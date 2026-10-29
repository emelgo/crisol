import { createCampaign, listCampaigns, renameCampaign } from './campaigns.ts'
import { listOrganizations } from './organizations.ts'
import { createWorld, listWorlds, renameWorld } from './worlds.ts'

export * from './action.ts'
export * from './campaigns.ts'
export * from './openapi.ts'
export * from './organizations.ts'
export * from './worlds.ts'

/** Todas las acciones de la API */
export const ACTIONS = [
  listOrganizations,
  listWorlds,
  createWorld,
  renameWorld,
  listCampaigns,
  createCampaign,
  renameCampaign
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
}
