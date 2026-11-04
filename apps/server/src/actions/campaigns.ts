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
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { prepareSecret } from './invitations.ts'
import { implement } from './registry.ts'
import { type CampaignSystem, campaignSystems, chosenSystem } from './systems.ts'
import { presentWorld } from './worlds.ts'

type CampaignRow = { color: string | null; system: string | null; systemChoices: unknown }

/** Si quien la ve juega en ella (lo dice su papel, si la fila lo lleva) */
const player = (row: object) => 'role' in row && row.role === 'player'

/** Una campaña de la base de datos, como la da la API: el color, solo si es de los que se ofrecen; con su sistema */
function presentCampaign<T extends CampaignRow>(row: T, systems: ReadonlyMap<string, CampaignSystem>) {
  const color = worldColor.safeParse(row.color)
  return {
    ...row,
    color: color.success ? color.data : null,
    system: row.system ? (systems.get(row.system) ?? null) : null,
    // Lo elegido del sistema (fuentes, ajustes) es del máster; un jugador solo ve el sistema, para sus dados
    systemChoices: (row.system && player(row) === false ? row.systemChoices : null) as Campaign['systemChoices']
  }
}

/** Varias, con los sistemas de todas de una vez */
async function present<T extends CampaignRow>(ctx: ActionContext, rows: readonly T[]) {
  const systems = await campaignSystems(
    ctx,
    rows.map((r) => r.system)
  )
  return rows.map((row) => presentCampaign(row, systems))
}
const presentOne = async <T extends CampaignRow>(ctx: ActionContext, row: T) =>
  (await present(ctx, [row]))[0] as ReturnType<typeof presentCampaign<T>>

export const campaignActions = [
  implement(listCampaigns, async (ctx, { worldId }) => {
    authorize(ctx.actor, 'world.read', { worldId })
    // El máster del mundo ve todas sus campañas; un jugador, solo las suyas
    const onlyMember = ctx.actor.worlds.get(worldId)?.role !== 'master'
    const campaigns = await campaignsRepo.listCampaigns(ctx.db, { worldId, userId: ctx.actor.userId, onlyMember })
    return { campaigns: await present(ctx, campaigns) }
  }),

  implement(listWorldsWithCampaigns, async (ctx) => {
    const userId = ctx.actor.userId
    const worlds = await worldsRepo.listMemberWorlds(ctx.db, userId)
    return {
      worlds: await Promise.all(
        worlds.map(async (world) => ({
          ...presentWorld(world),
          campaigns: await present(
            ctx,
            await campaignsRepo.listCampaigns(ctx.db, {
              worldId: world.id,
              userId,
              onlyMember: world.role !== 'master'
            })
          )
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
      campaign: await presentOne(ctx, {
        id: found.id,
        worldId: found.worldId,
        name: found.name,
        description: found.description,
        color: found.color,
        cover: found.cover,
        system: found.system,
        systemChoices: found.systemChoices,
        role,
        version: found.version
      }),
      world: { id: world.id, name: world.name },
      members: await membersRepo.listCampaignMembers(ctx.db, campaignId)
    }
  }),

  implement(createCampaign, async (ctx, { worldId, name, system, systemChoices }) => {
    authorize(ctx.actor, 'campaign.create', { worldId })
    const world = await worldsRepo.findWorld(ctx.db, worldId)
    if (!world) throw new NotFoundError('world')
    const chosen = await chosenSystem(ctx, world.organizationId, { system, systemChoices })
    const campaign = await campaignsRepo.createCampaignWithMaster(
      ctx.db,
      historyContext(ctx, 'createCampaign', { name, world: world.name }, world),
      {
        worldId,
        name,
        masterId: ctx.actor.userId,
        invitation: prepareSecret(ctx.sealKey),
        system: chosen?.system ?? null,
        systemChoices: chosen?.systemChoices ?? null
      }
    )
    ctx.realtime.publish(campaignsChanged({ campaignId: campaign.id, worldId }))
    return presentOne(ctx, { ...campaign, role: 'master' as const })
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
    return presentOne(ctx, { ...campaign, role: ctx.actor.campaigns.get(campaignId)?.role ?? ('master' as const) })
  }),

  implement(updateCampaign, async (ctx, { campaignId, system, systemChoices, ...look }) => {
    const current = await authorizedCampaign(ctx, 'campaign.rename', campaignId)
    // Su sistema, de serie o de la cuenta de su mundo, con lo que elige de él completo y comprobado
    const chosen = await chosenSystem(ctx, current.organizationId, { system, systemChoices }, current)
    const patch = { ...look, ...(chosen ? { system: chosen.system, systemChoices: chosen.systemChoices } : {}) }
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
      ...(patch.cover !== undefined ? { cover: patch.cover !== null } : {}),
      ...(chosen && chosen.system !== current.system ? { system: chosen.name ?? null } : {}),
      ...(chosen && chosen.system === current.system ? { systemChoices: true } : {})
    }
    const campaign = await campaignsRepo.updateCampaign(
      ctx.db,
      historyContext(ctx, 'updateCampaign', details, current),
      campaignId,
      patch
    )
    ctx.realtime.publish(campaignsChanged({ campaignId, worldId: current.worldId }))
    return presentOne(ctx, { ...campaign, role: ctx.actor.campaigns.get(campaignId)?.role ?? ('master' as const) })
  })
]
