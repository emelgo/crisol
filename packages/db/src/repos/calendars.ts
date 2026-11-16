/** Los calendarios de un mundo (módulo 8, ADR-0029): leerlos y escribirlos por operation(), con su historial */
import type { CalendarDefinition } from '@crisol/domain'
import { and, asc, eq, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { calendars } from '../schema/calendars.ts'

export type CalendarRow = typeof calendars.$inferSelect

/** Los de un mundo, en su orden (y por id, si dos claves coinciden) */
export function listCalendars(db: Database, worldId: string) {
  return db
    .select()
    .from(calendars)
    .where(eq(calendars.worldId, worldId))
    .orderBy(sql`${calendars.position} collate "C"`, asc(calendars.id))
}

export async function findCalendar(db: Database, calendarId: string) {
  const [found] = await db.select().from(calendars).where(eq(calendars.id, calendarId))
  return found ?? null
}

/** El principal de un mundo, si tiene calendarios */
export async function primaryCalendar(db: Database, worldId: string) {
  const [found] = await db
    .select()
    .from(calendars)
    .where(and(eq(calendars.worldId, worldId), eq(calendars.isPrimary, true)))
  return found ?? null
}

export function createCalendar(
  db: Database,
  context: OperationContext,
  values: { worldId: string; name: string; position: string; isPrimary: boolean; definition: CalendarDefinition }
) {
  return operation(db, context, (w) => w.insert(calendars, values))
}

export function updateCalendar(
  db: Database,
  context: OperationContext,
  calendarId: string,
  patch: Partial<Pick<CalendarRow, 'name' | 'position' | 'definition'>>
) {
  return operation(db, context, (w) => w.update(calendars, calendarId, patch))
}

/**
 * Hace principal a uno (con lo que cambie de él en la misma operación): primero deja de serlo el anterior (con la
 * correspondencia inversa, si la hay) y luego lo es este, para que el índice único no choque; deshacer va al revés
 */
export function makePrimary(
  db: Database,
  context: OperationContext,
  calendarId: string,
  patch: Partial<Pick<CalendarRow, 'name' | 'position' | 'definition'>>,
  previous: { id: string; definition?: CalendarDefinition } | null
) {
  return operation(db, context, async (w) => {
    if (previous)
      await w.update(calendars, previous.id, {
        isPrimary: false,
        ...(previous.definition ? { definition: previous.definition } : {})
      })
    return w.update(calendars, calendarId, { ...patch, isPrimary: true })
  })
}

export function deleteCalendar(db: Database, context: OperationContext, calendarId: string) {
  return operation(db, context, (w) => w.remove(calendars, calendarId))
}
