import type { RealtimeEvent } from './hub.ts'

/** Una campaña con su mundo: el ámbito de los eventos de campaña */
export interface CampaignScope {
  campaignId: string
  worldId: string
}

/** El mundo (su nombre, sus campañas): a quien lo ve */
export const worldsChanged = (worldId: string): RealtimeEvent => ({
  to: { capability: 'world.read', target: { worldId } },
  message: { type: 'changed', what: 'worlds' }
})

/** Una campaña nueva o cambiada: a quien la ve (el máster del mundo y los que están en ella) */
export const campaignsChanged = (scope: CampaignScope): RealtimeEvent => ({
  to: { capability: 'campaign.read', target: scope },
  message: { type: 'changed', what: 'campaigns', worldId: scope.worldId }
})

export const membersChanged = (scope: CampaignScope): RealtimeEvent => ({
  to: { capability: 'campaign.read', target: scope },
  message: { type: 'changed', what: 'members', campaignId: scope.campaignId }
})

/** El enlace: solo a quien lo gestiona */
export const invitationChanged = (scope: CampaignScope): RealtimeEvent => ({
  to: { capability: 'campaign.invite', target: scope },
  message: { type: 'changed', what: 'invitation', campaignId: scope.campaignId }
})

/** Alguien ha entrado con el enlace: a quien puede expulsarlo */
export const memberJoined = (
  scope: CampaignScope,
  campaign: string,
  member: { userId: string; name: string }
): RealtimeEvent => ({
  to: { capability: 'campaign.removeMember', target: scope },
  message: { type: 'joined', ...scope, campaign, member }
})
