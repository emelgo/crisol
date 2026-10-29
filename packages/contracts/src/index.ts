import { createCampaign, listCampaigns, renameCampaign } from './campaigns.ts'
import { listHistory, undoOperation } from './history.ts'
import { getInvitation, regenerateInvitation, setInvitationsOpen } from './invitations.ts'
import { leaveCampaign, listMembers, removeMember } from './members.ts'
import { listOrganizations } from './organizations.ts'
import { deleteCampaign, deleteWorld, listTrash, restoreCampaign, restoreWorld } from './trash.ts'
import { createWorld, listWorlds, renameWorld } from './worlds.ts'

export * from './action.ts'
export * from './campaigns.ts'
export * from './history.ts'
export * from './invitations.ts'
export * from './members.ts'
export * from './openapi.ts'
export * from './organizations.ts'
export type * from './realtime.ts'
export * from './trash.ts'
export * from './worlds.ts'

/** Todas las acciones de la API */
export const ACTIONS = [
  listOrganizations,
  listWorlds,
  createWorld,
  renameWorld,
  listCampaigns,
  createCampaign,
  renameCampaign,
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
  restoreCampaign
]

/** Las acciones por nombre, solo como tipo: la web las usa sin cargar zod */
export type Actions = {
  listOrganizations: typeof listOrganizations
  listWorlds: typeof listWorlds
  createWorld: typeof createWorld
  renameWorld: typeof renameWorld
  listCampaigns: typeof listCampaigns
  createCampaign: typeof createCampaign
  renameCampaign: typeof renameCampaign
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
}
