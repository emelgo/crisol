/**
 * Un día descrito (para la IA y la vista previa): su texto, la forma de la IA, el día de la semana, la estación, la era,
 * las lunas y el día del año. Origen: `packages/core/src/calendar/describe.ts` del Crisol antiguo (código de Enrique,
 * `~/CrisolVTT/crisol`, commit 3f68f11), sin el sol ni el clima
 */
import {
  clampDate,
  dateFromDay,
  dateSpan,
  dayNumber,
  dayOfYear,
  eraOfDay,
  moonPhasesOfDay,
  precisionOf,
  seasonOfDay,
  weekdayName,
  yearLength
} from './dates.ts'
import type { CalendarDefinition, DatePrecision, WorldDate } from './definition.ts'
import { dateForm, formatDate } from './format.ts'

export interface DayDescription {
  /** «Flora, 18 de Siega de 1250 RC» (sin día, «Siega de 1250 RC») */
  text: string
  /** `1250-Siega-18` */
  form: string
  precision: DatePrecision
  /** Sin día, el del primero que abarca */
  weekday: string | null
  season: string | null
  era: { id: string; name: string; abbreviation: string | null } | null
  moons: Array<{ id: string; name: string; phase: string; illumination: number; color: string }>
  dayOfYear: number
  /** Días desde el primero del año 0 */
  dayNumber: number
  yearLength: number
  /** Sin día: el primero y el último que abarca */
  span: { from: string; to: string } | null
}

export function describeDate(def: CalendarDefinition, date: WorldDate): DayDescription {
  const shown = clampDate(def, date)
  const day = dayNumber(def, shown)
  const first = dateFromDay(def, day)
  const precision = precisionOf(shown)
  const era = eraOfDay(def, day)
  const [from, to] = dateSpan(def, shown)
  return {
    text: formatDate(def, shown, { weekday: true }),
    form: dateForm(def, shown),
    precision,
    weekday: weekdayName(def, first),
    season: seasonOfDay(def, dayOfYear(def, first))?.name ?? null,
    era: era ? { id: era.id, name: era.name, abbreviation: era.abbreviation || null } : null,
    moons: moonPhasesOfDay(def, day).map((p) => ({
      id: p.moon.id,
      name: p.moon.name,
      phase: p.name,
      illumination: Math.round(p.illumination * 100) / 100,
      color: p.moon.color
    })),
    dayOfYear: dayOfYear(def, first),
    dayNumber: day,
    yearLength: yearLength(def, shown.year),
    span:
      precision === 'day'
        ? null
        : { from: formatDate(def, dateFromDay(def, from)), to: formatDate(def, dateFromDay(def, to)) }
  }
}
