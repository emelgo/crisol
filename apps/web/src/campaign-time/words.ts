/**
 * Cómo se leen el tiempo de una campaña y su clima (módulos 8 y 10 · campaña, decisión 28): los grados en centígrados,
 * el viento en palabras con su rumbo, las horas de sol y «hace / dentro de N días». Sin React: se prueba aparte
 */
import type { WeatherDayView } from '@crisol/contracts'
import type { TFunction } from 'i18next'

/** «6:27» a partir de los minutos desde la medianoche */
export function clockText(minutes: number): string {
  const whole = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** «11 h 06 min de luz» */
export function daylightText(t: TFunction, minutes: number): string {
  const whole = Math.round(minutes)
  return t('campaignTime.daylight', {
    hours: Math.floor(whole / 60),
    minutes: String(whole % 60).padStart(2, '0')
  })
}

/** «Viento fuerte del norte»; en calma, sin rumbo */
export function windText(t: TFunction, day: Pick<WeatherDayView, 'wind' | 'windDirection'>): string {
  if (day.wind === 'calm') return t('campaignTime.wind.calm')
  return t('campaignTime.windFrom', {
    force: t(`campaignTime.wind.${day.wind}`),
    direction: t(`campaignTime.compass.${day.windDirection}`)
  })
}

/** «11° / 17°» */
export const temperatureText = (day: Pick<WeatherDayView, 'low' | 'high'>) => `${day.low}° / ${day.high}°`

/** «45° N», «12° S» */
export function latitudeText(t: TFunction, latitude: number): string {
  const degrees = Math.round(Math.abs(latitude) * 10) / 10
  return t(latitude < 0 ? 'campaignTime.south' : 'campaignTime.north', { degrees: degrees.toLocaleString('es') })
}

/**
 * «hace 87 días», «dentro de 3 días», «hoy»; lejos (dos años o más), en años: «hace 9 años». `year`, los días de un año
 * del calendario
 */
export function relativeDays(t: TFunction, today: number, day: number, year: number): string {
  const diff = day - today
  if (diff === 0) return t('campaignTime.relative.today')
  const count = Math.abs(diff)
  const years = year > 0 && count >= year * 2 ? Math.round(count / year) : null
  const amount =
    years === null ? t('campaignTime.relative.days', { count }) : t('campaignTime.relative.years', { count: years })
  return t(diff < 0 ? 'campaignTime.relative.ago' : 'campaignTime.relative.in', { amount })
}

/** «Lunden, 7 de Brumas de 1247 RV» → «Lunden, 7 de Brumas» */
export const withoutYear = (text: string) => text.replace(/ de -?\d[\d.]*(\s.*)?$/, '')

/** «6 de Brumas» de «Solen, 6 de Brumas de 1247 RV» */
export const chipDate = (text: string) => withoutYear(text).replace(/^[^,]+,\s*/, '')
