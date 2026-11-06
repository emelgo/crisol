/**
 * Revelar en partida (docs/specs/revelar.md, ADR-0017): marcar que una campaña conoce algo y avisar a quien le aparece;
 * ocultarlo otra vez; «Lo que sabe el grupo»; quién conoce cada secreto de una página; lo nuevo de cada jugador
 */
import { getSecretsKnowledge, hide, listCampaignKnowledge, listNews, reveal, seeNews } from '@crisol/contracts'
import { campaignsRepo, charactersRepo, documentsRepo, knowledgeRepo, pagesRepo } from '@crisol/db'
import {
  explainPage,
  type Knowledge,
  type KnowledgeKind,
  type KnowledgeMark,
  knowledgeFor,
  NotFoundError
} from '@crisol/domain'
import { separateHeadings } from '@crisol/editor'
import { knowledgeChanged } from '../realtime/events.ts'
import { documentJson } from '../wiki/content.ts'
import { authorizedView, type WikiView } from '../wiki/reader.ts'
import { authorizedCampaign, authorizedPage, authorizedWiki, type WikiTarget } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

type Target = NonNullable<Awaited<ReturnType<typeof knowledgeRepo.findTarget>>>

/** La campaña de este mundo en la que se revela: la pedida o, si no se dice, la única */
async function campaignIn(ctx: ActionContext, wiki: WikiTarget, campaignId: string | undefined) {
  if (campaignId) {
    const campaign = await campaignsRepo.findCampaign(ctx.db, campaignId)
    if (!campaign || campaign.worldId !== wiki.worldId) throw new NotFoundError('campaign')
    return campaign
  }
  const all = await campaignsRepo.listCampaigns(ctx.db, {
    worldId: wiki.worldId,
    userId: ctx.actor.userId,
    onlyMember: false
  })
  const only = all.length === 1 ? all[0] : undefined
  if (!only) throw new InvalidRequestError('CAMPAIGN_REQUIRED', all.map((c) => `${c.name} (${c.id})`).join(', '))
  const campaign = await campaignsRepo.findCampaign(ctx.db, only.id)
  if (!campaign) throw new NotFoundError('campaign')
  return campaign
}

/** Si lo ve quien tiene esos personajes en la campaña, con esas marcas */
function sees(knowledge: Knowledge, kind: KnowledgeKind, targetId: string, target: Target) {
  const pageId = target.pageId ?? ''
  const hidden = target.hidden ?? false
  switch (kind) {
    case 'page':
      return knowledge.seesPage(targetId)
    case 'secret':
      return knowledge.seesSecret(targetId, pageId)
    case 'tab':
      return knowledge.seesTab({ id: targetId, pageId, hidden })
    case 'pin':
    case 'element':
      return knowledge.seesMapItem({ kind, id: targetId, pageId, hidden })
    case 'content':
      return knowledge.seesContent(targetId)
  }
}

/** Si lo ve quien lee, con su vista (lo mismo que sees, desde el servidor) */
function viewSees(view: WikiView, kind: KnowledgeKind, targetId: string, target: Target) {
  const pageId = target.pageId ?? ''
  const hidden = target.hidden ?? false
  switch (kind) {
    case 'page':
      return view.seesPage(targetId)
    case 'secret':
      return view.seesSecret(targetId, pageId)
    case 'tab':
      return view.seesTab({ id: targetId, pageId, hidden })
    case 'pin':
    case 'element':
      return view.seesMapItem({ kind, id: targetId, pageId, hidden })
    case 'content':
      return view.seesContent(targetId)
  }
}

/** El nombre de lo revelado para el aviso: un secreto, por el título de su sección (o el de su página) */
async function nameFor(ctx: ActionContext, kind: KnowledgeKind, targetId: string, target: Target) {
  if (kind !== 'secret' || !target.pageId) return target.name
  const body = await documentsRepo.findBody(ctx.db, target.pageId)
  if (!body) return target.name
  const place = separateHeadings(documentJson(ctx, { kind: 'body', pageId: target.pageId }, body.state)).get(targetId)
  return place?.heading ?? target.name
}

/** Lo que sabe una campaña de cada cosa con marca, lista para enseñarla («Lo que sabe el grupo») */
async function describeMarks(
  ctx: ActionContext,
  wiki: WikiTarget,
  rows: knowledgeRepo.KnowledgeRow[],
  names: Map<string, string>
) {
  const items = []
  for (const row of rows) {
    const target = await knowledgeRepo.findTarget(ctx.db, wiki.worldId, row.kind, row.targetId)
    if (!target) continue
    const pageTitle = target.pageId
      ? ((await pagesRepo.titlesOf(ctx.db, wiki.worldId, [target.pageId])).get(target.pageId) ?? null)
      : null
    items.push({
      kind: row.kind,
      targetId: row.targetId,
      name: await nameFor(ctx, row.kind, row.targetId, target),
      pageId: target.pageId,
      pageTitle,
      known: row.known,
      audience: row.characters ? row.characters.map((id) => ({ id, name: names.get(id) ?? '' })) : ('all' as const),
      at: row.updatedAt.toISOString()
    })
  }
  return items
}

export const revealActions = [
  implement(reveal, async (ctx, { worldId, campaignId: asked, kind, targetId, characters, alsoPage }) => {
    const wiki = await authorizedWiki(ctx, 'page.write', worldId)
    const campaign = await campaignIn(ctx, wiki, asked)
    const target = await knowledgeRepo.findTarget(ctx.db, wiki.worldId, kind, targetId)
    if (!target) throw new NotFoundError(kind)
    const roster = await charactersRepo.listCharacters(ctx.db, campaign.id)
    const names = new Map(roster.map((c) => [c.id, c.name]))
    const audience = characters ?? null
    if (audience?.some((id) => !names.has(id))) throw new InvalidRequestError('BAD_CHARACTERS')

    const [tree, before, players] = await Promise.all([
      knowledgeRepo.worldTree(ctx.db, wiki.worldId),
      knowledgeRepo.listMarks(ctx.db, { worldId: wiki.worldId, campaignIds: [campaign.id] }),
      knowledgeRepo.campaignPlayers(ctx.db, campaign.id)
    ])
    const readerOf = (characterIds: readonly string[]) => ({
      kind: 'player' as const,
      campaignId: campaign.id,
      characterIds,
      knowsWorld: campaign.knowsWorld
    })
    // ¿Conoce ese público la página donde está? (toda la campaña: sin personajes; si no, los elegidos)
    const pageId = kind === 'page' ? null : target.pageId
    const pageKnown = pageId ? knowledgeFor(readerOf(audience ?? []), tree, before).seesPage(pageId) : true
    const mark = { worldId: wiki.worldId, campaignId: campaign.id, known: true, characters: audience }
    const changes: knowledgeRepo.MarkChange[] = [{ ...mark, kind, targetId }]
    if (pageId && !pageKnown && alsoPage) changes.push({ ...mark, kind: 'page', targetId: pageId })
    const pageTitle = pageId ? ((await pagesRepo.titlesOf(ctx.db, wiki.worldId, [pageId])).get(pageId) ?? null) : null
    await knowledgeRepo.setMarks(
      ctx.db,
      historyContext(
        ctx,
        'reveal',
        {
          kind,
          name: target.name,
          campaign: campaign.name,
          ...(audience ? { characters: audience.map((id) => names.get(id) ?? '') } : {}),
          ...(changes.length > 1 && pageTitle ? { page: pageTitle } : {})
        },
        wiki
      ),
      changes
    )

    // A quién le aparece ahora (y antes no lo veía): lo nuevo y su aviso
    const after = await knowledgeRepo.listMarks(ctx.db, { worldId: wiki.worldId, campaignIds: [campaign.id] })
    const title = await nameFor(ctx, kind, targetId, target)
    const told = players.filter(
      (player) =>
        !sees(knowledgeFor(readerOf(player.characterIds), tree, before), kind, targetId, target) &&
        sees(knowledgeFor(readerOf(player.characterIds), tree, after), kind, targetId, target)
    )
    await knowledgeRepo.addNews(
      ctx.db,
      told.map((player) => ({ userId: player.userId, campaignId: campaign.id, kind, targetId, pageId: target.pageId }))
    )
    ctx.realtime.publish(
      knowledgeChanged(wiki, campaign.id),
      ...told.map((player) => ({
        to: { userId: player.userId },
        message: {
          type: 'revealed' as const,
          worldId: wiki.worldId,
          campaignId: campaign.id,
          kind,
          targetId,
          pageId: target.pageId,
          title
        }
      }))
    )
    return { told: told.length, pageUnknown: Boolean(pageId) && !pageKnown && !alsoPage }
  }),

  implement(hide, async (ctx, { campaignId, kind, targetId }) => {
    const campaign = await authorizedCampaign(ctx, 'campaign.read', campaignId)
    const wiki = await authorizedWiki(ctx, 'page.write', campaign.worldId)
    const target = await knowledgeRepo.findTarget(ctx.db, wiki.worldId, kind, targetId)
    if (!target) throw new NotFoundError(kind)
    // Sin su marca, ¿lo seguiría viendo alguien de la campaña (por el mundo o por su madre)? Entonces, «no la conocen»
    const [tree, marks, players] = await Promise.all([
      knowledgeRepo.worldTree(ctx.db, wiki.worldId),
      knowledgeRepo.listMarks(ctx.db, { worldId: wiki.worldId, campaignIds: [campaign.id] }),
      knowledgeRepo.campaignPlayers(ctx.db, campaign.id)
    ])
    const without: KnowledgeMark[] = marks.filter(
      (m) => !(m.campaignId === campaign.id && m.kind === kind && m.targetId === targetId)
    )
    const everyone = [...new Set(players.flatMap((p) => p.characterIds))]
    const reader = {
      kind: 'player' as const,
      campaignId: campaign.id,
      characterIds: everyone,
      knowsWorld: campaign.knowsWorld
    }
    const stillSeen = sees(knowledgeFor(reader, tree, without), kind, targetId, target)
    await knowledgeRepo.setMark(
      ctx.db,
      historyContext(ctx, 'hideKnowledge', { kind, name: target.name, campaign: campaign.name }, wiki),
      {
        worldId: wiki.worldId,
        campaignId: campaign.id,
        kind,
        targetId,
        known: stillSeen ? false : null,
        characters: null
      }
    )
    await knowledgeRepo.dropNews(ctx.db, campaign.id, kind, targetId)
    ctx.realtime.publish(knowledgeChanged(wiki, campaign.id))
    return { ok: true as const }
  }),

  implement(listCampaignKnowledge, async (ctx, { campaignId }) => {
    const campaign = await authorizedCampaign(ctx, 'campaign.read', campaignId)
    const wiki = await authorizedWiki(ctx, 'page.write', campaign.worldId)
    const names = new Map((await charactersRepo.listCharacters(ctx.db, campaign.id)).map((c) => [c.id, c.name]))
    const own = await knowledgeRepo.campaignRows(ctx.db, campaign.id)
    const world = campaign.knowsWorld ? await knowledgeRepo.worldRows(ctx.db, wiki.worldId) : []
    return {
      campaign: await describeMarks(ctx, wiki, own, names),
      world: await describeMarks(ctx, wiki, world, names),
      knowsWorld: campaign.knowsWorld
    }
  }),

  implement(getSecretsKnowledge, async (ctx, { pageId }) => {
    const { wiki } = await authorizedPage(ctx, 'page.write', pageId)
    const [campaigns, tree, marks, docs] = await Promise.all([
      campaignsRepo.listCampaigns(ctx.db, { worldId: wiki.worldId, userId: ctx.actor.userId, onlyMember: false }),
      knowledgeRepo.worldTree(ctx.db, wiki.worldId),
      knowledgeRepo.listMarks(ctx.db, { worldId: wiki.worldId, campaignIds: 'all' }),
      documentsRepo.documentsOfPages(ctx.db, [pageId])
    ])
    const rosters = new Map(
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
    const explained = explainPage(
      pageId,
      tree,
      marks.filter((m) => m.kind === 'page'),
      campaigns
    )
    const audienceOf = (campaignId: string, mark: KnowledgeMark | undefined) => {
      if (!mark?.known) return 'none' as const
      if (!mark.characters) return 'all' as const
      const roster = rosters.get(campaignId) ?? []
      return mark.characters.map((id) => roster.find((c) => c.id === id) ?? { id, name: '' })
    }
    return {
      secrets: docs
        .filter((d) => d.kind === 'secret')
        .map((d) => ({
          documentId: d.id,
          campaigns: campaigns.map((c) => ({
            campaignId: c.id,
            audience: audienceOf(
              c.id,
              marks.find((m) => m.campaignId === c.id && m.kind === 'secret' && m.targetId === d.id) ??
                (c.knowsWorld
                  ? marks.find((m) => m.campaignId === null && m.kind === 'secret' && m.targetId === d.id)
                  : undefined)
            )
          }))
        })),
      campaigns: campaigns.map((c, index) => {
        const page = explained.campaigns[index]?.audience ?? 'none'
        const roster = rosters.get(c.id) ?? []
        return {
          campaignId: c.id,
          name: c.name,
          seesPage:
            typeof page === 'string' ? page : page.map((id) => roster.find((ch) => ch.id === id) ?? { id, name: '' }),
          characters: roster
        }
      })
    }
  }),

  implement(listNews, async (ctx, { campaignId }) => {
    const campaign = await authorizedCampaign(ctx, 'campaign.read', campaignId)
    // Lo nuevo, solo de lo que sigue viendo (si se lo ocultaron, ya no está)
    const { view } = await authorizedView(ctx, campaign.worldId, { campaignId })
    const news = await knowledgeRepo.listNews(ctx.db, ctx.actor.userId, campaign.id)
    const kept = []
    for (const item of news) {
      const target = await knowledgeRepo.findTarget(ctx.db, campaign.worldId, item.kind, item.targetId)
      if (target && viewSees(view, item.kind, item.targetId, target)) kept.push(item)
    }
    return {
      news: kept.map((item) => ({
        kind: item.kind,
        targetId: item.targetId,
        pageId: item.pageId,
        at: item.createdAt.toISOString()
      }))
    }
  }),

  implement(seeNews, async (ctx, { campaignId, pageId, content }) => {
    await authorizedCampaign(ctx, 'campaign.read', campaignId)
    if (pageId) await knowledgeRepo.seeNews(ctx.db, ctx.actor.userId, campaignId, pageId)
    if (content) await knowledgeRepo.seeContentNews(ctx.db, ctx.actor.userId, campaignId, content)
    return { ok: true as const }
  })
]
