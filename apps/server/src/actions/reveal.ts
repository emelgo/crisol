/**
 * Revelar en partida (docs/specs/revelar.md, ADR-0017): marcar que una campaña conoce algo y avisar a quien le aparece;
 * ocultarlo otra vez; «Lo que sabe el grupo»; quién conoce cada secreto de una página; lo nuevo de cada jugador
 */
import {
  getSecretsKnowledge,
  hide,
  listCampaignKnowledge,
  listNews,
  reveal,
  seeNews,
  showPage
} from '@crisol/contracts'
import { campaignsRepo, charactersRepo, documentsRepo, knowledgeRepo, pagesRepo } from '@crisol/db'
import {
  explainPage,
  type Knowledge,
  type KnowledgeKind,
  type KnowledgeMark,
  knowledgeFor,
  NotFoundError,
  type Reader
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
export async function campaignIn(ctx: ActionContext, wiki: WikiTarget, campaignId: string | undefined) {
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

/**
 * Lo que se escribe al revelar: a quién lo verá, sumando lo pedido a quien ya lo ve (por su marca o heredado). Lo que
 * está en una página se mira como si la página se viera (si no se ve, lo dice pageUnknown). null: no hay que escribir
 * nada, porque ya lo ve toda la campaña o ya lo ven todos los pedidos
 */
export function widened(
  at: {
    tree: { id: string; parentId: string | null }[]
    marks: readonly KnowledgeMark[]
    roster: readonly string[]
    readerOf: (characterIds: readonly string[]) => Reader
    campaignId: string
  },
  kind: KnowledgeKind,
  targetId: string,
  target: Target,
  pageId: string | null,
  wanted: readonly string[] | null
): { characters: readonly string[] | null } | null {
  const marks: readonly KnowledgeMark[] = pageId
    ? [...at.marks, { campaignId: at.campaignId, kind: 'page', targetId: pageId, known: true, characters: null }]
    : at.marks
  const seen = (ids: readonly string[]) => sees(knowledgeFor(at.readerOf(ids), at.tree, marks), kind, targetId, target)
  if (seen([])) return null
  if (wanted === null) return { characters: null }
  const seeing = at.roster.filter((id) => seen([id]))
  const all = [...new Set([...seeing, ...wanted])]
  return all.length === seeing.length ? null : { characters: all }
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

/**
 * Lo que sabe una campaña de cada cosa con marca, lista para enseñarla («Lo que sabe el grupo»). De una vez: lo marcado
 * de cada tipo, los títulos de sus páginas y, de los secretos, el título de su sección (cada cuerpo se lee una vez)
 */
async function describeMarks(
  ctx: ActionContext,
  wiki: WikiTarget,
  rows: knowledgeRepo.KnowledgeRow[],
  names: Map<string, string>
) {
  const byKind = new Map<KnowledgeKind, string[]>()
  for (const row of rows) byKind.set(row.kind, [...(byKind.get(row.kind) ?? []), row.targetId])
  const targets = new Map<string, Target>()
  await Promise.all(
    [...byKind].map(async ([kind, ids]) => {
      for (const [id, target] of await knowledgeRepo.findTargets(ctx.db, wiki.worldId, kind, ids))
        targets.set(`${kind}|${id}`, target)
    })
  )
  const pageIds = [...new Set([...targets.values()].flatMap((t) => (t.pageId ? [t.pageId] : [])))]
  const withSecrets = [
    ...new Set(rows.flatMap((r) => (r.kind === 'secret' ? [targets.get(`secret|${r.targetId}`)?.pageId ?? ''] : [])))
  ].filter(Boolean)
  const [titles, bodies] = await Promise.all([
    pageIds.length > 0 ? pagesRepo.titlesOf(ctx.db, wiki.worldId, pageIds) : new Map<string, string>(),
    documentsRepo.bodiesOf(ctx.db, withSecrets)
  ])
  const headings = new Map<string, string>()
  for (const body of bodies) {
    if (!body.pageId) continue
    const doc = documentJson(ctx, { kind: 'body', pageId: body.pageId }, body.state)
    for (const [id, place] of separateHeadings(doc)) if (place.heading) headings.set(id, place.heading)
  }
  return rows.flatMap((row) => {
    const target = targets.get(`${row.kind}|${row.targetId}`)
    if (!target) return []
    return [
      {
        kind: row.kind,
        targetId: row.targetId,
        name: (row.kind === 'secret' ? headings.get(row.targetId) : undefined) ?? target.name,
        pageId: target.pageId,
        pageTitle: target.pageId ? (titles.get(target.pageId) ?? null) : null,
        known: row.known,
        audience: row.characters ? row.characters.map((id) => ({ id, name: names.get(id) ?? '' })) : ('all' as const),
        at: row.updatedAt.toISOString()
      }
    ]
  })
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
    // ¿Conoce ese público la página donde está? Toda la campaña, o cada uno de los elegidos
    const pageId = kind === 'page' ? null : target.pageId
    const seesPage = (ids: readonly string[]) =>
      pageId ? knowledgeFor(readerOf(ids), tree, before).seesPage(pageId) : true
    const pageKnown = audience ? audience.every((id) => seesPage([id])) : seesPage([])
    // Revelar solo suma: a quien ya lo ve (por su marca o heredado) no se le quita
    const widen = (kind: KnowledgeKind, targetId: string, target: Target, page: string | null) =>
      widened(
        { tree, marks: before, roster: [...names.keys()], readerOf, campaignId: campaign.id },
        kind,
        targetId,
        target,
        page,
        audience
      )
    const changes: knowledgeRepo.MarkChange[] = []
    const mark = { worldId: wiki.worldId, campaignId: campaign.id, known: true }
    const own = widen(kind, targetId, target, pageId)
    if (own) changes.push({ ...mark, kind, targetId, characters: own.characters })
    if (pageId && !pageKnown && alsoPage) {
      const page = widen('page', pageId, { pageId: null, name: '' }, null)
      if (page) changes.push({ ...mark, kind: 'page', targetId: pageId, characters: page.characters })
    }
    const pageTitle = pageId ? ((await pagesRepo.titlesOf(ctx.db, wiki.worldId, [pageId])).get(pageId) ?? null) : null
    if (changes.length > 0)
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
            ...(changes.some((c) => c.kind === 'page' && c.targetId === pageId) && pageTitle ? { page: pageTitle } : {})
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

  // Enseñar una página (como un diario en la mesa): se abre al momento a los jugadores de la campaña que la conocen
  implement(showPage, async (ctx, { campaignId, pageId }) => {
    const campaign = await authorizedCampaign(ctx, 'campaign.read', campaignId)
    const wiki = await authorizedWiki(ctx, 'page.write', campaign.worldId)
    const target = await knowledgeRepo.findTarget(ctx.db, wiki.worldId, 'page', pageId)
    if (!target) throw new NotFoundError('page')
    const [tree, marks, players] = await Promise.all([
      knowledgeRepo.worldTree(ctx.db, wiki.worldId),
      knowledgeRepo.listMarks(ctx.db, { worldId: wiki.worldId, campaignIds: [campaign.id] }),
      knowledgeRepo.campaignPlayers(ctx.db, campaign.id)
    ])
    const knows = players.filter((player) =>
      knowledgeFor(
        { kind: 'player', campaignId: campaign.id, characterIds: player.characterIds, knowsWorld: campaign.knowsWorld },
        tree,
        marks
      ).seesPage(pageId)
    )
    ctx.realtime.publish(
      ...knows.map((player) => ({
        to: { userId: player.userId },
        message: {
          type: 'shown' as const,
          worldId: wiki.worldId,
          campaignId: campaign.id,
          pageId,
          title: target.name
        }
      }))
    )
    return { shown: knows.length, unknown: players.length - knows.length }
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
    // Lo que escriben los jugadores se vuelve a mirar (una página que ya no ven no la abren)
    ctx.collab?.closeWorldPlayers(wiki.worldId)
    return { ok: true as const }
  }),

  implement(listCampaignKnowledge, async (ctx, { campaignId }) => {
    const campaign = await authorizedCampaign(ctx, 'campaign.read', campaignId)
    const wiki = await authorizedWiki(ctx, 'page.write', campaign.worldId)
    const names = new Map((await charactersRepo.listCharacters(ctx.db, campaign.id)).map((c) => [c.id, c.name]))
    const own = await knowledgeRepo.campaignRows(ctx.db, campaign.id)
    const world = campaign.knowsWorld ? await knowledgeRepo.worldRows(ctx.db, wiki.worldId) : []
    const [campaignItems, worldItems] = await Promise.all([
      describeMarks(ctx, wiki, own, names),
      describeMarks(ctx, wiki, world, names)
    ])
    return {
      campaign: campaignItems,
      world: worldItems,
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
