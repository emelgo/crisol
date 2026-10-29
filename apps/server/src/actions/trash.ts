import {
  deleteCampaign,
  deleteWorld,
  listTrash,
  type RealtimeMessage,
  restoreCampaign,
  restoreWorld
} from '@crisol/contracts'
import { trashRepo, worldsRepo } from '@crisol/db'
import { authorize, NotFoundError, purgeAt } from '@crisol/domain'
import { campaignsChanged } from '../realtime/events.ts'
import { authorizedCampaign, targetOrganization } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

const worldsChangedFor = (userId: string) => ({
  to: { userId },
  message: { type: 'changed', what: 'worlds' } satisfies RealtimeMessage
})

/** Avisa a quienes estaban (o vuelven a estar): ven un mundo menos o uno más */
function tellPeople(ctx: ActionContext, people: Array<{ userId: string }>) {
  const users = new Set([ctx.actor.userId, ...people.map((p) => p.userId)])
  ctx.realtime.publish(...[...users].map(worldsChangedFor))
}

export const trashActions = [
  implement(deleteWorld, async (ctx, { worldId }) => {
    authorize(ctx.actor, 'world.delete', { worldId })
    const world = await worldsRepo.findWorld(ctx.db, worldId)
    if (!world) throw new NotFoundError('world')
    const people = await trashRepo.peopleOf(ctx.db, { worldId })
    await trashRepo.deleteWorld(ctx.db, historyContext(ctx, 'deleteWorld', { name: world.name }, world), worldId)
    // Los de sus campañas dejan de estar en ellas al momento
    for (const { userId, campaignId } of people) if (campaignId) ctx.realtime.revoke(userId, { worldId, campaignId })
    tellPeople(ctx, people)
    return {}
  }),

  implement(deleteCampaign, async (ctx, { campaignId }) => {
    const campaign = await authorizedCampaign(ctx, 'campaign.delete', campaignId)
    const people = await trashRepo.peopleOf(ctx.db, { campaignId })
    const world = await worldsRepo.findWorld(ctx.db, campaign.worldId)
    await trashRepo.deleteCampaign(
      ctx.db,
      historyContext(ctx, 'deleteCampaign', { name: campaign.name, world: world?.name ?? '' }, campaign),
      campaignId
    )
    const scope = { campaignId, worldId: campaign.worldId }
    for (const { userId } of people) ctx.realtime.revoke(userId, scope)
    ctx.realtime.publish(campaignsChanged(scope))
    return {}
  }),

  implement(listTrash, async (ctx, { worldId, organizationId }) => {
    let scope: trashRepo.TrashScope
    if (worldId) {
      authorize(ctx.actor, 'world.trash', { worldId })
      scope = { worldId }
    } else {
      const target = targetOrganization(ctx, organizationId)
      authorize(ctx.actor, 'organization.trash', { organizationId: target })
      scope = { organizationId: target }
    }
    const items = await trashRepo.listTrash(ctx.db, scope)
    return {
      items: items.map((item) => ({
        ...item,
        deletedAt: item.deletedAt.toISOString(),
        purgeAt: purgeAt(item.deletedAt).toISOString()
      }))
    }
  }),

  implement(restoreWorld, async (ctx, { worldId }) => {
    // Un mundo en la papelera no lo ve ni su máster: lo restaura el propietario, desde la de la organización
    const world = await trashRepo.findTrashedWorld(ctx.db, worldId)
    authorize(ctx.actor, 'organization.trash', { organizationId: world?.organizationId ?? '' })
    if (!world) throw new NotFoundError('world')
    await trashRepo.restoreWorld(ctx.db, historyContext(ctx, 'restoreWorld', { name: world.name }, world), worldId)
    tellPeople(ctx, await trashRepo.peopleOf(ctx.db, { worldId }))
    return { id: world.id, name: world.name }
  }),

  implement(restoreCampaign, async (ctx, { campaignId }) => {
    const campaign = await trashRepo.findTrashedCampaign(ctx.db, campaignId)
    if (campaign?.worldInTrash) {
      authorize(ctx.actor, 'organization.trash', { organizationId: campaign.organizationId })
      throw new InvalidRequestError('WORLD_IN_TRASH')
    }
    authorize(ctx.actor, 'world.trash', { worldId: campaign?.worldId ?? '' })
    if (!campaign) throw new NotFoundError('campaign')
    const world = await worldsRepo.findWorld(ctx.db, campaign.worldId)
    await trashRepo.restoreCampaign(
      ctx.db,
      historyContext(ctx, 'restoreCampaign', { name: campaign.name, world: world?.name ?? '' }, campaign),
      campaignId
    )
    ctx.realtime.publish(campaignsChanged({ campaignId, worldId: campaign.worldId }))
    tellPeople(ctx, await trashRepo.peopleOf(ctx.db, { campaignId }))
    return { id: campaign.id, name: campaign.name }
  })
]
