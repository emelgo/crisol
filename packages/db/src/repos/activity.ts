/**
 * El centro de actividad de una campaña (docs/specs/modulo-8-10-campana.md, decisiones 19-23): la última visita de cada
 * cuenta y lo que ha pasado desde entonces, leído del historial (las operaciones con su campaña) y del registro. Quién
 * ve qué lo decide quien lo llama
 */
import { and, eq, gt, inArray, isNull, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { campaignVisits } from '../schema/activity.ts'
import { user } from '../schema/auth.ts'
import { campaignMembers, campaigns } from '../schema/campaigns.ts'
import { characters } from '../schema/characters.ts'
import { changes, operations } from '../schema/history.ts'
import { playerNotes } from '../schema/notes.ts'

/** Cuándo vio por última vez la cuenta el centro de la campaña (null: nunca) */
export async function lastVisit(db: Database, userId: string, campaignId: string): Promise<Date | null> {
  const [found] = await db
    .select({ seenAt: campaignVisits.seenAt })
    .from(campaignVisits)
    .where(and(eq(campaignVisits.userId, userId), eq(campaignVisits.campaignId, campaignId)))
  return found?.seenAt ?? null
}

/** Lo ha visto ahora */
export async function markSeen(db: Database, userId: string, campaignId: string): Promise<Date> {
  const [row] = await db
    .insert(campaignVisits)
    .values({ userId, campaignId })
    .onConflictDoUpdate({ target: [campaignVisits.userId, campaignVisits.campaignId], set: { seenAt: sql`now()` } })
    .returning({ seenAt: campaignVisits.seenAt })
  if (!row) throw new Error('campaign_visits: sin fila tras guardar')
  return row.seenAt
}

/** Desde cuándo está la cuenta en la campaña (o, si no está en ella, desde cuándo existe la campaña) */
export async function memberSince(db: Database, userId: string, campaignId: string): Promise<Date | null> {
  const [member] = await db
    .select({ at: campaignMembers.createdAt })
    .from(campaignMembers)
    .where(and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.userId, userId)))
  if (member) return member.at
  const [campaign] = await db.select({ at: campaigns.createdAt }).from(campaigns).where(eq(campaigns.id, campaignId))
  return campaign?.at ?? null
}

/** Lo que hicieron otros (o la IA) en la campaña desde entonces y sigue hecho: solo eso cuenta como nuevo */
const othersSince = (input: { campaignId: string; since: Date; viewerId: string }) =>
  and(
    eq(operations.campaignId, input.campaignId),
    gt(operations.createdAt, input.since),
    isNull(operations.undoneById),
    isNull(operations.undoesId),
    sql`(${operations.actorId} is distinct from ${input.viewerId} or ${operations.via} = 'ai')`
  )

export interface ChangedRow {
  tableName: string
  rowId: string
  at: Date
  actorId: string | null
  ai: boolean
  created: boolean
  count: number
  after: Record<string, unknown> | null
}

/** Las filas de esas tablas que cambiaron otros desde entonces, una por fila con su último cambio (las más recientes antes) */
export async function changedRows(
  db: Database,
  input: { campaignId: string; since: Date; viewerId: string; tables: readonly string[]; limit: number }
): Promise<ChangedRow[]> {
  const rows = await db
    .select({
      tableName: changes.tableName,
      rowId: changes.rowId,
      at: sql<Date>`max(${operations.createdAt})`.mapWith(operations.createdAt),
      actorId: sql<string | null>`(array_agg(${operations.actorId} order by ${operations.createdAt} desc))[1]`,
      ai: sql<boolean>`(array_agg(${operations.via} = 'ai' order by ${operations.createdAt} desc))[1]`,
      created: sql<boolean>`bool_or(${changes.before} is null)`,
      count: sql<number>`count(*)::int`,
      after: sql<Record<string, unknown> | null>`(array_agg(${changes.after} order by ${operations.createdAt} desc))[1]`
    })
    .from(changes)
    .innerJoin(operations, eq(operations.id, changes.operationId))
    .where(and(othersSince(input), inArray(changes.tableName, [...input.tables])))
    .groupBy(changes.tableName, changes.rowId)
    .orderBy(sql`max(${operations.createdAt}) desc`)
    .limit(input.limit)
  return rows
}

/** Las operaciones de esas acciones (los cambios de fecha) desde entonces, de otros o de todos (onlyOthers false) */
export function operationsSince(
  db: Database,
  input: { campaignId: string; since: Date; viewerId: string; actions: readonly string[]; onlyOthers: boolean }
) {
  const where = input.onlyOthers
    ? othersSince(input)
    : and(
        eq(operations.campaignId, input.campaignId),
        gt(operations.createdAt, input.since),
        isNull(operations.undoneById),
        isNull(operations.undoesId)
      )
  return db
    .select({
      id: operations.id,
      action: operations.action,
      details: operations.details,
      actorId: operations.actorId,
      via: operations.via,
      createdAt: operations.createdAt
    })
    .from(operations)
    .where(and(where, inArray(operations.action, [...input.actions])))
    .orderBy(sql`${operations.createdAt} desc`)
    .limit(100)
}

export interface LogDay {
  day: string
  messages: number
  rolls: number
  shown: number
}

/**
 * El registro desde entonces, resumido por día real (en esa zona horaria): lo que escribieron, tiraron o enseñaron
 * otros y ve quien mira (el máster, todo; los demás, lo de todos y lo que se les susurra; de las tiradas, las públicas).
 * Las entradas del sistema no cuentan: los cambios de fecha salen aparte
 */
export async function logByDay(
  db: Database,
  input: { campaignId: string; since: Date; viewerId: string; master: boolean; timeZone: string }
): Promise<LogDay[]> {
  const sees = input.master ? sql`true` : sql`(m.whisper is null or ${input.viewerId} = any(m.whisper))`
  const seesRoll = input.master ? sql`true` : sql`r.visibility = 'all'`
  const rows = await db.execute<{ day: string; messages: number; rolls: number; shown: number }>(sql`
    with entries as (
      select to_char(m.created_at at time zone ${input.timeZone}, 'YYYY-MM-DD') as day, m.kind as kind
        from campaign_messages m
        where m.campaign_id = ${input.campaignId} and m.created_at > ${input.since.toISOString()} and m.deleted_at is null
          and m.kind <> 'event' and (m.user_id <> ${input.viewerId} or m.ai) and ${sees}
      union all
      select to_char(r.created_at at time zone ${input.timeZone}, 'YYYY-MM-DD'), 'roll'
        from dice_rolls r
        where r.campaign_id = ${input.campaignId} and r.created_at > ${input.since.toISOString()}
          and r.user_id <> ${input.viewerId} and ${seesRoll}
    )
    select day,
      count(*) filter (where kind = 'message')::int as messages,
      count(*) filter (where kind = 'roll')::int as rolls,
      count(*) filter (where kind = 'shown')::int as shown
    from entries group by day order by day desc limit 60`)
  return [...rows]
}

/** Los nombres de unas cuentas */
export async function userNames(db: Database, ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const rows = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(inArray(user.id, [...new Set(ids)]))
  return new Map(rows.map((row) => [row.id, row.name]))
}

/** Unas notas de jugador de la campaña, fuera de la papelera */
export function notesById(db: Database, campaignId: string, ids: readonly string[]) {
  if (ids.length === 0) return Promise.resolve([])
  return db
    .select({ id: playerNotes.id, title: playerNotes.title, userId: playerNotes.userId })
    .from(playerNotes)
    .where(
      and(eq(playerNotes.campaignId, campaignId), inArray(playerNotes.id, [...ids]), isNull(playerNotes.deletedAt))
    )
}

/** Unos personajes de la campaña */
export function charactersById(db: Database, campaignId: string, ids: readonly string[]) {
  if (ids.length === 0) return Promise.resolve([])
  return db
    .select({ id: characters.id, name: characters.name, ownerId: characters.ownerId })
    .from(characters)
    .where(and(eq(characters.campaignId, campaignId), inArray(characters.id, [...ids])))
}
