/**
 * Las tablas aleatorias del máster: la de una pestaña, cambiarla con su versión, y lo sacado por campaña (las que
 * van sin reemplazo)
 */
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { campaigns } from '../schema/campaigns.ts'
import { pageTabs } from '../schema/maps.ts'
import { pages } from '../schema/pages.ts'
import { contentTableDraws, randomTableDraws, randomTables, type TableRow } from '../schema/tables.ts'

export class TableChangedError extends Error {
  constructor() {
    super('La tabla cambió mientras tanto')
    this.name = 'TableChangedError'
  }
}

/** La tabla de una pestaña, con el nombre de la pestaña y su página */
export async function tableOfTab(db: Database, tabId: string) {
  const [found] = await db
    .select({
      id: randomTables.id,
      worldId: randomTables.worldId,
      tabId: randomTables.tabId,
      formula: randomTables.formula,
      replacement: randomTables.replacement,
      rows: randomTables.rows,
      version: randomTables.version,
      name: pageTabs.name,
      pageId: pageTabs.pageId
    })
    .from(randomTables)
    .innerJoin(pageTabs, eq(pageTabs.id, randomTables.tabId))
    // La de una página en la papelera, no: ni se tira ni se anida
    .innerJoin(pages, eq(pages.id, pageTabs.pageId))
    .where(and(eq(randomTables.tabId, tabId), isNull(pages.deletedAt)))
  return found ?? null
}

export type TableOfTab = NonNullable<Awaited<ReturnType<typeof tableOfTab>>>

/** Las tablas aleatorias de un mundo (fuera de la papelera), con su página, por el título de su página y su nombre */
export function listWorldTables(db: Database, worldId: string) {
  return db
    .select({ tabId: randomTables.tabId, name: pageTabs.name, pageId: pages.id, pageTitle: pages.title })
    .from(randomTables)
    .innerJoin(pageTabs, eq(pageTabs.id, randomTables.tabId))
    .innerJoin(pages, eq(pages.id, pageTabs.pageId))
    .where(and(eq(randomTables.worldId, worldId), isNull(pages.deletedAt)))
    .orderBy(pages.title, pageTabs.name)
}

export function updateTable(
  db: Database,
  context: OperationContext,
  id: string,
  version: number,
  patch: { formula?: string | null; replacement?: boolean; rows?: TableRow[] }
) {
  return operation(db, context, async (w) => {
    const [current] = await w.read
      .select({ version: randomTables.version })
      .from(randomTables)
      .where(eq(randomTables.id, id))
      .for('update')
    if (!current || current.version !== version) throw new TableChangedError()
    return w.update(randomTables, id, patch)
  })
}

/** Lo sacado de una tabla en una campaña (sus filas) */
export async function drawsOf(db: Database, campaignId: string, tableId: string) {
  const [found] = await db
    .select({ rows: randomTableDraws.rows })
    .from(randomTableDraws)
    .where(and(eq(randomTableDraws.campaignId, campaignId), eq(randomTableDraws.tableId, tableId)))
  return found?.rows ?? []
}

/** Apunta lo sacado (sin repetir) */
export async function addDraws(db: Database, campaignId: string, tableId: string, rows: readonly string[]) {
  if (rows.length === 0) return
  await db
    .insert(randomTableDraws)
    .values({ campaignId, tableId, rows: [...rows] })
    .onConflictDoUpdate({
      target: [randomTableDraws.campaignId, randomTableDraws.tableId],
      set: {
        rows: sql`(select jsonb_agg(distinct v) from jsonb_array_elements(${randomTableDraws.rows} || ${JSON.stringify(rows)}::jsonb) v)`
      }
    })
}

/** Vuelve a empezar: todo puede salir otra vez */
export async function resetDraws(db: Database, campaignId: string, tableId: string) {
  await db
    .delete(randomTableDraws)
    .where(and(eq(randomTableDraws.campaignId, campaignId), eq(randomTableDraws.tableId, tableId)))
}

/** Lo sacado de una tabla del compendio sin reemplazo en una campaña, por su clave */
export async function contentDrawsOf(db: Database, campaignId: string, key: string) {
  const [found] = await db
    .select({ rows: contentTableDraws.rows })
    .from(contentTableDraws)
    .where(and(eq(contentTableDraws.campaignId, campaignId), eq(contentTableDraws.key, key)))
  return found?.rows ?? []
}

/** Lo sacado de unas tablas del compendio, de una vez (para leerlas) */
export async function contentDrawsByKeys(db: Database, campaignId: string, keys: readonly string[]) {
  if (keys.length === 0) return new Map<string, string[]>()
  const found = await db
    .select({ key: contentTableDraws.key, rows: contentTableDraws.rows })
    .from(contentTableDraws)
    .where(and(eq(contentTableDraws.campaignId, campaignId), inArray(contentTableDraws.key, [...keys])))
  return new Map(found.map((f) => [f.key, f.rows]))
}

/** Apunta lo sacado de una tabla del compendio */
export async function addContentDraws(db: Database, campaignId: string, key: string, rows: readonly string[]) {
  if (rows.length === 0) return
  await db
    .insert(contentTableDraws)
    .values({ campaignId, key, rows: [...rows] })
    .onConflictDoUpdate({
      target: [contentTableDraws.campaignId, contentTableDraws.key],
      set: {
        rows: sql`(select jsonb_agg(distinct v) from jsonb_array_elements(${contentTableDraws.rows} || ${JSON.stringify(rows)}::jsonb) v)`
      }
    })
}

/** Vuelve a empezar una tabla del compendio en una campaña */
export async function resetContentDraws(db: Database, campaignId: string, key: string) {
  await db
    .delete(contentTableDraws)
    .where(and(eq(contentTableDraws.campaignId, campaignId), eq(contentTableDraws.key, key)))
}

/** Olvida lo sacado de unas tablas del compendio de un mundo (al quitarlas) en sus campañas con ese sistema */
export async function forgetContentDraws(db: Database, worldId: string, systemId: string, keys: readonly string[]) {
  if (keys.length === 0) return
  const inWorld = db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.worldId, worldId), eq(campaigns.system, systemId)))
  await db
    .delete(contentTableDraws)
    .where(and(inArray(contentTableDraws.campaignId, inWorld), inArray(contentTableDraws.key, [...keys])))
}
