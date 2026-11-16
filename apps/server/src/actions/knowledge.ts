/**
 * Lo que sabe cada campaña (ADR-0017, docs/specs/conocimiento.md): «Quién la conoce» de una página y marcar lo que se
 * sabe. Solo quien lleva la wiki; marcar es de tipo «jugadores» (en copiloto, la IA espera la aprobación)
 */
import {
  getItemKnowledge,
  getPageKnowledge,
  listKnownPages,
  type PageKnowledge,
  setKnowledge,
  setPageEditors
} from '@crisol/contracts'
import { campaignsRepo, charactersRepo, knowledgeRepo, operation, pagesRepo } from '@crisol/db'
import { explainPage, type KnowledgeMark, knowledgeFor, NotFoundError } from '@crisol/domain'
import { knowledgeChanged } from '../realtime/events.ts'
import { readDocument } from '../wiki/content.ts'
import { linksIn } from '../wiki/links.ts'
import { hasSeparates } from '../wiki/player-pages.ts'
import { authorizedPage, authorizedWiki, type WikiTarget } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'
import { campaignIn, widened } from './reveal.ts'

/** Lo que ve cada campaña del mundo de una página, y por qué */
async function pageKnowledgeOf(ctx: ActionContext, wiki: WikiTarget, pageId: string): Promise<PageKnowledge> {
  const [campaigns, tree, marks, editors] = await Promise.all([
    campaignsRepo.listCampaigns(ctx.db, { worldId: wiki.worldId, userId: ctx.actor.userId, onlyMember: false }),
    knowledgeRepo.worldTree(ctx.db, wiki.worldId),
    knowledgeRepo.listMarks(ctx.db, { worldId: wiki.worldId, campaignIds: 'all', kinds: ['page'] }),
    knowledgeRepo.pageEditorsOf(ctx.db, pageId)
  ])
  const editing = new Map(editors.map((e) => [e.campaignId, e.characters]))
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
        characters: own,
        editors: !editing.has(c.campaignId)
          ? ('none' as const)
          : (editing.get(c.campaignId) ?? null) === null
            ? ('all' as const)
            : (editing.get(c.campaignId) ?? []).map((id) => own.find((ch) => ch.id === id) ?? { id, name: '' })
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

  // El ojo de un pin, de algo dibujado o de una pestaña (como el del árbol): qué campaña entera lo ve, contando con que
  // conozca su página (eso se dice aparte)
  implement(getItemKnowledge, async (ctx, { worldId, kind, targetId }) => {
    const wiki = await authorizedWiki(ctx, 'page.write', worldId)
    const target = await knowledgeRepo.findTarget(ctx.db, wiki.worldId, kind, targetId)
    if (!target) throw new NotFoundError(kind)
    const [campaigns, tree, marks] = await Promise.all([
      campaignsRepo.listCampaigns(ctx.db, { worldId: wiki.worldId, userId: ctx.actor.userId, onlyMember: false }),
      knowledgeRepo.worldTree(ctx.db, wiki.worldId),
      knowledgeRepo.listMarks(ctx.db, { worldId: wiki.worldId, campaignIds: 'all', kinds: ['page', kind] })
    ])
    const pageId = target.pageId ?? ''
    const item = { kind, id: targetId, pageId, hidden: target.hidden ?? false }
    return {
      campaigns: campaigns.map((campaign) => {
        const reader = {
          kind: 'player' as const,
          campaignId: campaign.id,
          characterIds: [],
          knowsWorld: campaign.knowsWorld
        }
        const page: KnowledgeMark = {
          campaignId: campaign.id,
          kind: 'page',
          targetId: pageId,
          known: true,
          characters: null
        }
        const knowing = knowledgeFor(reader, tree, [...marks, page])
        return {
          campaignId: campaign.id,
          name: campaign.name,
          knows: item.kind === 'tab' ? knowing.seesTab(item) : knowing.seesMapItem({ ...item, kind: item.kind }),
          seesPage: knowledgeFor(reader, tree, marks).seesPage(pageId)
        }
      })
    }
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
    // Lo que escriben los jugadores se vuelve a mirar (una página que ya no ven no la abren)
    ctx.collab?.closeWorldPlayers(worldId)
    return { page: kind === 'page' ? await pageKnowledgeOf(ctx, wiki, targetId) : null }
  }),

  // Quién de una campaña escribe en una página: la ve (se suma a quien ya la ve) y, en vivo, solo su texto
  implement(setPageEditors, async (ctx, { worldId, campaignId: asked, pageId, editors }) => {
    const wiki = await authorizedWiki(ctx, 'page.write', worldId)
    const page = await pagesRepo.findPage(ctx.db, pageId)
    if (!page || page.worldId !== wiki.worldId) throw new NotFoundError('page')
    const campaign = await campaignIn(ctx, wiki, asked)
    const roster = await charactersRepo.listCharacters(ctx.db, campaign.id)
    const names = new Map(roster.map((c) => [c.id, c.name]))
    const chosen = Array.isArray(editors) ? editors : null
    const unknown = (chosen ?? []).filter((id) => !names.has(id))
    if (unknown.length > 0) throw new InvalidRequestError('BAD_CHARACTERS', unknown.join(', '))
    // Sin secretos ni notas ocultas: lo verían (el cuerpo va entero a quien lo edita)
    const body = editors === null ? null : await readDocument(ctx, { kind: 'body', pageId })
    if (body && hasSeparates(body))
      throw new InvalidRequestError('PAGE_HAS_SECRETS', 'quita antes sus secretos y notas ocultas')
    // Quien puede editarla la ve: se suma a quien ya la ve
    const [tree, marks] = await Promise.all([
      knowledgeRepo.worldTree(ctx.db, wiki.worldId),
      knowledgeRepo.listMarks(ctx.db, { worldId: wiki.worldId, campaignIds: [campaign.id] })
    ])
    const readerOf = (characterIds: readonly string[]) => ({
      kind: 'player' as const,
      campaignId: campaign.id,
      characterIds,
      knowsWorld: campaign.knowsWorld
    })
    // Ni enlaces a páginas que no conocen: en el cuerpo en vivo verían su título (cada uno de los que la editan)
    if (body) {
      const withPage = [
        ...marks,
        { campaignId: campaign.id, kind: 'page' as const, targetId: pageId, known: true, characters: chosen }
      ]
      const readers = (chosen ?? [null]).map((id) => knowledgeFor(readerOf(id ? [id] : []), tree, withPage))
      const hidden = linksIn(body).filter((link) => link.pageId && readers.some((r) => !r.seesPage(link.pageId ?? '')))
      if (hidden.length > 0)
        throw new InvalidRequestError(
          'PAGE_HAS_HIDDEN_LINKS',
          `enlaza páginas que no conocen: ${[...new Set(hidden.map((link) => link.title))].join(', ')}`
        )
    }
    const seen =
      editors === null
        ? null
        : widened(
            { tree, marks, roster: [...names.keys()], readerOf, campaignId: campaign.id },
            'page',
            pageId,
            { pageId: null, name: page.title },
            null,
            chosen
          )
    const details = {
      title: page.title,
      campaign: campaign.name,
      editors: editors === null ? 'none' : editors === 'all' ? 'all' : 'characters',
      ...(chosen ? { characters: chosen.map((id) => names.get(id) ?? '') } : {})
    }
    await operation(ctx.db, historyContext(ctx, 'setPageEditors', details, wiki), async (w) => {
      await knowledgeRepo.writeEditors(w, { worldId: wiki.worldId, campaignId: campaign.id, pageId, editors })
      if (seen)
        await knowledgeRepo.writeMark(w, {
          worldId: wiki.worldId,
          campaignId: campaign.id,
          kind: 'page',
          targetId: pageId,
          known: true,
          characters: seen.characters
        })
    })
    // Los jugadores conectados para escribir se cierran: al volver se mira otra vez si pueden
    ctx.collab?.closePlayers(pageId)
    ctx.realtime.publish(knowledgeChanged(wiki, campaign.id))
    return { ok: true as const }
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
