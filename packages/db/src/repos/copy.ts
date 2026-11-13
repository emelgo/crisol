/**
 * Duplicar una página con todo lo suyo en una sola operación (ADR-0024): su fila (portada, hoja, propiedades, panel,
 * plantilla), sus documentos (el cuerpo, sus secretos y notas, y los de sus pestañas de texto, que llegan ya hechos) y
 * sus pestañas, cada tipo con su forma de copiarse. Lo que hay en cada tabla se copia entero (sin su id ni lo que pone
 * el historial), así una columna nueva viaja sola
 */
import { keyBetween } from '@crisol/domain'
import { asc, eq, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation, type Writer } from '../operation.ts'
import { documents } from '../schema/documents.ts'
import { mapElements, mapLayers, mapPins, maps, pageTabs } from '../schema/maps.ts'
import { pages } from '../schema/pages.ts'
import { scenes, sceneTiles } from '../schema/scenes.ts'
import { randomTables } from '../schema/tables.ts'
import { sceneLights, sceneSounds, sceneWalls } from '../schema/vision.ts'
import { writeMark } from './knowledge.ts'
import { placeKey } from './pages.ts'
import { type DocumentState, recordVersion } from './versions.ts'

/** La geometría de una ruta, con los pines donde empieza y acaba cambiados por sus copias */
function withPins(geometry: Record<string, unknown>, pinIds: ReadonlyMap<string, string>) {
  const swap = (id: unknown) => (typeof id === 'string' ? (pinIds.get(id) ?? null) : id)
  return 'from' in geometry || 'to' in geometry
    ? {
        ...geometry,
        ...('from' in geometry ? { from: swap(geometry.from) } : {}),
        ...('to' in geometry ? { to: swap(geometry.to) } : {})
      }
    : geometry
}

/** Lo que pone el historial (o es de la fila de origen) y no se copia */
const OWN = ['id', 'version', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt'] as const

/** Una fila sin su id ni lo que pone el historial, con el mundo de destino (si la tabla lo lleva) */
function copied<T extends Record<string, unknown>>(row: T, worldId: string) {
  const rest: Record<string, unknown> = { ...row }
  for (const key of OWN) delete rest[key]
  if ('worldId' in rest) rest.worldId = worldId
  return rest
}

export interface PageCopy {
  sourceId: string
  title: string
  /** El cuerpo, con los ids nuevos de sus secretos y notas ya puestos */
  body: { id: string; state: Uint8Array } | null
  separates: readonly { id: string; kind: 'secret' | 'note'; state: Uint8Array }[]
  /** El documento de cada pestaña de texto, por el id del de la original */
  tabDocuments: ReadonlyMap<string, { id: string; state: Uint8Array }>
  /** Su primera versión, en la misma operación (deshacer la copia la quita también) */
  version?: { fingerprint: string; documents: DocumentState[] }
  /** Nace oculta a los jugadores (bajo una página que alguna campaña conoce) */
  hidden: boolean
  /** Adónde (otro mundo o rama: crear desde una plantilla); sin ello, justo detrás de la original */
  place?: { worldId: string; parentId: string | null; before?: string; after?: string }
  /** Lo que cambia en su fila (al crear desde una plantilla: su plantilla y su linaje) */
  overrides?: { template?: string | null; templateLine?: string[]; icon?: string | null; panel?: unknown[] }
  /** Lo que apunta a páginas concretas (pines, filas de tabla, campos): se queda (duplicar) o se suelta (plantilla) */
  links?: 'keep' | 'drop'
  /** Algo más en la misma operación, con la página ya hecha (la ficha de una plantilla) */
  alongside?: (w: Writer, page: { id: string }) => Promise<void>
}

type TabRow = typeof pageTabs.$inferSelect
/** Los tipos de pestaña (los de su columna): un tipo nuevo tiene que decir cómo se copia */
type TabKind = TabRow['kind']

/**
 * Cómo se copia lo de cada tipo de pestaña: de la original (from) a la nueva (to). tabIds, de las de la página; keep,
 * si lo que lleva a una página concreta se queda
 */
type TabCopy = (
  w: Writer,
  input: { from: TabRow; to: TabRow; worldId: string; tabIds: ReadonlyMap<string, string>; keep: boolean }
) => Promise<void>

const TAB_COPIES: Record<TabKind, TabCopy> = {
  // Su documento ya va con la pestaña
  text: async () => undefined,
  // El mapa (imagen y escala) con sus pines y sus elementos
  map: async (w, { from, to, worldId, keep }) => {
    const [map] = await w.read.select().from(maps).where(eq(maps.tabId, from.id))
    if (!map) return
    const copy = await w.insert(maps, { ...copied(map, worldId), tabId: to.id } as typeof maps.$inferInsert)
    const pins = await w.read
      .select()
      .from(mapPins)
      .where(eq(mapPins.mapId, map.id))
      .orderBy(asc(mapPins.createdAt), asc(mapPins.id))
    // Cada pin y cada capa, con su id nuevo ya escogido: las rutas que van de un pin a otro y lo de cada capa, a sus copias
    const pinIds = new Map(pins.map((pin) => [pin.id, crypto.randomUUID()]))
    if (pins.length > 0) {
      await w.insertMany(
        mapPins,
        pins.map(
          (pin) =>
            ({
              ...copied(pin, worldId),
              id: pinIds.get(pin.id),
              mapId: copy.id,
              ...(keep ? {} : { pageId: null })
            }) as typeof mapPins.$inferInsert
        )
      )
    }
    const layers = await w.read.select().from(mapLayers).where(eq(mapLayers.mapId, map.id))
    const layerIds = new Map(layers.map((layer) => [layer.id, crypto.randomUUID()]))
    if (layers.length > 0) {
      await w.insertMany(
        mapLayers,
        layers.map(
          (layer) =>
            ({ ...copied(layer, worldId), id: layerIds.get(layer.id), mapId: copy.id }) as typeof mapLayers.$inferInsert
        )
      )
    }
    const elements = await w.read
      .select()
      .from(mapElements)
      .where(eq(mapElements.mapId, map.id))
      .orderBy(asc(mapElements.createdAt), asc(mapElements.id))
    if (elements.length > 0) {
      await w.insertMany(
        mapElements,
        elements.map(
          (element) =>
            ({
              ...copied(element, worldId),
              mapId: copy.id,
              layerId: element.layerId ? (layerIds.get(element.layerId) ?? null) : null,
              geometry: withPins(element.geometry, pinIds),
              ...(keep ? {} : { pageId: null })
            }) as typeof mapElements.$inferInsert
        )
      )
    }
  },
  // La tabla aleatoria: sus filas, y las que llevan a otra tabla de la misma página, a su copia
  table: async (w, { from, to, worldId, tabIds, keep }) => {
    const [table] = await w.read.select().from(randomTables).where(eq(randomTables.tabId, from.id))
    if (!table) return
    const rows = table.rows.map((row) => {
      const linked = row.table && tabIds.has(row.table) ? { ...row, table: tabIds.get(row.table) } : row
      // Sin enlaces: la página a la que lleva se suelta; la otra tabla, si no es de esta página, también
      if (keep) return linked
      const { page: _page, ...rest } = linked
      return rest.table && !tabIds.has(row.table ?? '') ? { ...rest, table: null } : rest
    })
    await w.insert(randomTables, { ...copied(table, worldId), tabId: to.id, rows } as typeof randomTables.$inferInsert)
  },
  // La escena: su imagen (con sus teselas, que se comparten), muros, luces y sonidos. Lo de cada campaña no
  scene: async (w, { from, to, worldId, keep }) => {
    const [scene] = await w.read.select().from(scenes).where(eq(scenes.tabId, from.id))
    if (!scene) return
    // Sus pines (los que salen en la mesa al abrirla): sin enlaces, sin su página
    const pins = keep
      ? scene.pins
      : (scene.pins as { pageId?: string | null }[]).map((pin) => ({ ...pin, pageId: null }))
    const copy = await w.insert(scenes, { ...copied(scene, worldId), tabId: to.id, pins } as typeof scenes.$inferInsert)
    for (const table of [sceneWalls, sceneLights, sceneSounds] as const) {
      const rows = await w.read
        .select()
        .from(table)
        .where(eq(table.sceneId, scene.id))
        .orderBy(asc(table.createdAt), asc(table.id))
      if (rows.length > 0) {
        await w.insertMany(
          table,
          rows.map((row) => ({ ...copied(row, worldId), sceneId: copy.id })) as (typeof table.$inferInsert)[]
        )
      }
    }
    // Las teselas de su imagen: las mismas (sus bytes se guardan mientras alguna las nombre), sin historial
    const version = (scene.tiles as { version?: string } | null)?.version
    if (version) {
      await w.read.execute(sql`
        insert into ${sceneTiles} (scene_id, version, level, x, y, storage_key, bytes)
        select ${copy.id}, version, level, x, y, storage_key, bytes from ${sceneTiles}
        where scene_id = ${scene.id} and version = ${version}`)
    }
  }
}

/** Los campos de enlace, vacíos: una plantilla no apunta a páginas de un mundo */
const withoutLinks = (properties: unknown) =>
  Array.isArray(properties)
    ? properties.map((property) =>
        property && typeof property === 'object' && (property as { type?: string }).type === 'pages'
          ? { ...property, value: [] }
          : property
      )
    : properties

/** Duplica una página con todo lo suyo (detrás de ella, o donde se diga); devuelve la nueva */
export function copyPage(db: Database, context: OperationContext, input: PageCopy) {
  return operation(db, context, async (w) => {
    const [source] = await w.read.select().from(pages).where(eq(pages.id, input.sourceId))
    if (!source) throw new Error(`${input.sourceId} no existe`)
    const worldId = input.place?.worldId ?? source.worldId
    const keep = (input.links ?? 'keep') === 'keep'
    const position = await placeKey(
      w.read,
      worldId,
      input.place
        ? {
            parentId: input.place.parentId,
            ...(input.place.before ? { before: input.place.before } : {}),
            ...(input.place.after ? { after: input.place.after } : {})
          }
        : { parentId: source.parentId, after: source.id }
    )
    const { searchTsv: _generated, deletedAt: _trashed, ...row } = copied(source, worldId) as typeof source
    const page = await w.insert(pages, {
      ...row,
      parentId: input.place ? input.place.parentId : source.parentId,
      title: input.title,
      position,
      ...(keep ? {} : { properties: withoutLinks(source.properties) }),
      ...input.overrides
    } as typeof pages.$inferInsert)
    if (input.hidden) {
      await writeMark(w, { worldId, campaignId: null, kind: 'page', targetId: page.id, known: false, characters: null })
    }
    // Los documentos, sin historial (se van con la página al deshacer)
    const owner = { worldId, pageId: page.id, updatedBy: context.actorId }
    const docs: (typeof documents.$inferInsert)[] = [
      ...(input.body ? [{ ...owner, id: input.body.id, kind: 'body' as const, state: input.body.state }] : []),
      ...input.separates.map((separate) => ({ ...owner, ...separate })),
      ...[...input.tabDocuments.values()].map((doc) => ({
        ...owner,
        id: doc.id,
        kind: 'tab' as const,
        state: doc.state
      }))
    ]
    if (docs.length > 0) await w.read.insert(documents).values(docs)
    if (input.version) {
      const via = context.via === 'ai' ? 'ai' : context.via === 'system' ? 'system' : 'ui'
      await recordVersion(w, { pageId: page.id, worldId, actorId: context.actorId, via, ...input.version })
    }
    await copyTabs(w, { sourceId: source.id, pageId: page.id, worldId, keep, tabDocuments: input.tabDocuments })
    await input.alongside?.(w, page)
    return { id: page.id, title: page.title }
  })
}

/**
 * Las pestañas de una página (todas o las de `only`), copiadas a otra, en su orden y cada una con lo suyo: primero
 * todas (para saber sus ids; una tabla que lleva a otra la encuentra), luego lo de cada una. Con `after`, detrás de esa
 * clave (las que ya tenga la de destino); sin él, con sus puestos de la original. Devuelve las nuevas
 */
async function copyTabs(
  w: Writer,
  input: {
    sourceId: string
    pageId: string
    worldId: string
    keep: boolean
    tabDocuments: ReadonlyMap<string, { id: string; state: Uint8Array }>
    only?: ReadonlySet<string>
    after?: string | null
  }
) {
  const tabs = (
    await w.read
      .select()
      .from(pageTabs)
      .where(eq(pageTabs.pageId, input.sourceId))
      .orderBy(sql`${pageTabs.position} collate "C"`)
  ).filter((tab) => !input.only || input.only.has(tab.id))
  const made: { from: TabRow; to: TabRow }[] = []
  let last = input.after ?? null
  for (const tab of tabs) {
    const documentId = tab.documentId ? (input.tabDocuments.get(tab.documentId)?.id ?? null) : null
    const position = input.after === undefined ? tab.position : keyBetween(last, null)
    last = position
    const to = await w.insert(pageTabs, {
      ...copied(tab, input.worldId),
      pageId: input.pageId,
      documentId,
      position
    } as typeof pageTabs.$inferInsert)
    made.push({ from: tab, to })
  }
  const tabIds = new Map(made.map(({ from, to }) => [from.id, to.id]))
  for (const { from, to } of made) {
    await TAB_COPIES[from.kind](w, { from, to, worldId: input.worldId, tabIds, keep: input.keep })
  }
  return made.map(({ to }) => to)
}
