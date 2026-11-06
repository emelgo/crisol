/**
 * El compendio de una campaña (docs/specs/personajes.md § campana): el contenido del sistema que eligió, con sus
 * fuentes. Lo ve cualquiera de la campaña (no solo quien ve los sistemas de la cuenta), y solo lo de esas fuentes. Con
 * el compendio de su mundo (docs/specs/compendio-mundo.md) para quien puede verlo: hasta el módulo 5, quien lleva el
 * mundo
 */
import {
  browseCampaignContent,
  getCampaignCompendium,
  getCampaignContent,
  resetContentTable,
  rollContentTable,
  searchCampaignContent,
  visibilitiesFor
} from '@crisol/contracts'
import { systemImagesRepo, systemsRepo, tablesRepo, worldContentRepo } from '@crisol/db'
import { can, NotFoundError } from '@crisol/domain'
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
  type Language,
  type Mechanics,
  mechanicsText,
  normalizeChoices,
  type System,
  searchContent,
  TABLE_DEPTH,
  TABLE_TYPE,
  type TableEntry,
  type Text,
  tableRowOf,
  textFieldOf,
  textOf,
  visibleContent,
  withTables
} from '@crisol/systems'
import { authorizedCampaign } from './access.ts'
import { type ActionContext, InvalidRequestError } from './context.ts'
import { rolled, saveRoll, storedOf } from './dice.ts'
import * as layers from './layers.ts'
import { implement } from './registry.ts'
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
  const world: layers.WorldLayer | null =
    row && can(ctx.actor, 'worldContent.read', wiki) ? { worldId: campaign.worldId, systemId: row.id } : null
  // Para la lista y los tipos basta lo de cada documento que se ve en ella: el de la cuenta, sin leerlo entero
  const entries: ContentEntry[] = row ? await layers.contentIndex(ctx, row.id, world) : []
  return { document, row, choices, entries, world, wiki }
}

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
    const { document, row, choices, entries, world, wiki } = found
    const language = choices.language
    const say = (text: Text | undefined) => textOf(text, language)
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
        .map((s) => ({
          key: s.key,
          name: say(s.name),
          edition: s.edition ?? null,
          license: s.license,
          attribution: say(s.attribution)
        })),
      sections: compendiumSections(document, compendiumTypes(document, entries, choices)).map((section) => ({
        key: section.key,
        label: say(section.label),
        types: section.types.map((type) => ({ key: type.key, label: say(type.label) }))
      })),
      types: compendiumTypes(document, entries, choices).map(typeView),
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
  }),

  implement(searchCampaignContent, async (ctx, { campaignId, layer, ...given }) => {
    const found = await campaignSystem(ctx, campaignId)
    if (!found) return { items: [], total: 0 }
    const { document, choices, entries: all } = found
    const own = worldKeys(all)
    // Solo una capa, si se pide: se filtra antes de paginar
    const entries = layer ? all.filter((e) => own.has(e.key) === (layer === 'world')) : all
    const result = searchContent(document, entries, {
      sources: choices.sources,
      duplicates: choices.duplicates,
      language: choices.language,
      ...given
    })
    return { ...result, items: result.items.map((hit) => (own.has(hit.key) ? { ...hit, world: true } : hit)) }
  }),

  implement(browseCampaignContent, async (ctx, { campaignId, type }) => {
    const found = await campaignSystem(ctx, campaignId)
    if (!found) return { items: [], folders: [], filters: [] }
    const { document, row, choices, world } = found
    // Las carpetas salen de sus valores: de un sistema de la cuenta, el contenido de ese tipo entero
    const items = row ? await layers.contentOfType(ctx, row.id, world, type) : []
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
  }),

  implement(rollContentTable, async (ctx, { campaignId, key, table, visibility }) => {
    const campaign = await authorizedCampaign(ctx, 'dice.roll', campaignId)
    // Como en los dados: el máster, cualquiera; los jugadores, las suyas
    const master = can(ctx.actor, 'dice.private', { campaignId, worldId: campaign.worldId })
    if (!master && !visibilitiesFor('player').includes(visibility))
      throw new InvalidRequestError('VISIBILITY_NOT_ALLOWED')
    const found = await campaignSystem(ctx, campaignId)
    if (!found) throw new NotFoundError('content')
    const { document, row, choices, entries, world } = found
    if (!visibleContent(document, entries, choices).some((s) => s.item.key === key)) throw new NotFoundError('content')
    const [item] = row ? await layers.contentByKeys(ctx, row.id, world, [key]) : []
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
          const [found] = await layers.contentByKeys(ctx, row.id, world, [k])
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
    const { document, row, choices, entries, world } = found
    const seen = visibleContent(document, entries, choices)
    const shown = new Set(seen.map((s) => s.item.key))
    const visible = wanted.filter((k) => shown.has(k))
    const items: ContentItem[] = row ? await layers.contentByKeys(ctx, row.id, world, visible) : []
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
    const draws = await tablesRepo.contentDrawsByKeys(ctx.db, campaignId, once)
    return {
      items: visible.flatMap((k) => {
        const item = byKey.get(k)
        if (!item) return []
        const entry = compendiumEntry(document, seen, item)
        return [
          {
            ...structuredClone(item),
            ...entry,
            play: mechanicsText(document, item.type, item.mechanics as Mechanics | undefined, choices.language),
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
  })
]

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
