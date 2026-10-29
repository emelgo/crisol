import { and, asc, eq, isNull } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { campaignMembers, campaigns } from '../schema/campaigns.ts'
import { organizationMembers, organizations } from '../schema/organizations.ts'
import { worldMembers, worlds } from '../schema/worlds.ts'

/**
 * Las pertenencias de una cuenta: se leen en cada petición para que revocar sea inmediato. Lo que está en la papelera
 * no cuenta: para todos es como si no existiera
 */
export async function loadMemberships(db: Database, userId: string) {
  const [organizations, worldRoles, campaignRoles] = await Promise.all([
    db
      .select({ organizationId: organizationMembers.organizationId, role: organizationMembers.role })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId)),
    db
      .select({ worldId: worldMembers.worldId, organizationId: worlds.organizationId, role: worldMembers.role })
      .from(worldMembers)
      .innerJoin(worlds, eq(worlds.id, worldMembers.worldId))
      .where(and(eq(worldMembers.userId, userId), isNull(worlds.deletedAt))),
    db
      .select({ campaignId: campaignMembers.campaignId, worldId: campaigns.worldId, role: campaignMembers.role })
      .from(campaignMembers)
      .innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
      .innerJoin(worlds, eq(worlds.id, campaigns.worldId))
      .where(and(eq(campaignMembers.userId, userId), isNull(campaigns.deletedAt), isNull(worlds.deletedAt)))
  ])
  return { organizations, worlds: worldRoles, campaigns: campaignRoles }
}

export type Memberships = Awaited<ReturnType<typeof loadMemberships>>

/** Las organizaciones de la cuenta, con su nombre y su rol */
export function listMemberOrganizations(db: Database, userId: string) {
  return db
    .select({ id: organizations.id, name: organizations.name, role: organizationMembers.role })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(eq(organizationMembers.userId, userId))
    .orderBy(asc(organizations.name))
}

/** Si la cuenta es propietaria de alguna organización */
export async function isOwner(db: Database, userId: string): Promise<boolean> {
  const [found] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.role, 'owner')))
    .limit(1)
  return Boolean(found)
}
