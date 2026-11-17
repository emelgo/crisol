/**
 * Las fechas de una campaña (docs/specs/modulo-8-10-campana.md; ADR-0029): leer su «hoy», cómo se enseña una fecha
 * (sin lo solo del máster para una jugadora) y cómo queda en el registro. Lo usan el «hoy», el clima y los viajes
 */
import type { CampaignDate } from '@crisol/contracts'
import { calendarsRepo, campaignTimeRepo } from '@crisol/db'
import {
  type CalendarDefinition,
  can,
  clampDate,
  dateForm,
  dayNumber,
  type FullDate,
  formatDate,
  parseDate,
  seasonOf,
  weekdayName
} from '@crisol/domain'
import { seenDefinition } from '../wiki/dates.ts'
import { type ActionContext, InvalidRequestError } from './context.ts'

type CalendarRow = calendarsRepo.CalendarRow
export type Today = campaignTimeRepo.CampaignToday

/** Si quien lo pide lleva la campaña (su máster o el del mundo) */
export const leadsCampaign = (ctx: ActionContext, campaign: { id: string; worldId: string }) =>
  can(ctx.actor, 'table.manage', { campaignId: campaign.id, worldId: campaign.worldId })

/** Los días de su semana (sin semana, 7): lo que avanza «+1 semana» */
export const weekLength = (definition: CalendarDefinition) => definition.weekdays.length || 7

/** Una fecha de la campaña como se lee; full: con lo solo del máster (las eras ocultas) */
export function presentDate(calendar: CalendarRow, date: FullDate, full: boolean): CampaignDate {
  const def = seenDefinition(calendar.definition, full)
  const shown = clampDate(def, date) as FullDate
  return {
    calendarId: calendar.id,
    calendar: calendar.name,
    date: shown,
    text: formatDate(def, shown, { weekday: true }),
    form: dateForm(def, shown),
    weekday: weekdayName(def, shown),
    season: seasonOf(def, shown)?.name ?? null,
    day: dayNumber(def, shown)
  }
}

/** Una fecha tal como queda en el registro, que ve toda la campaña: sin lo solo del máster */
export function loggedDate(calendar: CalendarRow, date: FullDate) {
  const def = seenDefinition(calendar.definition, false)
  return { calendarId: calendar.id, date, text: formatDate(def, clampDate(def, date), { weekday: true }) }
}

/** El «hoy» de la campaña con su calendario (null si no tiene, o si su calendario ya no está) */
export async function todayOf(ctx: ActionContext, campaignId: string) {
  const today = await campaignTimeRepo.findToday(ctx.db, campaignId)
  if (!today) return null
  const calendar = await calendarsRepo.findCalendar(ctx.db, today.calendarId)
  return calendar ? { today, calendar } : null
}

/** Una fecha escrita (texto u objeto) con su día, contra el calendario: BAD_DATE si no cabe o le falta el día */
export function dayIn(
  definition: CalendarDefinition,
  value: string | { year: number; month?: string | number | undefined; day?: number | undefined }
): FullDate {
  const parsed = parseDate(
    definition,
    typeof value === 'string'
      ? value
      : {
          year: value.year,
          ...(value.month === undefined ? {} : { month: String(value.month) }),
          ...(value.day === undefined ? {} : { day: value.day })
        }
  )
  if (!parsed.ok) throw new InvalidRequestError('BAD_DATE', parsed.message)
  const { year, month, day } = parsed.date
  if (month === undefined || day === undefined) throw new InvalidRequestError('BAD_DATE', 'el «hoy» lleva día')
  return { year, month, day }
}

/** El calendario principal del mundo, para poner una fecha: NO_CALENDAR si no tiene */
export async function primaryOf(ctx: ActionContext, worldId: string) {
  const calendar = await calendarsRepo.primaryCalendar(ctx.db, worldId)
  if (!calendar) throw new InvalidRequestError('NO_CALENDAR', 'el mundo no tiene calendarios: crea uno antes')
  return calendar
}
