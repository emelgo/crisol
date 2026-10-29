import { asc, eq } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { worldMembers, worlds } from '../schema/worlds.ts'

const worldColumns = {
  id: worlds.id,
  organizationId: worlds.organizationId,
  name: worlds.name,
  version: worlds.version
}

/** Los mundos en los que la cuenta tiene un rol, con ese rol */
export function listMemberWorlds(db: Database, userId: string) {
  return db
    .select({ ...worldColumns, role: worldMembers.role })
    .from(worldMembers)
    .innerJoin(worlds, eq(worlds.id, worldMembers.worldId))
    .where(eq(worldMembers.userId, userId))
    .orderBy(asc(worlds.name))
}

export async function findWorld(db: Database, worldId: string) {
  const [found] = await db.select(worldColumns).from(worlds).where(eq(worlds.id, worldId))
  return found ?? null
}

/** Crea el mundo y hace máster a quien lo crea, en una sola operación */
export function createWorldWithMaster(
  db: Database,
  context: OperationContext,
  input: { organizationId: string; name: string; masterId: string }
) {
  return operation(db, context, async (w) => {
    const world = await w.insert(worlds, { organizationId: input.organizationId, name: input.name })
    await w.insert(worldMembers, { worldId: world.id, userId: input.masterId, role: 'master' })
    return world
  })
}

export function renameWorld(db: Database, context: OperationContext, worldId: string, name: string) {
  return operation(db, context, (w) => w.update(worlds, worldId, { name }))
}
