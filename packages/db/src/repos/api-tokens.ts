import { and, asc, eq, gt, isNull, lt, or } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { apiTokens } from '../schema/ai.ts'

export type ApiToken = Omit<typeof apiTokens.$inferSelect, 'hash'>

/** Cuántos puede tener una cuenta a la vez */
export const MAX_API_TOKENS = 20

const view = {
  id: apiTokens.id,
  userId: apiTokens.userId,
  name: apiTokens.name,
  prefix: apiTokens.prefix,
  createdAt: apiTokens.createdAt,
  expiresAt: apiTokens.expiresAt,
  lastUsedAt: apiTokens.lastUsedAt
}

/** Los de la cuenta, también los caducados (para quitarlos), del más viejo al más nuevo */
export function listApiTokens(db: Database, userId: string): Promise<ApiToken[]> {
  return db.select(view).from(apiTokens).where(eq(apiTokens.userId, userId)).orderBy(asc(apiTokens.createdAt))
}

export async function createApiToken(
  db: Database,
  values: { userId: string; name: string; hash: string; prefix: string; expiresAt: Date }
): Promise<ApiToken> {
  const [created] = await db.insert(apiTokens).values(values).returning(view)
  if (!created) throw new Error('No se guardó el token')
  return created
}

/** Quita uno de la cuenta (los de otra no existen para ella): si no estaba, false */
export async function deleteApiToken(db: Database, userId: string, tokenId: string): Promise<boolean> {
  const deleted = await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId)))
    .returning({ id: apiTokens.id })
  return deleted.length > 0
}

/** El token vivo con esa huella: su cuenta. Apunta su uso (como mucho, una vez por minuto) */
export async function useApiToken(db: Database, hash: string, now: Date): Promise<ApiToken | null> {
  const [found] = await db
    .select(view)
    .from(apiTokens)
    .where(and(eq(apiTokens.hash, hash), gt(apiTokens.expiresAt, now)))
  if (!found) return null
  const minuteAgo = new Date(now.getTime() - 60_000)
  await db
    .update(apiTokens)
    .set({ lastUsedAt: now })
    .where(and(eq(apiTokens.id, found.id), or(isNull(apiTokens.lastUsedAt), lt(apiTokens.lastUsedAt, minuteAgo))))
  return found
}
