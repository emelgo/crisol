import { getTablePresence, leaveCampaign, listMembers, removeMember } from '@crisol/contracts'
import { membersRepo } from '@crisol/db'
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

  // Quién está ahora en la Mesa (ADR-0021): con su nombre, el de la campaña (el máster va primero)
  implement(getTablePresence, async (ctx, { campaignId }) => {
    await authorizedCampaign(ctx, 'campaign.read', campaignId)
    const present = ctx.presence?.list(campaignId) ?? []
    if (present.length === 0) return { present: [] }
    const names = new Map((await membersRepo.listCampaignMembers(ctx.db, campaignId)).map((m) => [m.userId, m.name]))
    return { present: present.map((entry) => ({ ...entry, name: names.get(entry.userId) ?? '' })) }
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
