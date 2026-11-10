/** Las carpetas de la pestaña Actores (Enrique, 2026-11-10): solo el máster las ve y las cambia */
import {
  createActorFolder,
  deleteActorFolder,
  listActorFolders,
  moveToActorFolder,
  renameActorFolder
} from '@crisol/contracts'
import { actorFoldersRepo, charactersRepo, creaturesRepo } from '@crisol/db'
import { NotFoundError } from '@crisol/domain'
import { authorizedCampaign } from './access.ts'
import type { ActionContext } from './context.ts'
import { implement } from './registry.ts'

/** Que avisen a las otras pestañas del máster (vuelven a pedir las carpetas) */
const changed = (ctx: ActionContext, campaign: { id: string; worldId: string }) =>
  ctx.realtime.publish({
    to: { capability: 'table.manage', target: { campaignId: campaign.id, worldId: campaign.worldId } },
    message: { type: 'changed', what: 'actorFolders', campaignId: campaign.id }
  })

const folderOf = async (ctx: ActionContext, campaignId: string, folderId: string) => {
  const folder = await actorFoldersRepo.findFolder(ctx.db, campaignId, folderId)
  if (!folder) throw new NotFoundError('folder')
  return folder
}

export const actorFolderActions = [
  implement(listActorFolders, async (ctx, { campaignId }) => {
    await authorizedCampaign(ctx, 'table.manage', campaignId)
    return actorFoldersRepo.listFolders(ctx.db, campaignId)
  }),

  implement(createActorFolder, async (ctx, { campaignId, name }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const folder = await actorFoldersRepo.createFolder(ctx.db, campaignId, name)
    changed(ctx, campaign)
    return folder
  }),

  implement(renameActorFolder, async (ctx, { campaignId, folderId, name }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    await folderOf(ctx, campaignId, folderId)
    await actorFoldersRepo.renameFolder(ctx.db, folderId, name)
    changed(ctx, campaign)
    return { ok: true as const }
  }),

  implement(deleteActorFolder, async (ctx, { campaignId, folderId }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    await folderOf(ctx, campaignId, folderId)
    await actorFoldersRepo.deleteFolder(ctx.db, folderId)
    changed(ctx, campaign)
    return { ok: true as const }
  }),

  implement(moveToActorFolder, async (ctx, { campaignId, kind, id, folderId }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    // Que sea de esta campaña (y la carpeta también)
    const actor =
      kind === 'character'
        ? await charactersRepo.findCharacter(ctx.db, id)
        : await creaturesRepo.findCreature(ctx.db, id)
    if (!actor || actor.campaignId !== campaignId) throw new NotFoundError(kind)
    if (folderId) await folderOf(ctx, campaignId, folderId)
    await actorFoldersRepo.moveToFolder(ctx.db, { campaignId, kind, actorId: id, folderId })
    changed(ctx, campaign)
    return { ok: true as const }
  })
]
