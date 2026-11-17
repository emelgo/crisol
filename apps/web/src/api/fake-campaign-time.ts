/**
 * El tiempo de las campañas en la API en memoria de las pruebas (módulos 8 y 10 · campaña): su «hoy», como el servidor,
 * con la aritmética del dominio (sin registro ni historial)
 */
import type { CalendarView, CampaignDate } from '@crisol/contracts'
import {
  addDays,
  clampDate,
  dateForm,
  dayNumber,
  type FullDate,
  formatDate,
  parseDate,
  seasonOf,
  weekdayName
} from '@crisol/domain'
import { type ActionInput, type ActionOutput, ApiError } from './client.ts'

type Names = 'getCampaignToday' | 'setCampaignToday'

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

  const handlers: { [N in Names]: (input: ActionInput<N>) => ActionOutput<N> } = {
    getCampaignToday: ({ campaignId }) => {
      const campaign = campaignOf(campaignId)
      const found = todayOf(campaignId)
      const calendar = found?.calendar ?? options.calendars.find((c) => c.worldId === campaign.worldId && c.primary)
      return {
        today: found ? present(found.calendar, found.today.date) : null,
        suggestion: null,
        weekLength: calendar ? calendar.definition.weekdays.length || 7 : 7
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
    }
  }
  return { handlers, todays }
}
