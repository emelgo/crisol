import { approve, getAiSettings, listApprovals, reject, setAiMode } from './ai.ts'
import {
  createCampaign,
  getCampaign,
  listCampaigns,
  listWorldsWithCampaigns,
  renameCampaign,
  updateCampaign
} from './campaigns.ts'
import {
  createFolder,
  deleteFile,
  deleteFiles,
  deleteFolder,
  listCommonFiles,
  listFiles,
  moveFile,
  renameFile,
  restoreFile,
  updateFolder
} from './files.ts'
import { listHistory, undoOperation } from './history.ts'
import { getInvitation, regenerateInvitation, setInvitationsOpen } from './invitations.ts'
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
import { listOrganizations } from './organizations.ts'
import {
  createPage,
  createPageDocument,
  createPages,
  editPage,
  getPage,
  getPageContent,
  getPageLinks,
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
import { searchWiki } from './search.ts'
import { createTag, deleteTag, listAccountTags, setFileTags, updateTag } from './tags.ts'
import { getTemplate, listTemplates } from './templates.ts'
import {
  deleteCampaign,
  deletePage,
  deleteWorld,
  listTrash,
  restoreCampaign,
  restorePage,
  restoreWorld
} from './trash.ts'
import { createWorld, ensureWorldHome, getWorldHome, listWorlds, renameWorld, updateWorld } from './worlds.ts'

export * from './action.ts'
export * from './ai.ts'
export * from './campaigns.ts'
export * from './files.ts'
export * from './history.ts'
export * from './invitations.ts'
export * from './maps.ts'
export * from './members.ts'
export * from './openapi.ts'
export * from './organizations.ts'
export * from './pages.ts'
export * from './panel.ts'
export type * from './realtime.ts'
export * from './search.ts'
export * from './tags.ts'
export * from './templates.ts'
export * from './trash.ts'
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
  listFiles,
  listCommonFiles,
  renameFile,
  deleteFile,
  restoreFile,
  createFolder,
  updateFolder,
  deleteFolder,
  deleteFiles,
  moveFile,
  searchWiki,
  listAccountTags,
  createTag,
  updateTag,
  deleteTag,
  setFileTags,
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
  getTemplate
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
  listFiles: typeof listFiles
  listCommonFiles: typeof listCommonFiles
  renameFile: typeof renameFile
  deleteFile: typeof deleteFile
  restoreFile: typeof restoreFile
  createFolder: typeof createFolder
  updateFolder: typeof updateFolder
  deleteFiles: typeof deleteFiles
  deleteFolder: typeof deleteFolder
  moveFile: typeof moveFile
  listAccountTags: typeof listAccountTags
  createTag: typeof createTag
  updateTag: typeof updateTag
  deleteTag: typeof deleteTag
  setFileTags: typeof setFileTags
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
}
