import { historyCutoff, trashCutoff } from '@crisol/domain'
import { and, eq, isNotNull, isNull, lt, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { approvals } from '../schema/ai.ts'
import { campaignMembers, campaigns } from '../schema/campaigns.ts'
import { operations } from '../schema/history.ts'
import { worldMembers, worlds } from '../schema/worlds.ts'

/** Borrar manda a la papelera: la misma fila, marcada. Deshacerlo o restaurarla la deja como estaba */
export function deleteWorld(db: Database, context: OperationContext, worldId: string) {
  return operation(db, context, (w) => w.update(worlds, worldId, { deletedAt: new Date() }))
}

export function deleteCampaign(db: Database, context: OperationContext, campaignId: string) {
  return operation(db, context, (w) => w.update(campaigns, campaignId, { deletedAt: new Date() }))
}

export function restoreWorld(db: Database, context: OperationContext, worldId: string) {
  return operation(db, context, (w) => w.update(worlds, worldId, { deletedAt: null }))
}

export function restoreCampaign(db: Database, context: OperationContext, campaignId: string) {
  return operation(db, context, (w) => w.update(campaigns, campaignId, { deletedAt: null }))
}

/** Un mundo de la papelera (para restaurarlo) */
export async function findTrashedWorld(db: Database, worldId: string) {
  const [found] = await db
    .select({ id: worlds.id, organizationId: worlds.organizationId, name: worlds.name, deletedAt: worlds.deletedAt })
    .from(worlds)
    .where(and(eq(worlds.id, worldId), isNotNull(worlds.deletedAt)))
  return found ?? null
}

/** Una campaña de la papelera, con su mundo, y si ese mundo también está en ella (entonces se restaura él) */
export async function findTrashedCampaign(db: Database, campaignId: string) {
  const [found] = await db
    .select({
      id: campaigns.id,
      worldId: campaigns.worldId,
      organizationId: worlds.organizationId,
      name: campaigns.name,
      deletedAt: campaigns.deletedAt,
      worldInTrash: sql<boolean>`${worlds.deletedAt} is not null`
    })
    .from(campaigns)
    .innerJoin(worlds, eq(worlds.id, campaigns.worldId))
    .where(and(eq(campaigns.id, campaignId), isNotNull(campaigns.deletedAt)))
  return found ?? null
}

export type TrashScope = { worldId: string } | { organizationId: string }

/**
 * Lo que hay en la papelera, de lo último borrado a lo primero: las campañas borradas de un mundo o, en la de la
 * organización, también los mundos. Las campañas de un mundo borrado no salen sueltas: vuelven con él.
 */
export async function listTrash(db: Database, scope: TrashScope) {
  const trashedCampaigns = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      worldId: campaigns.worldId,
      worldName: worlds.name,
      deletedAt: campaigns.deletedAt
    })
    .from(campaigns)
    .innerJoin(worlds, eq(worlds.id, campaigns.worldId))
    .where(
      and(
        isNotNull(campaigns.deletedAt),
        isNull(worlds.deletedAt),
        'worldId' in scope ? eq(campaigns.worldId, scope.worldId) : eq(worlds.organizationId, scope.organizationId)
      )
    )
  const trashedWorlds =
    'organizationId' in scope
      ? await db
          .select({
            id: worlds.id,
            name: worlds.name,
            worldId: worlds.id,
            worldName: worlds.name,
            deletedAt: worlds.deletedAt
          })
          .from(worlds)
          .where(and(eq(worlds.organizationId, scope.organizationId), isNotNull(worlds.deletedAt)))
      : []
  return [
    ...trashedWorlds.map((item) => ({ kind: 'world' as const, ...item, deletedAt: item.deletedAt as Date })),
    ...trashedCampaigns.map((item) => ({ kind: 'campaign' as const, ...item, deletedAt: item.deletedAt as Date }))
  ].sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime())
}

/** Quiénes están: en una campaña, o en un mundo (sus másteres, sin campaña, y los de todas sus campañas) */
export async function peopleOf(db: Database, scope: { worldId: string } | { campaignId: string }) {
  if ('campaignId' in scope) {
    return db
      .select({ userId: campaignMembers.userId, campaignId: sql<string | null>`${campaignMembers.campaignId}` })
      .from(campaignMembers)
      .where(eq(campaignMembers.campaignId, scope.campaignId))
  }
  const [masters, players] = await Promise.all([
    db
      .select({ userId: worldMembers.userId, campaignId: sql<string | null>`null` })
      .from(worldMembers)
      .where(eq(worldMembers.worldId, scope.worldId)),
    db
      .select({ userId: campaignMembers.userId, campaignId: sql<string | null>`${campaignMembers.campaignId}` })
      .from(campaignMembers)
      .innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
      .where(eq(campaigns.worldId, scope.worldId))
  ])
  return [...masters, ...players]
}

/**
 * La purga diaria: quita del todo lo que lleva más de 30 días en la papelera (con lo que cuelga de ello), y las
 * operaciones y las peticiones de la IA de más de 90. No es una operación: purgar no se puede deshacer. Quien se queda
 * sin nada en una organización deja de ser miembro de ella, como al expulsarlo.
 */
export function purge(db: Database, now: Date) {
  return db.transaction(async (tx) => {
    const cutoff = trashCutoff(now)
    const purgedWorlds = await tx.delete(worlds).where(lt(worlds.deletedAt, cutoff)).returning({ id: worlds.id })
    const purgedCampaigns = await tx
      .delete(campaigns)
      .where(lt(campaigns.deletedAt, cutoff))
      .returning({ id: campaigns.id })
    const memberships = await tx.execute<{ id: string }>(sql`
      delete from organization_members om
      where om.role = 'member'
        and not exists (
          select 1 from campaign_members cm
          join campaigns c on c.id = cm.campaign_id
          join worlds w on w.id = c.world_id
          where cm.user_id = om.user_id and w.organization_id = om.organization_id)
        and not exists (
          select 1 from world_members wm
          join worlds w on w.id = wm.world_id
          where wm.user_id = om.user_id and w.organization_id = om.organization_id)
      returning om.id`)
    const purgedOperations = await tx
      .delete(operations)
      .where(lt(operations.createdAt, historyCutoff(now)))
      .returning({ id: operations.id })
    const purgedApprovals = await tx
      .delete(approvals)
      .where(lt(approvals.createdAt, historyCutoff(now)))
      .returning({ id: approvals.id })
    return {
      worlds: purgedWorlds.length,
      campaigns: purgedCampaigns.length,
      memberships: memberships.length,
      operations: purgedOperations.length,
      approvals: purgedApprovals.length
    }
  })
}
