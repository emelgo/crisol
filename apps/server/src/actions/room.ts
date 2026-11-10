/**
 * La sala de cada campaña (docs/specs/sala.md, ADR-0022): la pausa, el modo de movimiento y echar de la Mesa. Todo lo
 * decide el servidor: la interfaz solo lo enseña
 */
import { allowBackToTable, kickFromTable, setTableControls } from '@crisol/contracts'
import { membersRepo, scenesRepo } from '@crisol/db'
import { NotFoundError } from '@crisol/domain'
import { tablePresenceChanged } from '../realtime/events.ts'
import { authorizedCampaign } from './access.ts'
import { InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

export const roomActions = [
  implement(setTableControls, async (ctx, { campaignId, paused, movement }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const patch = { ...(paused === undefined ? {} : { paused }), ...(movement === undefined ? {} : { movement }) }
    const row =
      Object.keys(patch).length > 0
        ? await scenesRepo.setCampaignTable(ctx.db, campaignId, patch)
        : await scenesRepo.campaignTable(ctx.db, campaignId)
    ctx.table?.changed(campaignId)
    ctx.realtime.publish(tablePresenceChanged({ campaignId, worldId: campaign.worldId }))
    return { paused: row.paused, movement: row.movement }
  }),

  implement(kickFromTable, async (ctx, { campaignId, userId }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    if (userId === ctx.actor.userId) throw new InvalidRequestError('CANNOT_KICK_SELF')
    const member = await membersRepo.findCampaignMember(ctx.db, campaignId, userId)
    if (!member) throw new NotFoundError('member')
    if (member.role === 'master') throw new InvalidRequestError('MASTER_NOT_KICKABLE')
    await scenesRepo.kickFromTable(ctx.db, campaignId, userId)
    ctx.presence?.disconnect(campaignId, userId)
    ctx.realtime.publish(tablePresenceChanged({ campaignId, worldId: campaign.worldId }))
    return { ok: true as const }
  }),

  implement(allowBackToTable, async (ctx, { campaignId, userId }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    await scenesRepo.allowBackToTable(ctx.db, campaignId, userId)
    ctx.realtime.publish(tablePresenceChanged({ campaignId, worldId: campaign.worldId }))
    return { ok: true as const }
  })
]
