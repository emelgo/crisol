/**
 * De lo que se escribe (la IA, de una vez; el editor) a la definición que se guarda: los ids que falten, los meses de
 * los bisiestos y de las fechas por su id o su nombre, las fechas también como texto (`1250-Siega-18`) y lo de por
 * defecto. Lo que no se entiende queda como problema, con su sección, igual que los de validateCalendar
 */
import {
  type CalendarDefinition,
  type CalendarEra,
  DEFAULT_PHASES,
  type FullDate,
  newCalendarId,
  type WorldDate
} from './definition.ts'
import { calendarKey, parseDate } from './format.ts'
import type { CalendarProblem } from './validate.ts'

type LooseDate = string | { year: number; month?: string | undefined; day?: number | undefined }

export interface CalendarDraft {
  yearSuffix?: string | undefined
  beforeZeroSuffix?: string | undefined
  description?: string | undefined
  weekdays: string[]
  firstWeekday?: number | undefined
  weekMode?: 'continuous' | 'reset' | undefined
  months: Array<{
    id?: string | undefined
    name: string
    days: number
    color?: string | null | undefined
    festival?: boolean | undefined
    outsideWeek?: boolean | undefined
    dayNames?: string[] | undefined
  }>
  leapRules?:
    | Array<{
        monthId: string
        days: number
        every: number
        unless?: number | null | undefined
        but?: number | null | undefined
      }>
    | undefined
  seasons?:
    | Array<{
        id?: string | undefined
        name: string
        startDay: number
        endDay: number
        color?: string | null | undefined
      }>
    | undefined
  moons?:
    | Array<{
        id?: string | undefined
        name: string
        cycleDays: number
        offsetDays?: number | undefined
        color?: string | undefined
        phases?: string[] | undefined
      }>
    | undefined
  eras?:
    | Array<{
        id?: string | undefined
        name: string
        abbreviation?: string | undefined
        description?: string | undefined
        start: LooseDate
        end?: LooseDate | null | undefined
        countsFromStart?: boolean | undefined
        hidden?: boolean | undefined
      }>
    | undefined
  correspondence?: { calendarId?: string | undefined; date: LooseDate } | null | undefined
  yearRange?: { min?: number | null | undefined; max?: number | null | undefined } | null | undefined
}

/** El calendario con el que se corresponde (sin decir otro, el principal del mundo) */
export interface CorrespondenceTarget {
  id: string
  definition: CalendarDefinition
}

export interface NormalizeOptions {
  /** Los calendarios del mundo a los que puede apuntar la correspondencia, y cuál va sin decirlo (el principal) */
  calendars?: readonly CorrespondenceTarget[]
  primaryId?: string | null
}

const DEFAULT_MOON_COLOR = '#d8dce4'

export function normalizeCalendar(
  draft: CalendarDraft,
  options: NormalizeOptions = {}
): { definition: CalendarDefinition; problems: CalendarProblem[] } {
  const problems: CalendarProblem[] = []
  const taken: string[] = []
  const idFor = (given: string | undefined) => {
    const id = given && !taken.includes(given) ? given : newCalendarId(taken)
    taken.push(id)
    return id
  }
  const months = draft.months.map((m) => ({
    id: idFor(m.id),
    name: m.name,
    days: m.days,
    ...(m.color ? { color: m.color } : {}),
    ...(m.festival ? { festival: true } : {}),
    ...(m.outsideWeek ? { outsideWeek: true } : {}),
    ...(m.dayNames?.some((name) => name.trim()) ? { dayNames: m.dayNames.map((name) => name.trim()) } : {})
  }))
  /** Un mes por su id o su nombre (sin tildes ni mayúsculas); si no está, tal cual (lo dirá validar) */
  const monthRef = (ref: string) =>
    months.find((m) => m.id === ref)?.id ?? months.find((m) => calendarKey(m.name) === calendarKey(ref))?.id ?? ref
  const base: CalendarDefinition = {
    yearSuffix: draft.yearSuffix ?? '',
    ...(draft.beforeZeroSuffix ? { beforeZeroSuffix: draft.beforeZeroSuffix } : {}),
    description: draft.description ?? '',
    weekdays: draft.weekdays,
    firstWeekday: draft.firstWeekday ?? 0,
    weekMode: draft.weekMode ?? 'continuous',
    months,
    leapRules: (draft.leapRules ?? []).map((r) => ({
      monthId: monthRef(r.monthId),
      days: r.days,
      every: r.every,
      ...(r.unless ? { unless: r.unless } : {}),
      ...(r.unless && r.but ? { but: r.but } : {})
    })),
    seasons: (draft.seasons ?? []).map((s) => ({
      id: idFor(s.id),
      name: s.name,
      startDay: s.startDay,
      endDay: s.endDay,
      ...(s.color ? { color: s.color } : {})
    })),
    moons: (draft.moons ?? []).map((moon) => ({
      id: idFor(moon.id),
      name: moon.name,
      cycleDays: moon.cycleDays,
      offsetDays: moon.offsetDays ?? 0,
      color: moon.color ?? DEFAULT_MOON_COLOR,
      phases: moon.phases ?? [...DEFAULT_PHASES]
    })),
    eras: [],
    ...yearRangeOf(draft.yearRange)
  }

  /** Una fecha de un calendario: el texto, contra él; el objeto, con su mes por id o por nombre */
  const dateIn = (def: CalendarDefinition, value: LooseDate): { date: WorldDate } | { error: string } => {
    if (typeof value === 'string') {
      const parsed = parseDate(def, value)
      return parsed.ok ? { date: parsed.date } : { error: parsed.message }
    }
    if (value.month === undefined) return { date: { year: value.year, ...(value.day ? { day: value.day } : {}) } }
    const ref = def === base ? monthRef(value.month) : resolveIn(def, value.month)
    return { date: { year: value.year, month: ref, ...(value.day === undefined ? {} : { day: value.day }) } }
  }

  base.eras = (draft.eras ?? []).map((era, i): CalendarEra => {
    const name = era.name.trim() || `Era ${i + 1}`
    const start = dateIn(base, era.start)
    if ('error' in start)
      problems.push({
        section: 'eras',
        index: i,
        code: 'eraStart',
        params: { name },
        message: `El comienzo de «${name}»: ${start.error}.`
      })
    const end = era.end ? dateIn(base, era.end) : null
    if (end && 'error' in end)
      problems.push({
        section: 'eras',
        index: i,
        code: 'eraEnd',
        params: { name },
        message: `El final de «${name}»: ${end.error}.`
      })
    return {
      id: idFor(era.id),
      name: era.name,
      ...(era.abbreviation ? { abbreviation: era.abbreviation } : {}),
      ...(era.description ? { description: era.description } : {}),
      start: 'date' in start ? start.date : { year: 0 },
      ...(end && 'date' in end ? { end: end.date } : {}),
      ...(era.countsFromStart ? { countsFromStart: true } : {}),
      ...(era.hidden ? { hidden: true } : {})
    }
  })

  const anchor = draft.correspondence
  if (anchor) {
    const targetId = anchor.calendarId ?? options.primaryId ?? null
    const target = options.calendars?.find((c) => c.id === targetId)
    if (!target) {
      problems.push({
        section: 'correspondence',
        code: 'correspondenceCalendar',
        params: {},
        message: 'La correspondencia necesita un calendario del mundo con el que corresponderse (el principal).'
      })
    } else {
      const date = dateIn(target.definition, anchor.date)
      const full = 'date' in date && date.date.month !== undefined && date.date.day !== undefined
      if (full) base.correspondence = { calendarId: target.id, date: date.date as FullDate }
      else
        problems.push({
          section: 'correspondence',
          code: 'correspondenceDate',
          params: {},
          message: `La correspondencia necesita un día de ese calendario${'error' in date ? `: ${date.error}` : ''}.`
        })
    }
  }
  return { definition: base, problems }
}

/** El rango de años, solo con lo que trae (sin nada, sin rango: el tope general) */
function yearRangeOf(range: CalendarDraft['yearRange']): Pick<CalendarDefinition, 'yearRange'> {
  const min = typeof range?.min === 'number' ? range.min : null
  const max = typeof range?.max === 'number' ? range.max : null
  if (min === null && max === null) return {}
  return { yearRange: { ...(min === null ? {} : { min }), ...(max === null ? {} : { max }) } }
}

const resolveIn = (def: CalendarDefinition, ref: string) =>
  def.months.find((m) => m.id === ref)?.id ??
  def.months.find((m) => calendarKey(m.name) === calendarKey(ref))?.id ??
  ref
