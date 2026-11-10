/**
 * El registro de la partida (docs/specs/registro.md, ADR-0022): los mensajes y los susurros de una campaña, mezclados
 * con sus tiradas al listar. A cada uno le llega (por tiempo real y por páginas) solo lo que puede ver: el máster, todo,
 * también los susurros entre jugadores (Enrique); los demás, lo de todos, lo suyo y lo que se les susurra
 */
import { deleteMessage, type LogEntry, type LogMessage, listLog, sendMessage } from '@crisol/contracts'
import { charactersRepo, creaturesRepo, diceRepo, logRepo, membersRepo } from '@crisol/db'
import { can, ForbiddenError, NotFoundError } from '@crisol/domain'
import { authorizedCampaign } from './access.ts'
import { type ActionContext, InvalidRequestError, TooManyRequestsError } from './context.ts'
import { present as presentRoll } from './dice.ts'
import { implement } from './registry.ts'

const PAGE = 50
/** El autor puede borrar lo suyo durante este rato */
const DELETE_WINDOW_MS = 5 * 60_000
/** El destinatario que son todos los másteres de la campaña y del mundo */
const MASTER = 'master'

type Campaign = { id: string; worldId: string }

const isMaster = (ctx: ActionContext, campaign: Campaign) =>
  can(ctx.actor, 'dice.private', { campaignId: campaign.id, worldId: campaign.worldId })

const colorOf = (color: string | null) => (color && /^#[0-9a-f]{6}$/i.test(color) ? color : null)

/** Un mensaje tal como lo ve la web, con los nombres de sus destinatarios */
function presentMessage(row: logRepo.MessageRow, names: ReadonlyMap<string, string>): LogEntry {
  const by = { userId: row.userId, name: row.name, color: colorOf(row.color) }
  const whisper = row.whisper?.map((id) => ({ id, name: id === MASTER ? '' : (names.get(id) ?? '') })) ?? null
  const base = {
    id: row.id,
    campaignId: row.campaignId,
    by,
    whisper,
    deleted: row.deletedAt !== null,
    createdAt: row.createdAt.toISOString()
  }
  if (row.kind === 'shown') return { kind: 'shown', ...base, shown: row.shown }
  return { kind: 'message', ...base, ai: row.ai, style: row.style, speaker: row.speaker, text: row.text }
}

const namesOf = async (ctx: ActionContext, campaignId: string) =>
  new Map((await membersRepo.listCampaignMembers(ctx.db, campaignId)).map((m) => [m.userId, m.name]))

/** Lo manda a quien lo puede ver: lo de todos, a la campaña; un susurro, a sus destinatarios, a quien lo escribe y a los másteres */
export function publishEntry(
  ctx: ActionContext,
  campaign: Campaign,
  entry: LogEntry,
  whisper: readonly string[] | null
) {
  const target = { campaignId: campaign.id, worldId: campaign.worldId }
  const message = { type: 'logged' as const, campaignId: campaign.id, entry }
  if (!whisper) return ctx.realtime.publish({ to: { capability: 'dice.read', target }, message })
  const users = new Set([ctx.actor.userId, ...whisper.filter((id) => id !== MASTER)])
  ctx.realtime.publish(...[...users].map((userId) => ({ to: { userId }, message })), {
    to: { capability: 'dice.private', target },
    message
  })
}

export const logActions = [
  implement(sendMessage, async (ctx, input) => {
    const campaign = await authorizedCampaign(ctx, 'dice.roll', input.campaignId)
    const master = isMaster(ctx, campaign)
    const names = await namesOf(ctx, campaign.id)
    // Quién habla: en personaje, su personaje (el que diga o el primero que juegue); el máster, también una criatura
    let speaker: LogMessage['speaker'] = { kind: 'user' }
    if (input.creatureId) {
      if (!master) throw new ForbiddenError('creature')
      const creature = await creaturesRepo.findCreature(ctx.db, input.creatureId)
      if (!creature || creature.campaignId !== campaign.id) throw new NotFoundError('creature')
      speaker = { kind: 'creature', id: creature.id, name: creature.name }
    } else if (input.characterId) {
      const character = await charactersRepo.findCharacter(ctx.db, input.characterId)
      if (!character || character.campaignId !== campaign.id) throw new NotFoundError('character')
      if (!master && character.ownerId !== ctx.actor.userId) throw new ForbiddenError('character')
      speaker = { kind: 'character', id: character.id, name: character.name }
    } else if (input.style !== 'ooc' && !master) {
      const [own] = await charactersRepo.listCharacters(ctx.db, campaign.id, ctx.actor.userId)
      if (own) speaker = { kind: 'character', id: own.id, name: own.name }
    }
    // Los destinatarios: de la campaña, o los másteres
    let whisper: string[] | null = null
    if (input.whisper) {
      const unique = [...new Set(input.whisper)]
      if (unique.some((id) => id !== MASTER && !names.has(id))) throw new InvalidRequestError('BAD_RECIPIENT')
      whisper = unique
    }
    const row = await logRepo.insertMessage(ctx.db, {
      campaignId: campaign.id,
      worldId: campaign.worldId,
      userId: ctx.actor.userId,
      ai: ctx.via === 'ai',
      style: input.style,
      speaker,
      text: input.text,
      whisper
    })
    if (!row) throw new TooManyRequestsError('TOO_MANY_MESSAGES')
    const entry = presentMessage(row, names)
    publishEntry(ctx, campaign, entry, whisper)
    return { entry: entry as LogMessage }
  }),

  implement(deleteMessage, async (ctx, { campaignId, id }) => {
    const campaign = await authorizedCampaign(ctx, 'dice.read', campaignId)
    const row = await logRepo.findMessage(ctx.db, campaign.id, id)
    const master = isMaster(ctx, campaign)
    // Lo que no puede ver, para ella no existe
    const sees =
      row &&
      (master || row.whisper === null || row.userId === ctx.actor.userId || row.whisper.includes(ctx.actor.userId))
    if (!row || !sees) throw new NotFoundError('message')
    const own = row.userId === ctx.actor.userId && Date.now() - row.createdAt.getTime() < DELETE_WINDOW_MS
    if (!master && !own) throw new ForbiddenError('message')
    if (row.deletedAt) return { ok: true as const }
    await logRepo.deleteMessage(ctx.db, row.id)
    const target = { campaignId: campaign.id, worldId: campaign.worldId }
    const message = { type: 'unlogged' as const, campaignId: campaign.id, id: row.id }
    if (!row.whisper) ctx.realtime.publish({ to: { capability: 'dice.read', target }, message })
    else
      ctx.realtime.publish(
        ...[...new Set([row.userId, ...row.whisper.filter((w) => w !== MASTER)])].map((userId) => ({
          to: { userId },
          message
        })),
        { to: { capability: 'dice.private', target }, message }
      )
    return { ok: true as const }
  }),

  implement(listLog, async (ctx, input) => {
    const campaign = await authorizedCampaign(ctx, 'dice.read', input.campaignId)
    const query = {
      campaignId: campaign.id,
      viewerId: ctx.actor.userId,
      master: isMaster(ctx, campaign),
      before: input.before ? new Date(input.before) : undefined,
      limit: PAGE + 1
    }
    const [messages, rolls, names] = await Promise.all([
      logRepo.listMessages(ctx.db, query),
      diceRepo.listRollsByTime(ctx.db, query),
      namesOf(ctx, campaign.id)
    ])
    const merged = [
      ...messages.map((row) => ({ at: row.createdAt, entry: presentMessage(row, names) })),
      ...rolls.map((row) => {
        const roll = presentRoll(row)
        return { at: row.createdAt, entry: { kind: 'roll' as const, id: roll.id, roll, createdAt: roll.createdAt } }
      })
    ].sort((a, b) => b.at.getTime() - a.at.getTime())
    const page = merged.slice(0, PAGE)
    const next = merged.length > PAGE ? (page.at(-1)?.at.toISOString() ?? null) : null
    return { entries: page.reverse().map((p) => p.entry), next }
  })
]
