import { campaignsRepo } from '@crisol/db'
import { authorize, type Capability, NotFoundError } from '@crisol/domain'
import type { ActionContext } from './context.ts'

/** La campaña, si la cuenta puede hacer eso en ella. Si no existe, se decide como si nadie la viera: 404 */
export async function authorizedCampaign(ctx: ActionContext, capability: Capability, campaignId: string) {
  const campaign = await campaignsRepo.findCampaign(ctx.db, campaignId)
  authorize(ctx.actor, capability, { campaignId, worldId: campaign?.worldId ?? '' })
  if (!campaign) throw new NotFoundError('campaign')
  return campaign
}
