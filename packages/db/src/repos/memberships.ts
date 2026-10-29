import { eq } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { organizationMembers } from '../schema/organizations.ts'
import { worldMembers, worlds } from '../schema/worlds.ts'

/** Las pertenencias de una cuenta: se leen en cada petición para que revocar sea inmediato */
export async function loadMemberships(db: Database, userId: string) {
  const [organizations, worldRoles] = await Promise.all([
    db
      .select({ organizationId: organizationMembers.organizationId, role: organizationMembers.role })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId)),
    db
      .select({ worldId: worldMembers.worldId, organizationId: worlds.organizationId, role: worldMembers.role })
      .from(worldMembers)
      .innerJoin(worlds, eq(worlds.id, worldMembers.worldId))
      .where(eq(worldMembers.userId, userId))
  ])
  return { organizations, worlds: worldRoles }
}

export type Memberships = Awaited<ReturnType<typeof loadMemberships>>
