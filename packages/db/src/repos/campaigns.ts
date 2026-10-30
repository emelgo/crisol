import { and, asc, eq, isNotNull, isNull, type SQL, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { campaignMembers, campaigns } from '../schema/campaigns.ts'
import { worlds } from '../schema/worlds.ts'
import { type PreparedSecret, writeInvitation } from './invitations.ts'

/** Lo que se ve de una campaña en su tarjeta, además del nombre */
const appearance = { description: campaigns.description, color: campaigns.color, cover: campaigns.cover }

/**
 * Las campañas de un mundo con el rol de la cuenta en cada una, en el orden en que se crearon (una nueva, al final).
 * onlyMember: solo aquellas en las que está (un jugador); si no, todas, y en las que no está figura como máster porque
 * administra el mundo.
 */
export function listCampaigns(db: Database, query: { worldId: string; userId: string; onlyMember: boolean }) {
  const membership = and(eq(campaignMembers.campaignId, campaigns.id), eq(campaignMembers.userId, query.userId))
  const filters: SQL[] = [eq(campaigns.worldId, query.worldId), isNull(campaigns.deletedAt)]
  if (query.onlyMember) filters.push(isNotNull(campaignMembers.id))
  return db
    .select({
      id: campaigns.id,
      worldId: campaigns.worldId,
      name: campaigns.name,
      ...appearance,
      version: campaigns.version,
      role: sql<'master' | 'player'>`coalesce(${campaignMembers.role}, 'master')`
    })
    .from(campaigns)
    .leftJoin(campaignMembers, membership)
    .where(and(...filters))
    .orderBy(asc(campaigns.createdAt), asc(campaigns.id))
}

/** La campaña con su mundo y su organización (para decidir permisos e historial). En la papelera, no existe */
export async function findCampaign(db: Database, campaignId: string) {
  const [found] = await db
    .select({
      id: campaigns.id,
      worldId: campaigns.worldId,
      organizationId: worlds.organizationId,
      name: campaigns.name,
      ...appearance,
      version: campaigns.version
    })
    .from(campaigns)
    .innerJoin(worlds, eq(worlds.id, campaigns.worldId))
    .where(and(eq(campaigns.id, campaignId), isNull(campaigns.deletedAt), isNull(worlds.deletedAt)))
  return found ?? null
}

/** Crea la campaña, hace máster de ella a quien la crea y le deja su enlace de invitación, en una sola operación */
export function createCampaignWithMaster(
  db: Database,
  context: OperationContext,
  input: { worldId: string; name: string; masterId: string; invitation: PreparedSecret }
) {
  return operation(db, context, async (w) => {
    const campaign = await w.insert(campaigns, { worldId: input.worldId, name: input.name })
    await w.insert(campaignMembers, { campaignId: campaign.id, userId: input.masterId, role: 'master' })
    await writeInvitation(w, campaign.id, input.invitation)
    return campaign
  })
}

export function renameCampaign(db: Database, context: OperationContext, campaignId: string, name: string) {
  return operation(db, context, (w) => w.update(campaigns, campaignId, { name }))
}

/** Lo que se ve de una campaña en su tarjeta: nombre, descripción, color y portada (como en un mundo) */
export type CampaignAppearance = Partial<{
  name: string
  description: string
  color: string | null
  cover: { fileId: string; x: number; y: number; zoom?: number } | null
}>

export function updateCampaign(db: Database, context: OperationContext, campaignId: string, patch: CampaignAppearance) {
  return operation(db, context, (w) => w.update(campaigns, campaignId, patch))
}
