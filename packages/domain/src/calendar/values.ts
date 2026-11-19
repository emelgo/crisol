/**
 * El valor «fecha» de Crisol (docs/specs/fechas.md, ADR-0029): una fecha de un calendario del mundo con su precisión
 * (año, mes o día), un fin opcional y «cada año». Lo guardan las propiedades «Fecha» de las páginas y lo guardarán los
 * eventos de las cronologías y el «hoy» de cada campaña
 */
import { offsetToPrimary, type WorldCalendar } from './convert.ts'
import { CalendarDateError, compareDates, dayNumber, isValidDate, precisionOf } from './dates.ts'
import { type CalendarDefinition, type WorldDate, yearProblem } from './definition.ts'
import { dateForm, formatRange, parseDate } from './format.ts'

export interface DateValue {
  /** Siempre explícito: al crearla, el principal */
  calendarId: string
  start: WorldDate
  /** Del mismo calendario y con la misma precisión, no antes que start */
  end?: WorldDate | undefined
  /** Se repite cada año (fiestas, aniversarios): solo si start tiene mes */
  yearly?: true | undefined
}

/** Lo que dice que se repite, al final de la forma de la IA: «1250-Siega-18 (cada año)» */
const YEARLY = /\s*\(\s*cada\s+a[nñ]o\s*\)\s*$/i

const monthName = (def: CalendarDefinition, id: string) => def.months.find((m) => m.id === id)?.name ?? id

/** Por qué una fecha no cabe en el calendario, o null */
function dateProblem(def: CalendarDefinition, date: WorldDate): string | null {
  const outside = Number.isInteger(date.year) ? yearProblem(def, date.year) : null
  if (outside) return outside
  if (date.month === undefined) return date.day === undefined ? null : 'un día sin mes'
  if (!def.months.some((m) => m.id === date.month)) return `el mes «${date.month}» no existe en el calendario`
  if (isValidDate(def, date)) return null
  const parsed = parseDate(def, { year: date.year, month: date.month, ...(date.day ? { day: date.day } : {}) })
  return parsed.ok ? `${monthName(def, date.month)} de ${date.year} no tiene ese día` : parsed.message
}

/** Por qué no vale un valor en su calendario (un mes que no existe, un día fuera, el fin antes), o null */
export function dateValueProblem(def: CalendarDefinition, value: Omit<DateValue, 'calendarId'>): string | null {
  const start = dateProblem(def, value.start)
  if (start) return start
  if (value.yearly && value.start.month === undefined) return 'cada año, solo una fecha con mes'
  if (!value.end) return null
  const end = dateProblem(def, value.end)
  if (end) return `el fin: ${end}`
  if (precisionOf(value.end) !== precisionOf(value.start)) return 'el inicio y el fin van con la misma precisión'
  if (compareDates(def, value.end, value.start) < 0) return 'el fin va antes que el inicio'
  return null
}

/** Para leerla: «18 de Siega de 1250 RC», «12 de Siega – 3 de Trilla de 1250 RC» (sin repetir lo que comparten) */
export const formatDateValue = (def: CalendarDefinition, value: Omit<DateValue, 'calendarId'>) =>
  formatRange(def, value.start, value.end)

/** La forma de la IA: `1250-Siega-18`, con el fin tras «/» y « (cada año)» al final si se repite */
export function dateValueForm(def: CalendarDefinition, value: Omit<DateValue, 'calendarId'>): string {
  const range = value.end ? `${dateForm(def, value.start)}/${dateForm(def, value.end)}` : dateForm(def, value.start)
  return value.yearly ? `${range} (cada año)` : range
}

export type ParsedDateValue =
  | { ok: true; value: Omit<DateValue, 'calendarId'> }
  | { ok: false; reason: 'FORMAT' | 'MONTH' | 'DAY' | 'YEAR' | 'RANGE'; message: string }

/**
 * Lee la forma de la IA contra el calendario: `1250-Siega-18`, `1250-Siega-12/1250-Trilla-3`, `1250-Siega (cada año)`.
 * El fin y «cada año» pueden venir también aparte (como los da la IA)
 */
export function parseDateValue(
  def: CalendarDefinition,
  text: string,
  extra: { end?: string | undefined; yearly?: boolean | undefined } = {}
): ParsedDateValue {
  const yearly = YEARLY.test(text) || extra.yearly === true
  const parts = text.replace(YEARLY, '').split('/')
  if (parts.length > 2 || (parts.length === 2 && extra.end !== undefined))
    return {
      ok: false,
      reason: 'FORMAT',
      message: `«${text}»: un inicio y, si acaso, un fin (1250-Siega-12/1250-Trilla-3)`
    }
  const start = parseDate(def, parts[0] ?? '')
  if (!start.ok) return start
  const endText = parts[1] ?? extra.end
  const end = endText === undefined ? null : parseDate(def, endText)
  if (end && !end.ok) return { ...end, message: `el fin: ${end.message}` }
  const value: Omit<DateValue, 'calendarId'> = {
    start: start.date,
    ...(end ? { end: end.date } : {}),
    ...(yearly ? { yearly: true as const } : {})
  }
  const problem = dateValueProblem(def, value)
  if (problem) return { ok: false, reason: 'RANGE', message: problem }
  return { ok: true, value }
}

/**
 * El día absoluto en que empieza, para ordenar fechas de varios calendarios: en el del principal si el suyo tiene
 * correspondencia; si no, en el suyo. null si su calendario no está o la fecha ya no cabe en él
 */
export function dateValueDay(calendars: readonly WorldCalendar[], value: DateValue): number | null {
  const calendar = calendars.find((c) => c.id === value.calendarId)
  if (!calendar) return null
  try {
    const own = dayNumber(calendar.definition, value.start)
    return own + (offsetToPrimary(calendars, calendar.id) ?? 0)
  } catch (error) {
    if (error instanceof CalendarDateError) return null
    throw error
  }
}

const sameDate = (a: WorldDate | undefined, b: WorldDate | undefined) =>
  a?.year === b?.year && a?.month === b?.month && a?.day === b?.day

/** Si dos valores dicen lo mismo (sin mirar el orden de sus claves) */
export function sameDateValue(a: DateValue | null, b: DateValue | null): boolean {
  if (!a || !b) return a === b
  return (
    a.calendarId === b.calendarId &&
    sameDate(a.start, b.start) &&
    sameDate(a.end, b.end) &&
    (a.end === undefined) === (b.end === undefined) &&
    !!a.yearly === !!b.yearly
  )
}
