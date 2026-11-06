/**
 * Lo que sabe cada campaña (ADR-0017, docs/specs/conocimiento.md): «Quién la conoce» de una página y marcar lo que se
 * sabe. Solo quien lleva la wiki; marcar es de tipo «jugadores» (en copiloto, la IA espera la aprobación)
 */
import { getPageKnowledge, listKnownPages, type PageKnowledge, setKnowledge } from '@crisol/contracts'
import { campaignsRepo, charactersRepo, knowledgeRepo, pagesRepo } from '@crisol/db'
import { explainPage, knowledgeFor, NotFoundError } from '@crisol/domain'
import { knowledgeChanged } from '../realtime/events.ts'
import { authorizedPage, authorizedWiki, type WikiTarget } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

/** Lo que ve cada campaña del mundo de una página, y por qué */
async function pageKnowledgeOf(ctx: ActionContext, wiki: WikiTarget, pageId: string): Promise<PageKnowledge> {
  const [campaigns, tree, marks] = await Promise.all([
    campaignsRepo.listCampaigns(ctx.db, { worldId: wiki.worldId, userId: ctx.actor.userId, onlyMember: false }),
    knowledgeRepo.worldTree(ctx.db, wiki.worldId),
    knowledgeRepo.listMarks(ctx.db, { worldId: wiki.worldId, campaignIds: 'all', kinds: ['page'] })
  ])
  const explained = explainPage(pageId, tree, marks, campaigns)
  const characters = new Map(
    await Promise.all(
      campaigns.map(
        async (c) =>
          [
            c.id,
            (await charactersRepo.listCharacters(ctx.db, c.id)).map((ch) => ({ id: ch.id, name: ch.name }))
          ] as const
      )
    )
  )
  const sources = [explained.world.from, ...explained.campaigns.map((c) => c.from)].flatMap((f) =>
    f ? [f.pageId] : []
  )
  const titles = await pagesRepo.titlesOf(ctx.db, wiki.worldId, sources)
  const source = (from: { pageId: string; layer: 'world' | 'campaign' } | null) =>
    from ? { ...from, title: titles.get(from.pageId) ?? '' } : null
  return {
    pageId,
    world: {
      own: explained.world.own?.known ?? null,
      known: explained.world.known,
      from: source(explained.world.from)
    },
    campaigns: explained.campaigns.map((c, index) => {
      const campaign = campaigns[index]
      const own = characters.get(c.campaignId) ?? []
      return {
        campaignId: c.campaignId,
        name: campaign?.name ?? '',
        knowsWorld: campaign?.knowsWorld ?? true,
        own: c.own ? { known: c.own.known, characters: c.own.characters ? [...c.own.characters] : null } : null,
        audience:
          typeof c.audience === 'string'
            ? c.audience
            : c.audience.map((id) => own.find((ch) => ch.id === id) ?? { id, name: '' }),
        from: source(c.from),
        characters: own
      }
    })
  }
}

export const knowledgeActions = [
  implement(listKnownPages, async (ctx, { worldId }) => {
    const wiki = await authorizedWiki(ctx, 'page.write', worldId)
    const [campaigns, tree, marks] = await Promise.all([
      campaignsRepo.listCampaigns(ctx.db, { worldId: wiki.worldId, userId: ctx.actor.userId, onlyMember: false }),
      knowledgeRepo.worldTree(ctx.db, wiki.worldId),
      knowledgeRepo.listMarks(ctx.db, { worldId: wiki.worldId, campaignIds: 'all', kinds: ['page'] })
    ])
    if (marks.length === 0) return { pageIds: [] }
    const known = new Set<string>()
    // Cada campaña con todos sus personajes: lo que conoce alguno de ellos cuenta
    for (const campaign of campaigns) {
      const characterIds = (await charactersRepo.listCharacters(ctx.db, campaign.id)).map((c) => c.id)
      const reader = { kind: 'player' as const, campaignId: campaign.id, characterIds, knowsWorld: campaign.knowsWorld }
      for (const id of knowledgeFor(reader, tree, marks).visiblePages()) known.add(id)
    }
    // Y lo que sabe todo el mundo, aunque no haya campañas
    const world = { kind: 'player' as const, campaignId: '', characterIds: [], knowsWorld: true }
    for (const id of knowledgeFor(world, tree, marks).visiblePages()) known.add(id)
    return { pageIds: [...known] }
  }),

  implement(getPageKnowledge, async (ctx, { pageId }) => {
    const { wiki } = await authorizedPage(ctx, 'page.write', pageId)
    return pageKnowledgeOf(ctx, wiki, pageId)
  }),

  implement(setKnowledge, async (ctx, { worldId, campaignId, kind, targetId, known, characters }) => {
    const wiki = await authorizedWiki(ctx, 'page.write', worldId)
    // La campaña, de este mundo
    const campaign = campaignId ? await campaignsRepo.findCampaign(ctx.db, campaignId) : null
    if (campaignId && (!campaign || campaign.worldId !== worldId)) throw new NotFoundError('campaign')
    // Lo que se marca, de este mundo
    const target = await knowledgeRepo.findTarget(ctx.db, worldId, kind, targetId)
    if (!target) throw new NotFoundError(kind)
    // Los personajes, de esa campaña (en el mundo no hay personajes)
    const audience = characters ?? null
    if (audience && !campaignId) throw new InvalidRequestError('CHARACTERS_NEED_CAMPAIGN')
    const names = new Map<string, string>()
    if (audience && campaignId) {
      for (const ch of await charactersRepo.listCharacters(ctx.db, campaignId)) names.set(ch.id, ch.name)
      const unknown = audience.filter((id) => !names.has(id))
      if (unknown.length > 0) throw new InvalidRequestError('BAD_CHARACTERS', unknown.join(', '))
    }
    const details = {
      kind,
      name: target.name,
      campaign: campaign?.name ?? null,
      known,
      ...(audience && known ? { characters: audience.map((id) => names.get(id) ?? '') } : {})
    }
    await knowledgeRepo.setMark(ctx.db, historyContext(ctx, 'setKnowledge', details, wiki), {
      worldId,
      campaignId,
      kind,
      targetId,
      known,
      characters: audience
    })
    ctx.realtime.publish(knowledgeChanged(wiki, campaignId))
    return { page: kind === 'page' ? await pageKnowledgeOf(ctx, wiki, targetId) : null }
  })
]

/** Lo que pide la IA al marcar, para la cola de aprobación: qué, si lo conocen y a quién (como en el historial) */
export async function knowledgeRequest(ctx: ActionContext, action: string, input: Record<string, unknown>) {
  if (!['setKnowledge', 'reveal', 'hide'].includes(action) || typeof input.targetId !== 'string') return {}
  // Ocultar dice la campaña, no el mundo
  const worldId =
    typeof input.worldId === 'string'
      ? input.worldId
      : typeof input.campaignId === 'string'
        ? ((await campaignsRepo.findCampaign(ctx.db, input.campaignId))?.worldId ?? '')
        : ''
  const wiki = await authorizedWiki(ctx, 'page.write', worldId)
  const kind = String(input.kind) as Parameters<typeof knowledgeRepo.findTarget>[2]
  const target = await knowledgeRepo.findTarget(ctx.db, wiki.worldId, kind, input.targetId)
  if (!target) throw new NotFoundError(kind)
  const ids = Array.isArray(input.characters) ? input.characters.map(String) : []
  const names =
    ids.length > 0 && typeof input.campaignId === 'string'
      ? (await charactersRepo.listCharacters(ctx.db, input.campaignId))
          .filter((c) => ids.includes(c.id))
          .map((c) => c.name)
      : []
  const known = action === 'reveal' ? true : action === 'hide' ? false : (input.known ?? null)
  return { kind, name: target.name, known, ...(names.length > 0 ? { characters: names } : {}) }
}
