/**
 * Las pestañas de las páginas y sus mapas con pines (ADR-0007). Todo pasa por operation(): se deshace desde el
 * historial. Quitar una pestaña quita su mapa y sus pines en la misma operación, para que deshacer lo vuelva a poner
 */
import { and, asc, eq, getTableColumns, inArray, isNull, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { files } from '../schema/files.ts'
import { mapElements, mapPins, maps, pageTabs } from '../schema/maps.ts'
import { pages } from '../schema/pages.ts'

export type PageTabRow = typeof pageTabs.$inferSelect
export type MapRow = typeof maps.$inferSelect
export type MapPinRow = typeof mapPins.$inferSelect
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

export async function findTab(db: Database, tabId: string) {
  const [found] = await db.select().from(pageTabs).where(eq(pageTabs.id, tabId))
  return found ?? null
}

/** Una pestaña nueva; si es un mapa, con su mapa vacío */
export function createTab(
  db: Database,
  context: OperationContext,
  values: { worldId: string; pageId: string; kind: PageTabRow['kind']; name: string; position: string }
) {
  return operation(db, context, async (w) => {
    const tab = await w.insert(pageTabs, values)
    if (values.kind === 'map') await w.insert(maps, { worldId: values.worldId, tabId: tab.id })
    return tab
  })
}

export function updateTab(
  db: Database,
  context: OperationContext,
  tabId: string,
  patch: Partial<Pick<PageTabRow, 'name' | 'hidden' | 'position'>>
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
      await w.remove(maps, map.id)
    }
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
  patch: Partial<Pick<MapRow, 'fileId' | 'width' | 'height' | 'scaleLength' | 'scaleValue' | 'scaleUnit'>>
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
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.worldId, worldId), inArray(pages.id, [...ids]), isNull(pages.deletedAt)))
}
