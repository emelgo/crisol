import { type AiMode, approvalExpiresAt, DEFAULT_AI_MODE } from '@crisol/domain'
import { and, asc, desc, eq, gt, lte, ne, or } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { aiSettings, approvals } from '../schema/ai.ts'

/** El modo de IA de la cuenta (sin ajuste, el de por defecto) */
export async function findAiMode(db: Database, userId: string): Promise<AiMode> {
  const [found] = await db.select({ mode: aiSettings.mode }).from(aiSettings).where(eq(aiSettings.userId, userId))
  return found?.mode ?? DEFAULT_AI_MODE
}

export async function setAiMode(db: Database, userId: string, mode: AiMode): Promise<AiMode> {
  const [saved] = await db
    .insert(aiSettings)
    .values({ userId, mode })
    .onConflictDoUpdate({ target: aiSettings.userId, set: { mode, updatedAt: new Date() } })
    .returning({ mode: aiSettings.mode })
  return saved?.mode ?? mode
}

export type Approval = typeof approvals.$inferSelect

/** Lo que pide la IA de una cuenta: entra pendiente y caduca a las 24 h */
export async function createApproval(
  db: Database,
  request: {
    userId: string
    tool: string
    action: string
    input: Record<string, unknown>
    details: Record<string, unknown>
    now: Date
  }
): Promise<Approval> {
  const { now, ...values } = request
  const [created] = await db
    .insert(approvals)
    .values({ ...values, createdAt: now, expiresAt: approvalExpiresAt(now) })
    .returning()
  if (!created) throw new Error('No se guardó la petición')
  return created
}

/** Una petición de la IA de esa cuenta (las de otras no existen para ella) */
export async function findApproval(db: Database, userId: string, approvalId: string): Promise<Approval | null> {
  const [found] = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.id, approvalId), eq(approvals.userId, userId)))
  return found ?? null
}

/** Aprueba o rechaza, solo si sigue pendiente y no ha caducado: de dos decisiones a la vez, gana una */
export async function decideApproval(
  db: Database,
  query: { userId: string; approvalId: string; decision: 'approved' | 'rejected'; now: Date }
): Promise<Approval | null> {
  const [decided] = await db
    .update(approvals)
    .set({ status: query.decision, decidedAt: query.now })
    .where(
      and(
        eq(approvals.id, query.approvalId),
        eq(approvals.userId, query.userId),
        eq(approvals.status, 'pending'),
        gt(approvals.expiresAt, query.now)
      )
    )
    .returning()
  return decided ?? null
}

/** Cómo acabó lo aprobado: lo que devolvió la acción, o el código del error */
export async function finishApproval(
  db: Database,
  approvalId: string,
  outcome: { status: 'done'; result: Record<string, unknown> } | { status: 'failed'; error: string }
): Promise<Approval | null> {
  const [finished] = await db
    .update(approvals)
    .set(
      outcome.status === 'done'
        ? { status: 'done', result: outcome.result }
        : { status: 'failed', error: outcome.error }
    )
    .where(eq(approvals.id, approvalId))
    .returning()
  return finished ?? null
}

/** Lo que espera (por orden de llegada) y las últimas que ya acabaron o caducaron (de la más reciente) */
export async function listApprovals(db: Database, userId: string, now: Date, recentLimit = 20) {
  const waiting = and(eq(approvals.status, 'pending'), gt(approvals.expiresAt, now))
  const [pending, recent] = await Promise.all([
    db
      .select()
      .from(approvals)
      .where(and(eq(approvals.userId, userId), waiting))
      .orderBy(asc(approvals.createdAt), asc(approvals.id)),
    db
      .select()
      .from(approvals)
      .where(and(eq(approvals.userId, userId), or(ne(approvals.status, 'pending'), lte(approvals.expiresAt, now))))
      .orderBy(desc(approvals.createdAt), desc(approvals.id))
      .limit(recentLimit)
  ])
  return { pending, recent }
}
