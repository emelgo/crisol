/**
 * Las pestañas de las páginas y sus mapas con pines (ADR-0007). Todo pasa por operation(): se deshace desde el
 * historial. Quitar una pestaña quita su mapa y sus pines en la misma operación, para que deshacer lo vuelva a poner
 */
import { and, asc, count, eq, getTableColumns, inArray, isNull, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { files } from '../schema/files.ts'
import { mapElements, mapLayers, mapPins, maps, pageTabs } from '../schema/maps.ts'
import { pages } from '../schema/pages.ts'
import { DEFAULT_SCENE_GRID, scenes } from '../schema/scenes.ts'
import { randomTables } from '../schema/tables.ts'
import { removeSceneWith } from './scenes.ts'

export type PageTabRow = typeof pageTabs.$inferSelect
export type MapRow = typeof maps.$inferSelect
export type MapPinRow = typeof mapPins.$inferSelect
export type MapLayerRow = typeof mapLayers.$inferSelect
export type MapElementRow = typeof mapElements.$inferSelect
type ElementValues = Omit<
  typeof mapElements.$inferInsert,
  'id' | 'version' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'
>
type PinValues = Omit<
  typeof mapPins.$inferInsert,
  'id' | 'version' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'
>

/** Las pestañas de una página, en su orden (y por id, si dos claves coinciden) */
export function listTabs(db: Database, pageId: string) {
  return db
    .select()
    .from(pageTabs)
    .where(eq(pageTabs.pageId, pageId))
    .orderBy(sql`${pageTabs.position} collate "C"`, asc(pageTabs.id))
}

/** La pestaña viva de un documento de texto (de tipo tab), o null si se borró */
export async function tabOfDocument(db: Database, documentId: string) {
  const [tab] = await db.select({ id: pageTabs.id }).from(pageTabs).where(eq(pageTabs.documentId, documentId))
  return tab ?? null
}

/** Cuántos pines tiene un mapa (para su tope) */
export async function countPins(db: Database, mapId: string) {
  const [row] = await db.select({ n: count() }).from(mapPins).where(eq(mapPins.mapId, mapId))
  return row?.n ?? 0
}

export async function findTab(db: Database, tabId: string) {
  const [found] = await db.select().from(pageTabs).where(eq(pageTabs.id, tabId))
  return found ?? null
}

/** Una pestaña nueva; si es un mapa o una escena, con su mapa o su escena vacía */
export function createTab(
  db: Database,
  context: OperationContext,
  values: {
    worldId: string
    pageId: string
    kind: PageTabRow['kind']
    name: string
    position: string
    documentId?: string | null
  }
) {
  return operation(db, context, async (w) => {
    const tab = await w.insert(pageTabs, values)
    if (values.kind === 'map') await w.insert(maps, { worldId: values.worldId, tabId: tab.id })
    if (values.kind === 'table') await w.insert(randomTables, { worldId: values.worldId, tabId: tab.id })
    if (values.kind === 'scene')
      await w.insert(scenes, { worldId: values.worldId, tabId: tab.id, grid: DEFAULT_SCENE_GRID })
    return tab
  })
}

export function updateTab(
  db: Database,
  context: OperationContext,
  tabId: string,
  patch: Partial<Pick<PageTabRow, 'name' | 'hidden' | 'position' | 'color'>>
) {
  return operation(db, context, (w) => w.update(pageTabs, tabId, patch))
}

/** Quita la pestaña con lo suyo: los pines y lo dibujado del mapa, el mapa y la pestaña, por ese orden */
export function deleteTab(db: Database, context: OperationContext, tabId: string) {
  return operation(db, context, async (w) => {
    const [map] = await w.read.select({ id: maps.id }).from(maps).where(eq(maps.tabId, tabId))
    if (map) {
      const pins = await w.read.select({ id: mapPins.id }).from(mapPins).where(eq(mapPins.mapId, map.id))
      for (const pin of pins) await w.remove(mapPins, pin.id)
      const elements = await w.read
        .select({ id: mapElements.id })
        .from(mapElements)
        .where(eq(mapElements.mapId, map.id))
      for (const element of elements) await w.remove(mapElements, element.id)
      const layers = await w.read.select({ id: mapLayers.id }).from(mapLayers).where(eq(mapLayers.mapId, map.id))
      for (const layer of layers) await w.remove(mapLayers, layer.id)
      await w.remove(maps, map.id)
    }
    // Su tabla aleatoria, al historial: deshacer la devuelve con sus filas
    const [table] = await w.read.select({ id: randomTables.id }).from(randomTables).where(eq(randomTables.tabId, tabId))
    if (table) await w.remove(randomTables, table.id)
    // Su escena, con el estado de cada campaña en ella: deshacer devuelve las dos
    const [scene] = await w.read.select({ id: scenes.id }).from(scenes).where(eq(scenes.tabId, tabId))
    if (scene) await removeSceneWith(w, scene.id)
    await w.remove(pageTabs, tabId)
  })
}

/** El mapa de una pestaña, con su imagen si la tiene y sigue fuera de la papelera */
export async function mapOfTab(db: Database, tabId: string) {
  const [found] = await db
    .select({
      ...getTableColumns(maps),
      fileName: files.name,
      fileVersion: files.version,
      fileKind: files.kind
    })
    .from(maps)
    .leftJoin(files, and(eq(files.id, maps.fileId), isNull(files.deletedAt)))
    .where(eq(maps.tabId, tabId))
  return found ?? null
}

export async function findMap(db: Database, mapId: string) {
  const [found] = await db.select().from(maps).where(eq(maps.id, mapId))
  return found ?? null
}

export function updateMap(
  db: Database,
  context: OperationContext,
  mapId: string,
  patch: Partial<Pick<MapRow, 'fileId' | 'width' | 'height' | 'scaleLength' | 'scaleValue' | 'scaleUnit' | 'speeds'>>
) {
  return operation(db, context, (w) => w.update(maps, mapId, patch))
}

/** Los pines de un mapa, con el título de su página si sigue fuera de la papelera */
export function listPins(db: Database, mapId: string) {
  return db
    .select({ ...getTableColumns(mapPins), pageTitle: pages.title })
    .from(mapPins)
    .leftJoin(pages, and(eq(pages.id, mapPins.pageId), isNull(pages.deletedAt)))
    .where(eq(mapPins.mapId, mapId))
    .orderBy(asc(mapPins.createdAt), asc(mapPins.id))
}

export async function findPin(db: Database, pinId: string) {
  const [found] = await db
    .select({ ...getTableColumns(mapPins), pageTitle: pages.title })
    .from(mapPins)
    .leftJoin(pages, and(eq(pages.id, mapPins.pageId), isNull(pages.deletedAt)))
    .where(eq(mapPins.id, pinId))
  return found ?? null
}

export function createPin(db: Database, context: OperationContext, values: PinValues) {
  return operation(db, context, (w) => w.insert(mapPins, values))
}

export function updatePin(
  db: Database,
  context: OperationContext,
  pinId: string,
  patch: Partial<Omit<PinValues, 'worldId' | 'mapId'>>
) {
  return operation(db, context, (w) => w.update(mapPins, pinId, patch))
}

export function deletePin(db: Database, context: OperationContext, pinId: string) {
  return operation(db, context, (w) => w.remove(mapPins, pinId))
}

/** De estos ids, las páginas del mundo fuera de la papelera */
export function pagesInWorld(db: Database, worldId: string, ids: readonly string[]) {
  if (ids.length === 0) return Promise.resolve([])
  return db
    .select({ id: pages.id, title: pages.title })
    .from(pages)
    .where(and(eq(pages.worldId, worldId), inArray(pages.id, [...ids]), isNull(pages.deletedAt)))
}

/** Las capas de un mapa, de abajo arriba (y por id, si dos claves coinciden) */
export function listLayers(db: Database, mapId: string) {
  return db
    .select()
    .from(mapLayers)
    .where(eq(mapLayers.mapId, mapId))
    .orderBy(sql`${mapLayers.position} collate "C"`, asc(mapLayers.id))
}

export async function findLayer(db: Database, layerId: string) {
  const [found] = await db.select().from(mapLayers).where(eq(mapLayers.id, layerId))
  return found ?? null
}

export function createLayer(
  db: Database,
  context: OperationContext,
  values: { worldId: string; mapId: string; name: string; position: string; hidden?: boolean }
) {
  return operation(db, context, (w) => w.insert(mapLayers, values))
}

export function updateLayer(
  db: Database,
  context: OperationContext,
  layerId: string,
  patch: Partial<Pick<MapLayerRow, 'name' | 'hidden' | 'position'>>
) {
  return operation(db, context, (w) => w.update(mapLayers, layerId, patch))
}

/** Quita la capa con lo dibujado en ella, en la misma operación (deshacer lo devuelve todo) */
export function deleteLayer(db: Database, context: OperationContext, layerId: string) {
  return operation(db, context, async (w) => {
    const elements = await w.read
      .select({ id: mapElements.id })
      .from(mapElements)
      .where(eq(mapElements.layerId, layerId))
    for (const element of elements) await w.remove(mapElements, element.id)
    await w.remove(mapLayers, layerId)
  })
}

/** Lo dibujado en un mapa, de abajo arriba dentro de cada capa, con el título de su página si sigue viva */
export function listElements(db: Database, mapId: string) {
  return db
    .select({ ...getTableColumns(mapElements), pageTitle: pages.title })
    .from(mapElements)
    .leftJoin(pages, and(eq(pages.id, mapElements.pageId), isNull(pages.deletedAt)))
    .where(eq(mapElements.mapId, mapId))
    .orderBy(sql`${mapElements.position} collate "C"`, asc(mapElements.createdAt), asc(mapElements.id))
}

export async function findElement(db: Database, elementId: string) {
  const [found] = await db
    .select({ ...getTableColumns(mapElements), pageTitle: pages.title })
    .from(mapElements)
    .leftJoin(pages, and(eq(pages.id, mapElements.pageId), isNull(pages.deletedAt)))
    .where(eq(mapElements.id, elementId))
  return found ?? null
}

/** Cuántos elementos tiene un mapa (para su tope) y la clave del de más arriba (para poner otro encima) */
export async function elementStats(db: Database, mapId: string) {
  const [row] = await db
    .select({ n: count(), last: sql<string | null>`max(${mapElements.position} collate "C")` })
    .from(mapElements)
    .where(eq(mapElements.mapId, mapId))
  return { count: row?.n ?? 0, last: row?.last || null }
}

export function createElement(db: Database, context: OperationContext, values: ElementValues) {
  return operation(db, context, (w) => w.insert(mapElements, values))
}

export function updateElement(
  db: Database,
  context: OperationContext,
  elementId: string,
  patch: Partial<Omit<ElementValues, 'worldId' | 'mapId' | 'kind'>>
) {
  return operation(db, context, (w) => w.update(mapElements, elementId, patch))
}

export function deleteElement(db: Database, context: OperationContext, elementId: string) {
  return operation(db, context, (w) => w.remove(mapElements, elementId))
}
