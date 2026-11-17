/**
 * El centro de actividad de una campaña (docs/specs/modulo-8-10-campana.md, decisiones 4 y 19-23): lo que ha pasado
 * desde la última visita de quien lo mira, leído del historial (las operaciones con su campaña) y del registro, con lo
 * que puede ver. Al máster, las notas y los personajes de los jugadores, lo revelado por otros (o por la IA) y los
 * cambios de fecha; a la jugadora, lo que le revelan (lo nuevo suyo) y los cambios de fecha; a los dos, el registro
 * resumido por día real. La última visita solo se pone al marcarlo como visto
 */
import { type ActivityItem, getCampaignActivity, markActivitySeen } from '@crisol/contracts'
import { activityRepo, knowledgeRepo } from '@crisol/db'
import type { KnowledgeKind } from '@crisol/domain'
import { authorizedView } from '../wiki/reader.ts'
import { authorizedCampaign } from './access.ts'
import { leadsCampaign } from './campaign-dates.ts'
import { type ActionContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'
import { viewSees } from './reveal.ts'

/** Lo más que se enseña de una vez */
const MAX_ITEMS = 100
/** Las acciones que cambian el «hoy» */
const DATE_ACTIONS = ['setCampaignToday', 'travel']

type Campaign = { id: string; worldId: string }
type Query = { campaignId: string; since: Date; viewerId: string }

/** Una zona horaria que entiende Postgres y el navegador (IANA): si no, BAD_TIME_ZONE */
function checkTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone })
  } catch {
    throw new InvalidRequestError('BAD_TIME_ZONE', `«${timeZone}» no es una zona horaria`)
  }
}

/** Las notas, los personajes y lo revelado (a la campaña) que cambiaron otros: lo del máster */
async function masterItems(ctx: ActionContext, campaign: Campaign, query: Query): Promise<ActivityItem[]> {
  const rows = await activityRepo.changedRows(ctx.db, {
    ...query,
    tables: ['player_notes', 'characters', 'knowledge'],
    limit: MAX_ITEMS * 2
  })
  const of = (table: string) => rows.filter((row) => row.tableName === table)
  const notes = await activityRepo.notesById(
    ctx.db,
    campaign.id,
    of('player_notes').map((row) => row.rowId)
  )
  const characters = await activityRepo.charactersById(
    ctx.db,
    campaign.id,
    of('characters').map((row) => row.rowId)
  )
  const names = await activityRepo.userNames(ctx.db, [
    ...rows.flatMap((row) => (row.actorId ? [row.actorId] : [])),
    ...characters.flatMap((c) => (c.ownerId ? [c.ownerId] : []))
  ])
  const person = (id: string | null) => (id ? { id, name: names.get(id) ?? '' } : null)
  const items: ActivityItem[] = []
  for (const row of rows) {
    const at = row.at.toISOString()
    if (row.tableName === 'player_notes') {
      const note = notes.find((n) => n.id === row.rowId)
      if (note)
        items.push({
          type: 'note',
          noteId: note.id,
          title: note.title,
          by: person(row.actorId),
          created: row.created,
          at
        })
    } else if (row.tableName === 'characters') {
      const character = characters.find((c) => c.id === row.rowId)
      if (character)
        items.push({
          type: 'character',
          characterId: character.id,
          name: character.name,
          owner: person(character.ownerId),
          by: person(row.actorId),
          created: row.created,
          changes: row.count,
          at
        })
    } else {
      // Lo revelado a esta campaña (no lo que se le oculta, ni la capa del mundo)
      const mark = row.after as {
        kind?: KnowledgeKind
        target_id?: string
        known?: boolean
        campaign_id?: string
      } | null
      if (!mark?.known || mark.campaign_id !== campaign.id || !mark.kind || !mark.target_id) continue
      const target = await knowledgeRepo.findTarget(ctx.db, campaign.worldId, mark.kind, mark.target_id)
      if (target)
        items.push({
          type: 'revealed',
          kind: mark.kind,
          targetId: mark.target_id,
          pageId: target.pageId,
          title: target.name,
          at
        })
    }
  }
  return items
}

/** Lo que le han revelado y aún es nuevo para ella, de lo que sigue viendo: lo de la jugadora */
async function playerItems(ctx: ActionContext, campaign: Campaign, query: Query): Promise<ActivityItem[]> {
  const { view } = await authorizedView(ctx, campaign.worldId, { campaignId: campaign.id })
  const items: ActivityItem[] = []
  for (const news of await knowledgeRepo.listNews(ctx.db, ctx.actor.userId, campaign.id)) {
    if (news.createdAt <= query.since) continue
    const target = await knowledgeRepo.findTarget(ctx.db, campaign.worldId, news.kind, news.targetId)
    if (!target || !viewSees(view, news.kind, news.targetId, target)) continue
    items.push({
      type: 'revealed',
      kind: news.kind,
      targetId: news.targetId,
      pageId: news.pageId,
      title: target.name,
      at: news.createdAt.toISOString()
    })
  }
  return items
}

/** Los cambios de fecha de otros (o de la IA): sus textos son los del registro, sin lo solo del máster */
async function dateItems(ctx: ActionContext, query: Query): Promise<ActivityItem[]> {
  const ops = await activityRepo.operationsSince(ctx.db, { ...query, actions: DATE_ACTIONS, onlyOthers: true })
  return ops.map((op) => ({
    type: 'date' as const,
    to: typeof op.details.to === 'string' ? op.details.to : '',
    days: typeof op.details.days === 'number' ? op.details.days : null,
    travel: op.action === 'travel',
    ai: op.via === 'ai',
    at: op.createdAt.toISOString()
  }))
}

export const activityActions = [
  implement(getCampaignActivity, async (ctx, { campaignId, timeZone }) => {
    const campaign = await authorizedCampaign(ctx, 'campaign.read', campaignId)
    checkTimeZone(timeZone)
    const master = leadsCampaign(ctx, campaign)
    const viewerId = ctx.actor.userId
    const seen = await activityRepo.lastVisit(ctx.db, viewerId, campaign.id)
    const since = seen ?? (await activityRepo.memberSince(ctx.db, viewerId, campaign.id)) ?? new Date(0)
    const query = { campaignId: campaign.id, since, viewerId }
    const items = [
      ...(master ? await masterItems(ctx, campaign, query) : await playerItems(ctx, campaign, query)),
      ...(await dateItems(ctx, query))
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, MAX_ITEMS)
    const log = await activityRepo.logByDay(ctx.db, { ...query, master, timeZone })
    const count = items.length + log.reduce((sum, day) => sum + day.messages + day.rolls + day.shown, 0)
    return { since: seen?.toISOString() ?? null, count, items, log }
  }),

  implement(markActivitySeen, async (ctx, { campaignId }) => {
    const campaign = await authorizedCampaign(ctx, 'campaign.read', campaignId)
    const seenAt = await activityRepo.markSeen(ctx.db, ctx.actor.userId, campaign.id)
    return { seenAt: seenAt.toISOString() }
  })
]
