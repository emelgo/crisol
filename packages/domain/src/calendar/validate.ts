/**
 * Lo que impide guardar un calendario, por secciones del editor y con el índice de lo que falla (docs/specs/
 * calendarios.md § Datos). El servidor no guarda una definición con problemas (BAD_CALENDAR, con la lista).
 *
 * Origen: `validateCalendarDefinition` de `packages/core/src/calendar/edit.ts` del Crisol antiguo (código de Enrique,
 * `~/CrisolVTT/crisol`, commit 3f68f11), con los meses por id, los solapes de estaciones y la correspondencia
 */
import { compareDates, isValidDate, monthIndexOf, yearLength } from './dates.ts'
import { CALENDAR_LIMITS, type CalendarDefinition, type WorldDate } from './definition.ts'

export type CalendarSection = 'general' | 'week' | 'months' | 'leap' | 'seasons' | 'moons' | 'eras' | 'correspondence'

export type CalendarProblemCode =
  | 'weekdaysEmpty'
  | 'weekdayUnnamed'
  | 'firstWeekday'
  | 'monthsEmpty'
  | 'monthUnnamed'
  | 'monthDays'
  | 'duplicateId'
  | 'leapMonth'
  | 'leapEvery'
  | 'leapDays'
  | 'leapUnless'
  | 'leapBut'
  | 'seasonUnnamed'
  | 'seasonRange'
  | 'seasonOverlap'
  | 'moonUnnamed'
  | 'moonCycle'
  | 'moonOffset'
  | 'moonPhases'
  | 'eraUnnamed'
  | 'eraStart'
  | 'eraEnd'
  | 'eraOrder'
  | 'eraAbbreviation'
  | 'correspondenceCalendar'
  | 'correspondenceDate'

export interface CalendarProblem {
  section: CalendarSection
  /** Su posición en su lista (meses, lunas, eras…) */
  index?: number
  code: CalendarProblemCode
  /** Lo que nombra el texto (el nombre, el otro, los días…) */
  params: Record<string, string | number>
  /** En español, para la IA y el historial */
  message: string
}

/** Lo que hace falta de fuera para comprobar la correspondencia: el calendario al que apunta, si es del mundo */
export interface ValidateOptions {
  anchor?: CalendarDefinition | null
}

export function validateCalendar(def: CalendarDefinition, options: ValidateOptions = {}): CalendarProblem[] {
  const problems: CalendarProblem[] = []
  const add = (
    section: CalendarSection,
    code: CalendarProblemCode,
    message: string,
    params: Record<string, string | number> = {},
    index?: number
  ) => problems.push({ section, code, message, params, ...(index === undefined ? {} : { index }) })

  if (def.weekdays.length === 0) add('week', 'weekdaysEmpty', 'La semana necesita al menos un día.')
  def.weekdays.forEach((name, i) => {
    if (!name.trim()) add('week', 'weekdayUnnamed', `El día ${i + 1} de la semana no tiene nombre.`, { n: i + 1 }, i)
  })
  if (def.weekdays.length > 0 && !(def.firstWeekday >= 0 && def.firstWeekday < def.weekdays.length))
    add('week', 'firstWeekday', 'El día con el que empieza el año 0 no está en la semana.')

  if (def.months.length === 0) add('months', 'monthsEmpty', 'El calendario necesita al menos un mes.')
  const ids = new Set<string>()
  const unique = (section: CalendarSection, id: string, index: number) => {
    if (ids.has(id)) add(section, 'duplicateId', `Hay dos elementos con el id «${id}».`, { id }, index)
    ids.add(id)
  }
  def.months.forEach((month, i) => {
    const name = month.name.trim() || `Mes ${i + 1}`
    if (!month.name.trim()) add('months', 'monthUnnamed', `El mes ${i + 1} no tiene nombre.`, { n: i + 1 }, i)
    if (!Number.isInteger(month.days) || month.days < 1 || month.days > CALENDAR_LIMITS.monthDays)
      add(
        'months',
        'monthDays',
        `«${name}» debe tener entre 1 y ${CALENDAR_LIMITS.monthDays} días.`,
        { name, max: CALENDAR_LIMITS.monthDays },
        i
      )
    unique('months', month.id, i)
  })

  def.leapRules.forEach((rule, i) => {
    const index = monthIndexOf(def, rule.monthId)
    const month = def.months[index]?.name ?? '?'
    if (index < 0) add('leap', 'leapMonth', `El bisiesto ${i + 1} va en un mes que no existe.`, { n: i + 1 }, i)
    if (!Number.isInteger(rule.every) || rule.every < 1)
      add('leap', 'leapEvery', `El bisiesto de «${month}» necesita cada cuántos años.`, { name: month }, i)
    if (!Number.isInteger(rule.days) || rule.days < 1)
      add('leap', 'leapDays', `El bisiesto de «${month}» debe añadir al menos un día.`, { name: month }, i)
    if (rule.unless && (!Number.isInteger(rule.unless) || rule.unless % rule.every !== 0))
      add(
        'leap',
        'leapUnless',
        `«Salvo cada ${rule.unless} años» debe ser múltiplo de ${rule.every}.`,
        { unless: rule.unless, every: rule.every },
        i
      )
    if (rule.unless && rule.but && (!Number.isInteger(rule.but) || rule.but % rule.unless !== 0))
      add(
        'leap',
        'leapBut',
        `«Pero sí cada ${rule.but} años» debe ser múltiplo de ${rule.unless}.`,
        { but: rule.but, unless: rule.unless },
        i
      )
  })

  // Lo que sigue necesita meses válidos para comprobar fechas y días del año
  if (problems.some((p) => p.section === 'months' || p.section === 'leap')) return problems

  const length = yearLength(def)
  const inYear = (day: number) => Number.isInteger(day) && day >= 1 && day <= length
  def.seasons.forEach((season, i) => {
    const name = season.name.trim() || `Estación ${i + 1}`
    if (!season.name.trim()) add('seasons', 'seasonUnnamed', `La estación ${i + 1} no tiene nombre.`, { n: i + 1 }, i)
    if (!inYear(season.startDay) || !inYear(season.endDay))
      add(
        'seasons',
        'seasonRange',
        `«${name}» debe empezar y acabar entre el día 1 y el ${length} del año.`,
        {
          name,
          max: length
        },
        i
      )
    unique('seasons', season.id, i)
  })
  seasonOverlaps(def, length).forEach(({ i, j, from, to }) => {
    const a = def.seasons[i]?.name || `Estación ${i + 1}`
    const b = def.seasons[j]?.name || `Estación ${j + 1}`
    add(
      'seasons',
      'seasonOverlap',
      `${a} ${and(b)} ${b} se pisan (días ${from} a ${to}).`,
      { name: a, other: b, from, to },
      j
    )
  })

  def.moons.forEach((moon, i) => {
    const name = moon.name.trim() || `Luna ${i + 1}`
    if (!moon.name.trim()) add('moons', 'moonUnnamed', `La luna ${i + 1} no tiene nombre.`, { n: i + 1 }, i)
    if (!(moon.cycleDays > 0) || !Number.isFinite(moon.cycleDays))
      add('moons', 'moonCycle', `El ciclo de «${name}» debe durar más de 0 días.`, { name }, i)
    if (!Number.isFinite(moon.offsetDays))
      add('moons', 'moonOffset', `El desfase de «${name}» no es un número.`, { name }, i)
    if (moon.phases.length < 2 || moon.phases.some((p) => !p.trim()))
      add('moons', 'moonPhases', `«${name}» necesita al menos dos fases, todas con nombre.`, { name }, i)
    unique('moons', moon.id, i)
  })

  def.eras.forEach((era, i) => {
    const name = era.name.trim() || `Era ${i + 1}`
    if (!era.name.trim()) add('eras', 'eraUnnamed', `La era ${i + 1} no tiene nombre.`, { n: i + 1 }, i)
    const startOk = isValidDate(def, era.start)
    if (!startOk) add('eras', 'eraStart', `El comienzo de «${name}» no es una fecha del calendario.`, { name }, i)
    if (era.end && !isValidDate(def, era.end))
      add('eras', 'eraEnd', `El final de «${name}» no es una fecha del calendario.`, { name }, i)
    else if (startOk && era.end && compareDates(def, era.end, era.start) < 0)
      add('eras', 'eraOrder', `«${name}» termina antes de empezar.`, { name }, i)
    if (era.countsFromStart && !era.abbreviation?.trim())
      add('eras', 'eraAbbreviation', `«${name}» cuenta los años desde su inicio: necesita su abreviatura.`, { name }, i)
    unique('eras', era.id, i)
  })

  const anchor = def.correspondence
  if (anchor) {
    if (options.anchor === null)
      add('correspondence', 'correspondenceCalendar', 'La correspondencia apunta a un calendario que no es del mundo.')
    else if (options.anchor && !fullDate(options.anchor, anchor.date))
      add('correspondence', 'correspondenceDate', 'La fecha de la correspondencia no es un día de ese calendario.')
  }
  return problems
}

/** «y», o «e» delante de i- o hi- (no hie-): «Otoño e Invierno» */
export const and = (next: string) => (/^h?[ií](?!e)/i.test(next.normalize('NFC')) ? 'e' : 'y')

const fullDate = (def: CalendarDefinition, date: WorldDate) =>
  date.month !== undefined && date.day !== undefined && isValidDate(def, date)

/** Los días del año (de un año normal) de una estación, en tramos (dos si cruza el fin de año) */
const pieces = (start: number, end: number, length: number): Array<[number, number]> =>
  start <= end
    ? [[start, end]]
    : [
        [start, length],
        [1, end]
      ]

/** Las estaciones que se pisan: cada pareja, con el primer tramo común */
function seasonOverlaps(def: CalendarDefinition, length: number) {
  const out: Array<{ i: number; j: number; from: number; to: number }> = []
  const valid = (d: number) => Number.isInteger(d) && d >= 1 && d <= length
  def.seasons.forEach((a, i) => {
    if (!valid(a.startDay) || !valid(a.endDay)) return
    def.seasons.forEach((b, j) => {
      if (j <= i || !valid(b.startDay) || !valid(b.endDay)) return
      for (const [a1, a2] of pieces(a.startDay, a.endDay, length))
        for (const [b1, b2] of pieces(b.startDay, b.endDay, length)) {
          const from = Math.max(a1, b1)
          const to = Math.min(a2, b2)
          if (from <= to && !out.some((o) => o.i === i && o.j === j)) out.push({ i, j, from, to })
        }
    })
  })
  return out
}
