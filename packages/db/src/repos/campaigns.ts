import { and, asc, eq, isNotNull, type SQL, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { campaignMembers, campaigns } from '../schema/campaigns.ts'
import { worlds } from '../schema/worlds.ts'

/**
 * Las campañas de un mundo con el rol de la cuenta en cada una. onlyMember: solo aquellas en las que está (un
 * jugador); si no, todas, y en las que no está figura como máster porque administra el mundo.
 */
export function listCampaigns(db: Database, query: { worldId: string; userId: string; onlyMember: boolean }) {
  const membership = and(eq(campaignMembers.campaignId, campaigns.id), eq(campaignMembers.userId, query.userId))
  const filters: SQL[] = [eq(campaigns.worldId, query.worldId)]
  if (query.onlyMember) filters.push(isNotNull(campaignMembers.id))
  return db
    .select({
      id: campaigns.id,
      worldId: campaigns.worldId,
      name: campaigns.name,
      version: campaigns.version,
      role: sql<'master' | 'player'>`coalesce(${campaignMembers.role}, 'master')`
    })
    .from(campaigns)
    .leftJoin(campaignMembers, membership)
    .where(and(...filters))
    .orderBy(asc(campaigns.name))
}

/** La campaña con su mundo y su organización (para decidir permisos e historial) */
export async function findCampaign(db: Database, campaignId: string) {
  const [found] = await db
    .select({
      id: campaigns.id,
      worldId: campaigns.worldId,
      organizationId: worlds.organizationId,
      name: campaigns.name,
      version: campaigns.version
    })
    .from(campaigns)
    .innerJoin(worlds, eq(worlds.id, campaigns.worldId))
    .where(eq(campaigns.id, campaignId))
  return found ?? null
}

/** Crea la campaña y hace máster de ella a quien la crea, en una sola operación */
export function createCampaignWithMaster(
  db: Database,
  context: OperationContext,
  input: { worldId: string; name: string; masterId: string }
) {
  return operation(db, context, async (w) => {
    const campaign = await w.insert(campaigns, { worldId: input.worldId, name: input.name })
    await w.insert(campaignMembers, { campaignId: campaign.id, userId: input.masterId, role: 'master' })
    return campaign
  })
}

export function renameCampaign(db: Database, context: OperationContext, campaignId: string, name: string) {
  return operation(db, context, (w) => w.update(campaigns, campaignId, { name }))
}
