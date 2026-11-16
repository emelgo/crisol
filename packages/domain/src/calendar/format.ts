/**
 * Las fechas en texto (docs/specs/calendarios.md § Fechas y su texto): en español para leerlas («Flora, 18 de Siega de
 * 1250 RC»), la forma de la IA (`1250-Siega-18`, `1250-03-18`, `1250-03`, `1250`, `-980-01-01`) y la distancia entre
 * dos («3 años después»).
 *
 * Origen: `packages/core/src/calendar/{format,events}.ts` del Crisol antiguo (código de Enrique, `~/CrisolVTT/crisol`,
 * commit 3f68f11), con los meses por id, las eras que cuentan desde su inicio y el sufijo de antes del 0
 */
import { CalendarDateError, clampDate, dayNumber, daysInMonth, eraOf, monthIndexOf, weekdayName } from './dates.ts'
import type { CalendarDefinition, CalendarMonth, WorldDate } from './definition.ts'

/** Sin tildes, en minúsculas y con los separadores juntos: para comparar nombres («Semana-del-yunque» = «semana del Yunque») */
export const calendarKey = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .trim()

/** Las que piden «de la» en vez de «del» */
const FEMININE =
  /^(semana|fiesta|festividad|noche|luna|era|celebraci[oó]n|vigilia|feria|jornada|quincena|estaci[oó]n)\b/i

/** «de Siega», «del Carnaval», «de la Semana del Yunque»: las festividades llevan artículo */
export function monthWithPreposition(month: CalendarMonth): string {
  if (FEMININE.test(month.name)) return `de la ${month.name}`
  return month.festival ? `del ${month.name}` : `de ${month.name}`
}

/** El número de un mes sin contar las festividades (null: es una festividad) */
export function monthNumber(def: CalendarDefinition, monthId: string): number | null {
  let n = 0
  for (const month of def.months) {
    if (month.festival) {
      if (month.id === monthId) return null
      continue
    }
    n++
    if (month.id === monthId) return n
  }
  return null
}

/** El año con su sufijo, o en la era que cuenta desde su inicio en la que cae (`at`, la fecha) */
export function formatYear(def: CalendarDefinition, year: number, at?: WorldDate): string {
  const era = at ? safeEra(def, at) : null
  if (era?.countsFromStart && era.abbreviation) return `${year - era.start.year + 1} ${era.abbreviation}`
  if (year < 0 && def.beforeZeroSuffix) return `${-year} ${def.beforeZeroSuffix}`
  return def.yearSuffix ? `${year} ${def.yearSuffix}` : String(year)
}

function safeEra(def: CalendarDefinition, date: WorldDate) {
  try {
    return eraOf(def, date)
  } catch (error) {
    if (error instanceof CalendarDateError) return null
    throw error
  }
}

const monthOf = (def: CalendarDefinition, id: string) => def.months[monthIndexOf(def, id)]

export interface FormatOptions {
  /** Delante, el día de la semana: «Flora, 18 de Siega…» */
  weekday?: boolean
  /** Sin el año */
  noYear?: boolean
}

/** «1250 RC», «Siega de 1250 RC», «18 de Siega de 1250 RC» (con el día recortado si su mes se acortó) */
export function formatDate(def: CalendarDefinition, date: WorldDate, options: FormatOptions = {}): string {
  const shown = clampDate(def, date)
  const year = formatYear(def, shown.year, shown)
  if (shown.month === undefined) return year
  const month = monthOf(def, shown.month)
  if (!month) return year
  const withYear = (text: string) => (options.noYear ? text : `${text} de ${year}`)
  if (shown.day === undefined) return withYear(month.name)
  let text = withYear(`${shown.day} ${monthWithPreposition(month)}`)
  if (options.weekday) {
    const name = weekdayName(def, { year: shown.year, month: shown.month, day: shown.day })
    if (name) text = `${name}, ${text}`
  }
  return text
}

/**
 * Un periodo sin repetir lo que comparten sus extremos: «12–18 de Siega de 1250 RC», «12 de Siega – 3 de Trilla de
 * 1250 RC», «1250 RC – 1262 RC»
 */
export function formatRange(def: CalendarDefinition, start: WorldDate, end: WorldDate | null | undefined): string {
  const from = formatDate(def, start)
  if (!end) return from
  const to = formatDate(def, end)
  if (to === from) return from
  const a = clampDate(def, start)
  const b = clampDate(def, end)
  const days = a.day !== undefined && b.day !== undefined
  const sameEraYear = formatYear(def, a.year, a) === formatYear(def, b.year, b)
  if (days && sameEraYear && a.year === b.year) {
    const month = b.month ? monthOf(def, b.month) : undefined
    if (a.month === b.month && month)
      return `${a.day}–${b.day} ${monthWithPreposition(month)} de ${formatYear(def, b.year, b)}`
    return `${formatDate(def, a, { noYear: true })} – ${to}`
  }
  return `${from} – ${to}`
}

/** La forma de la IA, con el nombre del mes (la que no cambia al reordenar): `1250-Siega-18`, `-980-Siega`, `1250` */
export function dateForm(def: CalendarDefinition, date: WorldDate): string {
  const year = String(date.year)
  if (date.month === undefined) return year
  const month = monthOf(def, date.month)
  if (!month) return year
  return date.day === undefined ? `${year}-${month.name}` : `${year}-${month.name}-${clampDate(def, date).day}`
}

export type ParsedDate =
  | { ok: true; date: WorldDate }
  | { ok: false; reason: 'FORMAT' | 'MONTH' | 'DAY'; message: string }

/** El mes de un trozo de texto: su número (sin contar festividades), su nombre (sin tildes ni mayúsculas) o su id */
function monthFrom(def: CalendarDefinition, token: string): string | null {
  const text = token.trim()
  if (/^\d+$/.test(text)) {
    const n = Number(text)
    return def.months.filter((m) => !m.festival)[n - 1]?.id ?? null
  }
  const key = calendarKey(text)
  return def.months.find((m) => calendarKey(m.name) === key || m.id === text)?.id ?? null
}

const failure = (reason: 'FORMAT' | 'MONTH' | 'DAY', message: string): ParsedDate => ({ ok: false, reason, message })

/**
 * Lee una fecha escrita para la IA contra el calendario: `"1250-Siega-18"`, `"1250-03-18"` (el mes por su número, sin
 * contar las festividades, que van por su nombre), `"1250-03"`, `"1250"`, `"-980-01-01"`; o `{ year, month?, day? }`
 * con el mes por su id, su nombre o su número
 */
export function parseDate(
  def: CalendarDefinition,
  value: string | WorldDate | { year: number; month?: string | number; day?: number }
): ParsedDate {
  if (typeof value !== 'string') {
    if (!Number.isInteger(value.year)) return failure('FORMAT', 'el año tiene que ser un número entero')
    if (value.month === undefined) {
      if (value.day !== undefined) return failure('FORMAT', 'un día sin mes')
      return { ok: true, date: { year: value.year } }
    }
    return withMonth(def, value.year, String(value.month), value.day)
  }
  const match = /^\s*(-?\d+)(?:-(.+))?\s*$/.exec(value)
  if (!match) return failure('FORMAT', `«${value}» no es una fecha: escríbela como 1250-Siega-18`)
  const year = Number(match[1])
  const rest = match[2]
  if (rest === undefined) return { ok: true, date: { year } }
  // Con día al final (y el resto, el mes); si ese mes no existe, todo es el mes («Mes-3» de uno en blanco)
  const dayed = /^(.+)-(\d+)$/.exec(rest)
  if (dayed?.[1] && monthFrom(def, dayed[1])) return withMonth(def, year, dayed[1], Number(dayed[2]))
  return withMonth(def, year, rest, undefined)
}

function withMonth(def: CalendarDefinition, year: number, token: string, day: number | undefined): ParsedDate {
  const month = monthFrom(def, token)
  if (!month) {
    const names = def.months.map((m) => m.name).join(', ')
    return failure('MONTH', `el mes «${token}» no existe en el calendario (sus meses: ${names})`)
  }
  if (day === undefined) return { ok: true, date: { year, month } }
  const days = daysInMonth(def, year, month)
  if (!Number.isInteger(day) || day < 1 || day > days)
    return failure('DAY', `${monthOf(def, month)?.name} de ${year} tiene ${days} días`)
  return { ok: true, date: { year, month, day } }
}

export interface DateDistance {
  unit: 'millennia' | 'centuries' | 'years' | 'months' | 'days'
  /** Siempre positivo; `after` dice el sentido */
  count: number
  after: boolean
}

/**
 * La distancia de `a` a `b` en la unidad natural más grande: años (en siglos o milenios si dividen exacto) si
 * coinciden mes y día, meses si coincide el día (los dos meses normales), y si no, días
 */
export function dateDistance(def: CalendarDefinition, a: WorldDate, b: WorldDate): DateDistance {
  const sameMonthDay = a.month === b.month && a.day === b.day
  if (sameMonthDay && a.year !== b.year) {
    const years = b.year - a.year
    const count = Math.abs(years)
    const unit = count % 1000 === 0 ? 'millennia' : count % 100 === 0 ? 'centuries' : 'years'
    const divisor = unit === 'millennia' ? 1000 : unit === 'centuries' ? 100 : 1
    return { unit, count: count / divisor, after: years > 0 }
  }
  if (a.month !== undefined && b.month !== undefined && a.day === b.day && a.month !== b.month) {
    const regular = def.months.filter((m) => !m.festival).map((m) => m.id)
    const ia = regular.indexOf(a.month)
    const ib = regular.indexOf(b.month)
    if (ia >= 0 && ib >= 0) {
      const months = b.year * regular.length + ib - (a.year * regular.length + ia)
      return { unit: 'months', count: Math.abs(months), after: months > 0 }
    }
  }
  const days = dayNumber(def, b) - dayNumber(def, a)
  return { unit: 'days', count: Math.abs(days), after: days > 0 }
}

const UNITS: Record<DateDistance['unit'], [string, string]> = {
  millennia: ['milenio', 'milenios'],
  centuries: ['siglo', 'siglos'],
  years: ['año', 'años'],
  months: ['mes', 'meses'],
  days: ['día', 'días']
}

/** «3 años después», «1 día antes», «El mismo día» */
export function formatDistance(d: DateDistance): string {
  if (d.count === 0) return 'El mismo día'
  const [one, many] = UNITS[d.unit]
  return `${d.count} ${d.count === 1 ? one : many} ${d.after ? 'después' : 'antes'}`
}
