import { campaignsRepo } from '@crisol/db'
import { authorize, type Capability, NotFoundError, ownedOrganizations } from '@crisol/domain'
import { type ActionContext, InvalidRequestError } from './context.ts'

/** La campaña, si la cuenta puede hacer eso en ella. Si no existe, se decide como si nadie la viera: 404 */
export async function authorizedCampaign(ctx: ActionContext, capability: Capability, campaignId: string) {
  const campaign = await campaignsRepo.findCampaign(ctx.db, campaignId)
  authorize(ctx.actor, capability, { campaignId, worldId: campaign?.worldId ?? '' })
  if (!campaign) throw new NotFoundError('campaign')
  return campaign
}

/** La organización que se pide o, si no se dice, la única de la que la cuenta es propietaria */
export function targetOrganization(ctx: ActionContext, organizationId: string | undefined): string {
  const owned = ownedOrganizations(ctx.actor)
  const target = organizationId ?? (owned.length === 1 ? owned[0] : undefined)
  if (!target) throw new InvalidRequestError('ORGANIZATION_REQUIRED')
  return target
}
