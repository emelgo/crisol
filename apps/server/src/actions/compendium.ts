/**
 * El compendio de una campaña (docs/specs/personajes.md § campana): el contenido del sistema que eligió, con sus
 * fuentes. Lo ve cualquiera de la campaña (no solo quien ve los sistemas de la cuenta), y solo lo de esas fuentes
 */
import {
  browseCampaignContent,
  getCampaignCompendium,
  getCampaignContent,
  rollContentTable,
  searchCampaignContent,
  visibilitiesFor
} from '@crisol/contracts'
import { systemsRepo } from '@crisol/db'
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
  contentTables,
  type Mechanics,
  mechanicsText,
  normalizeChoices,
  type System,
  searchContent,
  type Text,
  tableRowOf,
  textFieldOf,
  textOf,
  visibleContent
} from '@crisol/systems'
import { authorizedCampaign } from './access.ts'
import { type ActionContext, InvalidRequestError } from './context.ts'
import { rolled, saveRoll, storedOf } from './dice.ts'
import { implement } from './registry.ts'
import { contentOf } from './systems.ts'

/** El sistema de una campaña que se puede leer, con lo que eligió de él; sin sistema, null */
async function campaignSystem(ctx: ActionContext, campaignId: string) {
  const campaign = await authorizedCampaign(ctx, 'campaign.read', campaignId)
  if (!campaign.system) return null
  const catalog = catalogSystem(campaign.system)
  const row = catalog ? null : await systemsRepo.findSystem(ctx.db, campaign.system)
  if (!catalog && (!row || row.deletedAt)) throw new NotFoundError('system')
  const document = catalog ?? (row?.document as unknown as System)
  const { choices } = normalizeChoices(document, (campaign.systemChoices ?? {}) as Partial<Choices>)
  // Para la lista y los tipos basta lo de cada documento que se ve en ella: el de la cuenta, sin leerlo entero
  const entries: ContentEntry[] = row ? await systemsRepo.contentIndex(ctx.db, row.id) : []
  return { document, row, choices, entries }
}

export const compendiumActions = [
  implement(getCampaignCompendium, async (ctx, { campaignId }) => {
    const found = await campaignSystem(ctx, campaignId)
    if (!found) return { system: null, language: 'es' as const, sources: [], types: [], sections: [], editable: null }
    const { document, row, choices, entries } = found
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
      types: compendiumTypes(document, entries, choices).map(typeView)
    }
  }),

  implement(searchCampaignContent, async (ctx, { campaignId, ...given }) => {
    const found = await campaignSystem(ctx, campaignId)
    if (!found) return { items: [], total: 0 }
    const { document, choices, entries } = found
    return searchContent(document, entries, {
      sources: choices.sources,
      duplicates: choices.duplicates,
      language: choices.language,
      ...given
    })
  }),

  implement(browseCampaignContent, async (ctx, { campaignId, type }) => {
    const found = await campaignSystem(ctx, campaignId)
    if (!found) return { items: [], folders: [], filters: [] }
    const { document, row, choices } = found
    // Las carpetas salen de sus valores: de un sistema de la cuenta, el contenido de ese tipo entero
    const items: ContentItem[] = row ? (await systemsRepo.listContentOfType(ctx.db, row.id, type)).map(contentOf) : []
    return browseContent(document, items, {
      type,
      sources: choices.sources,
      duplicates: choices.duplicates,
      language: choices.language
    })
  }),

  implement(rollContentTable, async (ctx, { campaignId, key, table, visibility }) => {
    const campaign = await authorizedCampaign(ctx, 'dice.roll', campaignId)
    // Como en los dados: el máster, cualquiera; los jugadores, las suyas
    const master = can(ctx.actor, 'dice.private', { campaignId, worldId: campaign.worldId })
    if (!master && !visibilitiesFor('player').includes(visibility))
      throw new InvalidRequestError('VISIBILITY_NOT_ALLOWED')
    const found = await campaignSystem(ctx, campaignId)
    if (!found) throw new NotFoundError('content')
    const { document, row, choices, entries } = found
    if (!visibleContent(document, entries, choices).some((s) => s.item.key === key)) throw new NotFoundError('content')
    const [item] = row ? (await systemsRepo.contentByKeys(ctx.db, row.id, [key])).map(contentOf) : []
    if (!item) throw new NotFoundError('content')
    const field = textFieldOf(document, item.type)
    const text = field ? textOf(item.data[field] as Text | undefined, choices.language) : ''
    const chosen = contentTables(text)[table]
    if (!chosen) throw new InvalidRequestError('BAD_TABLE', `no tiene la tabla ${table}`)
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
    return { roll, row: hit ? chosen.rows.indexOf(hit) : null }
  }),

  implement(getCampaignContent, async (ctx, { campaignId, keys }) => {
    const wanted = [...new Set(keys)]
    const found = await campaignSystem(ctx, campaignId)
    if (!found) return { items: [], missing: wanted }
    const { document, row, choices, entries } = found
    const seen = visibleContent(document, entries, choices)
    const shown = new Set(seen.map((s) => s.item.key))
    const visible = wanted.filter((k) => shown.has(k))
    const items: ContentItem[] = row ? (await systemsRepo.contentByKeys(ctx.db, row.id, visible)).map(contentOf) : []
    const byKey = new Map(items.map((item) => [item.key, item]))
    const name = (value: unknown) =>
      typeof value === 'string' ? value : textOf(value as Text | undefined, choices.language)
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
