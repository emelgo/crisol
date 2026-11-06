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

/** La wiki de un mundo: su árbol o la fila de una página. A quien la ve (el máster y el propietario) */
export const pagesChanged = (wiki: { worldId: string; organizationId: string }): RealtimeEvent => ({
  to: { capability: 'page.read', target: wiki },
  message: { type: 'changed', what: 'pages', worldId: wiki.worldId }
})

/** Los archivos de un mundo: a quien ve su wiki */
export const filesChanged = (wiki: { worldId: string; organizationId: string }): RealtimeEvent => ({
  to: { capability: 'page.read', target: wiki },
  message: { type: 'changed', what: 'files', worldId: wiki.worldId }
})

/** Los archivos comunes de una organización: a quien los ve (el propietario y los másteres de sus mundos) */
export const commonFilesChanged = (organizationId: string): RealtimeEvent => ({
  to: { capability: 'commonFiles.read', target: { organizationId } },
  message: { type: 'changed', what: 'commonFiles', organizationId }
})

/** Las etiquetas de la cuenta: a quien las ve */
export const tagsChanged = (organizationId: string): RealtimeEvent => ({
  to: { capability: 'tags.read', target: { organizationId } },
  message: { type: 'changed', what: 'tags', organizationId }
})

export const templatesChanged = (organizationId: string): RealtimeEvent => ({
  to: { capability: 'templates.read', target: { organizationId } },
  message: { type: 'changed', what: 'templates', organizationId }
})

export const systemsChanged = (organizationId: string): RealtimeEvent => ({
  to: { capability: 'systems.read', target: { organizationId } },
  message: { type: 'changed', what: 'systems', organizationId }
})

/** El compendio de un mundo: a quien lo ve (hasta el módulo 5, quien lo lleva; las hojas de los jugadores, al volver a pedirlas) */
export const worldContentChanged = (wiki: { worldId: string; organizationId: string }): RealtimeEvent => ({
  to: { capability: 'worldContent.read', target: wiki },
  message: { type: 'changed', what: 'worldContent', worldId: wiki.worldId }
})

/** El texto de una página se guardó: a quien la ve (lo que la enseña en otra se vuelve a pedir) */
export const pageContentChanged = (
  wiki: { worldId: string; organizationId: string },
  pageId: string
): RealtimeEvent => ({
  to: { capability: 'page.read', target: wiki },
  message: { type: 'changed', what: 'pageContent', worldId: wiki.worldId, pageId }
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

/** La cola de la IA de una cuenta: solo a ella */
export const approvalsChanged = (userId: string): RealtimeEvent => ({
  to: { userId },
  message: { type: 'changed', what: 'approvals' }
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

export function undoEvents(
  applied: readonly Applied[],
  context: { worldId: string | null; organizationId: string; actorId: string }
) {
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
      case 'pages':
      case 'page_tabs':
      case 'maps':
      case 'map_pins':
      case 'map_elements':
        events.push(pagesChanged({ worldId, organizationId: context.organizationId }))
        break
      case 'tags':
        events.push(tagsChanged(String(row.organization_id ?? context.organizationId)))
        break
      case 'page_templates':
        events.push(templatesChanged(String(row.organization_id ?? context.organizationId)))
        break
      case 'systems':
      case 'system_content':
        if (context.organizationId) events.push(systemsChanged(String(row.organization_id ?? context.organizationId)))
        break
      case 'world_content':
        events.push(worldContentChanged({ worldId, organizationId: context.organizationId }))
        break
      case 'files':
      case 'file_folders':
        // Uno común (sin mundo): a quien ve los comunes de su organización
        if (change.after?.world_id === null || change.before?.world_id === null) {
          events.push(commonFilesChanged(String(row.organization_id ?? context.organizationId)))
        } else events.push(filesChanged({ worldId, organizationId: context.organizationId }))
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
