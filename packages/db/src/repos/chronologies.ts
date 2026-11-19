/**
 * Las cronologías de un mundo (cada una, una pestaña de una página: ADR-0031), sus grupos y sus eventos (de cada una:
 * ADR-0032; módulo 8): leerlos. Se escriben por operation() desde las acciones, con su historial
 */
import { and, asc, count, eq, getTableColumns, inArray, isNull, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import type { Writer } from '../operation.ts'
import { chronologies, timelineEvents, timelineGroups } from '../schema/chronologies.ts'
import { documents } from '../schema/documents.ts'
import { pageTabs } from '../schema/maps.ts'
import { pages } from '../schema/pages.ts'
import { writeMark } from './knowledge.ts'
import { placeKey } from './pages.ts'

export type ChronologyRow = typeof chronologies.$inferSelect
export type TimelineGroupRow = typeof timelineGroups.$inferSelect
export type TimelineEventRow = typeof timelineEvents.$inferSelect

/** Una cronología con su pestaña y su página (ADR-0031): su nombre, quién la ve y dónde está son los de ellas */
export type PlacedChronologyRow = ChronologyRow & {
  tabName: string
  tabHidden: boolean
  pageId: string
  pageTitle: string
}

const placed = {
  ...getTableColumns(chronologies),
  tabName: pageTabs.name,
  tabHidden: pageTabs.hidden,
  pageId: pageTabs.pageId,
  pageTitle: pages.title
}

/** Las de un mundo cuya página no está en la papelera, por su página y, en ella, en el orden de sus pestañas */
export function listChronologies(db: Database, worldId: string): Promise<PlacedChronologyRow[]> {
  return db
    .select(placed)
    .from(chronologies)
    .innerJoin(pageTabs, eq(pageTabs.id, chronologies.tabId))
    .innerJoin(pages, and(eq(pages.id, pageTabs.pageId), isNull(pages.deletedAt)))
    .where(eq(chronologies.worldId, worldId))
    .orderBy(asc(pages.title), sql`${pageTabs.position} collate "C"`, asc(chronologies.id))
}

/** Una, con su pestaña y su página (aunque esté en la papelera: quien la pide lo comprueba con su página) */
export async function findChronology(db: Database, chronologyId: string): Promise<PlacedChronologyRow | null> {
  const [found] = await db
    .select(placed)
    .from(chronologies)
    .innerJoin(pageTabs, eq(pageTabs.id, chronologies.tabId))
    .innerJoin(pages, eq(pages.id, pageTabs.pageId))
    .where(eq(chronologies.id, chronologyId))
  return found ?? null
}

/** La de una pestaña */
export async function chronologyOfTab(db: Database, tabId: string): Promise<PlacedChronologyRow | null> {
  const [found] = await db
    .select(placed)
    .from(chronologies)
    .innerJoin(pageTabs, eq(pageTabs.id, chronologies.tabId))
    .innerJoin(pages, eq(pages.id, pageTabs.pageId))
    .where(eq(chronologies.tabId, tabId))
  return found ?? null
}

/** Los grupos de todas las cronologías de un mundo (la vista grande de un calendario) */
export function listGroups(db: Database, worldId: string) {
  return db
    .select()
    .from(timelineGroups)
    .where(eq(timelineGroups.worldId, worldId))
    .orderBy(sql`${timelineGroups.position} collate "C"`, asc(timelineGroups.id))
}

/** Los grupos de una cronología, en su orden */
export function groupsOf(db: Database, chronologyId: string) {
  return db
    .select()
    .from(timelineGroups)
    .where(eq(timelineGroups.chronologyId, chronologyId))
    .orderBy(sql`${timelineGroups.position} collate "C"`, asc(timelineGroups.id))
}

export async function findGroup(db: Database, groupId: string) {
  const [found] = await db.select().from(timelineGroups).where(eq(timelineGroups.id, groupId))
  return found ?? null
}

/** Los eventos de todas las cronologías de un mundo */
export function listEvents(db: Database, worldId: string) {
  return db.select().from(timelineEvents).where(eq(timelineEvents.worldId, worldId))
}

/** Los eventos de una cronología */
export function eventsOf(db: Database, chronologyId: string) {
  return db.select().from(timelineEvents).where(eq(timelineEvents.chronologyId, chronologyId))
}

/** Cuántos eventos tiene un mundo (su tope) */
export async function countEvents(db: Database, worldId: string) {
  const [row] = await db.select({ n: count() }).from(timelineEvents).where(eq(timelineEvents.worldId, worldId))
  return row?.n ?? 0
}

export async function findEvent(db: Database, eventId: string) {
  const [found] = await db.select().from(timelineEvents).where(eq(timelineEvents.id, eventId))
  return found ?? null
}

/** Los eventos enlazados a una página (para enseñarlos en ella) */
export function eventsOfPage(db: Database, pageId: string) {
  return db.select().from(timelineEvents).where(eq(timelineEvents.pageId, pageId))
}

/** Las fechas de los eventos de un calendario (las fechas en uso, ADR-0029) */
export function eventDates(db: Database, calendarId: string) {
  return db
    .select({ date: timelineEvents.date })
    .from(timelineEvents)
    .where(sql`${timelineEvents.date}->>'calendarId' = ${calendarId}`)
}

/**
 * Las páginas con alguna fecha de un mundo (fuera de la papelera), con lo que enseña una cronología: de sus
 * propiedades, solo las fechas y las etiquetas (miles de páginas: lo demás no hace falta traerlo)
 */
export function datedPagesOf(db: Database, worldId: string) {
  return db
    .select({
      id: pages.id,
      title: pages.title,
      icon: pages.icon,
      cover: pages.cover,
      template: pages.template,
      templateLine: pages.templateLine,
      properties: sql<unknown[]>`jsonb_path_query_array(${pages.properties},
        '$[*] ? (@.type == "date" || @.name like_regex "^etiquetas$" flag "i")')`
    })
    .from(pages)
    .where(
      and(
        eq(pages.worldId, worldId),
        isNull(pages.deletedAt),
        sql`${pages.properties} @> ${JSON.stringify([{ type: 'date' }])}::jsonb`
      )
    )
}

/** Título e icono de esas páginas del mundo (fuera de la papelera) */
export async function pageHeads(db: Database, worldId: string, ids: readonly string[]) {
  if (ids.length === 0) return new Map<string, { title: string; icon: string | null }>()
  const rows = await db
    .select({ id: pages.id, title: pages.title, icon: pages.icon })
    .from(pages)
    .where(and(eq(pages.worldId, worldId), isNull(pages.deletedAt), inArray(pages.id, [...new Set(ids)])))
  return new Map(rows.map((row) => [row.id, { title: row.title, icon: row.icon }]))
}

/**
 * Una página nueva para un evento (enlazarlo a ella o convertirlo), dentro de la operación del evento: al final de su
 * rama, con su icono, su portada y su texto; oculta si alguna campaña conoce a su madre (ADR-0017)
 */
export async function insertEventPage(
  w: Writer,
  input: {
    worldId: string
    parentId: string | null
    title: string
    icon?: string | null
    cover?: { fileId: string; x: number; y: number } | null
    hidden: boolean
    body?: Uint8Array | null
    actorId: string | null
  }
) {
  const position = await placeKey(w.read, input.worldId, { parentId: input.parentId })
  const page = await w.insert(pages, {
    worldId: input.worldId,
    parentId: input.parentId,
    position,
    title: input.title,
    icon: input.icon ?? null,
    cover: input.cover ?? null
  })
  if (input.hidden)
    await writeMark(w, {
      worldId: input.worldId,
      campaignId: null,
      kind: 'page',
      targetId: page.id,
      known: false,
      characters: null
    })
  if (input.body)
    await w.read
      .insert(documents)
      .values({ worldId: input.worldId, pageId: page.id, kind: 'body', state: input.body, updatedBy: input.actorId })
  return page
}
