import { and, desc, eq, type SQL, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { user } from '../schema/auth.ts'
import { operations } from '../schema/history.ts'

export type HistoryScope = { worldId: string } | { organizationId: string }

/**
 * Las operaciones de un mundo o de toda una organización, de la más reciente a la más antigua, con el nombre de
 * quien las hizo. before: la última que ya se vio (paginación por cursor: no se repite ni se salta ninguna aunque
 * entren otras mientras tanto)
 */
export function listOperations(db: Database, query: HistoryScope & { before?: string; limit: number }) {
  const filters: SQL[] = [
    'worldId' in query ? eq(operations.worldId, query.worldId) : eq(operations.organizationId, query.organizationId)
  ]
  if (query.before) {
    filters.push(
      sql`(${operations.createdAt}, ${operations.id}) < (select o.created_at, o.id from operations o where o.id = ${query.before})`
    )
  }
  return db
    .select({
      id: operations.id,
      createdAt: operations.createdAt,
      worldId: operations.worldId,
      actorId: operations.actorId,
      actorName: user.name,
      via: operations.via,
      tool: operations.tool,
      action: operations.action,
      details: operations.details
    })
    .from(operations)
    .leftJoin(user, eq(user.id, operations.actorId))
    .where(and(...filters))
    .orderBy(desc(operations.createdAt), desc(operations.id))
    .limit(query.limit)
}
