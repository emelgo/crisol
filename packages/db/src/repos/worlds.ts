import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { campaignMembers, campaigns } from '../schema/campaigns.ts'
import { worldMembers, worlds } from '../schema/worlds.ts'

const worldColumns = {
  id: worlds.id,
  organizationId: worlds.organizationId,
  name: worlds.name,
  description: worlds.description,
  icon: worlds.icon,
  color: worlds.color,
  cover: worlds.cover,
  version: worlds.version
}

/**
 * Los mundos de la cuenta con su rol: los que administra (master) y en los que juega alguna campaña (player). En el
 * orden en que se crearon: uno nuevo, al final
 */
export async function listMemberWorlds(db: Database, userId: string) {
  const [mastered, played] = await Promise.all([
    db
      .select({ ...worldColumns, createdAt: worlds.createdAt, role: sql<'master' | 'player'>`${worldMembers.role}` })
      .from(worldMembers)
      .innerJoin(worlds, eq(worlds.id, worldMembers.worldId))
      .where(and(eq(worldMembers.userId, userId), isNull(worlds.deletedAt))),
    db
      .selectDistinct({ ...worldColumns, createdAt: worlds.createdAt, role: sql<'master' | 'player'>`'player'` })
      .from(campaignMembers)
      .innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
      .innerJoin(worlds, eq(worlds.id, campaigns.worldId))
      .where(
        and(
          eq(campaignMembers.userId, userId),
          eq(campaignMembers.role, 'player'),
          isNull(campaigns.deletedAt),
          isNull(worlds.deletedAt)
        )
      )
  ])
  const masteredIds = new Set(mastered.map((w) => w.id))
  return [...mastered, ...played.filter((w) => !masteredIds.has(w.id))]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.name.localeCompare(b.name))
    .map(({ createdAt: _, ...world }) => world)
}

/** Los mundos de una organización fuera de la papelera (para lo que comparten: sus archivos comunes) */
export function organizationWorlds(db: Database, organizationId: string) {
  return db
    .select({ id: worlds.id })
    .from(worlds)
    .where(and(eq(worlds.organizationId, organizationId), isNull(worlds.deletedAt)))
}

export async function findWorld(db: Database, worldId: string) {
  const [found] = await db
    .select(worldColumns)
    .from(worlds)
    .where(and(eq(worlds.id, worldId), isNull(worlds.deletedAt)))
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

/** Lo que se ve de un mundo en su tarjeta: nombre, descripción, icono, color y portada */
export type WorldAppearance = Partial<{
  name: string
  description: string
  icon: string | null
  color: string | null
  cover: { fileId: string; x: number; y: number; zoom?: number } | null
}>

export function updateWorld(db: Database, context: OperationContext, worldId: string, patch: WorldAppearance) {
  return operation(db, context, (w) => w.update(worlds, worldId, patch))
}
