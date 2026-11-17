/**
 * El tiempo de las campañas en la API en memoria de las pruebas (módulos 8 y 10 · campaña): su «hoy» y su clima, como el
 * servidor, con la aritmética del dominio (sin registro ni historial); y lo elegido en la pantalla del máster
 */
import {
  type CalendarView,
  type CampaignDate,
  DEFAULT_SPEEDS,
  type TravelPlanView,
  type WeatherDayView
} from '@crisol/contracts'
import {
  addDays,
  clampDate,
  dateForm,
  dateFromDay,
  dayNumber,
  effectiveWeatherLayer,
  type FullDate,
  formatDate,
  parseDate,
  planTravel as planDays,
  seasonOf,
  sunTimes,
  type WeatherZone,
  weatherRange,
  weekdayName
} from '@crisol/domain'
import { type ActionInput, type ActionOutput, ApiError } from './client.ts'

type Names =
  | 'getCampaignToday'
  | 'setCampaignToday'
  | 'getCampaignWeather'
  | 'setCampaignClimate'
  | 'setDayWeather'
  | 'planTravel'
  | 'travel'
  | 'getCampaignActivity'
  | 'markActivitySeen'
  | 'setGmScreen'
  | 'listRandomTables'
  | 'setWeatherLayer'

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

  /** Un viaje con la distancia escrita (los mapas no se miden aquí), como el servidor */
  const plan = (input: ActionInput<'planTravel'>): TravelPlanView => {
    if (input.distance === undefined) throw new ApiError('NO_MAP_SCALE', 400)
    const medium = input.medium ?? 'foot'
    const pace = input.pace ?? 'normal'
    const restDays = input.restDays ?? 0
    const speed = DEFAULT_SPEEDS[medium]
    const { travelDays, days, schedule } = planDays({ distance: input.distance, speed, pace, restDays })
    const found = todayOf(input.campaignId)
    const base = { distance: input.distance, unit: input.unit ?? null, route: null, medium, pace, speed, restDays }
    if (!found) return { ...base, travelDays, days, schedule, from: null, arrival: null, weather: [] }
    const def = found.calendar.definition
    return {
      ...base,
      travelDays,
      days,
      schedule,
      from: present(found.calendar, found.today.date),
      arrival: present(found.calendar, addDays(def, found.today.date, days)),
      weather: weatherDays(input.campaignId, found.calendar, dayNumber(def, found.today.date) + 1, days)
    }
  }

  // La pantalla del máster de cada campaña en cada escena
  const gmScreens = new Map<string, ActionOutput<'setGmScreen'>['gmScreen']>()
  // La última visita de la cuenta a cada centro de actividad (sin historial: siempre vacío)
  const visits = new Map<string, string>()

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
    },
    planTravel: (input) => plan(input),
    travel: ({ zone, ...input }) => {
      const planned = plan(input)
      const found = requireToday(input.campaignId)
      if (!planned.arrival) throw new ApiError('NO_TODAY', 400)
      todays.set(input.campaignId, { calendarId: found.calendar.id, date: planned.arrival.date })
      if (zone) climates.set(input.campaignId, { ...climateOf(input.campaignId), zone })
      return { plan: planned, today: planned.arrival }
    },
    getCampaignActivity: ({ campaignId }) => {
      campaignOf(campaignId)
      return { since: visits.get(campaignId) ?? null, count: 0, items: [], log: [] }
    },
    markActivitySeen: ({ campaignId }) => {
      campaignOf(campaignId)
      const seenAt = new Date().toISOString()
      visits.set(campaignId, seenAt)
      return { seenAt }
    },
    setGmScreen: ({ campaignId, sceneId, columns, note, tables }) => {
      campaignOf(campaignId)
      if (!sceneId) throw new ApiError('NO_OPEN_SCENE', 400)
      const key = `${campaignId}|${sceneId}`
      const current = gmScreens.get(key) ?? {
        columns: { statblocks: true, characters: true, note: true, tables: true },
        note: null,
        tables: []
      }
      const gmScreen = {
        columns: {
          ...current.columns,
          ...Object.fromEntries(Object.entries(columns ?? {}).filter(([, on]) => on !== undefined))
        },
        note: note !== undefined ? note : current.note,
        tables: tables ?? current.tables
      }
      gmScreens.set(key, gmScreen)
      return { sceneId, gmScreen }
    },
    listRandomTables: () => ({ tables: [] }),
    setWeatherLayer: ({ campaignId, layer }) => {
      const found = todayOf(campaignId)
      const [today] = found
        ? weatherDays(campaignId, found.calendar, dayNumber(found.calendar.definition, found.today.date), 1)
        : []
      return { layer, effective: effectiveWeatherLayer(layer, today ?? null, false) }
    }
  }
  return { handlers, todays }
}
