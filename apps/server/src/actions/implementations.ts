import { aiActions } from './ai.ts'
import { campaignActions } from './campaigns.ts'
import { characterActions } from './characters.ts'
import { compendiumActions } from './compendium.ts'
import { creatureActions } from './creatures.ts'
import { diceActions } from './dice.ts'
import { fileActions } from './files.ts'
import { foundryActions } from './foundry.ts'
import { historyActions } from './history.ts'
import { invitationActions } from './invitations.ts'
import { linkActions } from './links.ts'
import { mapActions } from './maps.ts'
import { memberActions } from './members.ts'
import { organizationActions } from './organizations.ts'
import { pageContentActions } from './page-content.ts'
import { pageActions } from './pages.ts'
import { partyActions } from './party.ts'
import { preferenceActions } from './preferences.ts'
import { previewActions } from './preview.ts'
import type { Implementation } from './registry.ts'
import { searchActions } from './search.ts'
import { systemActions } from './systems.ts'
import { tableActions } from './tables.ts'
import { tagActions } from './tags.ts'
import { templateActions } from './templates.ts'
import { trashActions } from './trash.ts'
import { versionActions } from './versions.ts'
import { worldContentActions } from './world-content.ts'
import { worldActions } from './worlds.ts'

/** Los servicios de todas las acciones del contrato: los usan la API y el MCP */
export const IMPLEMENTATIONS: Implementation[] = [
  ...organizationActions,
  ...worldActions,
  ...campaignActions,
  ...diceActions,
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
  ...searchActions,
  ...tagActions,
  ...templateActions,
  ...systemActions,
  ...foundryActions,
  ...compendiumActions,
  ...worldContentActions,
  ...characterActions,
  ...creatureActions,
  ...partyActions,
  ...tableActions,
  ...mapActions,
  ...preferenceActions
]

export const implementationsByName = new Map(IMPLEMENTATIONS.map((impl) => [impl.action.name, impl]))
