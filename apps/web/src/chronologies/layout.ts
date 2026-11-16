/**
 * Cómo se colocan las entradas de una cronología en sus vistas (módulo 8): las columnas de la vista de meses con su
 * ancho y su sitio, dónde cae un día, los tramos de un evento de varios días en cada semana de la vista de calendario y
 * la distancia al anterior en la lista. Sin React: se prueba aparte
 */
import type { ChronologyEntryView } from '@crisol/contracts'
import {
  type CalendarDefinition,
  type DateDistance,
  dateDistance,
  formatDistance,
  formatYear,
  type GridDay,
  meanYearLength,
  packRows,
  type TimeColumn,
  type TimeZoom
} from '@crisol/domain'

/** El ancho de una columna en cada zoom (las festividades, más estrechas) */
export function columnWidth(zoom: TimeZoom, column: Pick<TimeColumn, 'festival'>): number {
  if (zoom === 'years') return 72
  if (zoom === 'days') return 36
  return column.festival ? 40 : 88
}

/** Dónde empieza cada columna (en px) y lo que ocupan todas */
export function columnOffsets(zoom: TimeZoom, columns: readonly TimeColumn[]) {
  const offsets: number[] = []
  let at = 0
  for (const column of columns) {
    offsets.push(at)
    at += columnWidth(zoom, column)
  }
  return { offsets, total: at }
}

/** La columna que contiene ese día (o la más cercana por su lado), por búsqueda binaria */
export function columnAt(columns: readonly TimeColumn[], day: number): number {
  let low = 0
  let high = columns.length - 1
  if (high < 0) return -1
  if (day <= (columns[0]?.start ?? 0)) return 0
  if (day >= (columns[high]?.start ?? 0)) return high
  while (low < high) {
    const mid = (low + high + 1) >> 1
    if ((columns[mid]?.start ?? 0) <= day) low = mid
    else high = mid - 1
  }
  return low
}

/** Un tramo de un evento en una semana de la rejilla: de qué columna a cuál, en qué fila y si sigue a los lados */
export interface WeekSegment<T> {
  item: T
  from: number
  to: number
  row: number
  before: boolean
  after: boolean
}

/** Los tramos de lo que toca una semana (los días, con su día absoluto; null, huecos), sin que se monten */
export function weekSegments<T extends { startDay: number; endDay: number }>(
  week: ReadonlyArray<GridDay | null>,
  items: readonly T[]
): WeekSegment<T>[] {
  const days = week.flatMap((day, column) => (day ? [{ day: day.dayNumber, column }] : []))
  const first = days[0]
  const last = days.at(-1)
  if (!first || !last) return []
  const touching = items
    .filter((item) => item.startDay <= last.day && item.endDay >= first.day)
    .map((item) => {
      const from = days.find((d) => d.day >= item.startDay)?.column ?? first.column
      const to = [...days].reverse().find((d) => d.day <= item.endDay)?.column ?? last.column
      return { item, from, to, before: item.startDay < first.day, after: item.endDay > last.day }
    })
    // Lo largo primero, para que vaya arriba y lo corto se acomode debajo
    .sort((a, b) => a.from - b.from || b.to - b.from - (a.to - a.from))
  const rows = packRows(touching.map((t) => ({ start: t.from, end: t.to })))
  return touching.map((t, index) => ({ ...t, row: rows[index] ?? 0 }))
}

/** «3 años después» respecto a la anterior (null en la primera), en la unidad natural, con los días del calendario */
export function distanceText(
  definition: CalendarDefinition,
  previous: Pick<ChronologyEntryView, 'start'> | undefined,
  entry: Pick<ChronologyEntryView, 'start'>
): string | null {
  if (!previous) return null
  try {
    return formatDistance(natural(definition, dateDistance(definition, previous.start, entry.start)))
  } catch {
    // Un mes que ya no está en el calendario: sin distancia
    return null
  }
}

/** En la unidad más grande que tenga sentido: «113.603 días» son «312 años»; «4.562 meses», «380 años» */
function natural(definition: CalendarDefinition, distance: DateDistance): DateDistance {
  const regular = definition.months.filter((m) => !m.festival).length || 1
  const year = meanYearLength(definition)
  const inYears = (years: number): DateDistance => {
    const unit = years % 1000 === 0 ? 'millennia' : years % 100 === 0 ? 'centuries' : 'years'
    return {
      unit,
      count: years / (unit === 'millennia' ? 1000 : unit === 'centuries' ? 100 : 1),
      after: distance.after
    }
  }
  if (distance.unit === 'months' && distance.count >= regular) return inYears(Math.round(distance.count / regular))
  if (distance.unit === 'days' && distance.count >= year) return inYears(Math.round(distance.count / year))
  if (distance.unit === 'days' && distance.count >= (year / regular) * 2)
    return { unit: 'months', count: Math.round(distance.count / (year / regular)), after: distance.after }
  return distance
}

/** La fecha corta de la lista: «18 Sie 1250», con rango «12 Sie – 3 Tri 1250»; sin día o sin mes, menos */
export function shortDate(definition: CalendarDefinition, entry: Pick<ChronologyEntryView, 'start' | 'end'>): string {
  const one = (date: ChronologyEntryView['start'], withYear: boolean) => {
    const month = date.month ? definition.months.find((m) => m.id === date.month) : undefined
    const parts = [
      ...(date.day !== undefined ? [String(date.day)] : []),
      ...(month ? [month.name.slice(0, 3)] : []),
      ...(withYear ? [safeYear(definition, date)] : [])
    ]
    return parts.join(' ')
  }
  if (!entry.end) return one(entry.start, true)
  const { start, end } = entry
  // El mismo mes: «9–11 Sie 1247 RC»; el mismo año: «20 Sie – 3 Tri 1247 RC»
  if (start.day !== undefined && end.day !== undefined && start.month === end.month && start.year === end.year)
    return `${start.day}–${one(end, true)}`
  return `${one(start, end.year !== start.year)} – ${one(end, true)}`
}

/** El año con su sufijo o en la era que cuenta desde su inicio («32 IN»), como en el resto de las fechas */
function safeYear(definition: CalendarDefinition, date: ChronologyEntryView['start']): string {
  try {
    return formatYear(definition, date.year, date)
  } catch {
    return String(date.year)
  }
}
