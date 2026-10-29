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

/** Lo que el deshacer cambió, en avisos: la misma fila de antes o de después dice de qué se trata */
type Applied = {
  tableName: string
  rowId: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}
type UndoEvent = RealtimeEvent | { revoke: string; scope: CampaignScope }

export function undoEvents(applied: readonly Applied[], context: { worldId: string | null; actorId: string }) {
  const events: UndoEvent[] = [
    // Sus otras pestañas, aunque ya no vea lo que deshizo (un mundo quitado)
    { to: { userId: context.actorId }, message: { type: 'changed', what: 'worlds' } }
  ]
  for (const change of applied) {
    const row = change.after ?? change.before ?? {}
    const worldId = String(row.world_id ?? context.worldId ?? '')
    const campaignScope = { campaignId: String(row.campaign_id ?? ''), worldId }
    switch (change.tableName) {
      case 'worlds':
        events.push(worldsChanged(change.rowId))
        break
      case 'world_members':
        events.push(worldsChanged(worldId))
        break
      case 'campaigns':
        events.push(campaignsChanged({ campaignId: change.rowId, worldId }))
        break
      case 'invitation_links':
        events.push(invitationChanged(campaignScope))
        break
      case 'campaign_members': {
        const userId = String(row.user_id ?? '')
        events.push(membersChanged(campaignScope))
        // Quitada: deja de estar al momento; puesta otra vez: tiene un mundo más
        if (change.after === null) events.push({ revoke: userId, scope: campaignScope })
        else if (change.before === null) events.push({ to: { userId }, message: { type: 'changed', what: 'worlds' } })
        break
      }
    }
  }
  return events
}
