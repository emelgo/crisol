/**
 * Las cronologías de un mundo, sus grupos y sus eventos sueltos (módulo 8): leerlos. Se escriben por operation() desde
 * las acciones, con su historial
 */
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import type { Writer } from '../operation.ts'
import { chronologies, timelineEvents, timelineGroups } from '../schema/chronologies.ts'
import { documents } from '../schema/documents.ts'
import { pages } from '../schema/pages.ts'
import { writeMark } from './knowledge.ts'
import { placeKey } from './pages.ts'

export type ChronologyRow = typeof chronologies.$inferSelect
export type TimelineGroupRow = typeof timelineGroups.$inferSelect
export type TimelineEventRow = typeof timelineEvents.$inferSelect

/** Las de un mundo, en su orden (y por id, si dos claves coinciden) */
export function listChronologies(db: Database, worldId: string) {
  return db
    .select()
    .from(chronologies)
    .where(eq(chronologies.worldId, worldId))
    .orderBy(sql`${chronologies.position} collate "C"`, asc(chronologies.id))
}

export async function findChronology(db: Database, chronologyId: string) {
  const [found] = await db.select().from(chronologies).where(eq(chronologies.id, chronologyId))
  return found ?? null
}

export function listGroups(db: Database, worldId: string) {
  return db
    .select()
    .from(timelineGroups)
    .where(eq(timelineGroups.worldId, worldId))
    .orderBy(sql`${timelineGroups.position} collate "C"`, asc(timelineGroups.id))
}

export async function findGroup(db: Database, groupId: string) {
  const [found] = await db.select().from(timelineGroups).where(eq(timelineGroups.id, groupId))
  return found ?? null
}

export function listEvents(db: Database, worldId: string) {
  return db.select().from(timelineEvents).where(eq(timelineEvents.worldId, worldId))
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
