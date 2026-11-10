/**
 * Las notas del jugador (docs/specs/notas-jugador.md): su árbol en una campaña, crearlas, cambiarlas con su versión y
 * mandarlas a la papelera (con sus subnotas). Como el texto de las páginas, lo que escribe seguido una cuenta en una
 * nota es una sola entrada del historial: se cierra tras unos minutos sin cambios o, como mucho, a los 15
 */
import { keyBetween } from '@crisol/domain'
import { and, eq, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation, type Transaction } from '../operation.ts'
import { playerNotes } from '../schema/notes.ts'

export type NoteRow = typeof playerNotes.$inferSelect

/** Sin cambios durante este tiempo, lo siguiente es otra entrada del historial; y como mucho dura esto */
export const NOTE_SESSION = { idleMs: 3 * 60_000, maxMs: 15 * 60_000 }

export class NoteChangedError extends Error {
  constructor() {
    super('La nota cambió mientras tanto')
    this.name = 'NoteChangedError'
  }
}

const byPosition = [sql`${playerNotes.position} collate "C"`, playerNotes.id]

/** Una nota, esté o no en la papelera */
export async function findNote(db: Database, id: string): Promise<NoteRow | null> {
  const [found] = await db.select().from(playerNotes).where(eq(playerNotes.id, id))
  return found ?? null
}

/** Todas las de una cuenta en una campaña (también las de la papelera), en su orden */
export function notesOf(db: Database, campaignId: string, userId: string): Promise<NoteRow[]> {
  return db
    .select()
    .from(playerNotes)
    .where(and(eq(playerNotes.campaignId, campaignId), eq(playerNotes.userId, userId)))
    .orderBy(...byPosition)
}

/** Las que se ven: fuera de la papelera y sin ninguna antecesora en ella */
export function visibleNotes(rows: readonly NoteRow[]): NoteRow[] {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const live = (row: NoteRow, seen = new Set<string>()): boolean => {
    if (row.deletedAt || seen.has(row.id)) return false
    seen.add(row.id)
    const parent = row.parentId ? byId.get(row.parentId) : undefined
    return parent ? live(parent, seen) : true
  }
  return rows.filter((row) => live(row))
}

/** Las que cuelgan de una (hijas, nietas…), de esa lista */
export function below(rows: readonly NoteRow[], id: string): NoteRow[] {
  const out: NoteRow[] = []
  const walk = (parentId: string) => {
    for (const row of rows)
      if (row.parentId === parentId && !out.includes(row)) {
        out.push(row)
        walk(row.id)
      }
  }
  walk(id)
  return out
}

/** La clave para ir la última entre sus hermanas */
async function lastKey(
  db: Database | Transaction,
  note: { campaignId: string; userId: string; parentId: string | null }
) {
  const [last] = await db
    .select({ position: sql<string | null>`max(${playerNotes.position} collate "C")` })
    .from(playerNotes)
    .where(
      and(
        eq(playerNotes.campaignId, note.campaignId),
        eq(playerNotes.userId, note.userId),
        note.parentId ? eq(playerNotes.parentId, note.parentId) : sql`${playerNotes.parentId} is null`
      )
    )
  return keyBetween(last?.position ?? null, null)
}

export function createNote(
  db: Database,
  context: OperationContext,
  input: {
    campaignId: string
    userId: string
    parentId: string | null
    title: string
    icon: string | null
    markdown: string
  }
) {
  return operation(db, context, async (w) =>
    w.insert(playerNotes, { ...input, position: await lastKey(w.read, input) })
  )
}

/** Si lo de ahora sigue la entrada del historial que dejó esa cuenta en la nota: el cambio que hay que alargar */
async function openSession(db: Database | Transaction, note: NoteRow, actorId: string | null) {
  if (!actorId || Date.now() - note.updatedAt.getTime() > NOTE_SESSION.idleMs) return null
  const rows = await db.execute<{ change: string; operation: string }>(sql`
    select c.id as change, o.id as operation from changes c join operations o on o.id = c.operation_id
    where c.table_name = 'player_notes' and c.row_id = ${note.id}
      and o.actor_id = ${actorId} and o.action = 'updatePlayerNote' and o.undone_by_id is null
      and o.created_at > now() - make_interval(secs => ${NOTE_SESSION.maxMs / 1000})
      and (select count(*) from changes x where x.operation_id = o.id) = 1
      and o.created_at = (select max(o2.created_at) from changes c2 join operations o2 on o2.id = c2.operation_id
        where c2.table_name = 'player_notes' and c2.row_id = ${note.id})`)
  return [...rows][0] ?? null
}

/**
 * Cambia una nota con la versión que se leyó. Lo que no la mueve, si sigue lo último que escribió esa cuenta en ella
 * (unos minutos), alarga esa entrada del historial: deshacerla vuelve a como estaba antes de empezar a escribir
 */
export function updateNote(
  db: Database,
  context: OperationContext,
  id: string,
  version: number,
  patch: { title?: string; icon?: string | null; markdown?: string; parentId?: string | null }
): Promise<NoteRow> {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(playerNotes).where(eq(playerNotes.id, id)).for('update')
    if (!current || current.version !== version) throw new NoteChangedError()
    const moves = patch.parentId !== undefined && patch.parentId !== current.parentId
    const session = moves ? null : await openSession(tx, current, context.actorId)
    if (session) {
      const [row] = await tx
        .update(playerNotes)
        .set({ ...patch, version: sql`${playerNotes.version} + 1`, updatedBy: context.actorId, updatedAt: new Date() })
        .where(eq(playerNotes.id, id))
        .returning()
      if (!row) throw new NoteChangedError()
      await tx.execute(
        sql`update changes set after = (select to_jsonb(t) from player_notes t where t.id = ${id}) where id = ${session.change}`
      )
      if (context.details)
        await tx.execute(
          sql`update operations set details = ${JSON.stringify(context.details)}::jsonb where id = ${session.operation}`
        )
      return row
    }
    return operation(tx, context, async (w) => {
      const position = moves
        ? await lastKey(tx, {
            campaignId: current.campaignId,
            userId: current.userId,
            parentId: patch.parentId ?? null
          })
        : undefined
      return w.update(playerNotes, id, { ...patch, ...(position ? { position } : {}) })
    })
  })
}

/** A la papelera, con sus subnotas que no estaban ya: todas con la misma hora (vuelven juntas) */
export function deleteNote(db: Database, context: OperationContext, note: NoteRow, rows: readonly NoteRow[]) {
  return operation(db, context, async (w) => {
    const now = new Date()
    await w.update(playerNotes, note.id, { deletedAt: now })
    for (const row of below(rows, note.id)) if (!row.deletedAt) await w.update(playerNotes, row.id, { deletedAt: now })
  })
}

/** De la papelera, con las subnotas que se fueron con ella. Si su madre sigue en la papelera, vuelve arriba del todo */
export function restoreNote(
  db: Database,
  context: OperationContext,
  note: NoteRow,
  rows: readonly NoteRow[],
  toTop: boolean
) {
  return operation(db, context, async (w) => {
    const at = note.deletedAt?.getTime()
    const position = toTop
      ? await lastKey(w.read, { campaignId: note.campaignId, userId: note.userId, parentId: null })
      : undefined
    await w.update(playerNotes, note.id, { deletedAt: null, ...(toTop ? { parentId: null, position } : {}) })
    for (const row of below(rows, note.id))
      if (row.deletedAt && row.deletedAt.getTime() === at) await w.update(playerNotes, row.id, { deletedAt: null })
  })
}

/** Las versiones de una nota (cómo quedó tras cada entrada del historial), de la última a la primera */
export async function noteVersions(db: Database, id: string, limit: number) {
  const rows = await db.execute<{
    operation: string
    at: Date | string
    actor: string | null
    after: { title?: string; markdown?: string; version?: number } | null
  }>(sql`
    select o.id as operation, o.created_at as at, o.actor_id as actor, c.after
    from changes c join operations o on o.id = c.operation_id
    where c.table_name = 'player_notes' and c.row_id = ${id} and c.after is not null
    order by o.created_at desc, c.seq desc limit ${limit}`)
  return [...rows].map((row) => ({
    operationId: row.operation,
    at: new Date(row.at),
    actorId: row.actor,
    title: row.after?.title ?? '',
    markdown: row.after?.markdown ?? '',
    version: row.after?.version ?? 0
  }))
}
