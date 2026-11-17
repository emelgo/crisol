import type { RealtimeEvent } from './hub.ts'

/** Una campaña con su mundo: el ámbito de los eventos de campaña */
export interface CampaignScope {
  campaignId: string
  worldId: string
}

/** Quién está en la Mesa de una campaña: a quien la ve (la sección Mesa lo enseña en vivo, ADR-0021) */
export const tablePresenceChanged = (scope: CampaignScope): RealtimeEvent => ({
  to: { capability: 'campaign.read', target: scope },
  message: { type: 'changed', what: 'tablePresence', campaignId: scope.campaignId }
})

/**
 * Algo nuevo en el centro de actividad de una campaña (8 · campaña): un cambio de fecha, a todos; las notas y los
 * personajes de los jugadores, solo a los másteres (master: true). El aviso no dice qué
 */
export const activityChanged = (scope: CampaignScope, master = false): RealtimeEvent => ({
  to: { capability: master ? 'notes.read' : 'campaign.read', target: scope },
  message: { type: 'changed', what: 'activity', campaignId: scope.campaignId }
})

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

/**
 * La wiki de un mundo: su árbol o la fila de una página. A quien la lee (ADR-0017: también los jugadores, que vuelven a
 * pedir lo suyo, ya proyectado; el aviso no dice qué cambió)
 */
export const pagesChanged = (wiki: { worldId: string; organizationId: string }): RealtimeEvent => ({
  to: { capability: 'page.view', target: wiki },
  message: { type: 'changed', what: 'pages', worldId: wiki.worldId }
})

/**
 * Los calendarios de un mundo: a quien lee su wiki (los jugadores también los leen, sin las eras solo del máster; el
 * aviso no dice qué cambió)
 */
export const calendarsChanged = (wiki: { worldId: string; organizationId: string }): RealtimeEvent => ({
  to: { capability: 'page.view', target: wiki },
  message: { type: 'changed', what: 'calendars', worldId: wiki.worldId }
})

/**
 * Las cronologías de un mundo, sus grupos o sus eventos (módulo 8): a quien lee su wiki (un jugador las vuelve a pedir
 * ya proyectadas; el aviso no dice qué cambió)
 */
export const chronologiesChanged = (wiki: { worldId: string; organizationId: string }): RealtimeEvent => ({
  to: { capability: 'page.view', target: wiki },
  message: { type: 'changed', what: 'chronologies', worldId: wiki.worldId }
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

/** Las criaturas en juego de una campaña: a todos los de ella (los jugadores ven las que están a la vista, sin números) */
export const creaturesChanged = (scope: CampaignScope): RealtimeEvent => ({
  to: { capability: 'campaign.read', target: scope },
  message: { type: 'changed', what: 'creatures', campaignId: scope.campaignId }
})

/** El inventario del grupo de una campaña (y lo que llevan sus personajes): a todos los de la campaña */
export const partyChanged = (scope: CampaignScope, characters?: readonly string[]): RealtimeEvent => ({
  to: { capability: 'campaign.read', target: scope },
  message: {
    type: 'changed',
    what: 'party',
    campaignId: scope.campaignId,
    ...(characters ? { characters: [...characters] } : {})
  }
})

/** El compendio de un mundo: a quien lo ve (hasta el módulo 5, quien lo lleva; las hojas de los jugadores, al volver a pedirlas) */
export const worldContentChanged = (wiki: { worldId: string; organizationId: string }): RealtimeEvent => ({
  to: { capability: 'worldContent.read', target: wiki },
  message: { type: 'changed', what: 'worldContent', worldId: wiki.worldId }
})

/** Lo que sabe una campaña (o todo el mundo) cambió: a quien lee la wiki del mundo, sin decir qué (ADR-0017) */
export const knowledgeChanged = (
  wiki: { worldId: string; organizationId: string },
  campaignId: string | null
): RealtimeEvent => ({
  // Lo de una campaña, a quien está en ella (y al máster del mundo); lo del mundo, a todos los que leen sus páginas
  to: campaignId
    ? { capability: 'campaign.read', target: { campaignId, worldId: wiki.worldId } }
    : { capability: 'page.view', target: wiki },
  message: { type: 'changed', what: 'knowledge', worldId: wiki.worldId, campaignId }
})

/** El texto de una página se guardó: a quien la ve (lo que la enseña en otra se vuelve a pedir) */
export const pageContentChanged = (
  wiki: { worldId: string; organizationId: string },
  pageId: string
): RealtimeEvent => ({
  // A un jugador, solo si ve esa página
  to: { capability: 'page.view', target: wiki, page: pageId },
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
      // Las escenas sueltas (ADR-0020): sus listas cuelgan de las páginas en la web
      case 'scenes':
        events.push(pagesChanged({ worldId, organizationId: context.organizationId }))
        break
      case 'calendars':
        events.push(calendarsChanged({ worldId, organizationId: context.organizationId }))
        break
      case 'chronologies':
      case 'timeline_groups':
      case 'timeline_events':
        events.push(chronologiesChanged({ worldId, organizationId: context.organizationId }))
        break
      case 'tags':
        events.push(tagsChanged(String(row.organization_id ?? context.organizationId)))
        break
      case 'page_templates':
      case 'template_folders':
        events.push(templatesChanged(String(row.organization_id ?? context.organizationId)))
        break
      case 'systems':
      case 'system_content':
        if (context.organizationId) events.push(systemsChanged(String(row.organization_id ?? context.organizationId)))
        break
      case 'campaign_creatures':
        events.push(creaturesChanged(campaignScope))
        break
      case 'campaign_party':
        events.push(partyChanged(campaignScope))
        break
      case 'knowledge':
        events.push(
          knowledgeChanged(
            { worldId, organizationId: context.organizationId },
            (row.campaign_id as string | null) ?? null
          )
        )
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
