/**
 * Las escenas de la mesa y la mesa de cada campaña (docs/specs/escenas.md, ADR-0018). La escena es del mundo: la lleva
 * quien lleva la wiki. La mesa es de la campaña: la lleva su máster. Lo que cambia se avisa a las salas abiertas
 */

import type { Readable } from 'node:stream'
import { Readable as ReadableStream } from 'node:stream'
import {
  type ActionDefinition,
  createScene,
  deletePageTab,
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
  updatePageTab,
  updateScene
} from '@crisol/contracts'
import { filesRepo, scenesRepo } from '@crisol/db'
import type { Capability } from '@crisol/domain'
import { NotFoundError, sniff } from '@crisol/domain'
import { imageSize, svgProblem, svgSize } from '@crisol/tabletop'
import type { z } from 'zod'
import { pagesChanged, tablePresenceChanged } from '../realtime/events.ts'
import { campaignTableView, sceneView } from '../table/projection.ts'
import { authorizedCampaign, authorizedPage, authorizedScene, authorizedWiki, sceneOfCampaign } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { filesTouched, scopeOf, withFreeName } from './files.ts'
import { placePrepared } from './foundry-scenes.ts'
import { implement } from './registry.ts'
import { hasNoVision, placeImported } from './vision.ts'

/** Los primeros bytes de un archivo, para leer su cabecera */
async function readHead(stream: Readable) {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return new Uint8Array(Buffer.concat(chunks))
}

/**
 * Lo que trae el mapa (los muros, puertas y luces de un UVTT o de la IA) se pone en juego solo si la escena aún no
 * tiene ninguno; si ya tenía, se ponen a mano con placeImportedWalls (docs/specs/vision.md)
 */
async function placeImportedIfEmpty(
  ctx: ActionContext,
  sceneId: string,
  details: Record<string, unknown>,
  wiki: { organizationId: string; worldId: string }
) {
  const scene = await scenesRepo.findScene(ctx.db, sceneId)
  if (!scene?.imported || !(await hasNoVision(ctx, sceneId))) return
  await placeImported(ctx, scene, historyContext(ctx, 'placeImportedWalls', details, wiki), false)
}

/** Llama a otra acción con su entrada ya validada (sus valores por defecto) */
async function run<A extends ActionDefinition>(
  ctx: ActionContext,
  action: A,
  input: z.input<A['input']>
): Promise<z.output<A['output']>> {
  const impl = ctx.actions.get(action.name)
  if (!impl) throw new Error(`falta la acción ${action.name}`)
  return (await impl.handler(ctx, action.input.parse(input))) as z.output<A['output']>
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
    const { scene } = await authorizedScene(ctx, 'page.read', found?.id ?? '')
    return sceneView(scene)
  }),

  // Las escenas sueltas, de la Mesa (ADR-0020): sin página
  implement(createScene, async (ctx, { worldId, name }) => {
    const wiki = await authorizedWiki(ctx, 'page.write', worldId)
    const created = await scenesRepo.createScene(ctx.db, historyContext(ctx, 'createScene', { name }, wiki), {
      worldId,
      name
    })
    ctx.realtime.publish(pagesChanged(wiki))
    return sceneView((await scenesRepo.findScene(ctx.db, created.id)) as scenesRepo.SceneWithPage)
  }),

  implement(renameScene, async (ctx, { sceneId, name }) => {
    const { scene, wiki } = await authorizedScene(ctx, 'page.write', sceneId)
    // La de una página es su pestaña: cambia el nombre de la pestaña
    if (scene.tabId) await run(ctx, updatePageTab, { tabId: scene.tabId, name })
    else
      await scenesRepo.renameScene(
        ctx.db,
        historyContext(ctx, 'renameScene', { name: scene.name, to: name }, wiki),
        sceneId,
        name
      )
    ctx.table?.sceneChanged(sceneId)
    ctx.realtime.publish(pagesChanged(wiki))
    return sceneView((await scenesRepo.findScene(ctx.db, sceneId)) as scenesRepo.SceneWithPage)
  }),

  implement(deleteScene, async (ctx, { sceneId }) => {
    const { scene, wiki } = await authorizedScene(ctx, 'page.write', sceneId)
    // La de una página se va con su pestaña; la suelta, sola. Lo que había en ella, con ella (deshacer la devuelve)
    if (scene.tabId) await run(ctx, deletePageTab, { tabId: scene.tabId })
    else await scenesRepo.deleteScene(ctx.db, historyContext(ctx, 'deleteScene', { name: scene.name }, wiki), sceneId)
    ctx.table?.sceneChanged(sceneId)
    ctx.realtime.publish(pagesChanged(wiki))
    return { ok: true as const }
  }),

  implement(updateScene, async (ctx, { sceneId, grid, initialView, interior }) => {
    const { scene, page, wiki } = await authorizedScene(ctx, 'page.write', sceneId)
    const details = {
      title: page.title,
      name: scene.name,
      ...(grid ? { grid: true } : {}),
      ...(initialView !== undefined ? { view: true } : {}),
      ...(interior !== undefined ? { interior } : {})
    }
    await scenesRepo.updateScene(ctx.db, historyContext(ctx, 'updateScene', details, wiki), sceneId, {
      ...(grid ? { grid: { ...scene.grid, ...grid } } : {}),
      ...(initialView !== undefined ? { initialView } : {}),
      ...(interior !== undefined ? { interior } : {})
    })
    ctx.table?.sceneChanged(sceneId)
    ctx.realtime.publish(pagesChanged(wiki))
    return sceneView((await scenesRepo.findScene(ctx.db, sceneId)) as scenesRepo.SceneWithPage)
  }),

  implement(setSceneImage, async (ctx, { sceneId, width, height, fileId, tiles, imported }) => {
    const { scene, page, wiki } = await authorizedScene(ctx, 'page.write', sceneId)
    let size = { width, height }
    if (fileId) {
      // Un archivo del mundo (o común de su organización: sin mundo) que sea una imagen; sus medidas, si no vienen
      // con las teselas. Uno de otro mundo de la organización, no
      const file = await filesRepo.findFile(ctx.db, fileId)
      const own = file?.worldId === wiki.worldId
      const common = file?.worldId === null && file.organizationId === wiki.organizationId
      if (!file || file.deletedAt || !(own || common)) throw new InvalidRequestError('BAD_SCENE_FILE')
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
    await placeImportedIfEmpty(ctx, sceneId, { title: page.title, name: scene.name }, wiki)
    ctx.table?.sceneChanged(sceneId)
    ctx.realtime.publish(pagesChanged(wiki))
    return sceneView((await scenesRepo.findScene(ctx.db, sceneId)) as scenesRepo.SceneWithPage)
  }),

  implement(drawScene, async (ctx, { sceneId, svg, name, walls, portals, lights }) => {
    const { scene, page, wiki } = await authorizedScene(ctx, 'page.write', sceneId)
    const problem = svgProblem(svg)
    if (problem) throw new InvalidRequestError('BAD_SVG', problem)
    const size = svgSize(svg)
    if (!size) throw new InvalidRequestError('BAD_SVG', 'no se saben sus medidas: pon width y height (o viewBox)')
    if (!ctx.storage) throw new InvalidRequestError('NO_STORAGE')
    // Un archivo del mundo como cualquier otro: sale en Archivos y se trocea al abrir la escena
    const bytes = Buffer.from(svg, 'utf8')
    const stored = await ctx.storage.write(wiki.worldId, ReadableStream.from([bytes]), bytes.length + 1)
    const sniffed = sniff(stored.head, 'mapa.svg')
    const place = { worldId: wiki.worldId, organizationId: wiki.organizationId }
    const wanted = `${(name ?? `${page.title} · ${scene.name}`).replace(/[\\/:*?"<>|]/g, '-')}.svg`
    const file = await withFreeName(ctx.db, { scope: scopeOf(place), name: wanted }, (free) =>
      filesRepo.createFile(ctx.db, historyContext(ctx, 'uploadFile', { name: free }, wiki), {
        organizationId: wiki.organizationId,
        worldId: wiki.worldId,
        folderId: null,
        name: free,
        ...sniffed,
        size: stored.size,
        hash: stored.hash,
        storageKey: stored.key
      })
    )
    await filesTouched(ctx, place, [file.name])
    const geometry = walls || portals || lights
    await scenesRepo.updateScene(
      ctx.db,
      historyContext(ctx, 'setSceneImage', { title: page.title, name: scene.name }, wiki),
      sceneId,
      {
        fileId: file.id,
        width: size.width,
        height: size.height,
        tiles: null,
        ...(geometry
          ? {
              imported: {
                source: 'ai' as const,
                walls: walls ?? [],
                objects: [],
                portals: portals ?? [],
                lights: lights ?? [],
                ambientLight: null,
                bakedLighting: false
              }
            }
          : {})
      }
    )
    if (geometry) await placeImportedIfEmpty(ctx, sceneId, { title: page.title, name: scene.name }, wiki)
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
    const { created } = await scenesRepo.ensureSceneState(
      ctx.db,
      historyContext(
        ctx,
        'openScene',
        { campaign: campaign.name, name: scene.name, title: scene.pageTitle ?? scene.name },
        campaign
      ),
      { worldId: campaign.worldId, campaignId, sceneId }
    )
    // Y salen sus criaturas preparadas y sus pines (docs/specs/escenas-foundry.md), solo si esta llamada lo creó
    if (created) await placePrepared(ctx, campaign, sceneId)
    // Otra escena se abre en pausa (Enrique, 2026-11-10): nadie mueve hasta que el máster la quite
    const before = (await scenesRepo.campaignTable(ctx.db, campaignId)).openSceneId
    await scenesRepo.setCampaignTable(ctx.db, campaignId, {
      openSceneId: sceneId,
      ...(before === sceneId ? {} : { paused: true })
    })
    ctx.table?.changed(campaignId)
    if (before !== sceneId) ctx.realtime.publish(tablePresenceChanged({ campaignId, worldId: campaign.worldId }))
    return campaignTableView(ctx, campaignId)
  }),

  implement(presentScene, async (ctx, { campaignId, sceneId }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const target = sceneId ?? (await scenesRepo.campaignTable(ctx.db, campaignId)).openSceneId
    if (!target) throw new InvalidRequestError('NO_OPEN_SCENE', 'abre una escena antes o di cuál')
    const scene = await sceneOfCampaign(ctx, campaign.worldId, target)
    const { created } = await scenesRepo.ensureSceneState(
      ctx.db,
      historyContext(
        ctx,
        'openScene',
        { campaign: campaign.name, name: scene.name, title: scene.pageTitle ?? scene.name },
        campaign
      ),
      { worldId: campaign.worldId, campaignId, sceneId: target }
    )
    if (created) await placePrepared(ctx, campaign, target)
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
