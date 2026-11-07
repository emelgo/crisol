/**
 * Las escenas de la mesa (ADR-0018): lo del mundo (la escena de una pestaña, en operation() y el historial), el estado
 * de cada campaña en una escena y la mesa de cada campaña (estado de la sesión, fuera del historial)
 */
import { and, asc, eq, getTableColumns, isNull, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { pageTabs } from '../schema/maps.ts'
import { pages } from '../schema/pages.ts'
import { campaignTables, type ScreenCameraData, sceneStates, scenes, sceneTiles } from '../schema/scenes.ts'

export type SceneRow = typeof scenes.$inferSelect
export type CampaignTableRow = typeof campaignTables.$inferSelect
type ScenePatch = Partial<Pick<SceneRow, 'fileId' | 'width' | 'height' | 'tiles' | 'grid' | 'initialView' | 'imported'>>

const sceneColumns = {
  ...getTableColumns(scenes),
  name: pageTabs.name,
  pageId: pageTabs.pageId,
  pageTitle: pages.title
}

export type SceneWithPage = SceneRow & { name: string; pageId: string; pageTitle: string }

/** Una escena con su pestaña y su página, si la página sigue fuera de la papelera */
export async function findScene(db: Database, sceneId: string): Promise<SceneWithPage | null> {
  const [found] = await db
    .select(sceneColumns)
    .from(scenes)
    .innerJoin(pageTabs, eq(pageTabs.id, scenes.tabId))
    .innerJoin(pages, and(eq(pages.id, pageTabs.pageId), isNull(pages.deletedAt)))
    .where(eq(scenes.id, sceneId))
  return found ?? null
}

/** La escena de una pestaña */
export async function sceneOfTab(db: Database, tabId: string): Promise<SceneWithPage | null> {
  const [found] = await db
    .select(sceneColumns)
    .from(scenes)
    .innerJoin(pageTabs, eq(pageTabs.id, scenes.tabId))
    .innerJoin(pages, and(eq(pages.id, pageTabs.pageId), isNull(pages.deletedAt)))
    .where(eq(scenes.tabId, tabId))
  return found ?? null
}

/** Las escenas de un mundo (las de páginas fuera de la papelera), por el título de su página y el nombre de la pestaña */
export function listScenes(db: Database, worldId: string): Promise<SceneWithPage[]> {
  return db
    .select(sceneColumns)
    .from(scenes)
    .innerJoin(pageTabs, eq(pageTabs.id, scenes.tabId))
    .innerJoin(pages, and(eq(pages.id, pageTabs.pageId), isNull(pages.deletedAt)))
    .where(eq(scenes.worldId, worldId))
    .orderBy(sql`lower(${pages.title})`, sql`lower(${pageTabs.name})`, asc(scenes.id))
}

export function updateScene(db: Database, context: OperationContext, sceneId: string, patch: ScenePatch) {
  return operation(db, context, (w) => w.update(scenes, sceneId, patch))
}

/** El estado de la campaña en la escena; si es la primera vez que la abre, se crea */
export async function ensureSceneState(
  db: Database,
  context: OperationContext,
  values: { worldId: string; campaignId: string; sceneId: string }
) {
  const [found] = await db
    .select()
    .from(sceneStates)
    .where(and(eq(sceneStates.campaignId, values.campaignId), eq(sceneStates.sceneId, values.sceneId)))
  if (found) return found
  return operation(db, context, (w) => w.insert(sceneStates, values))
}

/** La mesa de una campaña; sin fila aún, la de por defecto (nada abierto, cámara siguiendo al máster) */
export async function campaignTable(db: Database, campaignId: string): Promise<CampaignTableRow> {
  const [found] = await db.select().from(campaignTables).where(eq(campaignTables.campaignId, campaignId))
  return (
    found ?? {
      campaignId,
      openSceneId: null,
      presentedSceneId: null,
      screenHidden: false,
      camera: { mode: 'follow' },
      updatedAt: new Date(0)
    }
  )
}

/** Cambia la mesa de una campaña (la crea si no la tenía) */
export async function setCampaignTable(
  db: Database,
  campaignId: string,
  patch: Partial<{
    openSceneId: string | null
    presentedSceneId: string | null
    screenHidden: boolean
    camera: ScreenCameraData
  }>
): Promise<CampaignTableRow> {
  const [row] = await db
    .insert(campaignTables)
    .values({ campaignId, ...patch })
    .onConflictDoUpdate({ target: campaignTables.campaignId, set: { ...patch, updatedAt: new Date() } })
    .returning()
  if (!row) throw new Error('campaign_tables: sin fila tras guardar')
  return row
}

type TileAt = { sceneId: string; version: string; level: number; x: number; y: number }

const tileWhere = (at: TileAt) =>
  and(
    eq(sceneTiles.sceneId, at.sceneId),
    eq(sceneTiles.version, at.version),
    eq(sceneTiles.level, at.level),
    eq(sceneTiles.x, at.x),
    eq(sceneTiles.y, at.y)
  )

/** Guarda dónde está una tesela; si ya había otra en su sitio, da su clave para borrar sus bytes */
export async function putTile(db: Database, at: TileAt & { storageKey: string; bytes: number }) {
  return db.transaction(async (tx) => {
    const [old] = await tx.select({ storageKey: sceneTiles.storageKey }).from(sceneTiles).where(tileWhere(at))
    await tx
      .insert(sceneTiles)
      .values(at)
      .onConflictDoUpdate({
        target: [sceneTiles.sceneId, sceneTiles.version, sceneTiles.level, sceneTiles.x, sceneTiles.y],
        set: { storageKey: at.storageKey, bytes: at.bytes }
      })
    return old && old.storageKey !== at.storageKey ? old.storageKey : null
  })
}

/** Dónde están los bytes de una tesela, o null */
export async function findTile(db: Database, at: TileAt) {
  const [found] = await db
    .select({ storageKey: sceneTiles.storageKey, bytes: sceneTiles.bytes })
    .from(sceneTiles)
    .where(tileWhere(at))
  return found ?? null
}

/** Cuántas teselas tiene subidas una versión (para comprobar que está entera antes de ponerla) */
export async function countTiles(db: Database, sceneId: string, version: string) {
  const rows = await db
    .select({ level: sceneTiles.level })
    .from(sceneTiles)
    .where(and(eq(sceneTiles.sceneId, sceneId), eq(sceneTiles.version, version)))
  return rows.length
}
