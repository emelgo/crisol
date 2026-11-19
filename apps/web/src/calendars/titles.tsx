/**
 * Los títulos de las vistas del calendario en grande, dichos enteros (Enrique, 2026-11-20: «en vez de un número suelto,
 * año X, enero del año X y semana del X al X de enero del año X»), y la estación de lo que se ve
 */
import {
  type CalendarDefinition,
  type CalendarSeason,
  clampDate,
  dateFromDay,
  formatYear,
  type GridDay,
  monthWithPreposition,
  seasonOfDay
} from '@crisol/domain'
import type { TFunction } from 'i18next'
import type { CSSProperties } from 'react'
import chrono from '../chronologies/chronologies.module.css'

const yearOf = (definition: CalendarDefinition, year: number) => formatYear(definition, year, { year })

/** «Año 1250» (con su era o su sufijo, si los tiene) */
export function yearTitle(t: TFunction, definition: CalendarDefinition, year: number): string {
  return t('calendars.view.yearTitle', { year: yearOf(definition, year) })
}

/** «Enero del año 1250» */
export function monthTitle(t: TFunction, definition: CalendarDefinition, year: number, monthId: string): string {
  const month = definition.months.find((m) => m.id === monthId)
  return month
    ? t('calendars.view.monthTitle', { month: month.name, year: yearOf(definition, year) })
    : yearTitle(t, definition, year)
}

/** «Semana del 1 al 7 de Enero del año 1», «… del 29 de Enero al 4 de Febrero…» o con dos años si cambia de año */
export function weekTitle(t: TFunction, definition: CalendarDefinition, first: number, last: number): string {
  const a = clampDate(definition, dateFromDay(definition, first))
  const b = clampDate(definition, dateFromDay(definition, last))
  const monthA = definition.months.find((m) => m.id === a.month)
  const monthB = definition.months.find((m) => m.id === b.month)
  if (!monthA || !monthB || a.day === undefined || b.day === undefined) return yearTitle(t, definition, a.year)
  const from = `${a.day} ${monthWithPreposition(monthA)}`
  const to = `${b.day} ${monthWithPreposition(monthB)}`
  if (a.year !== b.year)
    return t('calendars.view.weekTwoYears', {
      from,
      to,
      fromYear: yearOf(definition, a.year),
      toYear: yearOf(definition, b.year)
    })
  if (a.month === b.month)
    return t('calendars.view.weekTitle', {
      from: a.day,
      to: b.day,
      month: monthWithPreposition(monthB),
      year: yearOf(definition, b.year)
    })
  return t('calendars.view.weekTwoMonths', { from, to, year: yearOf(definition, b.year) })
}

/** Las estaciones de unos días, sin repetir y en su orden */
export function seasonsOf(definition: CalendarDefinition, days: readonly GridDay[]): CalendarSeason[] {
  const out: CalendarSeason[] = []
  for (const day of days) {
    const season = seasonOfDay(definition, day.dayOfYear)
    if (season && !out.some((s) => s.id === season.id)) out.push(season)
  }
  return out
}

/** La estación con su punto de color, como en la cabecera del mes */
export function SeasonFacts({ seasons }: { seasons: readonly CalendarSeason[] }) {
  return seasons.map((season) => (
    <span key={season.id}>
      <span
        className={chrono.seasonDot}
        style={{ '--season-color': season.color ?? 'var(--color-muted)' } as CSSProperties}
      />
      {season.name}
    </span>
  ))
}
