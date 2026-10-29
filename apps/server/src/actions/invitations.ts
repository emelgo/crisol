import { getInvitation, type Invitation, regenerateInvitation, setInvitationsOpen } from '@crisol/contracts'
import { invitationsRepo } from '@crisol/db'
import { NotFoundError } from '@crisol/domain'
import { invitationChanged } from '../realtime/events.ts'
import { hashSecret, newSecret, openSecret, sealSecret } from '../secrets.ts'
import { authorizedCampaign } from './access.ts'
import { type ActionContext, historyContext } from './context.ts'
import { implement } from './registry.ts'

/** Un secreto nuevo: lo que se guarda (hash y cifrado) */
export function prepareSecret(sealKey: Buffer) {
  const secret = newSecret()
  return { tokenHash: hashSecret(secret), secretSealed: sealSecret(secret, sealKey) }
}

type Row = Awaited<ReturnType<typeof invitationsRepo.findInvitation>>

/** El enlace tal como lo ve el máster. Si no hay o no se puede descifrar (otra clave), url es null */
function view(ctx: ActionContext, campaignId: string, row: Row): Invitation {
  if (!row) return { campaignId, url: null, open: true, issuedAt: null, joins: 0 }
  let url: string | null = null
  try {
    url = new URL(`/unirse/${openSecret(row.secretSealed, ctx.sealKey)}`, ctx.publicUrl).toString()
  } catch {
    url = null
  }
  return { campaignId, url, open: row.open, issuedAt: row.issuedAt.toISOString(), joins: row.joins }
}

/** La campaña, si la cuenta puede gestionar su enlace */
const managedCampaign = (ctx: ActionContext, campaignId: string) =>
  authorizedCampaign(ctx, 'campaign.invite', campaignId)

export const invitationActions = [
  implement(getInvitation, async (ctx, { campaignId }) => {
    await managedCampaign(ctx, campaignId)
    return view(ctx, campaignId, await invitationsRepo.findInvitation(ctx.db, campaignId))
  }),

  implement(regenerateInvitation, async (ctx, { campaignId }) => {
    const campaign = await managedCampaign(ctx, campaignId)
    const row = await invitationsRepo.regenerateInvitation(
      ctx.db,
      historyContext(ctx, 'regenerateInvitation', { campaign: campaign.name }, campaign),
      campaignId,
      prepareSecret(ctx.sealKey)
    )
    ctx.realtime.publish(invitationChanged({ campaignId, worldId: campaign.worldId }))
    return view(ctx, campaignId, row)
  }),

  implement(setInvitationsOpen, async (ctx, { campaignId, open }) => {
    const campaign = await managedCampaign(ctx, campaignId)
    const row = await invitationsRepo.setInvitationsOpen(
      ctx.db,
      historyContext(ctx, 'setInvitationsOpen', { campaign: campaign.name, open }, campaign),
      campaignId,
      open
    )
    if (!row) throw new NotFoundError('invitation')
    ctx.realtime.publish(invitationChanged({ campaignId, worldId: campaign.worldId }))
    return view(ctx, campaignId, row)
  })
]
