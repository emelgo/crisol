/**
 * El clima y el sol de cada campaña (docs/specs/modulo-8-10-campana.md, decisiones 11-15): cada día sale de su zona
 * con semilla `(mundo, zona, día absoluto)` y nada se guarda, salvo los días que el máster cambia a mano (no alteran los
 * siguientes). El máster ve hoy y la previsión; la jugadora, el clima de hoy y el sol (en el «hoy»)
 */
import {
  getCampaignWeather,
  type LogEventData,
  setCampaignClimate,
  setDayWeather,
  type WeatherDayView
} from '@crisol/contracts'
import { type calendarsRepo, campaignTimeRepo } from '@crisol/db'
import {
  type Compass,
  dateForm,
  dateFromDay,
  dayNumber,
  type FullDate,
  formatDate,
  sunTimes,
  type WeatherCondition,
  type WeatherZone,
  type WindForce,
  weatherRange
} from '@crisol/domain'
import { campaignsChanged } from '../realtime/events.ts'
import { seenDefinition } from '../wiki/dates.ts'
import { authorizedCampaign } from './access.ts'
import { dayIn, loggedDate, primaryOf, todayOf } from './campaign-dates.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { logEvent } from './log.ts'
import { implement } from './registry.ts'

type CalendarRow = calendarsRepo.CalendarRow

/** Lo de la campaña que decide su clima: su mundo, su zona y su latitud */
export interface ClimateOf {
  id: string
  worldId: string
  zone: WeatherZone
  latitude: number
}

const keyOf = (date: { year: number; month: string; day: number }) => `${date.year}|${date.month}|${date.day}`

/**
 * El clima de `count` días desde el día absoluto `from` de un calendario, con los cambiados a mano encima y el sol de
 * cada uno; full: con lo solo del máster en los textos
 */
export async function weatherDays(
  ctx: ActionContext,
  campaign: ClimateOf,
  calendar: CalendarRow,
  from: number,
  count: number,
  full: boolean
): Promise<WeatherDayView[]> {
  const def = calendar.definition
  const shown = seenDefinition(def, full)
  const generated = weatherRange(def, { worldId: campaign.worldId, zone: campaign.zone }, from, from + count - 1)
  const manual = new Map(
    (await campaignTimeRepo.listDayWeather(ctx.db, campaign.id, calendar.id)).map((row) => [keyOf(row), row])
  )
  return generated.map((weather, index) => {
    const date = dateFromDay(def, from + index)
    const own = manual.get(keyOf(date))
    const day = own
      ? {
          condition: own.condition as WeatherCondition,
          low: own.low,
          high: own.high,
          wind: own.wind as WindForce,
          windDirection: own.windDirection as Compass
        }
      : weather
    return {
      date,
      text: formatDate(shown, date, { weekday: true }),
      form: dateForm(shown, date),
      day: from + index,
      ...day,
      manual: own !== undefined,
      sun: sunTimes(def, date, campaign.latitude)
    }
  })
}

/** El clima de un día, como queda en el registro */
export const loggedWeather = (day: Pick<WeatherDayView, 'condition' | 'low' | 'high' | 'wind'>) => ({
  condition: day.condition,
  low: day.low,
  high: day.high,
  wind: day.wind
})

/** La campaña con su clima, si quien lo pide la lleva (su máster) */
async function masteredClimate(ctx: ActionContext, campaignId: string) {
  const campaign = await authorizedCampaign(ctx, 'table.manage', campaignId)
  const climate = await campaignTimeRepo.findClimate(ctx.db, campaign.id)
  if (!climate) throw new InvalidRequestError('NOT_FOUND')
  return {
    campaign,
    climate: { id: campaign.id, worldId: campaign.worldId, zone: climate.zone, latitude: climate.latitude }
  }
}

/** El calendario y el día absoluto de una fecha escrita (en el del «hoy» o, sin él, el principal); sin fecha, el «hoy» */
async function dayOf(ctx: ActionContext, campaign: { id: string; worldId: string }, written: unknown) {
  const current = await todayOf(ctx, campaign.id)
  if (written === undefined) {
    if (!current) throw new InvalidRequestError('NO_TODAY', 'la campaña aún no tiene fecha: di de qué día')
    return { calendar: current.calendar, date: current.today.date }
  }
  const calendar = current?.calendar ?? (await primaryOf(ctx, campaign.worldId))
  return { calendar, date: dayIn(calendar.definition, written as Parameters<typeof dayIn>[1]) }
}

export const weatherActions = [
  implement(getCampaignWeather, async (ctx, { campaignId, from, days }) => {
    const { campaign, climate } = await masteredClimate(ctx, campaignId)
    const start = await dayOf(ctx, campaign, from)
    const first = dayNumber(start.calendar.definition, start.date)
    return {
      zone: climate.zone,
      latitude: climate.latitude,
      days: await weatherDays(ctx, climate, start.calendar, first, days, true)
    }
  }),

  implement(setCampaignClimate, async (ctx, { campaignId, zone, latitude }) => {
    const { campaign, climate } = await masteredClimate(ctx, campaignId)
    const patch = { ...(zone ? { weatherZone: zone } : {}), ...(latitude === undefined ? {} : { latitude }) }
    await campaignTimeRepo.setClimate(
      ctx.db,
      historyContext(ctx, 'setCampaignClimate', { campaign: campaign.name, ...patch }, campaign),
      campaign.id,
      patch
    )
    ctx.realtime.publish(campaignsChanged({ campaignId: campaign.id, worldId: campaign.worldId }))
    ctx.table?.changed(campaign.id)
    return { zone: zone ?? climate.zone, latitude: latitude ?? climate.latitude }
  }),

  implement(setDayWeather, async (ctx, { campaignId, date, weather }) => {
    const { campaign, climate } = await masteredClimate(ctx, campaignId)
    const target = await dayOf(ctx, campaign, date)
    const at: FullDate = target.date
    await campaignTimeRepo.setDayWeather(
      ctx.db,
      historyContext(
        ctx,
        'setDayWeather',
        { campaign: campaign.name, date: loggedDate(target.calendar, at).text, ...(weather ?? { cleared: true }) },
        campaign
      ),
      { worldId: campaign.worldId, campaignId: campaign.id, calendarId: target.calendar.id, ...at },
      weather
    )
    const [day] = await weatherDays(ctx, climate, target.calendar, dayNumber(target.calendar.definition, at), 1, true)
    if (!day) throw new Error('Sin clima del día')
    // En el registro, solo para el máster (decisión 9)
    const event: LogEventData = {
      type: 'weather',
      date: loggedDate(target.calendar, at),
      weather: weather ? loggedWeather(day) : null
    }
    await logEvent(ctx, campaign, event, ['master'])
    ctx.realtime.publish(campaignsChanged({ campaignId: campaign.id, worldId: campaign.worldId }))
    ctx.table?.changed(campaign.id)
    return { day }
  })
]
