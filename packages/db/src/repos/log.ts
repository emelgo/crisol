/**
 * El registro de la partida (docs/specs/registro.md, ADR-0022): los mensajes y lo enseñado de una campaña, leídos por
 * quién los ve. El máster ve todo, también los susurros entre jugadores (Enrique); los demás, lo de todos, lo suyo y lo
 * que les susurran. No pasa por operation(): no se deshace
 */
import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { user } from '../schema/auth.ts'
import { campaignMessages, type MessageSpeaker, type ShownData } from '../schema/log.ts'

/** Cuántos mensajes puede mandar una cuenta por minuto */
export const MESSAGES_PER_MINUTE = 40

const view = {
  id: campaignMessages.id,
  campaignId: campaignMessages.campaignId,
  userId: campaignMessages.userId,
  name: user.name,
  color: user.diceColor,
  ai: campaignMessages.ai,
  kind: campaignMessages.kind,
  style: campaignMessages.style,
  speaker: campaignMessages.speaker,
  text: campaignMessages.text,
  whisper: campaignMessages.whisper,
  shown: campaignMessages.shown,
  deletedAt: campaignMessages.deletedAt,
  createdAt: campaignMessages.createdAt
}

export type MessageRow = {
  id: string
  campaignId: string
  userId: string
  name: string
  color: string | null
  ai: boolean
  kind: 'message' | 'shown'
  style: 'ic' | 'ooc' | 'emote'
  speaker: MessageSpeaker
  text: string
  whisper: string[] | null
  shown: ShownData | null
  deletedAt: Date | null
  createdAt: Date
}

/** Guarda un mensaje (null si la cuenta ya mandó los del último minuto) */
export async function insertMessage(
  db: Database,
  input: {
    campaignId: string
    worldId: string
    userId: string
    ai: boolean
    kind?: 'message' | 'shown'
    style: 'ic' | 'ooc' | 'emote'
    speaker: MessageSpeaker
    text: string
    whisper: string[] | null
    shown?: ShownData | null
  }
): Promise<MessageRow | null> {
  return db.transaction(async (tx) => {
    // Una cuenta a la vez: dos mensajes a la vez no se saltan el tope
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`log:${input.userId}`}))`)
    const [recent] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(campaignMessages)
      .where(
        and(eq(campaignMessages.userId, input.userId), sql`${campaignMessages.createdAt} > now() - interval '1 minute'`)
      )
    if ((recent?.count ?? 0) >= MESSAGES_PER_MINUTE) return null
    const [inserted] = await tx
      .insert(campaignMessages)
      .values({ ...input, kind: input.kind ?? 'message', shown: input.shown ?? null })
      .returning({ id: campaignMessages.id })
    if (!inserted) throw new Error('El mensaje no se guardó')
    const [row] = await tx
      .select(view)
      .from(campaignMessages)
      .innerJoin(user, eq(user.id, campaignMessages.userId))
      .where(eq(campaignMessages.id, inserted.id))
    if (!row) throw new Error('El mensaje no se guardó')
    return row as MessageRow
  })
}

/** Lo que ve una cuenta: el máster, todo; los demás, lo de todos, lo suyo y lo que se les susurra */
const visibleTo = (viewerId: string, master: boolean) =>
  master
    ? undefined
    : or(
        sql`${campaignMessages.whisper} is null`,
        eq(campaignMessages.userId, viewerId),
        sql`${viewerId} = any(${campaignMessages.whisper})`
      )

/** Los de una campaña que ve una cuenta, de los más recientes hacia atrás (antes de before), hasta limit */
export async function listMessages(
  db: Database,
  input: { campaignId: string; viewerId: string; master: boolean; before?: Date | undefined; limit: number }
): Promise<MessageRow[]> {
  const rows = await db
    .select(view)
    .from(campaignMessages)
    .innerJoin(user, eq(user.id, campaignMessages.userId))
    .where(
      and(
        eq(campaignMessages.campaignId, input.campaignId),
        input.before ? lt(campaignMessages.createdAt, input.before) : undefined,
        visibleTo(input.viewerId, input.master)
      )
    )
    .orderBy(desc(campaignMessages.createdAt))
    .limit(input.limit)
  return rows as MessageRow[]
}

/** Uno de una campaña, por su id */
export async function findMessage(db: Database, campaignId: string, id: string): Promise<MessageRow | null> {
  const [row] = await db
    .select(view)
    .from(campaignMessages)
    .innerJoin(user, eq(user.id, campaignMessages.userId))
    .where(and(eq(campaignMessages.id, id), eq(campaignMessages.campaignId, campaignId)))
  return (row as MessageRow | undefined) ?? null
}

/** Lo borra: queda «Mensaje borrado», sin su texto */
export async function deleteMessage(db: Database, id: string): Promise<void> {
  await db
    .update(campaignMessages)
    .set({ deletedAt: new Date(), text: '', shown: null })
    .where(eq(campaignMessages.id, id))
}

/** Vacía el registro de una campaña (sus mensajes); cuántos */
export async function clearMessages(db: Database, campaignId: string): Promise<number> {
  const rows = await db
    .delete(campaignMessages)
    .where(eq(campaignMessages.campaignId, campaignId))
    .returning({ id: campaignMessages.id })
  return rows.length
}

/**
 * Si a una cuenta le enseñaron una imagen en alguna de sus campañas (a ella o a todos) y sigue en el registro: así la
 * puede abrir (docs/specs/ensenar.md)
 */
export async function wasShownFile(
  db: Database,
  input: { userId: string; campaignIds: readonly string[]; fileId: string }
): Promise<boolean> {
  if (input.campaignIds.length === 0) return false
  const [found] = await db
    .select({ id: campaignMessages.id })
    .from(campaignMessages)
    .where(
      and(
        inArray(campaignMessages.campaignId, [...input.campaignIds]),
        eq(campaignMessages.kind, 'shown'),
        isNull(campaignMessages.deletedAt),
        sql`${campaignMessages.shown}->>'kind' = 'image'`,
        sql`${campaignMessages.shown}->>'id' = ${input.fileId}`,
        or(sql`${campaignMessages.whisper} is null`, sql`${input.userId} = any(${campaignMessages.whisper})`)
      )
    )
    .limit(1)
  return Boolean(found)
}
