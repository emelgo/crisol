/**
 * El tiempo de las campañas en la API en memoria de las pruebas (módulos 8 y 10 · campaña): su «hoy» y su clima, como el
 * servidor, con la aritmética del dominio (sin registro ni historial)
 */
import type { CalendarView, CampaignDate, WeatherDayView } from '@crisol/contracts'
import {
  addDays,
  clampDate,
  dateForm,
  dateFromDay,
  dayNumber,
  type FullDate,
  formatDate,
  parseDate,
  seasonOf,
  sunTimes,
  type WeatherZone,
  weatherRange,
  weekdayName
} from '@crisol/domain'
import { type ActionInput, type ActionOutput, ApiError } from './client.ts'

type Names = 'getCampaignToday' | 'setCampaignToday' | 'getCampaignWeather' | 'setCampaignClimate' | 'setDayWeather'

/** El «hoy» de partida de una campaña */
export interface FakeToday {
  campaignId: string
  calendarId: string
  date: FullDate
}

export function fakeCampaignTime(options: {
  calendars: readonly CalendarView[]
  campaigns: ReadonlyArray<{ id: string; worldId: string }>
  todays?: readonly FakeToday[]
}) {
  const climates = new Map<string, { zone: WeatherZone; latitude: number }>()
  const climateOf = (id: string) => climates.get(id) ?? { zone: 'temperate' as const, latitude: 45 }
  // Los días a mano, por campaña y día absoluto
  const manual = new Map<string, Omit<WeatherDayView, 'date' | 'text' | 'form' | 'day' | 'manual' | 'sun'>>()
  const todays = new Map((options.todays ?? []).map((t) => [t.campaignId, { calendarId: t.calendarId, date: t.date }]))
  const campaignOf = (id: string) => {
    const campaign = options.campaigns.find((c) => c.id === id)
    if (!campaign) throw new ApiError('NOT_FOUND', 404)
    return campaign
  }
  const calendarOf = (id: string) => options.calendars.find((c) => c.id === id) ?? null
  const present = (calendar: CalendarView, date: FullDate): CampaignDate => {
    const def = calendar.definition
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
  const todayOf = (campaignId: string) => {
    const today = todays.get(campaignId)
    const calendar = today ? calendarOf(today.calendarId) : null
    return today && calendar ? { today, calendar } : null
  }

  /** El clima de unos días, con los de a mano encima, como el servidor */
  const weatherDays = (campaignId: string, calendar: CalendarView, from: number, count: number): WeatherDayView[] => {
    const campaign = campaignOf(campaignId)
    const { zone, latitude } = climateOf(campaignId)
    const def = calendar.definition
    return weatherRange(def, { worldId: campaign.worldId, zone }, from, from + count - 1).map((generated, index) => {
      const day = from + index
      const date = dateFromDay(def, day)
      const own = manual.get(`${campaignId}|${day}`)
      return {
        date,
        text: formatDate(def, date, { weekday: true }),
        form: dateForm(def, date),
        day,
        ...(own ?? generated),
        manual: own !== undefined,
        sun: sunTimes(def, date, latitude)
      }
    })
  }
  const requireToday = (campaignId: string) => {
    const found = todayOf(campaignId)
    if (!found) throw new ApiError('NO_TODAY', 400)
    return found
  }

  const handlers: { [N in Names]: (input: ActionInput<N>) => ActionOutput<N> } = {
    getCampaignToday: ({ campaignId }) => {
      const campaign = campaignOf(campaignId)
      const found = todayOf(campaignId)
      const calendar = found?.calendar ?? options.calendars.find((c) => c.worldId === campaign.worldId && c.primary)
      const days = found
        ? weatherDays(campaignId, found.calendar, dayNumber(found.calendar.definition, found.today.date), 8)
        : []
      const { zone, latitude } = climateOf(campaignId)
      return {
        today: found ? present(found.calendar, found.today.date) : null,
        suggestion: null,
        weekLength: calendar ? calendar.definition.weekdays.length || 7 : 7,
        zone,
        latitude,
        weather: days[0] ?? null,
        sun: days[0]?.sun ?? null,
        forecast: days.slice(1)
      }
    },
    setCampaignToday: ({ campaignId, date, days, weeks }) => {
      const campaign = campaignOf(campaignId)
      let calendar: CalendarView
      let next: FullDate
      if (date !== undefined) {
        const primary = options.calendars.find((c) => c.worldId === campaign.worldId && c.primary)
        if (!primary) throw new ApiError('NO_CALENDAR', 400)
        const parsed = parseDate(
          primary.definition,
          typeof date === 'string'
            ? date
            : { year: date.year, ...(date.month === undefined ? {} : { month: String(date.month) }), day: date.day }
        )
        if (!parsed.ok || parsed.date.month === undefined || parsed.date.day === undefined)
          throw new ApiError('BAD_DATE', 400)
        calendar = primary
        next = { year: parsed.date.year, month: parsed.date.month, day: parsed.date.day }
      } else {
        const found = todayOf(campaignId)
        if (!found) throw new ApiError('NO_TODAY', 400)
        calendar = found.calendar
        const step = days ?? (weeks ?? 0) * (calendar.definition.weekdays.length || 7)
        next = addDays(calendar.definition, found.today.date, step)
      }
      todays.set(campaignId, { calendarId: calendar.id, date: next })
      return { today: present(calendar, next) }
    },
    getCampaignWeather: ({ campaignId, days }) => {
      const found = requireToday(campaignId)
      const from = dayNumber(found.calendar.definition, found.today.date)
      return { ...climateOf(campaignId), days: weatherDays(campaignId, found.calendar, from, days ?? 7) }
    },
    setCampaignClimate: ({ campaignId, zone, latitude }) => {
      campaignOf(campaignId)
      const next = {
        ...climateOf(campaignId),
        ...(zone ? { zone } : {}),
        ...(latitude === undefined ? {} : { latitude })
      }
      climates.set(campaignId, next)
      return next
    },
    setDayWeather: ({ campaignId, weather }) => {
      const found = requireToday(campaignId)
      const day = dayNumber(found.calendar.definition, found.today.date)
      if (weather) manual.set(`${campaignId}|${day}`, weather)
      else manual.delete(`${campaignId}|${day}`)
      const [view] = weatherDays(campaignId, found.calendar, day, 1)
      if (!view) throw new ApiError('NOT_FOUND', 404)
      return { day: view }
    }
  }
  return { handlers, todays }
}
