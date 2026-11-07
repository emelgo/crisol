import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { prepared } from '../prepared.ts'
import { campaignMembers, campaigns } from '../schema/campaigns.ts'
import { organizationMembers, organizations } from '../schema/organizations.ts'
import { worldMembers, worlds } from '../schema/worlds.ts'

/**
 * Las pertenencias de una cuenta: se leen en cada petición para que revocar sea inmediato. Lo que está en la papelera
 * no cuenta: para todos es como si no existiera
 */
export async function loadMemberships(db: Database, userId: string) {
  const [organizations, worldRoles, campaignRoles] = await Promise.all([
    organizationsOf(db).execute({ userId }),
    worldsOf(db).execute({ userId }),
    campaignsOf(db).execute({ userId })
  ])
  return { organizations, worlds: worldRoles, campaigns: campaignRoles }
}

// Preparadas: se leen en cada petición
const organizationsOf = prepared((db) =>
  db
    .select({ organizationId: organizationMembers.organizationId, role: organizationMembers.role })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, sql.placeholder('userId')))
    .prepare('memberships_organizations')
)

const worldsOf = prepared((db) =>
  db
    .select({ worldId: worldMembers.worldId, organizationId: worlds.organizationId, role: worldMembers.role })
    .from(worldMembers)
    .innerJoin(worlds, eq(worlds.id, worldMembers.worldId))
    .where(and(eq(worldMembers.userId, sql.placeholder('userId')), isNull(worlds.deletedAt)))
    .prepare('memberships_worlds')
)

const campaignsOf = prepared((db) =>
  db
    .select({ campaignId: campaignMembers.campaignId, worldId: campaigns.worldId, role: campaignMembers.role })
    .from(campaignMembers)
    .innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
    .innerJoin(worlds, eq(worlds.id, campaigns.worldId))
    .where(
      and(eq(campaignMembers.userId, sql.placeholder('userId')), isNull(campaigns.deletedAt), isNull(worlds.deletedAt))
    )
    .prepare('memberships_campaigns')
)

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

/**
 * Si la cuenta puede conectar una IA (ADR-0017): la propietaria de una organización, o quien juega en alguna campaña
 * (su IA solo lee lo que sabe su campaña)
 */
export async function mayUseAi(db: Database, userId: string): Promise<boolean> {
  if (await isOwner(db, userId)) return true
  const [found] = await db
    .select({ id: campaignMembers.id })
    .from(campaignMembers)
    .where(eq(campaignMembers.userId, userId))
    .limit(1)
  return Boolean(found)
}
