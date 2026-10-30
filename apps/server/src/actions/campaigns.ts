import {
  type Campaign,
  createCampaign,
  getCampaign,
  listCampaigns,
  listWorldsWithCampaigns,
  renameCampaign,
  updateCampaign,
  worldColor
} from '@crisol/contracts'
import { campaignsRepo, filesRepo, membersRepo, worldsRepo } from '@crisol/db'
import { authorize, NotFoundError } from '@crisol/domain'
import { campaignsChanged } from '../realtime/events.ts'
import { authorizedCampaign } from './access.ts'
import { historyContext, InvalidRequestError } from './context.ts'
import { prepareSecret } from './invitations.ts'
import { implement } from './registry.ts'
import { presentWorld } from './worlds.ts'

/** Una campaña de la base de datos, como la da la API: el color, solo si es de los que se ofrecen */
function presentCampaign<T extends { color: string | null }>(row: T): Omit<T, 'color'> & Pick<Campaign, 'color'> {
  const color = worldColor.safeParse(row.color)
  return { ...row, color: color.success ? color.data : null }
}

export const campaignActions = [
  implement(listCampaigns, async (ctx, { worldId }) => {
    authorize(ctx.actor, 'world.read', { worldId })
    // El máster del mundo ve todas sus campañas; un jugador, solo las suyas
    const onlyMember = ctx.actor.worlds.get(worldId)?.role !== 'master'
    const campaigns = await campaignsRepo.listCampaigns(ctx.db, { worldId, userId: ctx.actor.userId, onlyMember })
    return { campaigns: campaigns.map(presentCampaign) }
  }),

  implement(listWorldsWithCampaigns, async (ctx) => {
    const userId = ctx.actor.userId
    const worlds = await worldsRepo.listMemberWorlds(ctx.db, userId)
    return {
      worlds: await Promise.all(
        worlds.map(async (world) => ({
          ...presentWorld(world),
          campaigns: (
            await campaignsRepo.listCampaigns(ctx.db, {
              worldId: world.id,
              userId,
              onlyMember: world.role !== 'master'
            })
          ).map(presentCampaign)
        }))
      )
    }
  }),

  implement(getCampaign, async (ctx, { campaignId }) => {
    const found = await authorizedCampaign(ctx, 'campaign.read', campaignId)
    const world = await worldsRepo.findWorld(ctx.db, found.worldId)
    if (!world) throw new NotFoundError('world')
    // Quien administra el mundo es máster de sus campañas aunque no esté en ellas
    const role = ctx.actor.campaigns.get(campaignId)?.role ?? ('master' as const)
    return {
      campaign: presentCampaign({
        id: found.id,
        worldId: found.worldId,
        name: found.name,
        description: found.description,
        color: found.color,
        cover: found.cover,
        role,
        version: found.version
      }),
      world: { id: world.id, name: world.name },
      members: await membersRepo.listCampaignMembers(ctx.db, campaignId)
    }
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
    return presentCampaign({ ...campaign, role: 'master' as const })
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
    return presentCampaign({ ...campaign, role: ctx.actor.campaigns.get(campaignId)?.role ?? ('master' as const) })
  }),

  implement(updateCampaign, async (ctx, { campaignId, ...patch }) => {
    const current = await authorizedCampaign(ctx, 'campaign.rename', campaignId)
    // La portada, una imagen de su mundo o una común de su organización
    if (patch.cover) {
      const file = await filesRepo.findFile(ctx.db, patch.cover.fileId)
      const usable =
        file && (file.worldId ? file.worldId === current.worldId : file.organizationId === current.organizationId)
      if (!file || !usable || file.kind !== 'image') throw new InvalidRequestError('BAD_COVER')
    }
    // Lo que cambió, para la frase del historial
    const details = {
      ...(patch.name !== undefined && patch.name !== current.name
        ? { from: current.name, to: patch.name }
        : { name: current.name }),
      ...(patch.description !== undefined ? { description: true } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      ...(patch.cover !== undefined ? { cover: patch.cover !== null } : {})
    }
    const campaign = await campaignsRepo.updateCampaign(
      ctx.db,
      historyContext(ctx, 'updateCampaign', details, current),
      campaignId,
      patch
    )
    ctx.realtime.publish(campaignsChanged({ campaignId, worldId: current.worldId }))
    return presentCampaign({ ...campaign, role: ctx.actor.campaigns.get(campaignId)?.role ?? ('master' as const) })
  })
]
