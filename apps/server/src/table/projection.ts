/**
 * Lo que recibe cada quien mira la mesa (ADR-0018): el máster, todo; la pantalla de la tele, lo que ve el grupo. Hasta
 * que llegue la niebla (`vision`) la pantalla ve la escena presentada entera, pero ya sin su página ni su nombre
 */
import type { CampaignTableView, SceneView, ScreenScene, ScreenView } from '@crisol/contracts'
import { campaignsRepo, type Database, scenesRepo } from '@crisol/db'
import type { LoadTable } from './rooms.ts'

/** Una escena tal como la ve quien prepara el mundo */
export function sceneView(row: scenesRepo.SceneWithPage): SceneView {
  return {
    id: row.id,
    tabId: row.tabId,
    pageId: row.pageId,
    pageTitle: row.pageTitle,
    name: row.name,
    image:
      row.width && row.height
        ? { width: row.width, height: row.height, tiles: row.tiles ?? null, fileId: row.fileId ?? null }
        : null,
    grid: row.grid,
    initialView: row.initialView ?? null,
    hasImported: row.imported !== null
  }
}

/** Lo que la pantalla necesita para pintar una escena: ni su página, ni su nombre, ni lo traído para `vision` */
export function screenScene(scene: SceneView): ScreenScene {
  return {
    id: scene.id,
    image: scene.image ? { width: scene.image.width, height: scene.image.height, tiles: scene.image.tiles } : null,
    grid: scene.grid,
    initialView: scene.initialView
  }
}

/** La mesa de una campaña para su máster */
export async function campaignTableView(db: Database, campaignId: string): Promise<CampaignTableView> {
  const table = await scenesRepo.campaignTable(db, campaignId)
  const open = table.openSceneId ? await scenesRepo.findScene(db, table.openSceneId) : null
  const presented =
    table.presentedSceneId === table.openSceneId
      ? open
      : table.presentedSceneId
        ? await scenesRepo.findScene(db, table.presentedSceneId)
        : null
  return {
    campaignId,
    open: open ? sceneView(open) : null,
    presented: presented ? sceneView(presented) : null,
    screenHidden: table.screenHidden,
    camera: table.camera
  }
}

/** Lo que enseña la pantalla, sacado de la mesa del máster */
export function screenViewOf(master: CampaignTableView, campaignName: string): ScreenView {
  const showing = !master.screenHidden && master.presented !== null
  return {
    campaignId: master.campaignId,
    campaignName,
    scene: showing && master.presented ? screenScene(master.presented) : null,
    hidden: master.screenHidden,
    camera: master.camera
  }
}

/** Cómo carga la sala la mesa de una campaña */
export function loadTable(db: Database): LoadTable {
  return async (campaignId) => {
    const campaign = await campaignsRepo.findCampaign(db, campaignId)
    if (!campaign) return null
    const master = await campaignTableView(db, campaignId)
    return { master, screen: screenViewOf(master, campaign.name) }
  }
}
