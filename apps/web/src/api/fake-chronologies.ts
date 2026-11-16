/**
 * Las cronologías en la API en memoria de las pruebas (módulo 8): como el servidor, con el dominio para juntar los
 * eventos y las páginas con fecha. Lo de los jugadores (lo que ve cada campaña) lo prueba el servidor
 */
import type {
  CalendarView,
  ChronologyEntryView,
  ChronologyView,
  DateValueInput,
  PageProperty,
  TimelineEventView,
  TimelineGroupView
} from '@crisol/contracts'
import {
  type ChronologyFilter,
  chronologyEntries,
  type DateValue,
  DEFAULT_CHRONOLOGY_FILTER,
  dateValueForm,
  dateValueProblem,
  formatDateValue,
  keyBetween,
  parseDateValue
} from '@crisol/domain'
import { type ActionInput, type ActionOutput, ApiError } from './client.ts'

type Names =
  | 'listChronologies'
  | 'getChronology'
  | 'createChronology'
  | 'updateChronology'
  | 'deleteChronology'
  | 'updateTimelineGroups'
  | 'createTimelineEvents'
  | 'updateTimelineEvent'
  | 'deleteTimelineEvent'
  | 'convertEventToPage'

/** Una página del mundo, como la guarda la API en memoria (lo que miran las cronologías) */
export interface FakeDatedPage {
  id: string
  worldId: string
  title: string
  icon: string | null
  properties: PageProperty[]
  template?: string | null
  cover?: { fileId: string; x: number; y: number; zoom?: number } | null
}

/** Eventos de partida para una prueba */
export type FakeEvent = Partial<Omit<TimelineEventView, 'date'>> & { worldId: string; title: string; date: DateValue }

type ChronologyRow = ChronologyView & { position: string }
type GroupRow = TimelineGroupView & { worldId: string; position: string }

export function fakeChronologies(options: {
  calendars: () => Array<CalendarView & { position: string }>
  pages: () => FakeDatedPage[]
  /** Crea una página (para enlazar un evento o convertirlo) y devuelve su id */
  createPage: (input: {
    worldId: string
    title: string
    parentId: string | null
    icon?: string | null
    cover?: { fileId: string; x: number; y: number } | null
  }) => string
  events?: FakeEvent[]
  chronologies?: Array<Partial<ChronologyView> & { worldId: string; name: string }>
  groups?: Array<{ id?: string; worldId: string; name: string; color?: TimelineGroupView['color'] }>
}) {
  let last: string | null = null
  const chronologies: ChronologyRow[] = (options.chronologies ?? []).map((c) => {
    last = keyBetween(last, null)
    return {
      id: c.id ?? crypto.randomUUID(),
      worldId: c.worldId,
      name: c.name,
      calendarId: c.calendarId ?? null,
      filter: { ...DEFAULT_CHRONOLOGY_FILTER, ...(c.filter ?? {}) },
      version: 1,
      position: last
    }
  })
  last = null
  const groups: GroupRow[] = (options.groups ?? []).map((g) => {
    last = keyBetween(last, null)
    return {
      id: g.id ?? crypto.randomUUID(),
      worldId: g.worldId,
      name: g.name,
      color: g.color ?? null,
      version: 1,
      position: last
    }
  })
  const events: TimelineEventView[] = (options.events ?? []).map((e) => ({
    id: e.id ?? crypto.randomUUID(),
    worldId: e.worldId,
    title: e.title,
    date: e.date,
    color: e.color ?? null,
    image: e.image ?? null,
    icon: e.icon ?? null,
    description: e.description ?? '',
    groupId: e.groupId ?? null,
    pageId: e.pageId ?? null,
    hidden: e.hidden ?? false,
    version: 1
  }))

  const byPosition = <T extends { position: string }>(rows: T[]) =>
    [...rows].sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0))
  const groupsOf = (worldId: string) => byPosition(groups.filter((g) => g.worldId === worldId))
  const view = ({ position: _, ...row }: ChronologyRow): ChronologyView => structuredClone(row)
  const groupView = ({ position: _, worldId: __, ...row }: GroupRow): TimelineGroupView => ({ ...row })
  const find = (id: string) => {
    const row = chronologies.find((c) => c.id === id)
    if (!row) throw new ApiError('NOT_FOUND', 404)
    return row
  }
  const findEvent = (id: string) => {
    const row = events.find((e) => e.id === id)
    if (!row) throw new ApiError('NOT_FOUND', 404)
    return row
  }
  const calendarsOf = (worldId: string) => options.calendars().filter((c) => c.worldId === worldId)
  const calendarOf = (row: ChronologyRow) => {
    const all = calendarsOf(row.worldId)
    return all.find((c) => c.id === row.calendarId) ?? all.find((c) => c.primary) ?? null
  }

  const entriesOf = (row: ChronologyRow): { entries: ChronologyEntryView[]; outside: number } => {
    const calendar = calendarOf(row)
    if (!calendar) return { entries: [], outside: 0 }
    const worldCalendars = calendarsOf(row.worldId).map((c) => ({
      id: c.id,
      primary: c.primary,
      definition: c.definition
    }))
    const pages = options.pages().filter((p) => p.worldId === row.worldId)
    const titleOf = new Map(pages.map((p) => [p.id, p]))
    const { entries, outside } = chronologyEntries({
      calendars: worldCalendars,
      calendarId: calendar.id,
      filter: row.filter as ChronologyFilter,
      events: events
        .filter((e) => e.worldId === row.worldId)
        .map((e) => {
          const page = e.pageId ? titleOf.get(e.pageId) : undefined
          return { ...e, page: page ? { id: page.id, title: page.title, icon: page.icon } : null }
        }),
      pages: pages.flatMap((p) => {
        const dates = p.properties.flatMap((property) =>
          property.type === 'date' && property.value && !property.offTimeline
            ? [{ name: property.name, value: property.value as DateValue }]
            : []
        )
        const tags = p.properties.find((property) => property.name.toLowerCase() === 'etiquetas')
        return dates.length === 0
          ? []
          : [
              {
                id: p.id,
                title: p.title,
                icon: p.icon,
                cover: p.cover ?? null,
                templates: p.template ? [p.template] : [],
                tags: tags?.type === 'list' ? tags.value : [],
                dates
              }
            ]
      })
    })
    const names = new Map(calendarsOf(row.worldId).map((c) => [c.id, c]))
    return {
      outside,
      entries: entries.map((entry) => {
        const value = {
          start: entry.start,
          ...(entry.end ? { end: entry.end } : {}),
          ...(entry.yearly ? { yearly: true as const } : {})
        }
        const from = entry.converted ? names.get(entry.converted.calendarId) : undefined
        return {
          key: entry.key,
          kind: entry.kind,
          title: entry.title,
          start: entry.start,
          startDay: entry.startDay,
          endDay: entry.endDay,
          text: formatDateValue(calendar.definition, value),
          form: dateValueForm(calendar.definition, value),
          ...(entry.eventId ? { eventId: entry.eventId } : {}),
          ...(entry.pageId ? { pageId: entry.pageId } : {}),
          ...(entry.field ? { field: entry.field } : {}),
          ...(entry.end ? { end: entry.end } : {}),
          ...(entry.yearly ? { yearly: true as const } : {}),
          ...(from
            ? {
                converted: {
                  calendarId: from.id,
                  name: from.name,
                  text: formatDateValue(from.definition, entry.original)
                }
              }
            : {}),
          ...(entry.color ? { color: entry.color } : {}),
          ...(entry.image ? { image: entry.image } : {}),
          ...(entry.cover ? { cover: entry.cover } : {}),
          ...(entry.icon ? { icon: entry.icon } : {}),
          ...(entry.description ? { description: entry.description } : {}),
          ...(entry.groupId ? { groupId: entry.groupId } : {}),
          ...(entry.page ? { page: entry.page } : {}),
          ...(entry.hidden ? { hidden: true as const } : {})
        }
      })
    }
  }

  /** Una fecha escrita (el valor o la forma de la IA) contra los calendarios del mundo */
  const dateFrom = (worldId: string, value: DateValueInput | string, calendar?: string): DateValue => {
    const all = calendarsOf(worldId)
    if (typeof value !== 'string') {
      const row = all.find((c) => c.id === value.calendarId)
      if (!row || dateValueProblem(row.definition, value)) throw new ApiError('BAD_DATE', 400)
      return value as DateValue
    }
    const row = calendar ? all.find((c) => c.id === calendar || c.name === calendar) : all.find((c) => c.primary)
    if (!row) throw new ApiError('NO_CALENDAR', 400)
    const parsed = parseDateValue(row.definition, value)
    if (!parsed.ok) throw new ApiError('BAD_DATE', 400)
    return { calendarId: row.id, ...parsed.value }
  }
  const groupNamed = (worldId: string, name: string) => {
    const found = groupsOf(worldId).find((g) => g.name.toLowerCase() === name.toLowerCase())
    if (found) return found.id
    const row: GroupRow = {
      id: crypto.randomUUID(),
      worldId,
      name,
      color: null,
      version: 1,
      position: keyBetween(groupsOf(worldId).at(-1)?.position ?? null, null)
    }
    groups.push(row)
    return row.id
  }

  type EventInput = Partial<ActionInput<'updateTimelineEvent'>> & { title?: string | undefined }
  const apply = (worldId: string, event: TimelineEventView, input: EventInput) => {
    if (input.title !== undefined) event.title = input.title.trim()
    if (input.date !== undefined)
      event.date = dateFrom(
        worldId,
        input.date,
        typeof input.date === 'string' ? (input.calendar ?? event.date.calendarId) : undefined
      )
    if (input.color !== undefined) event.color = input.color
    if (input.image !== undefined) event.image = input.image
    if (input.icon !== undefined) event.icon = input.icon
    if (input.description !== undefined) event.description = input.description
    if (input.hidden !== undefined) event.hidden = input.hidden
    if (input.groupId !== undefined) event.groupId = input.groupId
    else if (input.group !== undefined) event.groupId = groupNamed(worldId, input.group)
    if (input.pageId !== undefined) event.pageId = input.pageId
    if (input.newPage)
      event.pageId = options.createPage({
        worldId,
        title: input.newPage.title,
        parentId: input.newPage.parentId ?? null
      })
  }

  const handlers: { [N in Names]: (input: ActionInput<N>) => ActionOutput<N> } = {
    listChronologies: ({ worldId }) => ({
      chronologies: byPosition(chronologies.filter((c) => c.worldId === worldId)).map((row) => {
        const { entries } = entriesOf(row)
        const first = entries[0]
        const end = entries.at(-1)
        return {
          ...view(row),
          calendarName: calendarOf(row)?.name ?? null,
          entries: entries.length,
          span: first && end ? { from: first.text, to: end.text } : null
        }
      }),
      groups: groupsOf(worldId).map(groupView)
    }),
    getChronology: ({ chronologyId }) => {
      const row = find(chronologyId)
      const calendar = calendarOf(row)
      if (!calendar) throw new ApiError('NO_CALENDAR', 400)
      const { position: _, ...plain } = calendar
      return { chronology: view(row), calendar: plain, groups: groupsOf(row.worldId).map(groupView), ...entriesOf(row) }
    },
    createChronology: ({ worldId, name, calendarId, filter }) => {
      if (calendarsOf(worldId).length === 0) throw new ApiError('NO_CALENDAR', 400)
      const row: ChronologyRow = {
        id: crypto.randomUUID(),
        worldId,
        name,
        calendarId: calendarId ?? null,
        filter: { ...DEFAULT_CHRONOLOGY_FILTER, ...(filter ?? {}) },
        version: 1,
        position: keyBetween(
          byPosition(chronologies.filter((c) => c.worldId === worldId)).at(-1)?.position ?? null,
          null
        )
      }
      chronologies.push(row)
      return view(row)
    },
    updateChronology: ({ chronologyId, name, calendarId, filter, after }) => {
      const row = find(chronologyId)
      if (name !== undefined) row.name = name
      if (calendarId !== undefined) row.calendarId = calendarId
      if (filter !== undefined) row.filter = { ...row.filter, ...filter }
      if (after !== undefined) {
        const others = byPosition(chronologies.filter((c) => c.worldId === row.worldId && c.id !== row.id))
        const index = after === null ? -1 : others.findIndex((c) => c.id === after)
        row.position = keyBetween(others[index]?.position ?? null, others[index + 1]?.position ?? null)
      }
      row.version++
      return view(row)
    },
    deleteChronology: ({ chronologyId }) => {
      const row = find(chronologyId)
      chronologies.splice(chronologies.indexOf(row), 1)
      return { id: row.id }
    },
    updateTimelineGroups: ({ worldId, groups: wanted }) => {
      const kept = new Set(wanted.flatMap((g) => (g.id ? [g.id] : [])))
      for (const group of groupsOf(worldId))
        if (!kept.has(group.id)) {
          groups.splice(groups.indexOf(group), 1)
          for (const event of events) if (event.groupId === group.id) event.groupId = null
        }
      let previous: string | null = null
      for (const group of wanted) {
        previous = keyBetween(previous, null)
        const own = group.id ? groups.find((g) => g.id === group.id) : undefined
        if (own)
          Object.assign(own, { name: group.name, color: group.color, position: previous, version: own.version + 1 })
        else
          groups.push({
            id: crypto.randomUUID(),
            worldId,
            name: group.name,
            color: group.color,
            version: 1,
            position: previous
          })
      }
      return { groups: groupsOf(worldId).map(groupView) }
    },
    createTimelineEvents: ({ worldId, events: wanted }) => {
      const created = wanted.map((input) => {
        const event: TimelineEventView = {
          id: crypto.randomUUID(),
          worldId,
          title: '',
          date: dateFrom(worldId, input.date, input.calendar),
          color: null,
          image: null,
          icon: null,
          description: '',
          groupId: null,
          pageId: null,
          hidden: false,
          version: 1
        }
        apply(worldId, event, { ...input, date: undefined })
        return event
      })
      events.push(...created)
      return { events: created.map((e) => structuredClone(e)) }
    },
    updateTimelineEvent: ({ eventId, ...input }) => {
      const event = findEvent(eventId)
      apply(event.worldId, event, input)
      event.version++
      return structuredClone(event)
    },
    deleteTimelineEvent: ({ eventId }) => {
      const event = findEvent(eventId)
      events.splice(events.indexOf(event), 1)
      return { id: event.id }
    },
    convertEventToPage: ({ eventId, parentId, title }) => {
      const event = findEvent(eventId)
      const pageId = options.createPage({
        worldId: event.worldId,
        title: title ?? event.title,
        parentId,
        icon: event.icon,
        cover: event.image
      })
      Object.assign(event, { pageId, title: '', description: '', version: event.version + 1 })
      return { pageId, event: structuredClone(event) }
    }
  }
  return { handlers, events, chronologies, groups }
}
