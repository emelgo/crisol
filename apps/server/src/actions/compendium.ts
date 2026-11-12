/**
 * El compendio de una campaña (docs/specs/personajes.md § campana): el contenido del sistema que eligió, con sus
 * fuentes. Lo ve cualquiera de la campaña (no solo quien ve los sistemas de la cuenta), y solo lo de esas fuentes. Con
 * el compendio de su mundo (docs/specs/compendio-mundo.md) para quien puede verlo: hasta el módulo 5, quien lleva el
 * mundo
 */
import {
  browseCampaignContent,
  browseSystemCompendium,
  getCampaignCompendium,
  getCampaignContent,
  getSystemCompendium,
  readSystemCompendium,
  resetContentTable,
  rollContentAction,
  rollContentTable,
  searchCampaignContent,
  searchSystemCompendium,
  visibilitiesFor
} from '@crisol/contracts'
import { chaptersRepo, systemImagesRepo, systemsRepo, tablesRepo, worldContentRepo } from '@crisol/db'
import { cryptoRoller, DiceSyntaxError } from '@crisol/dice'
import { authorize, can, NotFoundError } from '@crisol/domain'
import {
  browseContent,
  type Choices,
  type CompendiumType,
  type ContentEntry,
  type ContentItem,
  catalogSystem,
  compendiumEntry,
  compendiumSections,
  compendiumTypes,
  contentFingerprint,
  contentTables,
  creatureView,
  type Language,
  type Mechanics,
  mechanicsText,
  normalizeChoices,
  type Play,
  RollError,
  type System,
  searchContent,
  summarizeBooks,
  TABLE_DEPTH,
  TABLE_TYPE,
  type TableEntry,
  type Text,
  tableRowOf,
  textFieldOf,
  textOf,
  tryAction,
  visibleContent,
  withTables
} from '@crisol/systems'
import { contentSeen } from '../wiki/reader.ts'
import { authorizedCampaign } from './access.ts'
import { characterSheet } from './characters.ts'
import { type ActionContext, InvalidRequestError } from './context.ts'
import { rolled, saveRoll, storedOf } from './dice.ts'
import * as layers from './layers.ts'
import { implement } from './registry.ts'
import { readableOrganization } from './systems.ts'
import { type Drawn, pickRows } from './tables.ts'

/**
 * El sistema de una campaña que se puede leer, con lo que eligió de él y, si quien lo pide puede verlo, el compendio de
 * su mundo; sin sistema, null
 */
export async function campaignSystem(ctx: ActionContext, campaignId: string) {
  const campaign = await authorizedCampaign(ctx, 'campaign.read', campaignId)
  if (!campaign.system) return null
  const catalog = catalogSystem(campaign.system)
  const row = catalog ? null : await systemsRepo.findSystem(ctx.db, campaign.system)
  if (!catalog && (!row || row.deletedAt)) throw new NotFoundError('system')
  const document = withTables(catalog ?? (row?.document as unknown as System))
  const { choices } = normalizeChoices(document, (campaign.systemChoices ?? {}) as Partial<Choices>)
  const wiki = { worldId: campaign.worldId, organizationId: campaign.organizationId }
  // El compendio del mundo: entero para quien lo lleva; para un jugador, lo que se le reveló (docs/specs/compendio-jugadores.md)
  const master = can(ctx.actor, 'worldContent.read', wiki)
  let layer: layers.WorldLayer | null = null
  if (row && master) layer = { worldId: campaign.worldId, systemId: row.id }
  else if (row) {
    const seen = await contentSeen(ctx, wiki, campaignId)
    const keys = (await worldContentRepo.contentIndex(ctx.db, campaign.worldId, row.id))
      .map((entry) => entry.key)
      .filter((key) => seen?.(key) ?? true)
    layer = keys.length > 0 ? { worldId: campaign.worldId, systemId: row.id, only: new Set(keys) } : null
  }
  // Para la lista y los tipos basta lo de cada documento que se ve en ella: el de la cuenta, sin leerlo entero.
  // Un jugador no ve los tipos que la campaña le oculta
  const hidden = master ? [] : (campaign.hiddenTypes ?? [])
  const entries: ContentEntry[] = (row ? await layers.contentIndex(ctx, row.id, layer) : []).filter(
    (entry) => !hidden.includes(entry.type)
  )
  // `layer`: lo que se lee del mundo; `world`: el compendio del mundo como tal (su id, sus copias), solo del máster
  return { document, row, choices, entries, layer, world: master ? layer : null, wiki, hidden }
}

/** El id del objeto de la entrada en la hoja del personaje con el que se tira, mientras se tira */
const ENTRY_ITEM = 'entrada-del-compendio'

/** Lo que sale de una tirada, como mucho: las filas que se pisan y las tablas anidadas no la disparan */
const TABLE_RESULTS = 100

interface TableResult {
  text: string
  page: null
  content?: string
}

/** Lo de una tirada mientras se tira: lo sacado en cada tabla (lo de antes y lo de ahora) y lo que va saliendo */
interface Drawing {
  campaignId: string
  drawn: Map<string, Set<string>>
  results: TableResult[]
  draws: { key: string; rowId: string }[]
  open: (key: string) => Promise<ContentItem | null>
  shown: (key: string) => boolean
  nameOf: (entry: ContentItem) => string
}

/**
 * Tira en una entrada «Tabla» (con el cálculo de la pestaña «Tabla» de la wiki): las filas que salen entre las que no
 * se han sacado (ni en esta tirada) y, si alguna lleva a otra tabla que se ve, lo que sale en ella: hasta TABLE_DEPTH
 * niveles, sin volver a una tabla del camino y con TABLE_RESULTS resultados como mucho. Lo que sale va a `drawing`
 */
async function drawEntry(
  ctx: ActionContext,
  drawing: Drawing,
  entry: { key: string; name: string; table: TableEntry },
  path: readonly string[],
  prefix: string
): Promise<{ result: Drawn['result']; rows: string[] }> {
  const repeats = entry.table.replacement !== false
  let drawn = drawing.drawn.get(entry.key)
  if (!drawn) {
    drawn = new Set(repeats ? [] : await tablesRepo.contentDrawsOf(ctx.db, drawing.campaignId, entry.key))
    drawing.drawn.set(entry.key, drawn)
  }
  const { result, rows } = pickRows({ name: entry.name, formula: entry.table.formula, rows: entry.table.rows }, [
    ...drawn
  ])
  for (const row of rows) {
    if (drawing.results.length >= TABLE_RESULTS) break
    const linked = row.key && drawing.shown(row.key) ? row.key : null
    drawing.results.push({ text: `${prefix}${row.text}`, page: null, ...(linked ? { content: linked } : {}) })
    if (!repeats) {
      drawn.add(row.id)
      drawing.draws.push({ key: entry.key, rowId: row.id })
    }
    if (!linked || path.length > TABLE_DEPTH || path.includes(linked)) continue
    const nested = await drawing.open(linked)
    if (nested?.type !== TABLE_TYPE || !nested.table) continue
    const name = drawing.nameOf(nested)
    try {
      await drawEntry(
        ctx,
        drawing,
        { key: nested.key, name, table: nested.table },
        [...path, nested.key],
        `${prefix}${name}: `
      )
    } catch (error) {
      // Una anidada ya agotada: queda la fila de arriba
      if (!(error instanceof InvalidRequestError && error.code === 'TABLE_EMPTY')) throw error
    }
  }
  return { result, rows: rows.map((r) => r.id) }
}

/** Cuántas hay de cada tipo */
const countByType = (entries: readonly ContentEntry[]) => {
  const counts: Record<string, number> = {}
  for (const entry of entries) counts[entry.type] = (counts[entry.type] ?? 0) + 1
  return counts
}

/** Las claves de lo del mundo, para marcarlo en lo que sale */
const worldKeys = (entries: readonly (ContentEntry & { world?: true })[]) =>
  new Set(entries.filter((e) => e.world).map((e) => e.key))

export const compendiumActions = [
  implement(getCampaignCompendium, async (ctx, { campaignId }) => {
    const found = await campaignSystem(ctx, campaignId)
    if (!found)
      return {
        system: null,
        language: 'es' as const,
        sources: [],
        types: [],
        sections: [],
        editable: null,
        world: null
      }
    return compendiumView(ctx, found)
  }),

  implement(searchCampaignContent, async (ctx, { campaignId, layer, source, ...given }) => {
    const found = await campaignSystem(ctx, campaignId)
    if (!found) return { items: [], total: 0 }
    return searchView(found, { layer, source, ...given })
  }),

  implement(browseCampaignContent, async (ctx, { campaignId, type }) => {
    const found = await campaignSystem(ctx, campaignId)
    if (!found) return { items: [], folders: [], filters: [] }
    return browseView(ctx, found, type)
  }),

  // Una acción de una entrada (revisión, tanda 7): una criatura, con su hoja; un objeto o un conjuro, con la de un
  // personaje, como si lo llevara. A su registro, como las tiradas de las criaturas en juego
  implement(rollContentAction, async (ctx, { campaignId, key, action, characterId, visibility }) => {
    const campaign = await authorizedCampaign(ctx, 'dice.roll', campaignId)
    const master = can(ctx.actor, 'dice.private', { campaignId, worldId: campaign.worldId })
    if (!master && !visibilitiesFor('player').includes(visibility))
      throw new InvalidRequestError('VISIBILITY_NOT_ALLOWED')
    const found = await campaignSystem(ctx, campaignId)
    if (!found?.row) throw new NotFoundError('content')
    const { document, row, choices, entries, layer } = found
    if (!visibleContent(document, entries, choices).some((s) => s.item.key === key)) throw new NotFoundError('content')
    const [item] = await layers.contentByKeys(ctx, row.id, layer, [key])
    const kind = item ? document.types[item.type] : undefined
    if (!item || !kind) throw new NotFoundError('content')
    const name = textOf(item.data.name as Text | undefined, choices.language) || item.key
    const options = {
      roller: cryptoRoller,
      settings: choices.settings,
      language: choices.language,
      ...(action.level !== undefined ? { level: action.level } : {}),
      ...(action.mode !== undefined ? { mode: action.mode } : {}),
      ...(action.critical ? { critical: true } : {})
    }
    try {
      let rolledAction: ReturnType<typeof tryAction>
      let who = name
      if (kind.document === 'actor') {
        // Lo que tiene hoja propia (una criatura): con la suya, como si estuviera en juego sin nada gastado
        const played = creatureView(document, [item], choices, item, {} as Play)
        rolledAction = tryAction(document, item.type, played.document, null, action.key, options)
      } else {
        if (!characterId) throw new InvalidRequestError('CHARACTER_REQUIRED', 'di con qué personaje')
        const sheet = await characterSheet(ctx, characterId, campaignId)
        const carried = {
          ...sheet.doc,
          items: [
            ...(sheet.doc.items ?? []),
            {
              id: ENTRY_ITEM,
              type: item.type,
              name,
              data: item.data,
              ...(item.mechanics ? { mechanics: item.mechanics } : {})
            }
          ]
        }
        rolledAction = tryAction(document, sheet.type, carried, ENTRY_ITEM, action.key, options)
        who = `${sheet.name} · ${name}`
      }
      const parts =
        action.part === 'attack'
          ? rolledAction.attack
            ? [{ result: rolledAction.attack, type: undefined as string | undefined }]
            : []
          : action.part === 'heal'
            ? rolledAction.heal
              ? [{ result: rolledAction.heal.result, type: undefined }]
              : []
            : rolledAction.damage.map((d) => ({ result: d.result, type: d.type }))
      if (parts.length === 0) throw new InvalidRequestError('BAD_ROLL', 'esa acción no tiene eso')
      const stored = parts.map((p) => storedOf(p.result))
      const suffix = action.part === 'attack' ? '' : action.part === 'heal' ? ' · curación' : ' · daño'
      const view = await saveRoll(ctx, campaign, {
        formula: parts.map((p) => p.result.formula).join(' + '),
        // Sin repetir el nombre si la acción se llama como la entrada (un conjuro: «Thora · Flecha ácida · daño»)
        label: `${who}${rolledAction.label === name ? '' : ` · ${rolledAction.label}`}${suffix}`,
        visibility,
        result: {
          total: stored.reduce((n, p) => n + p.total, 0),
          detail: stored.map((p) => p.detail).join(' + '),
          critical: action.part === 'attack' ? (stored[0]?.critical ?? null) : null,
          dice: stored.flatMap((p) => p.dice),
          // Lo que se aplica después a quien lo recibe, como el de una criatura en juego
          ...(action.part === 'attack'
            ? {}
            : {
                apply: {
                  kind: action.part === 'heal' ? ('heal' as const) : ('damage' as const),
                  parts: parts.map((p, i) => ({ amount: stored[i]?.total ?? 0, type: p.type ?? null }))
                }
              })
        }
      })
      return { roll: view }
    } catch (error) {
      if (error instanceof RollError || error instanceof DiceSyntaxError)
        throw new InvalidRequestError('BAD_ROLL', error.message)
      throw error
    }
  }),

  implement(rollContentTable, async (ctx, { campaignId, key, table, visibility }) => {
    const campaign = await authorizedCampaign(ctx, 'dice.roll', campaignId)
    // Como en los dados: el máster, cualquiera; los jugadores, las suyas
    const master = can(ctx.actor, 'dice.private', { campaignId, worldId: campaign.worldId })
    if (!master && !visibilitiesFor('player').includes(visibility))
      throw new InvalidRequestError('VISIBILITY_NOT_ALLOWED')
    const found = await campaignSystem(ctx, campaignId)
    if (!found) throw new NotFoundError('content')
    const { document, row, choices, entries, layer } = found
    if (!visibleContent(document, entries, choices).some((s) => s.item.key === key)) throw new NotFoundError('content')
    const [item] = row ? await layers.contentByKeys(ctx, row.id, layer, [key]) : []
    if (!item) throw new NotFoundError('content')
    const nameOf = (entry: ContentItem) => textOf(entry.data.name as Text | undefined, choices.language) || entry.key
    if (table === undefined && item.table) {
      // Una entrada «Tabla»: sus filas, sin repetir lo sacado si va sin reemplazo, y las tablas a las que lleva
      const shown = new Set(visibleContent(document, entries, choices).map((s) => s.item.key))
      const drawing: Drawing = {
        campaignId,
        drawn: new Map(),
        results: [],
        draws: [],
        shown: (k) => shown.has(k),
        open: async (k) => {
          if (!row || !shown.has(k)) return null
          const [found] = await layers.contentByKeys(ctx, row.id, layer, [k])
          return found ?? null
        },
        nameOf
      }
      const name = nameOf(item)
      const drawnNow = await drawEntry(ctx, drawing, { key, name, table: item.table }, [key], '')
      const { formula, ...stored } = drawnNow.result
      const roll = await saveRoll(ctx, campaign, {
        formula,
        label: name,
        visibility,
        result: { ...stored, table: { name, results: drawing.results } }
      })
      // Ya en el registro: lo sacado, apuntado (si la tirada no se guardó, nada se gastó)
      const byTable = new Map<string, string[]>()
      for (const d of drawing.draws) byTable.set(d.key, [...(byTable.get(d.key) ?? []), d.rowId])
      for (const [k, rowIds] of byTable) await tablesRepo.addContentDraws(ctx.db, campaignId, k, rowIds)
      return {
        roll,
        row: item.table.rows.findIndex((r) => r.id === drawnNow.rows[0]),
        drawn: item.table.replacement === false ? await tablesRepo.contentDrawsOf(ctx.db, campaignId, key) : []
      }
    }
    const field = textFieldOf(document, item.type)
    const text = field ? textOf(item.data[field] as Text | undefined, choices.language) : ''
    // Sin orden: la tabla de su texto, si es una «Tabla» de antes (traída antes de que hubiera filas)
    if (table === undefined && item.type !== TABLE_TYPE) throw new InvalidRequestError('NOT_A_TABLE', 'no es una tabla')
    const chosen = contentTables(text)[table ?? 0]
    if (!chosen) throw new InvalidRequestError('BAD_TABLE', `no tiene la tabla ${table ?? 0}`)
    const result = rolled(chosen.formula)
    const hit = tableRowOf(chosen, result.total)
    const name = textOf(item.data.name as Text | undefined, choices.language) || item.key
    const roll = await saveRoll(ctx, campaign, {
      formula: result.formula,
      label: name,
      visibility,
      result: {
        ...storedOf(result),
        table: { name, results: hit ? [{ text: hit.cells.slice(1).join(' · '), page: null }] : [] }
      }
    })
    return { roll, row: hit ? chosen.rows.indexOf(hit) : null, drawn: [] }
  }),

  implement(resetContentTable, async (ctx, { campaignId, key }) => {
    const campaign = await authorizedCampaign(ctx, 'campaign.read', campaignId)
    // Lo sacado es de la partida: lo reinicia el máster
    if (!can(ctx.actor, 'dice.private', { campaignId, worldId: campaign.worldId })) throw new NotFoundError('content')
    await tablesRepo.resetContentDraws(ctx.db, campaignId, key)
    return { ok: true as const }
  }),

  implement(getCampaignContent, async (ctx, { campaignId, keys }) => {
    const wanted = [...new Set(keys)]
    const found = await campaignSystem(ctx, campaignId)
    if (!found) return { items: [], missing: wanted }
    return contentView(ctx, found, wanted, campaignId)
  }),

  // El compendio de un sistema (su espacio y sus libros, revisión tanda 6): lo mismo que el de una campaña, con todos
  // sus libros y sin lo de la partida (el mundo, lo que ven los jugadores, lo sacado de las tablas)
  implement(getSystemCompendium, async (ctx, { systemId, organizationId }) =>
    compendiumView(ctx, await systemScope(ctx, systemId, organizationId))
  ),

  implement(searchSystemCompendium, async (ctx, { systemId, organizationId, source, ...given }) =>
    searchView(await systemScope(ctx, systemId, organizationId), { source, ...given })
  ),

  implement(browseSystemCompendium, async (ctx, { systemId, organizationId, type }) =>
    browseView(ctx, await systemScope(ctx, systemId, organizationId), type)
  ),

  implement(readSystemCompendium, async (ctx, { systemId, organizationId, keys }) =>
    contentView(ctx, await systemScope(ctx, systemId, organizationId), [...new Set<string>(keys)], null)
  )
]

/** Lo que se lee del compendio: el de una campaña (campaignSystem) o el de un sistema entero (systemScope) */
type Scope = NonNullable<Awaited<ReturnType<typeof campaignSystem>>>

/**
 * El compendio de un sistema, sin campaña (su espacio y sus libros): todos sus libros, las dos ediciones de lo repetido
 * y nada del mundo. Lo lee quien puede leer los sistemas de su cuenta (y cualquiera, uno de serie)
 */
async function systemScope(ctx: ActionContext, systemId: string, organizationId: string | undefined): Promise<Scope> {
  const catalog = catalogSystem(systemId)
  const row = catalog ? null : await systemsRepo.findSystem(ctx.db, systemId)
  if (!catalog && (!row || row.deletedAt)) throw new NotFoundError('system')
  if (row) authorize(ctx.actor, 'systems.read', { organizationId: row.organizationId })
  else readableOrganization(ctx, organizationId)
  const document = withTables(catalog ?? (row?.document as unknown as System))
  const { choices: base } = normalizeChoices(document, {})
  const choices = { ...base, sources: (document.sources ?? []).map((s) => s.key), duplicates: 'both' as const }
  const entries: ContentEntry[] = row ? await layers.contentIndex(ctx, row.id, null) : []
  return {
    document,
    row,
    choices,
    entries,
    layer: null,
    world: null,
    wiki: { worldId: '', organizationId: row?.organizationId ?? '' },
    hidden: []
  }
}

async function compendiumView(ctx: ActionContext, found: Scope) {
  const { document, row, choices, entries, world, wiki, hidden } = found
  const language = choices.language
  // Los tipos que la campaña oculta a sus jugadores no salen (ni en sus secciones)
  const shownTypes = (types: CompendiumType[]) => types.filter((type) => !hidden.includes(type.key))
  const say = (text: Text | undefined) => textOf(text, language)
  // Cuánto trae cada libro (lo pendiente de revisar no cuenta) y cuánto deja fuera la campaña
  const books = new Map(
    summarizeBooks(document, entries, { excluded: choices.excluded ?? [], language }).map((b) => [b.key, b])
  )
  const chapters = row ? await chaptersRepo.chapterCounts(ctx.db, row.id) : new Map<string, number>()
  const typeView = (type: CompendiumType) => ({
    ...type,
    label: say(type.label),
    fields: type.fields.map(({ options, ...f }) => ({
      ...f,
      label: say(f.label),
      ...(options ? { options: options.map((o) => ({ value: o.value, label: say(o.label) })) } : {})
    }))
  })
  const editable =
    row && can(ctx.actor, 'systems.write', { organizationId: row.organizationId })
      ? {
          systemId: row.id,
          version: row.version,
          types: compendiumTypes(document, entries, choices, true).map(typeView)
        }
      : null
  return {
    system: { id: document.id, name: say(document.name) },
    editable,
    language,
    sources: (document.sources ?? [])
      .filter((s) => choices.sources.includes(s.key))
      .map((s) => {
        const summary = books.get(s.key)
        return {
          key: s.key,
          name: say(s.name),
          edition: s.edition ?? null,
          license: s.license,
          attribution: say(s.attribution),
          description: s.description ? say(s.description) : null,
          cover: s.cover ?? null,
          requires: s.requires ?? [],
          count: (summary?.count ?? 0) - (summary?.excluded ?? 0),
          excluded: summary?.excluded ?? 0,
          chapters: chapters.get(s.key) ?? 0
        }
      }),
    sections: compendiumSections(document, shownTypes(compendiumTypes(document, entries, choices)))
      .filter((section) => section.types.length > 0)
      .map((section) => ({
        key: section.key,
        label: say(section.label),
        types: section.types.map((type) => ({ key: type.key, label: say(type.label) }))
      })),
    types: shownTypes(compendiumTypes(document, entries, choices)).map(typeView),
    world: world
      ? {
          worldId: world.worldId,
          systemId: world.systemId,
          writable: can(ctx.actor, 'worldContent.write', wiki),
          count: worldKeys(entries).size,
          byType: countByType(entries.filter((e) => (e as { world?: true }).world)),
          types: compendiumTypes(document, entries, choices, true).map(typeView)
        }
      : null
  }
}

function searchView(
  found: Scope,
  {
    layer,
    source,
    ...given
  }: { layer?: 'system' | 'world' | undefined; source?: string | undefined } & Partial<
    Parameters<typeof searchContent>[2]
  >
) {
  const { document, choices, entries: all } = found
  const own = worldKeys(all)
  // Solo una capa o un libro, si se pide: se filtra antes de paginar
  const entries = all.filter(
    (e) => (!layer || own.has(e.key) === (layer === 'world')) && (!source || e.source === source)
  )
  const result = searchContent(document, entries, {
    sources: choices.sources,
    excluded: choices.excluded ?? [],
    duplicates: choices.duplicates,
    language: choices.language,
    ...given
  })
  return { ...result, items: result.items.map((hit) => (own.has(hit.key) ? { ...hit, world: true } : hit)) }
}

async function browseView(ctx: ActionContext, found: Scope, type: string) {
  const { document, row, choices, hidden } = found
  if (hidden.includes(type)) return { items: [], folders: [], filters: [] }
  // Las carpetas salen de sus valores: de un sistema de la cuenta, el contenido de ese tipo entero (con lo del mundo
  // que se ve: un jugador, lo revelado)
  const items = row ? await layers.contentOfType(ctx, row.id, found.layer, type) : []
  const own = new Set(items.filter((i) => i.world).map((i) => i.key))
  // Su imagen, si el sistema la tiene
  const images = row
    ? await systemImagesRepo.existingPaths(
        ctx.db,
        row.id,
        items.flatMap((i) => (i.img ? [i.img] : []))
      )
    : new Map()
  const imgOf = new Map(items.flatMap((i) => (i.img && images.has(i.img) ? [[i.key, i.img] as const] : [])))
  const result = browseContent(document, items, {
    type,
    sources: choices.sources,
    excluded: choices.excluded ?? [],
    duplicates: choices.duplicates,
    language: choices.language
  })
  return {
    ...result,
    items: result.items.map((item) => ({
      ...item,
      ...(own.has(item.key) ? { world: true } : {}),
      ...(imgOf.has(item.key) ? { img: imgOf.get(item.key) } : {})
    }))
  }
}

/** Leer unas entradas; con campaignId, también lo ya sacado de sus tablas sin reemplazo */
async function contentView(ctx: ActionContext, found: Scope, wanted: string[], campaignId: string | null) {
  const { document, row, choices, entries, layer, world } = found
  const seen = visibleContent(document, entries, choices)
  const shown = new Set(seen.map((s) => s.item.key))
  const visible = wanted.filter((k) => shown.has(k))
  const items: ContentItem[] = row ? await layers.contentByKeys(ctx, row.id, layer, visible) : []
  const byKey = new Map(items.map((item) => [item.key, item]))
  const own = world ? await worldEntries(ctx, world, choices.language, visible) : new Map<string, WorldView>()
  const images = row
    ? await systemImagesRepo.existingPaths(
        ctx.db,
        row.id,
        items.flatMap((i) => (i.img ? [i.img] : []))
      )
    : new Map()
  const name = (value: unknown) =>
    typeof value === 'string' ? value : textOf(value as Text | undefined, choices.language)
  // Las tablas sin reemplazo: lo ya sacado en esta campaña
  const once = items.filter((i) => i.table?.replacement === false).map((i) => i.key)
  const draws = campaignId ? await tablesRepo.contentDrawsByKeys(ctx.db, campaignId, once) : new Map<string, string[]>()
  return {
    items: visible.flatMap((k) => {
      const item = byKey.get(k)
      if (!item) return []
      const entry = compendiumEntry(document, seen, item)
      // Lo del mundo como tal (su id, su origen) va en `world`, solo para el máster
      const { world: _, ...copy } = structuredClone(item) as ContentItem & { world?: unknown }
      return [
        {
          ...copy,
          ...entry,
          // Con sus datos: una criatura tira con lo suyo (su ataque y su daño, ya calculados)
          play: mechanicsText(document, item.type, item.mechanics as Mechanics | undefined, choices.language, {
            data: item.data as Record<string, unknown>
          }),
          ...(item.img && images.has(item.img)
            ? {
                image: {
                  credit: images.get(item.img)?.credit ?? null,
                  license: images.get(item.img)?.license ?? 'unknown'
                }
              }
            : {}),
          ...(own.has(k) ? { world: own.get(k) } : {}),
          ...(once.includes(k) ? { drawn: draws.get(k) ?? [] } : {}),
          granted: entry.granted.map((g) =>
            'choose' in g
              ? { level: g.level, choose: textOf(g.choose, choices.language), count: g.count }
              : { level: g.level, key: g.key, type: g.type, name: name(g.name) }
          )
        }
      ]
    }),
    missing: wanted.filter((k) => !byKey.has(k))
  }
}

/** Lo que se dice de una entrada del mundo al leerla */
interface WorldView {
  id: string
  version: number
  origin: {
    layer: 'system' | 'world'
    systemId: string
    key: string
    name: string | null
    changed: boolean
    missing: boolean
  } | null
}

/** De lo del mundo: su id, su versión y, si es una copia, cómo está su original */
async function worldEntries(ctx: ActionContext, world: layers.WorldLayer, language: Language, keys: readonly string[]) {
  const rows = await worldContentRepo.contentByKeys(ctx.db, world.worldId, world.systemId, keys)
  // Los originales de las copias, de una vez por sistema (los del mundo, uno a uno: son raros)
  const bySystem = new Map<string, string[]>()
  for (const row of rows)
    if (row.origin?.layer === 'system')
      bySystem.set(row.origin.systemId, [...(bySystem.get(row.origin.systemId) ?? []), row.origin.key])
  const originals = new Map<string, { key: string; type: string; data: Record<string, unknown>; mechanics: unknown }>()
  for (const [systemId, wanted] of bySystem)
    for (const found of await systemsRepo.contentByKeys(ctx.db, systemId, wanted))
      originals.set(`${systemId}:${found.key}`, found)
  const entries = new Map<string, WorldView>()
  for (const row of rows) {
    const origin = row.origin
    let view: WorldView['origin'] = null
    if (origin) {
      const original =
        origin.layer === 'world'
          ? (
              await worldContentRepo.contentByKeys(ctx.db, origin.worldId ?? world.worldId, origin.systemId, [
                origin.key
              ])
            )[0]
          : originals.get(`${origin.systemId}:${origin.key}`)
      view = {
        layer: origin.layer,
        systemId: origin.systemId,
        key: origin.key,
        name: original ? textOf(original.data.name as Text | undefined, language) || original.key : null,
        changed: original ? contentFingerprint(original) !== origin.fingerprint : false,
        missing: !original
      }
    }
    entries.set(row.key, { id: row.id, version: row.version, origin: view })
  }
  return entries
}
