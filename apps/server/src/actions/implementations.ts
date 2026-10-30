import { aiActions } from './ai.ts'
import { campaignActions } from './campaigns.ts'
import { fileActions } from './files.ts'
import { historyActions } from './history.ts'
import { invitationActions } from './invitations.ts'
import { linkActions } from './links.ts'
import { memberActions } from './members.ts'
import { organizationActions } from './organizations.ts'
import { pageContentActions } from './page-content.ts'
import { pageActions } from './pages.ts'
import { preferenceActions } from './preferences.ts'
import { previewActions } from './preview.ts'
import type { Implementation } from './registry.ts'
import { trashActions } from './trash.ts'
import { versionActions } from './versions.ts'
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
  ...pageActions,
  ...pageContentActions,
  ...linkActions,
  ...previewActions,
  ...versionActions,
  ...fileActions,
  ...preferenceActions
]

export const implementationsByName = new Map(IMPLEMENTATIONS.map((impl) => [impl.action.name, impl]))
