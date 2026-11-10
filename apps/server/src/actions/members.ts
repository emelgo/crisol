import { getTablePresence, leaveCampaign, listMembers, removeMember } from '@crisol/contracts'
import { charactersRepo, membersRepo, scenesRepo } from '@crisol/db'
import { NotFoundError } from '@crisol/domain'
import { membersChanged } from '../realtime/events.ts'
import { authorizedCampaign } from './access.ts'
import { historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

export const memberActions = [
  implement(listMembers, async (ctx, { campaignId }) => {
    await authorizedCampaign(ctx, 'campaign.read', campaignId)
    return { members: await membersRepo.listCampaignMembers(ctx.db, campaignId) }
  }),

  // La sala (ADR-0021, docs/specs/sala.md): quién está en la Mesa (con su personaje y su color), quién tiene abierta la
  // campaña fuera de ella, a quién echó el máster, la pausa y el modo (el máster va primero)
  implement(getTablePresence, async (ctx, { campaignId }) => {
    await authorizedCampaign(ctx, 'campaign.read', campaignId)
    const [members, table, characters] = await Promise.all([
      membersRepo.listCampaignMembers(ctx.db, campaignId),
      scenesRepo.campaignTable(ctx.db, campaignId),
      charactersRepo.listCharacters(ctx.db, campaignId)
    ])
    const byId = new Map(members.map((m) => [m.userId, m]))
    const characterOf = (userId: string) => {
      const found = characters.find((c) => c.ownerId === userId)
      return found ? { id: found.id, name: found.name } : null
    }
    const present = (ctx.presence?.list(campaignId) ?? []).map((entry) => ({
      ...entry,
      name: byId.get(entry.userId)?.name ?? '',
      color: byId.get(entry.userId)?.color ?? null,
      character: entry.viewer === 'player' ? characterOf(entry.userId) : null
    }))
    const atTable = new Set(present.map((p) => p.userId))
    const inCampaign = (ctx.presence?.inCampaign(campaignId) ?? [])
      .filter((userId) => !atTable.has(userId) && byId.has(userId))
      .map((userId) => ({ userId, name: byId.get(userId)?.name ?? '', color: byId.get(userId)?.color ?? null }))
    const kicked = table.kicked
      .filter((userId) => byId.has(userId))
      .map((userId) => ({ userId, name: byId.get(userId)?.name ?? '' }))
    return { present, inCampaign, kicked, paused: table.paused, movement: table.movement }
  }),

  implement(removeMember, async (ctx, { campaignId, userId }) => {
    const campaign = await authorizedCampaign(ctx, 'campaign.removeMember', campaignId)
    const member = await membersRepo.findCampaignMember(ctx.db, campaignId, userId)
    if (!member) throw new NotFoundError('member')
    if (member.role === 'master') throw new InvalidRequestError('MASTER_NOT_REMOVABLE')
    // Si entretanto ha salido, el resultado es el mismo: ya no está
    await membersRepo.removeCampaignMember(
      ctx.db,
      historyContext(ctx, 'removeMember', { campaign: campaign.name, member: member.name }, campaign),
      { campaignId, organizationId: campaign.organizationId, userId }
    )
    const scope = { campaignId, worldId: campaign.worldId }
    ctx.realtime.revoke(userId, scope)
    ctx.realtime.publish(membersChanged(scope))
    // Si escribía en una página de jugadores, deja de hacerlo
    ctx.collab?.closeWorldPlayers(campaign.worldId)
    return { members: await membersRepo.listCampaignMembers(ctx.db, campaignId) }
  }),

  implement(leaveCampaign, async (ctx, { campaignId }) => {
    const campaign = await authorizedCampaign(ctx, 'campaign.leave', campaignId)
    await membersRepo.removeCampaignMember(
      ctx.db,
      historyContext(ctx, 'leaveCampaign', { campaign: campaign.name }, campaign),
      { campaignId, organizationId: campaign.organizationId, userId: ctx.actor.userId }
    )
    // También a sus otras pestañas
    const scope = { campaignId, worldId: campaign.worldId }
    ctx.realtime.revoke(ctx.actor.userId, scope)
    ctx.realtime.publish(membersChanged(scope))
    ctx.collab?.closeWorldPlayers(campaign.worldId)
    return {}
  })
]
