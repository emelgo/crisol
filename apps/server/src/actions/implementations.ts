import { campaignActions } from './campaigns.ts'
import { invitationActions } from './invitations.ts'
import { organizationActions } from './organizations.ts'
import type { Implementation } from './registry.ts'
import { worldActions } from './worlds.ts'

/** Los servicios de todas las acciones del contrato: los usan la API y el MCP */
export const IMPLEMENTATIONS: Implementation[] = [
  ...organizationActions,
  ...worldActions,
  ...campaignActions,
  ...invitationActions
]

export const implementationsByName = new Map(IMPLEMENTATIONS.map((impl) => [impl.action.name, impl]))
