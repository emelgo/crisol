/**
 * Las cronologías en la API en memoria de las pruebas (módulo 8): como el servidor, con el dominio para juntar sus
 * eventos (cada uno de una cronología: ADR-0032) y las páginas con fecha. Lo de los jugadores lo prueba el servidor
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
import { WORLD_COLORS } from '@crisol/contracts'
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
  | 'listCalendarEntries'
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

/** Eventos de partida para una prueba (sin chronologyId, de la primera cronología de su mundo) */
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
  /** Pone una pestaña de cronología en una página (la de la API en memoria) y devuelve su id (ADR-0031) */
  addTab?: (pageId: string, name: string) => string
  /** Quita su pestaña al borrar una cronología */
  removeTab?: (tabId: string) => void
  events?: FakeEvent[]
  chronologies?: Array<Partial<ChronologyView> & { worldId: string; name: string }>
  /** Sin chronologyId, de la primera cronología de su mundo */
  groups?: Array<{
    id?: string
    worldId: string
    chronologyId?: string
    name: string
    color?: TimelineGroupView['color']
  }>
}) {
  let last: string | null = null
  const chronologies: ChronologyRow[] = (options.chronologies ?? []).map((c) => {
    last = keyBetween(last, null)
    return {
      id: c.id ?? crypto.randomUUID(),
      worldId: c.worldId,
      name: c.name,
      // Cada una, una pestaña de una página (sin página, una nueva con su nombre: la pestaña la pone fake.ts)
      tabId: c.tabId ?? crypto.randomUUID(),
      pageId: c.pageId ?? options.createPage({ worldId: c.worldId, title: c.name, parentId: null }),
      calendarId: c.calendarId ?? null,
      filter: { ...DEFAULT_CHRONOLOGY_FILTER, ...(c.filter ?? {}) },
      version: 1,
      position: last
    }
  })
  last = null
  const firstOf = (worldId: string) => chronologies.find((c) => c.worldId === worldId)?.id ?? ''
  const groups: GroupRow[] = (options.groups ?? []).map((g) => {
    last = keyBetween(last, null)
    return {
      id: g.id ?? crypto.randomUUID(),
      worldId: g.worldId,
      chronologyId: g.chronologyId ?? firstOf(g.worldId),
      name: g.name,
      color: g.color ?? null,
      version: 1,
      position: last
    }
  })
  const events: TimelineEventView[] = (options.events ?? []).map((e) => ({
    id: e.id ?? crypto.randomUUID(),
    worldId: e.worldId,
    chronologyId: e.chronologyId ?? firstOf(e.worldId),
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
  /** Los de una cronología (o, con worldId, los de todas las de un mundo) */
  const groupsOf = (chronologyId: string) => byPosition(groups.filter((g) => g.chronologyId === chronologyId))
  const worldGroups = (worldId: string) => byPosition(groups.filter((g) => g.worldId === worldId))
  const view = ({ position: _, ...row }: ChronologyRow): ChronologyView => structuredClone(row)
  const groupView = ({ position: _, worldId: __, ...row }: GroupRow): TimelineGroupView => ({ ...row })
  const find = (id: string) => {
    const row = chronologies.find((c) => c.id === id || c.tabId === id)
    if (!row) throw new ApiError('NOT_FOUND', 404)
    return row
  }
  const findEvent = (id: string) => {
    const row = events.find((e) => e.id === id)
    if (!row) throw new ApiError('NOT_FOUND', 404)
    return row
  }
  /** Al borrar una cronología, sus eventos y sus grupos se van con ella */
  const dropContents = (chronologyId: string) => {
    for (const list of [events, groups] as Array<Array<{ chronologyId: string }>>)
      for (let i = list.length - 1; i >= 0; i--) if (list[i]?.chronologyId === chronologyId) list.splice(i, 1)
  }
  const calendarsOf = (worldId: string) => options.calendars().filter((c) => c.worldId === worldId)
  const calendarOf = (row: Pick<ChronologyRow, 'worldId' | 'calendarId'>) => {
    const all = calendarsOf(row.worldId)
    return all.find((c) => c.id === row.calendarId) ?? all.find((c) => c.primary) ?? null
  }

  /** Con id, los eventos de esa cronología; sin él (la vista grande de un calendario), los de todas */
  const entriesOf = (
    row: Pick<ChronologyRow, 'worldId' | 'calendarId' | 'filter'> & { id?: string }
  ): { entries: ChronologyEntryView[]; outside: number } => {
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
        .filter((e) => e.worldId === row.worldId && (!row.id || e.chronologyId === row.id))
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
          ...(entry.chronologyId ? { chronologyId: entry.chronologyId } : {}),
          ...(entry.pageId ? { pageId: entry.pageId } : {}),
          ...(entry.untitled ? { untitled: true as const } : {}),
          ...(entry.field ? { field: entry.field } : {}),
          ...(entry.property ? { property: entry.property } : {}),
          ...(entry.end ? { end: entry.end } : {}),
          ...(entry.yearly ? { yearly: true as const } : {}),
          ...(from
            ? {
                converted: {
                  calendarId: from.id,
                  name: from.name,
                  text: formatDateValue(from.definition, entry.original),
                  date: entry.original
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
  const groupNamed = (worldId: string, chronologyId: string, name: string) => {
    const found = groupsOf(chronologyId).find((g) => g.name.toLowerCase() === name.toLowerCase())
    if (found) return found.id
    const row: GroupRow = {
      id: crypto.randomUUID(),
      worldId,
      chronologyId,
      name,
      color: WORLD_COLORS[groupsOf(chronologyId).length % WORLD_COLORS.length] ?? null,
      version: 1,
      position: keyBetween(groupsOf(chronologyId).at(-1)?.position ?? null, null)
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
    if (input.chronologyId !== undefined && input.chronologyId !== event.chronologyId) {
      find(input.chronologyId)
      event.chronologyId = input.chronologyId
      event.groupId = null
    }
    if (input.groupId !== undefined) {
      if (input.groupId && !groupsOf(event.chronologyId).some((g) => g.id === input.groupId))
        throw new ApiError('NOT_FOUND', 404)
      event.groupId = input.groupId
    } else if (input.group !== undefined) event.groupId = groupNamed(worldId, event.chronologyId, input.group)
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
          span: first && end ? { from: first.text, to: end.text } : null,
          groups: groupsOf(row.id).map(groupView)
        }
      })
    }),
    getChronology: ({ chronologyId, tabId }) => {
      const row = find(chronologyId ?? tabId ?? '')
      const calendar = calendarOf(row)
      if (!calendar) throw new ApiError('NO_CALENDAR', 400)
      const { position: _, ...plain } = calendar
      return { chronology: view(row), calendar: plain, groups: groupsOf(row.id).map(groupView), ...entriesOf(row) }
    },
    // La vista grande de un calendario: los eventos de todas las cronologías y las páginas con fecha
    listCalendarEntries: ({ calendarId }) => {
      const calendar = options.calendars().find((c) => c.id === calendarId)
      if (!calendar) throw new ApiError('NOT_FOUND', 404)
      const all = { worldId: calendar.worldId, calendarId, filter: { ...DEFAULT_CHRONOLOGY_FILTER, pages: true } }
      return { groups: worldGroups(calendar.worldId).map(groupView), ...entriesOf(all) }
    },
    createChronology: ({ worldId, name, pageId, parentId, calendarId, filter }) => {
      if (calendarsOf(worldId).length === 0) throw new ApiError('NO_CALENDAR', 400)
      // En una página que ya hay, una pestaña más; si no, una página nueva con su pestaña «Cronología»
      const page = pageId ?? options.createPage({ worldId, title: name, parentId: parentId ?? null })
      const tabId = options.addTab?.(page, pageId ? name : 'Cronología') ?? crypto.randomUUID()
      const row: ChronologyRow = {
        id: crypto.randomUUID(),
        worldId,
        name,
        tabId,
        pageId: page,
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
    updateChronology: ({ chronologyId, name, calendarId, filter }) => {
      const row = find(chronologyId)
      if (name !== undefined) row.name = name
      if (calendarId !== undefined) row.calendarId = calendarId
      if (filter !== undefined) row.filter = { ...row.filter, ...filter }
      row.version++
      return view(row)
    },
    deleteChronology: ({ chronologyId }) => {
      const row = find(chronologyId)
      chronologies.splice(chronologies.indexOf(row), 1)
      dropContents(row.id)
      options.removeTab?.(row.tabId)
      return { id: row.id }
    },
    updateTimelineGroups: ({ chronologyId, groups: wanted }) => {
      const { worldId } = find(chronologyId)
      const kept = new Set(wanted.flatMap((g) => (g.id ? [g.id] : [])))
      for (const group of groupsOf(chronologyId))
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
            chronologyId,
            name: group.name,
            color: group.color,
            version: 1,
            position: previous
          })
      }
      return { groups: groupsOf(chronologyId).map(groupView) }
    },
    createTimelineEvents: ({ chronologyId, events: wanted }) => {
      const { worldId } = find(chronologyId)
      const created = wanted.map((input) => {
        const event: TimelineEventView = {
          id: crypto.randomUUID(),
          worldId,
          chronologyId,
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
  /** «Pestaña nueva» de tipo cronología: con el calendario principal y todo el mundo */
  const attach = (tab: { id: string; pageId: string; name: string }, worldId: string) => {
    chronologies.push({
      id: crypto.randomUUID(),
      worldId,
      name: tab.name,
      tabId: tab.id,
      pageId: tab.pageId,
      calendarId: null,
      filter: { ...DEFAULT_CHRONOLOGY_FILTER },
      version: 1,
      position: keyBetween(byPosition(chronologies).at(-1)?.position ?? null, null)
    })
  }
  /** Al quitar su pestaña, la cronología se va con ella (y sus eventos y sus grupos) */
  const detach = (tabId: string) => {
    const row = chronologies.find((c) => c.tabId === tabId)
    if (!row) return
    chronologies.splice(chronologies.indexOf(row), 1)
    dropContents(row.id)
  }
  return { handlers, events, chronologies, groups, attach, detach }
}
