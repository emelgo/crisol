import { aiActions } from './ai.ts'
import { campaignActions } from './campaigns.ts'
import { historyActions } from './history.ts'
import { invitationActions } from './invitations.ts'
import { memberActions } from './members.ts'
import { organizationActions } from './organizations.ts'
import { pageActions } from './pages.ts'
import type { Implementation } from './registry.ts'
import { trashActions } from './trash.ts'
import { worldActions } from './worlds.ts'

/** Los servicios de todas las acciones del contrato: los usan la API y el MCP */
export const IMPLEMENTATIONS: Implementation[] = [
  ...organizationActions,
  ...worldActions,
  ...campaignActions,
  ...invitationActions,
  ...memberActions,
  ...historyActions,
  ...trashActions,
  ...aiActions,
  ...pageActions
]

export const implementationsByName = new Map(IMPLEMENTATIONS.map((impl) => [impl.action.name, impl]))
