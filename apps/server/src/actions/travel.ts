/**
 * Los viajes de una campaña (docs/specs/modulo-8-10-campana.md, decisiones 3, 17 y 18): la distancia escrita o medida
 * en un mapa del mundo (con su escala y sus velocidades), el medio, el ritmo y el descanso dan los días; hacer el viaje
 * avanza el «hoy» (y la zona, si se elige la de destino) en una sola operación y deja el resumen en el registro
 */
import { DEFAULT_SPEEDS, type LogEventData, planTravel, type TravelPlanView, travel } from '@crisol/contracts'
import { calendarsRepo, campaignTimeRepo, mapsRepo } from '@crisol/db'
import { addDays, dayNumber, NotFoundError, planTravel as planDays } from '@crisol/domain'
import type { z } from 'zod'
import { authorizedCampaign } from './access.ts'
import { loggedDate, presentDate, todayOf } from './campaign-dates.ts'
import { type ActionContext, InvalidRequestError } from './context.ts'
import { logEvent } from './log.ts'
import { implement } from './registry.ts'
import { changeToday } from './today.ts'
import { loggedWeather, weatherDays } from './weather.ts'

/** Lo más largo que se planea de una vez */
const MAX_DAYS = 366

type Input = z.output<typeof planTravel.input>
type Campaign = Awaited<ReturnType<typeof authorizedCampaign>>

/** La distancia, su unidad, lo que se anda al día con ese medio y el nombre de la ruta: escritos o del mapa */
async function measured(ctx: ActionContext, campaign: Campaign, input: Input) {
  if (input.distance !== undefined)
    return { distance: input.distance, unit: input.unit ?? null, speed: DEFAULT_SPEEDS[input.medium], route: null }
  const tabId = input.tabId ?? ''
  const map = await mapsRepo.mapOfTab(ctx.db, tabId)
  if (!map || map.worldId !== campaign.worldId) throw new NotFoundError('tab')
  // Lo mide la acción de medir, con sus permisos y lo que ve quien mide
  const measure = ctx.actions.get('measureMap')
  if (!measure) throw new Error('Sin measureMap')
  const result = (await measure.handler(ctx, {
    tabId,
    ...(input.points ? { points: input.points } : {}),
    ...(input.pins ? { pins: input.pins } : {}),
    ...(input.elementId ? { elementId: input.elementId } : {})
  })) as { distance: number | null; unit: string | null }
  if (result.distance === null) throw new InvalidRequestError('NO_MAP_SCALE', 'el mapa no tiene escala')
  const element = input.elementId ? await mapsRepo.findElement(ctx.db, input.elementId) : null
  const speeds = map.speeds ?? DEFAULT_SPEEDS
  const route = element?.label || element?.pageTitle || null
  return { distance: result.distance, unit: result.unit, speed: speeds[input.medium], route }
}

/** El plan entero: los días, la llegada desde el «hoy» y el clima de cada día del camino */
async function plan(ctx: ActionContext, campaign: Campaign, input: Input): Promise<TravelPlanView> {
  const { distance, unit, speed, route } = await measured(ctx, campaign, input)
  if (distance <= 0) throw new InvalidRequestError('BAD_DISTANCE', 'no hay camino que andar')
  const { travelDays, days } = planDays({ distance, speed, pace: input.pace, restDays: input.restDays })
  if (days > MAX_DAYS) throw new InvalidRequestError('TRAVEL_TOO_LONG', `como mucho ${MAX_DAYS} días de una vez`)
  const current = await todayOf(ctx, campaign.id)
  const climate = await campaignTimeRepo.findClimate(ctx.db, campaign.id)
  const base = { distance, unit, route, medium: input.medium, pace: input.pace, speed, restDays: input.restDays }
  if (!current || !climate) return { ...base, travelDays, days, from: null, arrival: null, weather: [] }
  const def = current.calendar.definition
  const start = dayNumber(def, current.today.date)
  return {
    ...base,
    travelDays,
    days,
    from: presentDate(current.calendar, current.today.date, true),
    arrival: presentDate(current.calendar, addDays(def, current.today.date, days), true),
    weather: await weatherDays(
      ctx,
      { id: campaign.id, worldId: campaign.worldId, zone: climate.zone, latitude: climate.latitude },
      current.calendar,
      start + 1,
      days,
      true
    )
  }
}

export const travelActions = [
  implement(planTravel, async (ctx, input) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', input.campaignId)
    return plan(ctx, campaign, input)
  }),

  implement(travel, async (ctx, { zone, ...input }) => {
    const campaign = await authorizedCampaign(ctx, 'table.manage', input.campaignId)
    const planned = await plan(ctx, campaign, input)
    const current = await todayOf(ctx, campaign.id)
    if (!current || !planned.from || !planned.arrival)
      throw new InvalidRequestError('NO_TODAY', 'la campaña aún no tiene fecha: ponla antes de viajar')
    const arrival = planned.arrival.date
    await changeToday(
      ctx,
      campaign,
      { calendar: current.calendar, date: arrival },
      {
        from: planned.from.text,
        days: planned.days,
        medium: planned.medium,
        ...(planned.route ? { route: planned.route } : {}),
        ...(zone ? { zone } : {})
      },
      'travel',
      zone
    )
    const calendar = (await calendarsRepo.findCalendar(ctx.db, current.calendar.id)) ?? current.calendar
    const event: LogEventData = {
      type: 'travel',
      from: loggedDate(calendar, current.today.date),
      to: loggedDate(calendar, arrival),
      distance: planned.distance,
      unit: planned.unit,
      medium: planned.medium,
      pace: planned.pace,
      restDays: planned.restDays,
      days: planned.days,
      route: planned.route,
      zone: zone ?? null,
      weather: planned.weather.map((day) => ({ date: loggedDate(calendar, day.date), ...loggedWeather(day) }))
    }
    await logEvent(ctx, campaign, event)
    return { plan: planned, today: presentDate(calendar, arrival, true) }
  })
]
