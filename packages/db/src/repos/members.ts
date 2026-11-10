import { and, asc, eq, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { user } from '../schema/auth.ts'
import { campaignMembers, campaigns } from '../schema/campaigns.ts'
import { organizationMembers } from '../schema/organizations.ts'
import { worldMembers, worlds } from '../schema/worlds.ts'
import { lockMembership } from './invitations.ts'

/** Quiénes están en la campaña: el máster primero y luego por nombre */
export function listCampaignMembers(db: Database, campaignId: string) {
  return db
    .select({ userId: campaignMembers.userId, name: user.name, role: campaignMembers.role, color: user.diceColor })
    .from(campaignMembers)
    .innerJoin(user, eq(user.id, campaignMembers.userId))
    .where(eq(campaignMembers.campaignId, campaignId))
    .orderBy(sql`case when ${campaignMembers.role} = 'master' then 0 else 1 end`, asc(user.name), asc(user.id))
}

/** Una cuenta en la campaña, con su nombre y su rol */
export async function findCampaignMember(db: Database, campaignId: string, userId: string) {
  const [found] = await db
    .select({ name: user.name, role: campaignMembers.role })
    .from(campaignMembers)
    .innerJoin(user, eq(user.id, campaignMembers.userId))
    .where(and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.userId, userId)))
  return found ?? null
}

export type RemoveResult =
  | { status: 'removed'; leftOrganization: boolean }
  | { status: 'master' }
  | { status: 'not-member' }

/**
 * Saca a un jugador de la campaña (expulsado o porque sale él), en una sola operación. Si ya no le queda nada en la
 * organización (ninguna campaña ni mundo) y no es propietario, deja también de ser miembro de ella. Al máster no se
 * le saca.
 */
export function removeCampaignMember(
  db: Database,
  context: OperationContext,
  input: { campaignId: string; organizationId: string; userId: string }
): Promise<RemoveResult> {
  return operation(db, context, async (w) => {
    await lockMembership(w, input.organizationId, input.userId)
    const [member] = await w.read
      .select({ id: campaignMembers.id, role: campaignMembers.role })
      .from(campaignMembers)
      .where(and(eq(campaignMembers.campaignId, input.campaignId), eq(campaignMembers.userId, input.userId)))
      .for('update')
    if (!member) return { status: 'not-member' }
    if (member.role === 'master') return { status: 'master' }
    await w.remove(campaignMembers, member.id)

    // Con la cuenta en fila (lockMembership), lo que le queda no cambia mientras se cuenta
    const [orgMember] = await w.read
      .select({ id: organizationMembers.id, role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(eq(organizationMembers.organizationId, input.organizationId), eq(organizationMembers.userId, input.userId))
      )
      .for('update')
    if (orgMember?.role !== 'member') return { status: 'removed', leftOrganization: false }
    const [otherCampaign] = await w.read
      .select({ id: campaignMembers.id })
      .from(campaignMembers)
      .innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
      .innerJoin(worlds, eq(worlds.id, campaigns.worldId))
      .where(and(eq(campaignMembers.userId, input.userId), eq(worlds.organizationId, input.organizationId)))
      .limit(1)
    const [world] = await w.read
      .select({ id: worldMembers.id })
      .from(worldMembers)
      .innerJoin(worlds, eq(worlds.id, worldMembers.worldId))
      .where(and(eq(worldMembers.userId, input.userId), eq(worlds.organizationId, input.organizationId)))
      .limit(1)
    if (otherCampaign || world) return { status: 'removed', leftOrganization: false }
    await w.remove(organizationMembers, orgMember.id)
    return { status: 'removed', leftOrganization: true }
  })
}
