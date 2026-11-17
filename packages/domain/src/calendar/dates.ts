/**
 * La aritmética de las fechas (ADR-0029): el día absoluto (días desde el primero del año 0, negativo antes), el día de
 * la semana, la estación, la era, las lunas, la rejilla de un mes y las repeticiones anuales. El día absoluto se calcula
 * al leer, nunca se guarda.
 *
 * Origen: `packages/core/src/calendar/{dates,events}.ts` del Crisol antiguo (código de Enrique, `~/CrisolVTT/crisol`,
 * commit 3f68f11), con los meses por id, los días fuera de la semana y la media de los bisiestos corregida
 */
import type {
  CalendarDefinition,
  CalendarEra,
  CalendarMoon,
  CalendarSeason,
  DatePrecision,
  FullDate,
  LeapRule,
  WorldDate
} from './definition.ts'

/** Una fecha que no cabe en el calendario (un mes que no existe) */
export class CalendarDateError extends Error {
  readonly reason: 'MONTH' | 'DAY' | 'FORMAT'
  constructor(reason: 'MONTH' | 'DAY' | 'FORMAT', message: string) {
    super(message)
    this.reason = reason
    this.name = 'CalendarDateError'
  }
}

const mod = (n: number, m: number) => ((n % m) + m) % m

/** Lo que se calcula una vez por definición: el índice de cada mes, la longitud del año normal, lo que va fuera de la semana */
interface Shape {
  index: Map<string, number>
  outsideIds: Set<string>
  base: number
  outsideBase: number
  mean: number
}
const shapes = new WeakMap<CalendarDefinition, Shape>()

function shapeOf(def: CalendarDefinition): Shape {
  let shape = shapes.get(def)
  if (!shape) {
    const index = new Map(def.months.map((m, i) => [m.id, i]))
    const base = def.months.reduce((sum, m) => sum + m.days, 0)
    const outsideBase = def.months.reduce((sum, m) => sum + (m.outsideWeek ? m.days : 0), 0)
    // Lo que añade cada regla de media por año: cada `every`, menos cada `unless`, más cada `but`
    const mean =
      base +
      def.leapRules.reduce(
        (sum, r) => sum + r.days * (1 / r.every - (r.unless ? 1 / r.unless : 0) + (r.unless && r.but ? 1 / r.but : 0)),
        0
      )
    const outsideIds = new Set(def.months.filter((m) => m.outsideWeek).map((m) => m.id))
    shape = { index, outsideIds, base, outsideBase, mean }
    shapes.set(def, shape)
  }
  return shape
}

/** La posición de un mes por su id (o -1) */
export const monthIndexOf = (def: CalendarDefinition, monthId: string) => shapeOf(def).index.get(monthId) ?? -1

function indexOrThrow(def: CalendarDefinition, monthId: string): number {
  const index = monthIndexOf(def, monthId)
  if (index < 0) throw new CalendarDateError('MONTH', `el mes «${monthId}» no existe en el calendario`)
  return index
}

export const precisionOf = (date: WorldDate): DatePrecision =>
  date.month === undefined ? 'year' : date.day === undefined ? 'month' : 'day'

/** Si en ese año la regla añade sus días */
export function leapApplies(rule: LeapRule, year: number): boolean {
  if (mod(year, rule.every) !== 0) return false
  if (rule.unless && mod(year, rule.unless) === 0) return !!rule.but && mod(year, rule.but) === 0
  return true
}

/** Días de un mes (por su posición) en un año, con sus bisiestos */
export function monthLength(def: CalendarDefinition, year: number, index: number): number {
  const month = def.months[index]
  if (!month) return 0
  let days = month.days
  for (const rule of def.leapRules) if (rule.monthId === month.id && leapApplies(rule, year)) days += rule.days
  return days
}

/** Días de un mes (por su id) en un año */
export const daysInMonth = (def: CalendarDefinition, year: number, monthId: string) =>
  monthLength(def, year, indexOrThrow(def, monthId))

/** Días de un año normal o, con `year`, de ese año */
export function yearLength(def: CalendarDefinition, year?: number): number {
  const { base } = shapeOf(def)
  if (year === undefined) return base
  return base + def.leapRules.reduce((sum, r) => sum + (leapApplies(r, year) ? r.days : 0), 0)
}

/** El año medio, con los bisiestos: para medir distancias y para buscar un año */
export const meanYearLength = (def: CalendarDefinition) => shapeOf(def).mean

export const isLeapYear = (def: CalendarDefinition, year: number) => def.leapRules.some((r) => leapApplies(r, year))

/** Múltiplos de k en [0, y); antes del 0, los de [y, 0) en negativo */
const multiples = (y: number, k: number) => Math.ceil(y / k)

/** Los días de más de los años anteriores a `year` desde el año 0 (en negativo antes); `only`, solo de esas reglas */
function leapDaysBefore(def: CalendarDefinition, year: number, only?: (rule: LeapRule) => boolean): number {
  let total = 0
  for (const rule of def.leapRules) {
    if (only && !only(rule)) continue
    let n = multiples(year, rule.every)
    if (rule.unless) n -= multiples(year, rule.unless)
    if (rule.unless && rule.but) n += multiples(year, rule.but)
    total += n * rule.days
  }
  return total
}

/** El día absoluto del primer día de un año */
export const yearStart = (def: CalendarDefinition, year: number) => year * shapeOf(def).base + leapDaysBefore(def, year)

/** El día del año (desde 1) de una fecha; sin día, el primero de su mes (o del año) */
export function dayOfYear(def: CalendarDefinition, date: WorldDate): number {
  if (date.month === undefined) return 1
  const index = indexOrThrow(def, date.month)
  let days = 0
  for (let i = 0; i < index; i++) days += monthLength(def, date.year, i)
  return days + clampDay(def, date.year, index, date.day ?? 1)
}

/** El día recortado al mes: uno que ya no cabe (el mes se acortó) se lee como el último */
const clampDay = (def: CalendarDefinition, year: number, index: number, day: number) =>
  Math.min(Math.max(1, Math.trunc(day)), monthLength(def, year, index))

/** La fecha con el día recortado a su mes */
export function clampDate(def: CalendarDefinition, date: WorldDate): WorldDate {
  if (date.month === undefined || date.day === undefined) return date
  return { ...date, day: clampDay(def, date.year, indexOrThrow(def, date.month), date.day) }
}

/** Si la fecha cabe tal cual (su mes existe y su día, en él ese año) */
export function isValidDate(def: CalendarDefinition, date: WorldDate): boolean {
  if (!Number.isInteger(date.year)) return false
  if (date.month === undefined) return date.day === undefined
  const index = monthIndexOf(def, date.month)
  if (index < 0) return false
  if (date.day === undefined) return true
  return Number.isInteger(date.day) && date.day >= 1 && date.day <= monthLength(def, date.year, index)
}

/** El día absoluto de una fecha (sin día o sin mes, el primero que abarca) */
export const dayNumber = (def: CalendarDefinition, date: WorldDate) =>
  yearStart(def, date.year) + dayOfYear(def, date) - 1

/** La fecha de un día absoluto */
export function dateFromDay(def: CalendarDefinition, day: number): FullDate {
  const n = Math.floor(day)
  // Un año aproximado, que se corrige (los bisiestos solo lo desplazan un poco)
  let year = Math.floor(n / meanYearLength(def))
  let start = yearStart(def, year)
  while (start > n) start = yearStart(def, --year)
  for (let next = yearStart(def, year + 1); next <= n; next = yearStart(def, year + 1)) {
    year++
    start = next
  }
  let rest = n - start
  let index = 0
  while (index < def.months.length - 1 && rest >= monthLength(def, year, index)) {
    rest -= monthLength(def, year, index)
    index++
  }
  return { year, month: def.months[index]?.id ?? '', day: rest + 1 }
}

/** El primer y el último día que abarca una fecha según su precisión */
export function dateSpan(def: CalendarDefinition, date: WorldDate): [number, number] {
  const first = dayNumber(def, date)
  if (date.month === undefined) return [first, first + yearLength(def, date.year) - 1]
  if (date.day === undefined) return [first, first + daysInMonth(def, date.year, date.month) - 1]
  return [first, first]
}

/** Orden de dos fechas: por el día en que empiezan y, si coinciden, la menos precisa antes */
export function compareDates(def: CalendarDefinition, a: WorldDate, b: WorldDate): number {
  const RANK = { year: 0, month: 1, day: 2 }
  return dayNumber(def, a) - dayNumber(def, b) || RANK[precisionOf(a)] - RANK[precisionOf(b)]
}

export const addDays = (def: CalendarDefinition, date: WorldDate, days: number): FullDate =>
  dateFromDay(def, dayNumber(def, date) + days)

/** El mismo día de otro mes (contando todas las posiciones del año), recortado si es más corto */
export function addMonths(def: CalendarDefinition, date: FullDate, months: number): FullDate {
  const count = def.months.length
  const at = date.year * count + indexOrThrow(def, date.month) + months
  const year = Math.floor(at / count)
  const index = at - year * count
  return { year, month: def.months[index]?.id ?? date.month, day: clampDay(def, year, index, date.day) }
}

/** Los días fuera de la semana antes de una fecha, desde el año 0 (en negativo antes) */
function outsideBefore(def: CalendarDefinition, year: number, index: number): number {
  const { outsideBase, outsideIds } = shapeOf(def)
  if (outsideIds.size === 0) return 0
  let total = year * outsideBase + leapDaysBefore(def, year, (rule) => outsideIds.has(rule.monthId))
  for (let i = 0; i < index; i++) if (def.months[i]?.outsideWeek) total += monthLength(def, year, i)
  return total
}

/** El día de la semana (su índice) de una fecha con día; null si va fuera de la semana o no hay semana */
export function weekdayOf(def: CalendarDefinition, date: FullDate): number | null {
  const count = def.weekdays.length
  if (count === 0) return null
  const index = indexOrThrow(def, date.month)
  if (def.months[index]?.outsideWeek) return null
  const day = clampDay(def, date.year, index, date.day)
  if (def.weekMode === 'reset') return mod(def.firstWeekday + day - 1, count)
  const absolute = dayNumber(def, { ...date, day })
  return mod(def.firstWeekday + absolute - outsideBefore(def, date.year, index), count)
}

export function weekdayName(def: CalendarDefinition, date: FullDate): string | null {
  const index = weekdayOf(def, date)
  return index === null ? null : (def.weekdays[index] ?? null)
}

/** La estación de un día del año (de un año normal; en uno bisiesto, los días de más alargan la que toque) */
export function seasonOfDay(def: CalendarDefinition, day: number): CalendarSeason | null {
  return (
    def.seasons.find((s) =>
      s.startDay <= s.endDay ? day >= s.startDay && day <= s.endDay : day >= s.startDay || day <= s.endDay
    ) ?? null
  )
}

export const seasonOf = (def: CalendarDefinition, date: WorldDate) => seasonOfDay(def, dayOfYear(def, date))

/** La era de un día: la última que empieza antes y no ha terminado */
export function eraOfDay(def: CalendarDefinition, day: number): CalendarEra | null {
  let found: { era: CalendarEra; start: number } | null = null
  for (const era of def.eras) {
    let start: number
    let end: number
    try {
      start = dateSpan(def, era.start)[0]
      end = era.end ? dateSpan(def, era.end)[1] : Number.POSITIVE_INFINITY
    } catch {
      // Una era con una fecha que ya no cabe (un mes quitado) no cuenta hasta que se arregle
      continue
    }
    if (start > day || end < day) continue
    if (!found || start > found.start) found = { era, start }
  }
  return found?.era ?? null
}

export const eraOf = (def: CalendarDefinition, date: WorldDate) => eraOfDay(def, dayNumber(def, date))

export interface MoonPhase {
  moon: CalendarMoon
  /** Índice de la fase (0, nueva; la mitad, llena) */
  phase: number
  name: string
  /** Parte del ciclo, de 0 a 1 */
  cycle: number
  /** Parte iluminada, de 0 (nueva) a 1 (llena) */
  illumination: number
}

const phaseAt = (moon: CalendarMoon, day: number) => {
  const cycle = mod(day + moon.offsetDays, moon.cycleDays) / moon.cycleDays
  const phase = Math.min(moon.phases.length - 1, Math.floor(cycle * moon.phases.length))
  return { cycle, phase }
}

export function moonPhasesOfDay(def: CalendarDefinition, day: number): MoonPhase[] {
  return def.moons.map((moon) => {
    const { cycle, phase } = phaseAt(moon, day)
    return {
      moon,
      phase,
      name: moon.phases[phase] ?? '',
      cycle,
      illumination: (1 - Math.cos(2 * Math.PI * cycle)) / 2
    }
  })
}

export const moonPhases = (def: CalendarDefinition, date: WorldDate) => moonPhasesOfDay(def, dayNumber(def, date))

/**
 * Si ese día la luna está nueva o llena: el día que contiene el centro de su fase «Nueva» o de la de la mitad (cada fase
 * ocupa una parte igual del ciclo). Origen: `momentosLunares` del Crisol antiguo (`calendario/vista.ts`), con el día
 * entero (de su principio a su final) en vez de medio día a cada lado de su principio
 */
export function moonEvent(moon: CalendarMoon, day: number): 'new' | 'full' | null {
  const phases = Math.max(1, moon.phases.length)
  const { cycle } = phaseAt(moon, day)
  const oneDay = 1 / moon.cycleDays
  // El centro cae entre el principio de este día y el del siguiente
  const at = (center: number) => {
    const difference = ((((cycle - center) % 1) + 1.5) % 1) - 0.5
    return difference > -oneDay && difference <= 0
  }
  if (at(0.5 / phases)) return 'new'
  if (phases > 1 && at((Math.floor(phases / 2) + 0.5) / phases)) return 'full'
  return null
}

export interface GridDay {
  day: number
  dayOfYear: number
  dayNumber: number
  /** null: fuera de la semana */
  weekday: number | null
}

export interface MonthGrid {
  /** Las semanas del mes, con huecos (null) antes del primero y después del último */
  weeks: Array<Array<GridDay | null>>
  /** Los días fuera de la semana (todos, si el mes va fuera de ella) */
  outside: GridDay[]
}

/** La rejilla de un mes para la vista de calendario: tantas columnas como días tenga la semana */
export function monthGrid(def: CalendarDefinition, year: number, monthId: string): MonthGrid {
  const index = indexOrThrow(def, monthId)
  const length = monthLength(def, year, index)
  const first = dayNumber(def, { year, month: monthId, day: 1 })
  const firstOfYear = dayOfYear(def, { year, month: monthId, day: 1 })
  const days: GridDay[] = Array.from({ length }, (_, i) => {
    const date = { year, month: monthId, day: i + 1 }
    return { day: i + 1, dayOfYear: firstOfYear + i, dayNumber: first + i, weekday: weekdayOf(def, date) }
  })
  const columns = def.weekdays.length
  if (def.months[index]?.outsideWeek || columns === 0) return { weeks: [], outside: days }
  const weeks: Array<Array<GridDay | null>> = []
  let row: Array<GridDay | null> = Array.from({ length: days[0]?.weekday ?? 0 }, () => null)
  for (const day of days) {
    row.push(day)
    if (row.length === columns) {
      weeks.push(row)
      row = []
    }
  }
  if (row.length > 0) weeks.push([...row, ...Array.from({ length: columns - row.length }, () => null)])
  return { weeks, outside: [] }
}

/** Una fecha llevada a otro año: el día, recortado si ese mes es más corto ese año */
function inYear(def: CalendarDefinition, date: WorldDate, year: number): WorldDate {
  if (date.month === undefined || date.day === undefined) return { ...date, year }
  return { ...date, year, day: clampDay(def, year, indexOrThrow(def, date.month), date.day) }
}

/**
 * Las veces que cae una fecha (o un periodo) que se repite cada año dentro de los días [from, to]: una por año, desde
 * el de su fecha, con sus fechas de ese año. Sin repetir (o sin mes), la propia si toca el intervalo
 */
export function occurrences(
  def: CalendarDefinition,
  event: { start: WorldDate; end?: WorldDate | null | undefined; yearly?: boolean | undefined },
  from: number,
  to: number
): Array<{ start: WorldDate; end: WorldDate | null }> {
  const touches = (start: WorldDate, end: WorldDate | null) =>
    dateSpan(def, start)[0] <= to && dateSpan(def, end ?? start)[1] >= from
  const end = event.end ?? null
  if (!event.yearly || event.start.month === undefined)
    return touches(event.start, end) ? [{ start: event.start, end }] : []
  const offset = end ? end.year - event.start.year : 0
  const out: Array<{ start: WorldDate; end: WorldDate | null }> = []
  const firstYear = Math.max(event.start.year, dateFromDay(def, from).year - 1 - offset)
  const lastYear = dateFromDay(def, to).year
  for (let year = firstYear; year <= lastYear; year++) {
    const start = inYear(def, event.start, year)
    const until = end ? inYear(def, end, year + offset) : null
    if (touches(start, until)) out.push({ start, end: until })
  }
  return out
}
