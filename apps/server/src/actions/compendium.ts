/**
 * El compendio de una campaña (docs/specs/personajes.md § campana): el contenido del sistema que eligió, con sus
 * fuentes. Lo ve cualquiera de la campaña (no solo quien ve los sistemas de la cuenta), y solo lo de esas fuentes
 */
import { getCampaignCompendium, getCampaignContent, searchCampaignContent } from '@crisol/contracts'
import { systemsRepo } from '@crisol/db'
import { NotFoundError } from '@crisol/domain'
import {
  type Choices,
  type ContentEntry,
  type ContentItem,
  catalogSystem,
  compendiumEntry,
  compendiumTypes,
  normalizeChoices,
  type System,
  searchContent,
  type Text,
  textOf,
  visibleContent
} from '@crisol/systems'
import { catalogContent } from '@crisol/systems/catalog/content'
import { authorizedCampaign } from './access.ts'
import type { ActionContext } from './context.ts'
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
  const entries: ContentEntry[] = row
    ? await systemsRepo.contentIndex(ctx.db, row.id)
    : catalogContent(document.id).map((item) => ({
        key: item.key,
        type: item.type,
        source: item.source,
        concept: item.concept ?? null,
        name: item.data.name,
        automation: item.mechanics?.automation ?? null
      }))
  return { document, row, choices, entries }
}

export const compendiumActions = [
  implement(getCampaignCompendium, async (ctx, { campaignId }) => {
    const found = await campaignSystem(ctx, campaignId)
    if (!found) return { system: null, language: 'es' as const, sources: [], types: [] }
    const { document, choices, entries } = found
    const language = choices.language
    const say = (text: Text | undefined) => textOf(text, language)
    return {
      system: { id: document.id, name: say(document.name) },
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
      types: compendiumTypes(document, entries, choices).map((type) => ({
        ...type,
        label: say(type.label),
        fields: type.fields.map(({ options, ...f }) => ({
          ...f,
          label: say(f.label),
          ...(options ? { options: options.map((o) => ({ value: o.value, label: say(o.label) })) } : {})
        }))
      }))
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

  implement(getCampaignContent, async (ctx, { campaignId, keys }) => {
    const wanted = [...new Set(keys)]
    const found = await campaignSystem(ctx, campaignId)
    if (!found) return { items: [], missing: wanted }
    const { document, row, choices, entries } = found
    const seen = visibleContent(document, entries, choices)
    const shown = new Set(seen.map((s) => s.item.key))
    const visible = wanted.filter((k) => shown.has(k))
    const items: ContentItem[] = row
      ? (await systemsRepo.contentByKeys(ctx.db, row.id, visible)).map(contentOf)
      : catalogContent(document.id).filter((item) => visible.includes(item.key))
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
