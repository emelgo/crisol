import { describe, expect, it } from 'vitest'
import { ACTIONS, type Actions } from './index.ts'

describe('Actions', () => {
  it('el tipo por nombre cubre todas las acciones', () => {
    // Si falta una acción en Actions, esto no compila
    const names: Record<keyof Actions, true> = {
      listOrganizations: true,
      listWorlds: true,
      createWorld: true,
      renameWorld: true,
      listCampaigns: true,
      createCampaign: true,
      renameCampaign: true,
      listWorldsWithCampaigns: true,
      getCampaign: true,
      getInvitation: true,
      regenerateInvitation: true,
      setInvitationsOpen: true,
      listMembers: true,
      removeMember: true,
      leaveCampaign: true,
      listHistory: true,
      undoOperation: true,
      deleteWorld: true,
      deleteCampaign: true,
      listTrash: true,
      restoreWorld: true,
      restoreCampaign: true,
      getAiSettings: true,
      setAiMode: true,
      listApprovals: true,
      approve: true,
      reject: true,
      createPage: true,
      updatePage: true,
      movePage: true,
      getPage: true,
      listPageChildren: true,
      listPageTree: true,
      setPageProperties: true,
      listTags: true,
      deletePage: true,
      restorePage: true,
      getWikiPreferences: true,
      setWikiTabs: true,
      setBookmarks: true,
      createPageDocument: true,
      readPage: true,
      createPages: true,
      editPage: true,
      listPageNames: true,
      getPageLinks: true,
      listUnresolvedLinks: true,
      linkMention: true,
      getPageContent: true,
      listPageVersions: true,
      getPageVersion: true,
      restorePageVersion: true
    }
    expect(Object.keys(names).sort()).toEqual(ACTIONS.map((a) => a.name).sort())
  })
})
