/**
 * El «hoy» de cada campaña (docs/specs/modulo-8-10-campana.md, decisiones 1 y 5-10; ADR-0029): una fecha con día de un
 * calendario del mundo. La pone y la avanza el máster (con su historial: se deshace); la lee toda la campaña, sin lo
 * solo del máster. Cada cambio queda en el registro de la partida, también al deshacerlo
 */
import { type CampaignDate, getCampaignToday, type LogEventData, setCampaignToday } from '@crisol/contracts'
import { calendarsRepo, campaignsRepo, campaignTimeRepo } from '@crisol/db'
import {
  addDays,
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
import { campaignsChanged } from '../realtime/events.ts'
import { seenDefinition } from '../wiki/dates.ts'
import { authorizedCampaign } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { logEvent } from './log.ts'
import { implement } from './registry.ts'

type CalendarRow = calendarsRepo.CalendarRow
type Campaign = { id: string; worldId: string; name: string; organizationId: string }
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

/**
 * Cambia el «hoy» en una operación (con su historial) y avisa; el registro lo escribe quien lo llama. extra: lo que se
 * cambia a la vez en la campaña (la zona, al viajar)
 */
export async function changeToday(
  ctx: ActionContext,
  campaign: Campaign,
  next: { calendar: CalendarRow; date: FullDate },
  details: Record<string, unknown>,
  action = 'setCampaignToday'
) {
  const today: Today = { calendarId: next.calendar.id, date: next.date }
  await campaignTimeRepo.setToday(
    ctx.db,
    historyContext(
      ctx,
      action,
      { campaign: campaign.name, to: loggedDate(next.calendar, next.date).text, ...details },
      campaign
    ),
    campaign.id,
    today
  )
  ctx.realtime.publish(campaignsChanged({ campaignId: campaign.id, worldId: campaign.worldId }))
  ctx.table?.changed(campaign.id)
  return today
}

/** El «hoy» de otra campaña del mundo, para proponerlo a una que no tiene (decisión 6) */
async function suggestionFor(ctx: ActionContext, campaign: Campaign) {
  for (const other of await campaignTimeRepo.todaysOfWorld(ctx.db, campaign.worldId)) {
    if (other.id === campaign.id || !other.today) continue
    const calendar = await calendarsRepo.findCalendar(ctx.db, other.today.calendarId)
    if (calendar) return presentDate(calendar, other.today.date, true)
  }
  return null
}

const sameToday = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * Al deshacer: cada campaña cuyo «hoy» cambió lo deja dicho en su registro («La fecha vuelve a…»), porque el registro
 * no se deshace (decisión 8)
 */
export async function logUndoneToday(
  ctx: ActionContext,
  applied: ReadonlyArray<{ tableName: string; rowId: string; before: unknown; after: unknown }>
) {
  for (const change of applied) {
    if (change.tableName !== 'campaigns') continue
    const before = (change.before as { today?: Today | null } | null)?.today ?? null
    const after = (change.after as { today?: Today | null } | null)?.today ?? null
    if (sameToday(before, after)) continue
    const campaign = await campaignsRepo.findCampaign(ctx.db, change.rowId)
    if (!campaign) continue
    const logged = async (today: Today | null) => {
      const calendar = today ? await calendarsRepo.findCalendar(ctx.db, today.calendarId) : null
      return today && calendar ? loggedDate(calendar, today.date) : null
    }
    const event: LogEventData = {
      type: 'date',
      from: await logged(before),
      to: await logged(after),
      days: null,
      undo: true
    }
    await logEvent(ctx, campaign, event)
  }
}

export const todayActions = [
  implement(getCampaignToday, async (ctx, { campaignId }) => {
    const campaign = await authorizedCampaign(ctx, 'campaign.read', campaignId)
    const master = leadsCampaign(ctx, campaign)
    const found = await todayOf(ctx, campaign.id)
    const calendar = found?.calendar ?? (await calendarsRepo.primaryCalendar(ctx.db, campaign.worldId))
    return {
      today: found ? presentDate(found.calendar, found.today.date, master) : null,
      suggestion: !found && master ? await suggestionFor(ctx, campaign) : null,
      weekLength: calendar ? weekLength(calendar.definition) : 7
    }
  }),

  implement(setCampaignToday, async (ctx, { campaignId, date, days, weeks }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
    const current = await todayOf(ctx, campaign.id)
    let next: { calendar: CalendarRow; date: FullDate }
    let moved: number | null = null
    if (date !== undefined) {
      const calendar = await primaryOf(ctx, campaign.worldId)
      next = { calendar, date: dayIn(calendar.definition, date) }
    } else {
      if (!current) throw new InvalidRequestError('NO_TODAY', 'la campaña aún no tiene fecha: ponla con date')
      moved = days ?? (weeks ?? 0) * weekLength(current.calendar.definition)
      next = { calendar: current.calendar, date: addDays(current.calendar.definition, current.today.date, moved) }
    }
    const from = current ? loggedDate(current.calendar, current.today.date) : null
    await changeToday(ctx, campaign, next, { from: from?.text ?? null, ...(moved === null ? {} : { days: moved }) })
    await logEvent(ctx, campaign, { type: 'date', from, to: loggedDate(next.calendar, next.date), days: moved })
    return { today: presentDate(next.calendar, next.date, true) }
  })
]
