import {
  createActorFolder,
  deleteActorFolder,
  listActorFolders,
  moveToActorFolder,
  renameActorFolder
} from './actor-folders.ts'
import { approve, getAiSettings, listApprovals, reject, setAiMode } from './ai.ts'
import {
  createBook,
  deleteBook,
  getBookEntries,
  getSystemBooks,
  importBook,
  listPending,
  proposeContent,
  settlePending,
  updateBook
} from './books.ts'
import {
  createCampaign,
  getCampaign,
  listCampaigns,
  listWorldsWithCampaigns,
  renameCampaign,
  updateCampaign
} from './campaigns.ts'
import {
  chooseForCharacter,
  createCharacter,
  deleteCharacter,
  getCharacter,
  listCharacters,
  listCharacterVersions,
  playCharacter,
  restoreCharacterVersion,
  rollForCharacter,
  updateCharacter
} from './characters.ts'
import {
  addCombatants,
  endCombat,
  getCombat,
  groupCombatants,
  nextTurn,
  orderCombatants,
  previousTurn,
  removeCombatants,
  rollInitiative,
  setInitiative,
  startCombat,
  updateCombat
} from './combat.ts'
import {
  applyRoll,
  getInPlay,
  listInPlay,
  listVisibleInPlay,
  playCreature,
  putInPlay,
  removeFromPlay,
  rollForCreature,
  setCreatureHidden
} from './creatures.ts'
import { deleteRolls, listRolls, rollDice, tryDice } from './dice.ts'
import {
  createFolder,
  deleteFile,
  deleteFiles,
  deleteFolder,
  listCommonFiles,
  listFiles,
  moveFile,
  moveFiles,
  renameFile,
  restoreFile,
  updateFolder
} from './files.ts'
import { importFoundry, inspectFoundry, putSystemImages } from './foundry.ts'
import { importFoundryScenes, inspectFoundryScenes } from './foundry-scenes.ts'
import { listHistory, undoOperation } from './history.ts'
import { getInvitation, regenerateInvitation, setInvitationsOpen } from './invitations.ts'
import {
  clearScreenShow,
  getPageKnowledge,
  getSecretsKnowledge,
  hide,
  listCampaignKnowledge,
  listKnownPages,
  listNews,
  reveal,
  seeNews,
  setKnowledge,
  setPageEditors,
  showImage,
  showPage
} from './knowledge.ts'
import { getBookPages, listLibrary, readBookAgain, searchLibrary } from './library.ts'
import { clearLog, deleteMessage, listLog, sendMessage } from './log.ts'
import {
  createMapPin,
  createPageTab,
  deleteMapPin,
  deletePageTab,
  getMap,
  listPageTabs,
  updateMap,
  updateMapPin,
  updatePageTab
} from './maps.ts'
import { leaveCampaign, listMembers, removeMember } from './members.ts'
import {
  createPlayerNote,
  deletePlayerNote,
  getPlayerNote,
  listPlayerNotes,
  listPlayerNoteVersions,
  restorePlayerNote,
  updatePlayerNote
} from './notes.ts'
import { listOrganizations } from './organizations.ts'
import {
  copyPage,
  createPage,
  createPageDocument,
  createPages,
  editPage,
  getPage,
  getPageContent,
  getPageLinks,
  getPageTables,
  getPageVersion,
  getWikiPreferences,
  linkMention,
  listPageChildren,
  listPageNames,
  listPageTree,
  listPageVersions,
  listRecentPages,
  listTags,
  listUnresolvedLinks,
  movePage,
  readPage,
  restorePageVersion,
  setBookmarks,
  setPagePanel,
  setPageProperties,
  setPageView,
  setWikiTabs,
  sortPageChildren,
  updatePage
} from './pages.ts'
import { getParty, moveCoins, moveItem, splitCoins, updateParty } from './party.ts'
import {
  createScene,
  deleteScene,
  drawScene,
  getCampaignTable,
  getScene,
  hideScreen,
  listScenes,
  openScene,
  presentScene,
  renameScene,
  setSceneImage,
  setScreenCamera,
  updateScene
} from './scenes.ts'
import { searchWiki } from './search.ts'
import {
  createSoundPlaylist,
  deleteSoundPlaylist,
  getSound,
  listSoundPlaylists,
  nextTrack,
  pauseSound,
  playSound,
  setSoundVolume,
  stopSound,
  updateSoundPlaylist
} from './sound.ts'
import {
  browseCampaignContent,
  checkSystem,
  createSystem,
  deleteSystem,
  deleteSystemContent,
  exportSystem,
  getCampaignCompendium,
  getCampaignContent,
  getSystem,
  getSystemContent,
  getSystemFormat,
  getSystemParts,
  importSystem,
  listSystems,
  putSystemContent,
  resetContentTable,
  rollContentTable,
  searchCampaignContent,
  searchSystemContent,
  tryFormula,
  trySystemAction,
  trySystemRoll,
  updateSystem
} from './systems.ts'
import { allowBackToTable, getTablePresence, kickFromTable, setTableControls } from './table.ts'
import {
  changeMarks,
  createWidget,
  deleteSnapshot,
  deleteWidget,
  getTemplateTokens,
  listMarks,
  listSnapshots,
  listWidgets,
  measureDistance,
  placeTemplate,
  restoreSnapshot,
  saveSnapshot,
  setMeasureOnScreen,
  updateWidget
} from './table-tools.ts'
import { getRandomTable, resetTableDraws, rollOnTable, updateRandomTable } from './tables.ts'
import { addFileTags, createTag, deleteTag, listAccountTags, moveTag, setFileTags, updateTag } from './tags.ts'
import {
  addTemplateTabs,
  createTemplate,
  createTemplateFolder,
  deleteTemplate,
  deleteTemplateFolder,
  getTemplate,
  listTemplates,
  moveTemplate,
  updateTemplate,
  updateTemplateFolder
} from './templates.ts'
import {
  assignToken,
  deleteEncounter,
  listEncounters,
  moveTokens,
  placeEncounter,
  placeTokens,
  removeTokens,
  saveEncounter,
  updateToken
} from './tokens.ts'
import {
  deleteCampaign,
  deletePage,
  deleteWorld,
  listTrash,
  restoreCampaign,
  restorePage,
  restoreWorld
} from './trash.ts'
import {
  changeFog,
  changeSceneSound,
  changeWalls,
  getSceneVision,
  placeImportedWalls,
  placeSceneSound,
  removeSceneSound,
  resetFog,
  setDoor,
  setTileFit,
  updateSceneVision,
  viewAsParty
} from './vision.ts'
import {
  copyContent,
  deleteWorldContent,
  getContentOrigin,
  getLinkedContent,
  pullContentOrigin,
  putWorldContent,
  searchLinkableContent
} from './world-content.ts'
import { createWorld, ensureWorldHome, getWorldHome, listWorlds, renameWorld, updateWorld } from './worlds.ts'

export * from './action.ts'
export * from './actor-folders.ts'
export * from './ai.ts'
export * from './books.ts'
export * from './campaigns.ts'
export * from './characters.ts'
export * from './combat.ts'
export * from './conditions.ts'
export * from './creatures.ts'
export * from './dice.ts'
export * from './files.ts'
export * from './foundry.ts'
export * from './foundry-scenes.ts'
export * from './history.ts'
export * from './invitations.ts'
export * from './knowledge.ts'
export * from './library.ts'
export * from './log.ts'
export * from './maps.ts'
export * from './members.ts'
export * from './notes.ts'
export * from './openapi.ts'
export * from './organizations.ts'
export * from './pages.ts'
export * from './panel.ts'
export * from './party.ts'
export * from './read-as.ts'
export type * from './realtime.ts'
export * from './scenes.ts'
export * from './search.ts'
export * from './sound.ts'
export * from './systems.ts'
export * from './table.ts'
export * from './table-tools.ts'
export * from './tables.ts'
export * from './tags.ts'
export * from './templates.ts'
export * from './tokens.ts'
export * from './trash.ts'
export * from './vision.ts'
export * from './world-content.ts'
export * from './worlds.ts'

/** Todas las acciones de la API */
export const ACTIONS = [
  listOrganizations,
  listWorlds,
  createWorld,
  renameWorld,
  updateWorld,
  listCampaigns,
  createCampaign,
  renameCampaign,
  updateCampaign,
  listWorldsWithCampaigns,
  getCampaign,
  getInvitation,
  regenerateInvitation,
  setInvitationsOpen,
  listMembers,
  removeMember,
  leaveCampaign,
  listHistory,
  undoOperation,
  deleteWorld,
  deleteCampaign,
  listTrash,
  restoreWorld,
  restoreCampaign,
  getAiSettings,
  setAiMode,
  listApprovals,
  approve,
  reject,
  copyPage,
  createPage,
  updatePage,
  movePage,
  getPage,
  listPageChildren,
  listPageTree,
  listRecentPages,
  setPagePanel,
  sortPageChildren,
  setPageProperties,
  listTags,
  deletePage,
  restorePage,
  getWikiPreferences,
  setWikiTabs,
  setBookmarks,
  setPageView,
  createPageDocument,
  readPage,
  createPages,
  editPage,
  listPageNames,
  getPageLinks,
  listUnresolvedLinks,
  linkMention,
  getPageContent,
  listPageVersions,
  getPageVersion,
  restorePageVersion,
  getPageTables,
  getPageKnowledge,
  setKnowledge,
  setPageEditors,
  listKnownPages,
  listVisibleInPlay,
  setCreatureHidden,
  reveal,
  showPage,
  hide,
  listCampaignKnowledge,
  getSecretsKnowledge,
  listNews,
  seeNews,
  listFiles,
  listCommonFiles,
  renameFile,
  deleteFile,
  restoreFile,
  createFolder,
  updateFolder,
  deleteFolder,
  deleteFiles,
  moveFiles,
  moveFile,
  searchWiki,
  listAccountTags,
  createTag,
  updateTag,
  moveTag,
  deleteTag,
  setFileTags,
  addFileTags,
  listPageTabs,
  createPageTab,
  updatePageTab,
  deletePageTab,
  getMap,
  updateMap,
  createMapPin,
  updateMapPin,
  deleteMapPin,
  getWorldHome,
  ensureWorldHome,
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  createTemplateFolder,
  updateTemplateFolder,
  deleteTemplateFolder,
  moveTemplate,
  addTemplateTabs,
  rollDice,
  listRolls,
  tryDice,
  listSystems,
  getSystem,
  createSystem,
  updateSystem,
  deleteSystem,
  deleteSystemContent,
  exportSystem,
  putSystemContent,
  trySystemAction,
  getCampaignCompendium,
  getCampaignContent,
  searchCampaignContent,
  browseCampaignContent,
  rollContentTable,
  resetContentTable,
  putWorldContent,
  deleteWorldContent,
  copyContent,
  getContentOrigin,
  pullContentOrigin,
  listInPlay,
  getInPlay,
  putInPlay,
  playCreature,
  rollForCreature,
  removeFromPlay,
  applyRoll,
  getParty,
  updateParty,
  moveItem,
  moveCoins,
  splitCoins,
  listLibrary,
  searchLibrary,
  getBookPages,
  readBookAgain,
  searchLinkableContent,
  getLinkedContent,
  listCharacters,
  getCharacter,
  createCharacter,
  updateCharacter,
  chooseForCharacter,
  rollForCharacter,
  playCharacter,
  deleteCharacter,
  listCharacterVersions,
  restoreCharacterVersion,
  getRandomTable,
  updateRandomTable,
  rollOnTable,
  resetTableDraws,
  getSystemContent,
  searchSystemContent,
  importSystem,
  getSystemParts,
  checkSystem,
  tryFormula,
  trySystemRoll,
  getSystemFormat,
  inspectFoundry,
  importFoundry,
  putSystemImages,
  inspectFoundryScenes,
  importFoundryScenes,
  listScenes,
  getScene,
  createScene,
  renameScene,
  deleteScene,
  updateScene,
  setSceneImage,
  getCampaignTable,
  openScene,
  presentScene,
  hideScreen,
  setScreenCamera,
  drawScene,
  placeTokens,
  moveTokens,
  assignToken,
  updateToken,
  removeTokens,
  listEncounters,
  saveEncounter,
  deleteEncounter,
  placeEncounter,
  getCombat,
  startCombat,
  addCombatants,
  removeCombatants,
  rollInitiative,
  setInitiative,
  orderCombatants,
  groupCombatants,
  updateCombat,
  nextTurn,
  previousTurn,
  endCombat,
  getSceneVision,
  changeWalls,
  placeImportedWalls,
  updateSceneVision,
  setDoor,
  changeFog,
  resetFog,
  setTileFit,
  viewAsParty,
  placeSceneSound,
  changeSceneSound,
  removeSceneSound,
  setMeasureOnScreen,
  listMarks,
  changeMarks,
  placeTemplate,
  getTemplateTokens,
  measureDistance,
  listWidgets,
  createWidget,
  updateWidget,
  deleteWidget,
  listSnapshots,
  saveSnapshot,
  restoreSnapshot,
  deleteSnapshot,
  getSystemBooks,
  createBook,
  updateBook,
  deleteBook,
  proposeContent,
  listPending,
  settlePending,
  getBookEntries,
  getTablePresence,
  importBook,
  setTableControls,
  kickFromTable,
  allowBackToTable,
  sendMessage,
  deleteMessage,
  listLog,
  listActorFolders,
  createActorFolder,
  renameActorFolder,
  deleteActorFolder,
  moveToActorFolder,
  clearLog,
  deleteRolls,
  showImage,
  clearScreenShow,
  listPlayerNotes,
  getPlayerNote,
  createPlayerNote,
  updatePlayerNote,
  deletePlayerNote,
  restorePlayerNote,
  listPlayerNoteVersions,
  createSoundPlaylist,
  deleteSoundPlaylist,
  getSound,
  listSoundPlaylists,
  nextTrack,
  pauseSound,
  playSound,
  setSoundVolume,
  stopSound,
  updateSoundPlaylist
]

/** Las acciones por nombre, solo como tipo: la web las usa sin cargar zod */
export type Actions = {
  listOrganizations: typeof listOrganizations
  listWorlds: typeof listWorlds
  createWorld: typeof createWorld
  renameWorld: typeof renameWorld
  updateWorld: typeof updateWorld
  listCampaigns: typeof listCampaigns
  createCampaign: typeof createCampaign
  renameCampaign: typeof renameCampaign
  updateCampaign: typeof updateCampaign
  listWorldsWithCampaigns: typeof listWorldsWithCampaigns
  getCampaign: typeof getCampaign
  getInvitation: typeof getInvitation
  regenerateInvitation: typeof regenerateInvitation
  setInvitationsOpen: typeof setInvitationsOpen
  listMembers: typeof listMembers
  removeMember: typeof removeMember
  leaveCampaign: typeof leaveCampaign
  listHistory: typeof listHistory
  undoOperation: typeof undoOperation
  deleteWorld: typeof deleteWorld
  deleteCampaign: typeof deleteCampaign
  listTrash: typeof listTrash
  restoreWorld: typeof restoreWorld
  restoreCampaign: typeof restoreCampaign
  getAiSettings: typeof getAiSettings
  setAiMode: typeof setAiMode
  listApprovals: typeof listApprovals
  approve: typeof approve
  reject: typeof reject
  copyPage: typeof copyPage
  createPage: typeof createPage
  updatePage: typeof updatePage
  movePage: typeof movePage
  getPage: typeof getPage
  listPageChildren: typeof listPageChildren
  listPageTree: typeof listPageTree
  listRecentPages: typeof listRecentPages
  setPagePanel: typeof setPagePanel
  sortPageChildren: typeof sortPageChildren
  setPageProperties: typeof setPageProperties
  listTags: typeof listTags
  deletePage: typeof deletePage
  restorePage: typeof restorePage
  getWikiPreferences: typeof getWikiPreferences
  setWikiTabs: typeof setWikiTabs
  setBookmarks: typeof setBookmarks
  setPageView: typeof setPageView
  createPageDocument: typeof createPageDocument
  readPage: typeof readPage
  createPages: typeof createPages
  editPage: typeof editPage
  listPageNames: typeof listPageNames
  getPageLinks: typeof getPageLinks
  listUnresolvedLinks: typeof listUnresolvedLinks
  linkMention: typeof linkMention
  getPageContent: typeof getPageContent
  listPageVersions: typeof listPageVersions
  getPageVersion: typeof getPageVersion
  restorePageVersion: typeof restorePageVersion
  getPageTables: typeof getPageTables
  getPageKnowledge: typeof getPageKnowledge
  setKnowledge: typeof setKnowledge
  setPageEditors: typeof setPageEditors
  listKnownPages: typeof listKnownPages
  listVisibleInPlay: typeof listVisibleInPlay
  setCreatureHidden: typeof setCreatureHidden
  reveal: typeof reveal
  showPage: typeof showPage
  hide: typeof hide
  listCampaignKnowledge: typeof listCampaignKnowledge
  getSecretsKnowledge: typeof getSecretsKnowledge
  listNews: typeof listNews
  seeNews: typeof seeNews
  listFiles: typeof listFiles
  listCommonFiles: typeof listCommonFiles
  renameFile: typeof renameFile
  deleteFile: typeof deleteFile
  restoreFile: typeof restoreFile
  createFolder: typeof createFolder
  updateFolder: typeof updateFolder
  deleteFiles: typeof deleteFiles
  moveFiles: typeof moveFiles
  deleteFolder: typeof deleteFolder
  moveFile: typeof moveFile
  listAccountTags: typeof listAccountTags
  createTag: typeof createTag
  updateTag: typeof updateTag
  moveTag: typeof moveTag
  deleteTag: typeof deleteTag
  setFileTags: typeof setFileTags
  addFileTags: typeof addFileTags
  listPageTabs: typeof listPageTabs
  createPageTab: typeof createPageTab
  updatePageTab: typeof updatePageTab
  deletePageTab: typeof deletePageTab
  getMap: typeof getMap
  updateMap: typeof updateMap
  createMapPin: typeof createMapPin
  updateMapPin: typeof updateMapPin
  deleteMapPin: typeof deleteMapPin
  getWorldHome: typeof getWorldHome
  ensureWorldHome: typeof ensureWorldHome
  searchWiki: typeof searchWiki
  listTemplates: typeof listTemplates
  getTemplate: typeof getTemplate
  createTemplate: typeof createTemplate
  updateTemplate: typeof updateTemplate
  deleteTemplate: typeof deleteTemplate
  createTemplateFolder: typeof createTemplateFolder
  updateTemplateFolder: typeof updateTemplateFolder
  deleteTemplateFolder: typeof deleteTemplateFolder
  moveTemplate: typeof moveTemplate
  addTemplateTabs: typeof addTemplateTabs
  rollDice: typeof rollDice
  listRolls: typeof listRolls
  tryDice: typeof tryDice
  listSystems: typeof listSystems
  getSystem: typeof getSystem
  createSystem: typeof createSystem
  updateSystem: typeof updateSystem
  deleteSystem: typeof deleteSystem
  deleteSystemContent: typeof deleteSystemContent
  exportSystem: typeof exportSystem
  putSystemContent: typeof putSystemContent
  trySystemAction: typeof trySystemAction
  getSystemContent: typeof getSystemContent
  getCampaignCompendium: typeof getCampaignCompendium
  getCampaignContent: typeof getCampaignContent
  searchCampaignContent: typeof searchCampaignContent
  browseCampaignContent: typeof browseCampaignContent
  rollContentTable: typeof rollContentTable
  resetContentTable: typeof resetContentTable
  putWorldContent: typeof putWorldContent
  deleteWorldContent: typeof deleteWorldContent
  copyContent: typeof copyContent
  getContentOrigin: typeof getContentOrigin
  pullContentOrigin: typeof pullContentOrigin
  listInPlay: typeof listInPlay
  getInPlay: typeof getInPlay
  putInPlay: typeof putInPlay
  playCreature: typeof playCreature
  rollForCreature: typeof rollForCreature
  removeFromPlay: typeof removeFromPlay
  applyRoll: typeof applyRoll
  getParty: typeof getParty
  updateParty: typeof updateParty
  moveItem: typeof moveItem
  moveCoins: typeof moveCoins
  splitCoins: typeof splitCoins
  listLibrary: typeof listLibrary
  searchLibrary: typeof searchLibrary
  getBookPages: typeof getBookPages
  readBookAgain: typeof readBookAgain
  searchLinkableContent: typeof searchLinkableContent
  getLinkedContent: typeof getLinkedContent
  listCharacters: typeof listCharacters
  getCharacter: typeof getCharacter
  createCharacter: typeof createCharacter
  updateCharacter: typeof updateCharacter
  chooseForCharacter: typeof chooseForCharacter
  rollForCharacter: typeof rollForCharacter
  playCharacter: typeof playCharacter
  deleteCharacter: typeof deleteCharacter
  listCharacterVersions: typeof listCharacterVersions
  restoreCharacterVersion: typeof restoreCharacterVersion
  getRandomTable: typeof getRandomTable
  updateRandomTable: typeof updateRandomTable
  rollOnTable: typeof rollOnTable
  resetTableDraws: typeof resetTableDraws
  searchSystemContent: typeof searchSystemContent
  importSystem: typeof importSystem
  getSystemParts: typeof getSystemParts
  checkSystem: typeof checkSystem
  tryFormula: typeof tryFormula
  trySystemRoll: typeof trySystemRoll
  getSystemFormat: typeof getSystemFormat
  inspectFoundry: typeof inspectFoundry
  importFoundry: typeof importFoundry
  putSystemImages: typeof putSystemImages
  inspectFoundryScenes: typeof inspectFoundryScenes
  importFoundryScenes: typeof importFoundryScenes
  listScenes: typeof listScenes
  getScene: typeof getScene
  createScene: typeof createScene
  renameScene: typeof renameScene
  deleteScene: typeof deleteScene
  updateScene: typeof updateScene
  setSceneImage: typeof setSceneImage
  getCampaignTable: typeof getCampaignTable
  openScene: typeof openScene
  presentScene: typeof presentScene
  hideScreen: typeof hideScreen
  setScreenCamera: typeof setScreenCamera
  drawScene: typeof drawScene
  placeTokens: typeof placeTokens
  moveTokens: typeof moveTokens
  assignToken: typeof assignToken
  updateToken: typeof updateToken
  removeTokens: typeof removeTokens
  listEncounters: typeof listEncounters
  saveEncounter: typeof saveEncounter
  deleteEncounter: typeof deleteEncounter
  placeEncounter: typeof placeEncounter
  getCombat: typeof getCombat
  startCombat: typeof startCombat
  addCombatants: typeof addCombatants
  removeCombatants: typeof removeCombatants
  rollInitiative: typeof rollInitiative
  setInitiative: typeof setInitiative
  orderCombatants: typeof orderCombatants
  groupCombatants: typeof groupCombatants
  updateCombat: typeof updateCombat
  nextTurn: typeof nextTurn
  previousTurn: typeof previousTurn
  endCombat: typeof endCombat
  getSceneVision: typeof getSceneVision
  changeWalls: typeof changeWalls
  placeImportedWalls: typeof placeImportedWalls
  updateSceneVision: typeof updateSceneVision
  setDoor: typeof setDoor
  changeFog: typeof changeFog
  resetFog: typeof resetFog
  setTileFit: typeof setTileFit
  viewAsParty: typeof viewAsParty
  placeSceneSound: typeof placeSceneSound
  changeSceneSound: typeof changeSceneSound
  removeSceneSound: typeof removeSceneSound
  setMeasureOnScreen: typeof setMeasureOnScreen
  listMarks: typeof listMarks
  changeMarks: typeof changeMarks
  placeTemplate: typeof placeTemplate
  getTemplateTokens: typeof getTemplateTokens
  measureDistance: typeof measureDistance
  listWidgets: typeof listWidgets
  createWidget: typeof createWidget
  updateWidget: typeof updateWidget
  deleteWidget: typeof deleteWidget
  listSnapshots: typeof listSnapshots
  saveSnapshot: typeof saveSnapshot
  restoreSnapshot: typeof restoreSnapshot
  deleteSnapshot: typeof deleteSnapshot
  getSystemBooks: typeof getSystemBooks
  createBook: typeof createBook
  updateBook: typeof updateBook
  deleteBook: typeof deleteBook
  proposeContent: typeof proposeContent
  listPending: typeof listPending
  settlePending: typeof settlePending
  getBookEntries: typeof getBookEntries
  getTablePresence: typeof getTablePresence
  importBook: typeof importBook
  setTableControls: typeof setTableControls
  kickFromTable: typeof kickFromTable
  allowBackToTable: typeof allowBackToTable
  sendMessage: typeof sendMessage
  deleteMessage: typeof deleteMessage
  listLog: typeof listLog
  listActorFolders: typeof listActorFolders
  createActorFolder: typeof createActorFolder
  renameActorFolder: typeof renameActorFolder
  deleteActorFolder: typeof deleteActorFolder
  moveToActorFolder: typeof moveToActorFolder
  clearLog: typeof clearLog
  deleteRolls: typeof deleteRolls
  showImage: typeof showImage
  clearScreenShow: typeof clearScreenShow
  listPlayerNotes: typeof listPlayerNotes
  getPlayerNote: typeof getPlayerNote
  createPlayerNote: typeof createPlayerNote
  updatePlayerNote: typeof updatePlayerNote
  deletePlayerNote: typeof deletePlayerNote
  restorePlayerNote: typeof restorePlayerNote
  listPlayerNoteVersions: typeof listPlayerNoteVersions
  createSoundPlaylist: typeof createSoundPlaylist
  deleteSoundPlaylist: typeof deleteSoundPlaylist
  getSound: typeof getSound
  listSoundPlaylists: typeof listSoundPlaylists
  nextTrack: typeof nextTrack
  pauseSound: typeof pauseSound
  playSound: typeof playSound
  setSoundVolume: typeof setSoundVolume
  stopSound: typeof stopSound
  updateSoundPlaylist: typeof updateSoundPlaylist
}
