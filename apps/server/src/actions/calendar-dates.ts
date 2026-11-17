/**
 * Las fechas que usan un calendario (ADR-0029): borrar un calendario con fechas o quitarle un mes con fechas se impide,
 * y acortar un mes avisa de cuántas tienen un día que ya no cabe. Cada capacidad que guarda fechas añade aquí su
 * fuente: `fechas` (las propiedades de las páginas), `cronologias` (los eventos) y el «hoy» de las campañas
 */
import { campaignTimeRepo, chronologiesRepo, type Database, pagesRepo } from '@crisol/db'
import { type CalendarDefinition, isValidDate, type WorldDate } from '@crisol/domain'
import { propertiesOf } from '../wiki/properties.ts'

/** Una fecha guardada: su inicio y, si es un periodo, su fin */
export interface StoredDate {
  start: WorldDate
  end?: WorldDate | undefined
}

export interface DateSource {
  /** Las fechas de ese calendario */
  dates: (db: Database, calendarId: string) => Promise<StoredDate[]>
}

/** Las propiedades «Fecha» de las páginas (también las de la papelera: al volver tienen que caber) */
export const pageDates: DateSource = {
  dates: async (db, calendarId) =>
    (await pagesRepo.datedPages(db, calendarId)).flatMap((row) =>
      propertiesOf(row.properties).flatMap((property) =>
        property.type === 'date' && property.value?.calendarId === calendarId ? [property.value] : []
      )
    )
}

/** Las fechas de los eventos sueltos de las cronologías */
export const eventDates: DateSource = {
  dates: async (db, calendarId) => (await chronologiesRepo.eventDates(db, calendarId)).map((row) => row.date)
}

/** El «hoy» de las campañas (8 · campaña) */
export const todayDates: DateSource = {
  dates: async (db, calendarId) =>
    (await campaignTimeRepo.todaysInCalendar(db, calendarId)).map((today) => ({ start: today.date }))
}

export const DATE_SOURCES: DateSource[] = [pageDates, eventDates, todayDates]

async function allDates(db: Database, calendarId: string) {
  return (await Promise.all(DATE_SOURCES.map((source) => source.dates(db, calendarId)))).flat()
}

const endsOf = (date: StoredDate) => (date.end ? [date.start, date.end] : [date.start])

/** Cuántas fechas usan el calendario (o alguno de esos meses suyos), entre todas las fuentes */
export async function datesInUse(db: Database, calendarId: string, monthIds?: readonly string[]): Promise<number> {
  if (monthIds?.length === 0) return 0
  const dates = await allDates(db, calendarId)
  if (!monthIds) return dates.length
  return dates.filter((date) => endsOf(date).some((end) => end.month !== undefined && monthIds.includes(end.month)))
    .length
}

/** Cuántas fechas tienen un día que no cabe en su mes con la definición nueva (se leerán en su último día) */
export async function datesClipped(db: Database, calendarId: string, next: CalendarDefinition): Promise<number> {
  const months = new Set(next.months.map((m) => m.id))
  const dates = await allDates(db, calendarId)
  return dates.filter((date) =>
    endsOf(date).some((end) => end.month !== undefined && months.has(end.month) && !isValidDate(next, end))
  ).length
}
