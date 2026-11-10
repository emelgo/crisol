/**
 * Las escenas de la mesa (ADR-0018): lo del mundo (la escena de una pestaña, en operation() y el historial), el estado
 * de cada campaña en una escena y la mesa de cada campaña (estado de la sesión, fuera del historial)
 */
import { and, asc, eq, getTableColumns, isNotNull, isNull, or, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation, type Writer } from '../operation.ts'
import { prepared } from '../prepared.ts'
import { combats } from '../schema/combat.ts'
import { pageTabs } from '../schema/maps.ts'
import { pages } from '../schema/pages.ts'
import {
  campaignTables,
  DEFAULT_SCENE_GRID,
  type ScreenCameraData,
  sceneStates,
  scenes,
  sceneTiles,
  sceneTokens
} from '../schema/scenes.ts'
import { sceneMarks, sceneSnapshots } from '../schema/table-tools.ts'
import { sceneFog, sceneLights, sceneWalls } from '../schema/vision.ts'

export type SceneRow = typeof scenes.$inferSelect
export type CampaignTableRow = typeof campaignTables.$inferSelect
type ScenePatch = Partial<Pick<SceneRow, 'fileId' | 'width' | 'height' | 'tiles' | 'grid' | 'initialView' | 'imported'>>

// La suelta (ADR-0020) lleva su nombre; la de una pestaña, el de la pestaña
const sceneColumns = {
  ...getTableColumns(scenes),
  name: sql<string>`coalesce(${scenes.name}, ${pageTabs.name}, '')`,
  pageId: pageTabs.pageId,
  pageTitle: pages.title
}

/** Una escena con su pestaña y su página; la suelta, sin ellas (pageId y pageTitle, null) */
export type SceneWithPage = Omit<SceneRow, 'name'> & { name: string; pageId: string | null; pageTitle: string | null }

/** La suelta, o la de una página que sigue fuera de la papelera */
const alive = or(isNull(scenes.tabId), isNotNull(pages.id))

/** Una escena (la de una pestaña, con su pestaña y su página, si la página sigue fuera de la papelera) */
export async function findScene(db: Database, sceneId: string): Promise<SceneWithPage | null> {
  const [found] = await sceneById(db).execute({ sceneId })
  return found ?? null
}

const sceneById = prepared((db) =>
  db
    .select(sceneColumns)
    .from(scenes)
    .leftJoin(pageTabs, eq(pageTabs.id, scenes.tabId))
    .leftJoin(pages, and(eq(pages.id, pageTabs.pageId), isNull(pages.deletedAt)))
    .where(and(eq(scenes.id, sql.placeholder('sceneId')), alive))
    .prepare('find_scene')
)

/** La escena de una pestaña */
export async function sceneOfTab(db: Database, tabId: string): Promise<SceneWithPage | null> {
  const [found] = await db
    .select(sceneColumns)
    .from(scenes)
    .leftJoin(pageTabs, eq(pageTabs.id, scenes.tabId))
    .leftJoin(pages, and(eq(pages.id, pageTabs.pageId), isNull(pages.deletedAt)))
    .where(and(eq(scenes.tabId, tabId), isNotNull(pages.id)))
  return found ?? null
}

/**
 * Las escenas de un mundo: las sueltas y las de páginas fuera de la papelera, por su nombre (las de una página, por el
 * título de la página y luego el de la pestaña)
 */
export function listScenes(db: Database, worldId: string): Promise<SceneWithPage[]> {
  return db
    .select(sceneColumns)
    .from(scenes)
    .leftJoin(pageTabs, eq(pageTabs.id, scenes.tabId))
    .leftJoin(pages, and(eq(pages.id, pageTabs.pageId), isNull(pages.deletedAt)))
    .where(and(eq(scenes.worldId, worldId), alive))
    .orderBy(
      sql`lower(coalesce(${pages.title}, ${scenes.name}, ''))`,
      sql`lower(coalesce(${pageTabs.name}, ''))`,
      asc(scenes.id)
    )
}

/** Una escena suelta, de la Mesa (ADR-0020): sin página, con su nombre y la rejilla de siempre */
export function createScene(db: Database, context: OperationContext, values: { worldId: string; name: string }) {
  return operation(db, context, (w) => w.insert(scenes, { ...values, grid: DEFAULT_SCENE_GRID }))
}

/** El nombre de una escena suelta */
export function renameScene(db: Database, context: OperationContext, sceneId: string, name: string) {
  return operation(db, context, (w) => w.update(scenes, sceneId, { name }))
}

/** Borrar una escena suelta (al historial: deshacer la devuelve entera; sus teselas se conservan, 0062) */
export function deleteScene(db: Database, context: OperationContext, sceneId: string) {
  return operation(db, context, (w) => removeSceneWith(w, sceneId))
}

/**
 * Quitar una escena con todo lo suyo, al historial: el estado de cada campaña en ella, sus muros, sus luces y, de cada
 * campaña, su niebla a mano, sus fichas, lo dejado en el mapa y sus instantáneas (sin historial se irían en cascada y
 * deshacer devolvería la escena rota). Las teselas y lo explorado se quedan. Lo usa también quitar su pestaña
 */
export async function removeSceneWith(w: Writer, sceneId: string) {
  const states = await w.read.select({ id: sceneStates.id }).from(sceneStates).where(eq(sceneStates.sceneId, sceneId))
  for (const state of states) await w.remove(sceneStates, state.id)
  for (const table of [sceneWalls, sceneLights, sceneFog, sceneTokens, sceneMarks, sceneSnapshots]) {
    const rows = await w.read.select({ id: table.id }).from(table).where(eq(table.sceneId, sceneId))
    await w.removeMany(
      table,
      rows.map((r) => r.id)
    )
  }
  // El combate que se libraba en ella se queda sin escena (con historial: deshacer se la devuelve)
  const fights = await w.read.select({ id: combats.id }).from(combats).where(eq(combats.sceneId, sceneId))
  for (const fight of fights) await w.update(combats, fight.id, { sceneId: null })
  await w.remove(scenes, sceneId)
}

export function updateScene(db: Database, context: OperationContext, sceneId: string, patch: ScenePatch) {
  return operation(db, context, (w) => w.update(scenes, sceneId, patch))
}

/**
 * El estado de la campaña en la escena; si es la primera vez que la abre, se crea (y `created` lo dice: solo quien lo
 * crea pone lo preparado de la escena). Dos a la vez no chocan: la segunda espera a la primera y se encuentra el suyo
 */
export async function ensureSceneState(
  db: Database,
  context: OperationContext,
  values: { worldId: string; campaignId: string; sceneId: string }
): Promise<{ state: typeof sceneStates.$inferSelect; created: boolean }> {
  const where = and(eq(sceneStates.campaignId, values.campaignId), eq(sceneStates.sceneId, values.sceneId))
  const [found] = await db.select().from(sceneStates).where(where)
  if (found) return { state: found, created: false }
  return operation(db, context, async (w) => {
    await w.read.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`scene_state:${values.campaignId}:${values.sceneId}`}, 0))`
    )
    const [again] = await w.read.select().from(sceneStates).where(where)
    if (again) return { state: again, created: false }
    return { state: await w.insert(sceneStates, values), created: true }
  })
}

/** La mesa de una campaña; sin fila aún, la de por defecto (nada abierto, cámara siguiendo al máster) */
export async function campaignTable(db: Database, campaignId: string): Promise<CampaignTableRow> {
  const [found] = await tableOfCampaign(db).execute({ campaignId })
  return (
    found ?? {
      campaignId,
      openSceneId: null,
      presentedSceneId: null,
      screenHidden: false,
      camera: { mode: 'follow' },
      tileFit: 'whole',
      measureOnScreen: false,
      paused: false,
      movement: 'free',
      kicked: [],
      screenShow: null,
      updatedAt: new Date(0)
    }
  )
}

const tableOfCampaign = prepared((db) =>
  db
    .select()
    .from(campaignTables)
    .where(eq(campaignTables.campaignId, sql.placeholder('campaignId')))
    .prepare('campaign_table')
)

/** Cambia la mesa de una campaña (la crea si no la tenía) */
export async function setCampaignTable(
  db: Database,
  campaignId: string,
  patch: Partial<{
    openSceneId: string | null
    presentedSceneId: string | null
    screenHidden: boolean
    camera: ScreenCameraData
    tileFit: 'whole' | 'cropped'
    measureOnScreen: boolean
    paused: boolean
    movement: 'free' | 'turn' | 'locked'
    kicked: string[]
    screenShow: { kind: 'page' | 'image'; id: string; title: string } | null
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

/** Echa a alguien de la Mesa de una campaña (sin repetirlo si ya estaba): la sala, docs/specs/sala.md */
export async function kickFromTable(db: Database, campaignId: string, userId: string): Promise<void> {
  await db
    .insert(campaignTables)
    .values({ campaignId, kicked: [userId] })
    .onConflictDoUpdate({
      target: campaignTables.campaignId,
      set: {
        kicked: sql`case when ${userId} = any(${campaignTables.kicked}) then ${campaignTables.kicked} else array_append(${campaignTables.kicked}, ${userId}) end`,
        updatedAt: new Date()
      }
    })
}

/** Le deja volver a la Mesa */
export async function allowBackToTable(db: Database, campaignId: string, userId: string): Promise<void> {
  await db
    .update(campaignTables)
    .set({ kicked: sql`array_remove(${campaignTables.kicked}, ${userId})`, updatedAt: new Date() })
    .where(eq(campaignTables.campaignId, campaignId))
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
