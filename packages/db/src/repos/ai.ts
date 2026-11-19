import { randomUUID } from 'node:crypto'
import { type AiMode, approvalExpiresAt, DEFAULT_AI_MODE } from '@crisol/domain'
import { and, asc, desc, eq, gt, isNull, lt, lte, ne, or, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { aiSettings, approvals } from '../schema/ai.ts'
import { oauthClient, oauthRefreshToken, oauthResource } from '../schema/auth.ts'

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

/**
 * Lo aprobado que se quedó haciéndose (el servidor se reinició a medias): pasa a fallido, y la cuenta lo ve. Solo lo
 * aprobado antes de `before`, para no tocar lo que se está haciendo ahora
 */
export async function failInterruptedApprovals(db: Database, before: Date): Promise<number> {
  const failed = await db
    .update(approvals)
    .set({ status: 'failed', error: 'INTERRUPTED' })
    .where(and(eq(approvals.status, 'approved'), lt(approvals.decidedAt, before)))
    .returning({ id: approvals.id })
  return failed.length
}

/**
 * Da de alta un recurso OAuth si aún no está (el conector de una campaña, ADR-0030): Better Auth solo emite tokens
 * para recursos que conoce, y los de las campañas no se saben al arrancar
 */
export async function ensureOAuthResource(db: Database, identifier: string, name: string): Promise<void> {
  const now = new Date()
  await db
    .insert(oauthResource)
    .values({ id: randomUUID(), identifier, name, createdAt: now, updatedAt: now })
    .onConflictDoNothing({ target: oauthResource.identifier })
}

/** Una conexión de IA: un cliente (claude.ai) con un conector (un recurso), y cuándo renovó su acceso por última vez */
export interface AiConnectionRow {
  clientId: string
  clientName: string | null
  resource: string
  renewedAt: Date
}

/**
 * Las conexiones de IA de una cuenta: cada cliente con cada conector del que guarda un token de refresco vivo (el de
 * acceso no se guarda: es un JWT de una hora). Un cliente sin offline_access no sale
 */
export async function listAiConnections(db: Database, userId: string, now: Date): Promise<AiConnectionRow[]> {
  const rows = await db.execute<{
    client_id: string
    client_name: string | null
    resource: string
    renewed_at: string
  }>(sql`
    select t.client_id, c.name as client_name, r.resource, max(t.created_at) as renewed_at
      from ${oauthRefreshToken} t
      join ${oauthClient} c on c.client_id = t.client_id
      cross join lateral unnest(t.resources) as r(resource)
      where t.user_id = ${userId} and t.revoked is null and t.expires_at > ${now.toISOString()}
      group by t.client_id, c.name, r.resource
      order by renewed_at desc`)
  return [...rows].map((row) => ({
    clientId: row.client_id,
    clientName: row.client_name,
    resource: row.resource,
    renewedAt: new Date(row.renewed_at)
  }))
}

/** Quita una conexión: sus tokens de refresco dejan de valer (los de acceso que queden los rechaza el conector) */
export async function revokeAiConnection(
  db: Database,
  query: { userId: string; clientId: string; resource: string; now: Date }
): Promise<number> {
  const revoked = await db
    .update(oauthRefreshToken)
    .set({ revoked: query.now })
    .where(
      and(
        eq(oauthRefreshToken.userId, query.userId),
        eq(oauthRefreshToken.clientId, query.clientId),
        isNull(oauthRefreshToken.revoked),
        sql`${query.resource} = any(${oauthRefreshToken.resources})`
      )
    )
    .returning({ id: oauthRefreshToken.id })
  return revoked.length
}
