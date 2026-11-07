/**
 * Las escenas de la mesa y la mesa de cada campaña (docs/specs/escenas.md, ADR-0018). La escena es del mundo: la lleva
 * quien lleva la wiki. La mesa es de la campaña: la lleva su máster. Lo que cambia se avisa a las salas abiertas
 */

import type { Readable } from 'node:stream'
import {
  getCampaignTable,
  getScene,
  hideScreen,
  listScenes,
  openScene,
  presentScene,
  setSceneImage,
  setScreenCamera,
  updateScene
} from '@crisol/contracts'
import { filesRepo, scenesRepo } from '@crisol/db'
import type { Capability } from '@crisol/domain'
import { NotFoundError } from '@crisol/domain'
import { imageSize } from '@crisol/tabletop'
import { pagesChanged } from '../realtime/events.ts'
import { campaignTableView, sceneView } from '../table/projection.ts'
import { authorizedCampaign, authorizedPage, authorizedWiki } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

/** La escena, si la cuenta puede hacer eso en su página (404 si no existe o no la ve) */
async function authorizedScene(ctx: ActionContext, capability: Capability, sceneId: string) {
  const scene = await scenesRepo.findScene(ctx.db, sceneId)
  const { page, wiki } = await authorizedPage(ctx, capability, scene?.pageId ?? '')
  if (!scene) throw new NotFoundError('scene')
  return { scene, page, wiki }
}

/** Los primeros bytes de un archivo, para leer su cabecera */
async function readHead(stream: Readable) {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return new Uint8Array(Buffer.concat(chunks))
}

/** La escena para la mesa de una campaña: tiene que ser de su mundo (y la ve quien lleva la mesa) */
export async function sceneOfCampaign(ctx: ActionContext, worldId: string, sceneId: string) {
  const scene = await scenesRepo.findScene(ctx.db, sceneId)
  if (!scene || scene.worldId !== worldId) throw new NotFoundError('scene')
  return scene
}

export const sceneActions = [
  implement(listScenes, async (ctx, { worldId }) => {
    await authorizedWiki(ctx, 'page.read', worldId)
    return { scenes: (await scenesRepo.listScenes(ctx.db, worldId)).map(sceneView) }
  }),

  implement(getScene, async (ctx, { sceneId, tabId }) => {
    const found = sceneId
      ? await scenesRepo.findScene(ctx.db, sceneId)
      : await scenesRepo.sceneOfTab(ctx.db, tabId ?? '')
    await authorizedPage(ctx, 'page.read', found?.pageId ?? '')
    if (!found) throw new NotFoundError('scene')
    return sceneView(found)
  }),

  implement(updateScene, async (ctx, { sceneId, grid, initialView }) => {
    const { scene, page, wiki } = await authorizedScene(ctx, 'page.write', sceneId)
    const details = {
      title: page.title,
      name: scene.name,
      ...(grid ? { grid: true } : {}),
      ...(initialView !== undefined ? { view: true } : {})
    }
    await scenesRepo.updateScene(ctx.db, historyContext(ctx, 'updateScene', details, wiki), sceneId, {
      ...(grid ? { grid: { ...scene.grid, ...grid } } : {}),
      ...(initialView !== undefined ? { initialView } : {})
    })
    ctx.table?.sceneChanged(sceneId)
    ctx.realtime.publish(pagesChanged(wiki))
    return sceneView((await scenesRepo.findScene(ctx.db, sceneId)) as scenesRepo.SceneWithPage)
  }),

  implement(setSceneImage, async (ctx, { sceneId, width, height, fileId, tiles, imported }) => {
    const { scene, page, wiki } = await authorizedScene(ctx, 'page.write', sceneId)
    let size = { width, height }
    if (fileId) {
      // Un archivo del mundo (o común de su organización) que sea una imagen; sus medidas, si no vienen con las teselas
      const file = await filesRepo.findFile(ctx.db, fileId)
      if (!file || file.deletedAt || (file.worldId !== wiki.worldId && file.organizationId !== wiki.organizationId))
        throw new InvalidRequestError('BAD_SCENE_FILE')
      if (file.kind !== 'image') throw new InvalidRequestError('BAD_SCENE_FILE', 'no es una imagen')
      // Sin medidas (la IA no las sabe), las de su cabecera
      if ((!width || !height) && ctx.storage) {
        const head = await readHead(ctx.storage.read(file.storageKey, { start: 0, end: 65_535 }))
        const found = imageSize(head)
        if (found) size = found
      }
    }
    if (!size.width || !size.height) throw new InvalidRequestError('SCENE_SIZE_REQUIRED', 'width y height')
    if (tiles) {
      // Las teselas ya tienen que estar subidas: al menos la del nivel más pequeño
      if ((await scenesRepo.countTiles(ctx.db, sceneId, tiles.version)) === 0)
        throw new InvalidRequestError('TILES_MISSING')
    }
    await scenesRepo.updateScene(
      ctx.db,
      historyContext(ctx, 'setSceneImage', { title: page.title, name: scene.name }, wiki),
      sceneId,
      {
        width: size.width,
        height: size.height,
        tiles: tiles ?? null,
        ...(fileId !== undefined ? { fileId } : {}),
        ...(imported !== undefined ? { imported } : {})
      }
    )
    ctx.table?.sceneChanged(sceneId)
    ctx.realtime.publish(pagesChanged(wiki))
    return sceneView((await scenesRepo.findScene(ctx.db, sceneId)) as scenesRepo.SceneWithPage)
  }),

  implement(getCampaignTable, async (ctx, { campaignId }) => {
    await authorizedCampaign(ctx, 'table.manage', campaignId)
    return campaignTableView(ctx, campaignId)
  }),

  implement(openScene, async (ctx, { campaignId, sceneId }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const scene = await sceneOfCampaign(ctx, campaign.worldId, sceneId)
    // La primera vez que la campaña la abre, nace su estado en ella (al historial: deshacer lo quita)
    await scenesRepo.ensureSceneState(
      ctx.db,
      historyContext(ctx, 'openScene', { campaign: campaign.name, name: scene.name, title: scene.pageTitle }, campaign),
      { worldId: campaign.worldId, campaignId, sceneId }
    )
    await scenesRepo.setCampaignTable(ctx.db, campaignId, { openSceneId: sceneId })
    ctx.table?.changed(campaignId)
    return campaignTableView(ctx, campaignId)
  }),

  implement(presentScene, async (ctx, { campaignId, sceneId }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const target = sceneId ?? (await scenesRepo.campaignTable(ctx.db, campaignId)).openSceneId
    if (!target) throw new InvalidRequestError('NO_OPEN_SCENE', 'abre una escena antes o di cuál')
    const scene = await sceneOfCampaign(ctx, campaign.worldId, target)
    await scenesRepo.ensureSceneState(
      ctx.db,
      historyContext(ctx, 'openScene', { campaign: campaign.name, name: scene.name, title: scene.pageTitle }, campaign),
      { worldId: campaign.worldId, campaignId, sceneId: target }
    )
    await scenesRepo.setCampaignTable(ctx.db, campaignId, { presentedSceneId: target, screenHidden: false })
    ctx.table?.changed(campaignId)
    return campaignTableView(ctx, campaignId)
  }),

  implement(hideScreen, async (ctx, { campaignId, hidden }) => {
    await authorizedCampaign(ctx, 'table.manage', campaignId)
    await scenesRepo.setCampaignTable(ctx.db, campaignId, { screenHidden: hidden })
    ctx.table?.changed(campaignId)
    return campaignTableView(ctx, campaignId)
  }),

  implement(setScreenCamera, async (ctx, { campaignId, camera }) => {
    await authorizedCampaign(ctx, 'table.manage', campaignId)
    await scenesRepo.setCampaignTable(ctx.db, campaignId, { camera })
    ctx.table?.changed(campaignId)
    return campaignTableView(ctx, campaignId)
  })
]
