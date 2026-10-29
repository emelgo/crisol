import { createCampaign, listCampaigns, renameCampaign } from '@crisol/contracts'
import { campaignsRepo, worldsRepo } from '@crisol/db'
import { authorize, NotFoundError } from '@crisol/domain'
import { campaignsChanged } from '../realtime/events.ts'
import { authorizedCampaign } from './access.ts'
import { historyContext } from './context.ts'
import { prepareSecret } from './invitations.ts'
import { implement } from './registry.ts'

export const campaignActions = [
  implement(listCampaigns, async (ctx, { worldId }) => {
    authorize(ctx.actor, 'world.read', { worldId })
    // El máster del mundo ve todas sus campañas; un jugador, solo las suyas
    const onlyMember = ctx.actor.worlds.get(worldId)?.role !== 'master'
    return { campaigns: await campaignsRepo.listCampaigns(ctx.db, { worldId, userId: ctx.actor.userId, onlyMember }) }
  }),

  implement(createCampaign, async (ctx, { worldId, name }) => {
    authorize(ctx.actor, 'campaign.create', { worldId })
    const world = await worldsRepo.findWorld(ctx.db, worldId)
    if (!world) throw new NotFoundError('world')
    const campaign = await campaignsRepo.createCampaignWithMaster(
      ctx.db,
      historyContext(ctx, 'createCampaign', { name, world: world.name }, world),
      { worldId, name, masterId: ctx.actor.userId, invitation: prepareSecret(ctx.sealKey) }
    )
    ctx.realtime.publish(campaignsChanged({ campaignId: campaign.id, worldId }))
    return { ...campaign, role: 'master' as const }
  }),

  implement(renameCampaign, async (ctx, { campaignId, name }) => {
    const current = await authorizedCampaign(ctx, 'campaign.rename', campaignId)
    const campaign = await campaignsRepo.renameCampaign(
      ctx.db,
      historyContext(ctx, 'renameCampaign', { from: current.name, to: name }, current),
      campaignId,
      name
    )
    ctx.realtime.publish(campaignsChanged({ campaignId, worldId: current.worldId }))
    return { ...campaign, role: ctx.actor.campaigns.get(campaignId)?.role ?? ('master' as const) }
  })
]
