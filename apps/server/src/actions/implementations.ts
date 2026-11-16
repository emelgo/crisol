import { actorFolderActions } from './actor-folders.ts'
import { aiActions } from './ai.ts'
import { bookActions } from './books.ts'
import { calendarActions } from './calendars.ts'
import { campaignActions } from './campaigns.ts'
import { chapterActions } from './chapters.ts'
import { characterActions } from './characters.ts'
import { chronologyActions } from './chronologies.ts'
import { combatActions } from './combat.ts'
import { compendiumActions } from './compendium.ts'
import { copyPageActions } from './copy-page.ts'
import { creatureActions } from './creatures.ts'
import { diceActions } from './dice.ts'
import { fileActions } from './files.ts'
import { foundryActions } from './foundry.ts'
import { foundrySceneActions } from './foundry-scenes.ts'
import { historyActions } from './history.ts'
import { iconActions } from './icons.ts'
import { invitationActions } from './invitations.ts'
import { knowledgeActions } from './knowledge.ts'
import { libraryActions } from './library.ts'
import { linkActions } from './links.ts'
import { logActions } from './log.ts'
import { mapActions } from './maps.ts'
import { memberActions } from './members.ts'
import { noteActions } from './notes.ts'
import { organizationActions } from './organizations.ts'
import { pageContentActions } from './page-content.ts'
import { pageActions } from './pages.ts'
import { partyActions } from './party.ts'
import { preferenceActions } from './preferences.ts'
import { previewActions } from './preview.ts'
import type { Implementation } from './registry.ts'
import { revealActions } from './reveal.ts'
import { roomActions } from './room.ts'
import { sceneActions } from './scenes.ts'
import { searchActions } from './search.ts'
import { soundActions } from './sound.ts'
import { systemActions } from './systems.ts'
import { tableToolActions } from './table-tools.ts'
import { tableActions } from './tables.ts'
import { tagActions } from './tags.ts'
import { templateActions } from './templates.ts'
import { tokenActions } from './tokens.ts'
import { trashActions } from './trash.ts'
import { versionActions } from './versions.ts'
import { visionActions } from './vision.ts'
import { worldContentActions } from './world-content.ts'
import { worldActions } from './worlds.ts'

/** Los servicios de todas las acciones del contrato: los usan la API y el MCP */
export const IMPLEMENTATIONS: Implementation[] = [
  ...organizationActions,
  ...worldActions,
  ...calendarActions,
  ...chronologyActions,
  ...campaignActions,
  ...diceActions,
  ...logActions,
  ...actorFolderActions,
  ...invitationActions,
  ...memberActions,
  ...noteActions,
  ...soundActions,
  ...roomActions,
  ...historyActions,
  ...trashActions,
  ...aiActions,
  ...pageActions,
  ...pageContentActions,
  ...copyPageActions,
  ...linkActions,
  ...previewActions,
  ...versionActions,
  ...fileActions,
  ...searchActions,
  ...tagActions,
  ...iconActions,
  ...templateActions,
  ...systemActions,
  ...bookActions,
  ...foundryActions,
  ...foundrySceneActions,
  ...compendiumActions,
  ...chapterActions,
  ...worldContentActions,
  ...characterActions,
  ...creatureActions,
  ...partyActions,
  ...sceneActions,
  ...tokenActions,
  ...combatActions,
  ...visionActions,
  ...tableToolActions,
  ...knowledgeActions,
  ...revealActions,
  ...libraryActions,
  ...tableActions,
  ...mapActions,
  ...preferenceActions
]

export const implementationsByName = new Map(IMPLEMENTATIONS.map((impl) => [impl.action.name, impl]))
