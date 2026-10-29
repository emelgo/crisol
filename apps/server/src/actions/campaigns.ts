import { createCampaign, listCampaigns, renameCampaign } from '@crisol/contracts'
import { campaignsRepo, worldsRepo } from '@crisol/db'
import { authorize, NotFoundError } from '@crisol/domain'
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
      historyContext(ctx, 'createCampaign', { name, world: world.name }, world.organizationId),
      { worldId, name, masterId: ctx.actor.userId, invitation: prepareSecret(ctx.sealKey) }
    )
    return { ...campaign, role: 'master' as const }
  }),

  implement(renameCampaign, async (ctx, { campaignId, name }) => {
    const current = await campaignsRepo.findCampaign(ctx.db, campaignId)
    // Sin campaña, se decide como si estuviera en un mundo que nadie ve: no existe
    authorize(ctx.actor, 'campaign.rename', { campaignId, worldId: current?.worldId ?? '' })
    if (!current) throw new NotFoundError('campaign')
    const campaign = await campaignsRepo.renameCampaign(
      ctx.db,
      historyContext(ctx, 'renameCampaign', { from: current.name, to: name }, current.organizationId),
      campaignId,
      name
    )
    return { ...campaign, role: ctx.actor.campaigns.get(campaignId)?.role ?? ('master' as const) }
  })
]
