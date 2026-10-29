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
  return selectOperations(db)
    .where(and(...filters))
    .orderBy(desc(operations.createdAt), desc(operations.id))
    .limit(query.limit)
}

/** Una operación, con el nombre de quien la hizo y su organización (para decidir quién puede deshacerla) */
export async function getOperation(db: Database, operationId: string) {
  const [found] = await selectOperations(db).where(eq(operations.id, operationId))
  return found ?? null
}

function selectOperations(db: Database) {
  return db
    .select({
      id: operations.id,
      createdAt: operations.createdAt,
      organizationId: operations.organizationId,
      worldId: operations.worldId,
      actorId: operations.actorId,
      actorName: user.name,
      via: operations.via,
      tool: operations.tool,
      action: operations.action,
      details: operations.details,
      undoneById: operations.undoneById,
      undoesId: operations.undoesId
    })
    .from(operations)
    .leftJoin(user, eq(user.id, operations.actorId))
}
