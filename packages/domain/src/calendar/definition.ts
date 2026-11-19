/**
 * Los calendarios de un mundo (docs/specs/calendarios.md, ADR-0029): su definición, las fechas y los de ejemplo.
 *
 * Origen: el modelo de calendario del Crisol antiguo (código de Enrique, `~/CrisolVTT/crisol`, commit 3f68f11,
 * `packages/core/src/calendar/definition.ts`), con los cambios del módulo 8: los meses por id estable, los días fuera de
 * la semana, las eras que cuentan desde su inicio o solo del máster, el sufijo de antes del año 0 y la correspondencia
 * con otro calendario. Sin el «hoy» ni el sol (8 · campaña)
 */

/** Una fecha de un calendario: el año (hay año 0 y negativos), el mes por su id y el día desde 1. Lo que falta baja la precisión */
export interface WorldDate {
  year: number
  month?: string | undefined
  day?: number | undefined
}

/** Una fecha con su día */
export interface FullDate {
  year: number
  month: string
  day: number
}

export type DatePrecision = 'year' | 'month' | 'day'

export interface CalendarMonth {
  /** Corto y aleatorio, único en el calendario; no se enseña. Las fechas lo guardan: renombrar o mover no las toca */
  id: string
  name: string
  days: number
  color?: string | null | undefined
  /** Ocupa su sitio en el año, pero no cuenta al numerar los meses (el «mes 3» es el tercero que no lo es) */
  festival?: boolean | undefined
  /** Sus días no son de ningún día de la semana */
  outsideWeek?: boolean | undefined
  /**
   * Los días con nombre propio, por su orden (los de bisiesto, al final): «Shieldmeet», el 2 de Pleno Verano. Uno con
   * nombre se lee por él («Shieldmeet de 1372 DR»); un mes de un solo día, por el del mes
   */
  dayNames?: string[] | undefined
}

/** Días de más en un mes algunos años: cada `every`, salvo cada `unless`, pero sí cada `but` (contando desde el año 0) */
export interface LeapRule {
  monthId: string
  days: number
  every: number
  unless?: number | null | undefined
  but?: number | null | undefined
}

export interface CalendarSeason {
  id: string
  name: string
  /** Días del año normal, desde 1 y los dos incluidos; puede cruzar el fin de año (empieza después de acabar) */
  startDay: number
  endDay: number
  color?: string | null | undefined
}

export interface CalendarMoon {
  id: string
  name: string
  /** Días del ciclo (con decimales) */
  cycleDays: number
  /** Desfase en días respecto al día 0 del calendario: la fase es (día + desfase) mod ciclo; 0, nueva */
  offsetDays: number
  color: string
  /** Los nombres de sus fases, desde la nueva; la de la mitad es la llena */
  phases: string[]
}

export interface CalendarEra {
  id: string
  name: string
  abbreviation?: string | undefined
  description?: string | undefined
  start: WorldDate
  /** Sin fin, abierta */
  end?: WorldDate | null | undefined
  /** Los años se cuentan desde su inicio (el año en que empieza es su año 1), con su abreviatura */
  countsFromStart?: boolean | undefined
  /** Solo del máster: no le llega a ningún jugador */
  hidden?: boolean | undefined
}

/** «El 1 del primer mes del año 0 de este calendario cae el `date` de `calendarId`» (al crearla, el principal) */
export interface CalendarCorrespondence {
  calendarId: string
  date: FullDate
}

/** Los años que admite el calendario; lo que falte, hasta el tope general (CALENDAR_LIMITS.yearBound) */
export interface CalendarYearRange {
  min?: number | null | undefined
  max?: number | null | undefined
}

export interface CalendarDefinition {
  /** «RC»: «1250 RC» */
  yearSuffix: string
  /** «a. R.»: «980 a. R.»; sin él, «-980 RC» */
  beforeZeroSuffix?: string | undefined
  description: string
  weekdays: string[]
  /** El día de la semana del primer día del año 0 (su índice) */
  firstWeekday: number
  /** continuous: la semana sigue de un mes a otro; reset: cada mes empieza en el primer día */
  weekMode: 'continuous' | 'reset'
  months: CalendarMonth[]
  leapRules: LeapRule[]
  seasons: CalendarSeason[]
  moons: CalendarMoon[]
  eras: CalendarEra[]
  correspondence?: CalendarCorrespondence | null | undefined
  /** Sin él, de -99.999 a 99.999 */
  yearRange?: CalendarYearRange | null | undefined
}

/** Los límites de una definición (los mismos en el contrato) */
export const CALENDAR_LIMITS = {
  name: 60,
  suffix: 12,
  description: 500,
  weekdays: 20,
  months: 100,
  monthDays: 1000,
  leapRules: 10,
  leapDays: 10,
  leapEvery: 100_000,
  seasons: 12,
  moons: 20,
  phases: 32,
  eras: 100,
  eraDescription: 280,
  abbreviation: 12,
  year: 10_000_000,
  /** El tope de años de un calendario sin rango propio (y el de su rango) */
  yearBound: 99_999
} as const

/**
 * Los años que admite (los dos incluidos): su rango, recortado al tope general; sin él, o con uno que no vale (el
 * primero después del último), el tope general
 */
export function yearBounds(def: Pick<CalendarDefinition, 'yearRange'>): { min: number; max: number } {
  const bound = CALENDAR_LIMITS.yearBound
  const fit = (n: number | null | undefined, fallback: number) =>
    typeof n === 'number' && Number.isInteger(n) ? Math.min(bound, Math.max(-bound, n)) : fallback
  const min = fit(def.yearRange?.min, -bound)
  const max = fit(def.yearRange?.max, bound)
  return min <= max ? { min, max } : { min: -bound, max: bound }
}

/** El año llevado al rango del calendario (se para en el borde) */
export function clampYear(def: Pick<CalendarDefinition, 'yearRange'>, year: number): number {
  const { min, max } = yearBounds(def)
  return Math.min(max, Math.max(min, Math.trunc(year)))
}

/** Por qué un año no vale en el calendario (en español, para la IA), o null */
export function yearProblem(def: Pick<CalendarDefinition, 'yearRange'>, year: number): string | null {
  const { min, max } = yearBounds(def)
  if (year >= min && year <= max) return null
  return `el año ${year} se sale del calendario, que va del año ${min} al ${max}`
}

export const DEFAULT_PHASES = [
  'Nueva',
  'Creciente',
  'Cuarto creciente',
  'Gibosa creciente',
  'Llena',
  'Gibosa menguante',
  'Cuarto menguante',
  'Menguante'
]

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** Un id corto para un mes, una luna, una era o una estación (no se enseña: basta con que no se repita en el calendario) */
export function newCalendarId(taken: Iterable<string> = []): string {
  const used = new Set(taken)
  for (;;) {
    let id = ''
    for (let i = 0; i < 8; i++) id += ID_CHARS.charAt(Math.floor(Math.random() * ID_CHARS.length))
    if (!used.has(id)) return id
  }
}

/** Uno en blanco: doce meses de treinta días y una semana de siete */
export function blankCalendar(): CalendarDefinition {
  const ids: string[] = []
  const id = () => {
    const next = newCalendarId(ids)
    ids.push(next)
    return next
  }
  return {
    yearSuffix: '',
    description: '',
    weekdays: Array.from({ length: 7 }, (_, i) => `Día ${i + 1}`),
    firstWeekday: 0,
    weekMode: 'continuous',
    months: Array.from({ length: 12 }, (_, i) => ({ id: id(), name: `Mes ${i + 1}`, days: 30 })),
    leapRules: [],
    seasons: [],
    moons: [],
    eras: []
  }
}

const GREGORIAN_MONTHS: Array<[string, number]> = [
  ['Enero', 31],
  ['Febrero', 28],
  ['Marzo', 31],
  ['Abril', 30],
  ['Mayo', 31],
  ['Junio', 30],
  ['Julio', 31],
  ['Agosto', 31],
  ['Septiembre', 30],
  ['Octubre', 31],
  ['Noviembre', 30],
  ['Diciembre', 31]
]

/**
 * «Como el nuestro», de ejemplo: el gregoriano proléptico con año 0 (el 1 de enero del año 0 fue sábado), febrero
 * bisiesto cada 4 años salvo cada 100 pero sí cada 400, su luna (luna nueva el 6 de enero de 2000) y las estaciones del
 * hemisferio norte. La luna nueva de verdad cae en el centro de su fase «Nueva» (como en el antiguo)
 */
export function gregorianCalendar(): CalendarDefinition {
  const months = GREGORIAN_MONTHS.map(([name, days]) => ({ id: name.toLowerCase().slice(0, 3), name, days }))
  return {
    yearSuffix: '',
    description: '',
    weekdays: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
    firstWeekday: 5,
    weekMode: 'continuous',
    months,
    leapRules: [{ monthId: 'feb', days: 1, every: 4, unless: 100, but: 400 }],
    seasons: [
      { id: 'invierno', name: 'Invierno', startDay: 355, endDay: 79, color: '#7fa8d8' },
      { id: 'primavera', name: 'Primavera', startDay: 80, endDay: 171, color: '#8fc26a' },
      { id: 'verano', name: 'Verano', startDay: 172, endDay: 265, color: '#e2b35d' },
      { id: 'otono', name: 'Otoño', startDay: 266, endDay: 354, color: '#d98859' }
    ],
    moons: [
      {
        id: 'luna',
        name: 'Luna',
        cycleDays: 29.530588,
        offsetDays: 9.241018,
        color: '#d8dce4',
        phases: [...DEFAULT_PHASES]
      }
    ],
    eras: []
  }
}

/** «Copia de…»: la misma definición (los ids son de cada calendario) sin su correspondencia, que es de él */
export const copyCalendar = (def: CalendarDefinition): CalendarDefinition => {
  const { correspondence: _, ...rest } = JSON.parse(JSON.stringify(def)) as CalendarDefinition
  return rest
}
