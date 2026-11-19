/**
 * El «hoy» de cada campaña (docs/specs/modulo-8-10-campana.md, decisiones 1 y 5-10; ADR-0029): una fecha con día de un
 * calendario del mundo. La pone y la avanza el máster (con su historial: se deshace); la lee toda la campaña, sin lo
 * solo del máster. Cada cambio queda en el registro de la partida, también al deshacerlo
 */
import { getCampaignToday, type LogEventData, setCampaignToday } from '@crisol/contracts'
import { calendarsRepo, campaignsRepo, campaignTimeRepo } from '@crisol/db'
import { addDays, dayNumber, type FullDate, sunTimes, yearProblem } from '@crisol/domain'
import { activityChanged, campaignsChanged } from '../realtime/events.ts'
import { authorizedCampaign } from './access.ts'
import {
  dayIn,
  leadsCampaign,
  loggedDate,
  presentDate,
  primaryOf,
  type Today,
  todayOf,
  weekLength
} from './campaign-dates.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { logEvent } from './log.ts'
import { implement } from './registry.ts'
import { weatherDays } from './weather.ts'

type CalendarRow = calendarsRepo.CalendarRow
type Campaign = { id: string; worldId: string; name: string; organizationId: string }

/**
 * Cambia el «hoy» en una operación (con su historial) y avisa; el registro lo escribe quien lo llama. extra: lo que se
 * cambia a la vez en la campaña (la zona, al viajar)
 */
export async function changeToday(
  ctx: ActionContext,
  campaign: Campaign,
  next: { calendar: CalendarRow; date: FullDate },
  details: Record<string, unknown>,
  action = 'setCampaignToday',
  zone?: campaignTimeRepo.WeatherZoneValue
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
    today,
    zone
  )
  const scope = { campaignId: campaign.id, worldId: campaign.worldId }
  ctx.realtime.publish(campaignsChanged(scope), activityChanged(scope))
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
    const climate = await campaignTimeRepo.findClimate(ctx.db, campaign.id)
    const zone = climate?.zone ?? 'temperate'
    const latitude = climate?.latitude ?? 45
    const calendar = found?.calendar ?? (await calendarsRepo.primaryCalendar(ctx.db, campaign.worldId))
    // El clima de hoy y, al máster, la previsión de los 7 días siguientes (decisión 14)
    const days = found
      ? await weatherDays(
          ctx,
          { id: campaign.id, worldId: campaign.worldId, zone, latitude },
          found.calendar,
          dayNumber(found.calendar.definition, found.today.date),
          master ? 8 : 1,
          master
        )
      : []
    return {
      today: found ? presentDate(found.calendar, found.today.date, master) : null,
      suggestion: !found && master ? await suggestionFor(ctx, campaign) : null,
      weekLength: calendar ? weekLength(calendar.definition) : 7,
      zone,
      latitude,
      weather: days[0] ?? null,
      sun: found ? sunTimes(found.calendar.definition, found.today.date, latitude) : null,
      forecast: days.slice(1)
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
      const outside = yearProblem(current.calendar.definition, next.date.year)
      if (outside) throw new InvalidRequestError('BAD_DATE', outside)
    }
    const from = current ? loggedDate(current.calendar, current.today.date) : null
    await changeToday(ctx, campaign, next, { from: from?.text ?? null, ...(moved === null ? {} : { days: moved }) })
    await logEvent(ctx, campaign, { type: 'date', from, to: loggedDate(next.calendar, next.date), days: moved })
    return { today: presentDate(next.calendar, next.date, true) }
  })
]
