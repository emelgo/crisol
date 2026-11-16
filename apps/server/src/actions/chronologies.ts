/**
 * Las cronologías de un mundo (módulo 8, capacidad `cronologias`; decisiones 4-10 de docs/specs/modulo-8.md): viven en
 * «Calendarios», con su calendario y su filtro, y juntan al leer los eventos sueltos del mundo y las páginas con fecha.
 * Las lleva el máster (page.write). Un jugador (ADR-0017) ve las que se le revelan (marca `chronology`) y, dentro, los
 * eventos que no están ocultos (o que se le revelaron) y las páginas que conoce, sin campos ocultos ni eras solo del
 * máster; un evento enlazado a una página que no conoce sale sin enlace (y sin título propio, no sale)
 */
import {
  CHRONOLOGY_LIMITS,
  type ChronologyEntryView,
  type ChronologyFilterValue,
  type ChronologyView,
  convertEventToPage,
  createChronology,
  createTimelineEvents,
  type DateValueInput,
  deleteChronology,
  deleteTimelineEvent,
  getChronology,
  listChronologies,
  type TimelineEventView,
  type TimelineGroupView,
  updateChronology,
  updateTimelineEvent,
  updateTimelineGroups
} from '@crisol/contracts'
import { calendarsRepo, chronologiesRepo, filesRepo, operation, pagesRepo, schema } from '@crisol/db'
import {
  type ChronologyEntry,
  type ChronologyEvent,
  type ChronologyFilter,
  type ChronologyPage,
  chronologyEntries,
  type DateValue,
  DEFAULT_CHRONOLOGY_FILTER,
  dateSpan,
  dateValueForm,
  dateValueProblem,
  entryOccurrences,
  formatDateValue,
  keyBetween,
  NotFoundError,
  parseDate,
  parseDateValue,
  type WorldCalendar
} from '@crisol/domain'
import type { JSONContent } from '@tiptap/core'
import { chronologiesChanged, pagesChanged } from '../realtime/events.ts'
import { stateOf } from '../wiki/content.ts'
import { worldCalendars } from '../wiki/dates.ts'
import { authorizedView, knownBySomeone, type ReadAs, type WikiView } from '../wiki/reader.ts'
import { authorizedWiki, type WikiTarget } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

/** Una propiedad tal como se guarda (solo lo que se mira de ella) */
interface StoredProperty {
  name?: unknown
  type?: unknown
  value?: unknown
  hidden?: unknown
  offTimeline?: unknown
}

const isDateValue = (value: unknown): value is DateValue =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as DateValue).calendarId === 'string' &&
  typeof (value as DateValue).start?.year === 'number'

type ChronologyRow = chronologiesRepo.ChronologyRow
type GroupRow = chronologiesRepo.TimelineGroupRow
type EventRow = chronologiesRepo.TimelineEventRow
type CalendarRow = calendarsRepo.CalendarRow

const chronologyView = (row: ChronologyRow): ChronologyView => ({
  id: row.id,
  worldId: row.worldId,
  name: row.name,
  calendarId: row.calendarId,
  filter: { ...DEFAULT_CHRONOLOGY_FILTER, ...row.filter },
  version: row.version
})

const groupView = (row: GroupRow): TimelineGroupView => ({
  id: row.id,
  name: row.name,
  color: row.color,
  version: row.version
})

/** Un evento para quien lee: a un jugador, sin la página que no conoce ni la marca de oculto */
const eventView = (row: EventRow, view: WikiView | null = null): TimelineEventView => ({
  id: row.id,
  worldId: row.worldId,
  title: row.title,
  date: row.date,
  color: row.color,
  image: row.image ?? null,
  icon: row.icon,
  description: row.description,
  groupId: row.groupId,
  pageId: row.pageId && (!view || view.seesPage(row.pageId)) ? row.pageId : null,
  hidden: view && !view.full ? false : row.hidden,
  version: row.version
})

/** El calendario de una cronología: el suyo o, sin él (o si ya no está), el principal */
const calendarOf = (rows: readonly CalendarRow[], chronology: Pick<ChronologyRow, 'calendarId'>) =>
  rows.find((row) => row.id === chronology.calendarId) ?? rows.find((row) => row.isPrimary) ?? null

/** Lo que juntan las cronologías de un mundo, con lo que ve quien lee */
async function worldData(ctx: ActionContext, worldId: string, view: WikiView) {
  const [calendarRows, groups, events, pageRows] = await Promise.all([
    calendarsRepo.listCalendars(ctx.db, worldId),
    chronologiesRepo.listGroups(ctx.db, worldId),
    chronologiesRepo.listEvents(ctx.db, worldId),
    chronologiesRepo.datedPagesOf(ctx.db, worldId)
  ])
  const calendars = worldCalendars(calendarRows, view.full)
  const seen = events.filter((event) => view.seesEvent({ id: event.id, hidden: event.hidden }))
  const heads = await chronologiesRepo.pageHeads(
    ctx.db,
    worldId,
    seen.flatMap((event) => (event.pageId ? [event.pageId] : []))
  )
  const chronologyEvents: ChronologyEvent[] = seen.map((event) => {
    const head = event.pageId && view.seesPage(event.pageId) ? heads.get(event.pageId) : undefined
    return {
      id: event.id,
      title: event.title,
      date: event.date,
      color: event.color,
      image: event.image ?? null,
      icon: event.icon,
      description: event.description,
      groupId: event.groupId,
      page: head && event.pageId ? { id: event.pageId, ...head } : null,
      hidden: view.full ? event.hidden : false
    }
  })
  const pages: ChronologyPage[] = view.pages(pageRows).flatMap((row) => {
    // Lo guardado ya se comprobó al escribirlo: aquí basta mirar su forma (sin zod: son miles)
    const properties = row.properties as StoredProperty[]
    const dates = properties.flatMap((property) =>
      property.type === 'date' &&
      isDateValue(property.value) &&
      !property.offTimeline &&
      (view.full || !property.hidden)
        ? [{ name: String(property.name ?? ''), value: property.value }]
        : []
    )
    if (dates.length === 0) return []
    const tags = properties.find((p) => p.type === 'list' && String(p.name ?? '').toLowerCase() === 'etiquetas')
    return [
      {
        id: row.id,
        title: row.title,
        icon: row.icon,
        cover: row.cover,
        templates: [...(row.template ? [row.template] : []), ...row.templateLine],
        tags: Array.isArray(tags?.value) ? tags.value.map(String) : [],
        dates
      }
    ]
  })
  return { calendarRows, calendars, groups, events: chronologyEvents, pages }
}

type WorldData = Awaited<ReturnType<typeof worldData>>

/** Las entradas de una cronología, ya para la API: con sus fechas en texto y lo convertido, de dónde viene */
function entriesOf(data: WorldData, chronology: ChronologyRow) {
  const calendar = calendarOf(data.calendarRows, chronology)
  if (!calendar)
    return { calendar: null, entries: [] as ChronologyEntryView[], raw: [] as ChronologyEntry[], outside: 0 }
  const filter: ChronologyFilter = { ...DEFAULT_CHRONOLOGY_FILTER, ...chronology.filter }
  const { entries, outside } = chronologyEntries({
    calendars: data.calendars,
    calendarId: calendar.id,
    events: data.events,
    pages: data.pages,
    filter
  })
  const seen = data.calendars.find((c) => c.id === calendar.id) as WorldCalendar
  const names = new Map(data.calendarRows.map((row) => [row.id, row.name]))
  const view = (entry: ChronologyEntry): ChronologyEntryView => {
    const value = {
      start: entry.start,
      ...(entry.end ? { end: entry.end } : {}),
      ...(entry.yearly ? { yearly: true as const } : {})
    }
    const from = entry.converted ? data.calendars.find((c) => c.id === entry.converted?.calendarId) : undefined
    const out: ChronologyEntryView = {
      key: entry.key,
      kind: entry.kind,
      title: entry.title,
      start: entry.start,
      startDay: entry.startDay,
      endDay: entry.endDay,
      text: formatDateValue(seen.definition, value),
      form: dateValueForm(seen.definition, value)
    }
    // Solo lo que tiene (son miles)
    if (entry.eventId) out.eventId = entry.eventId
    if (entry.pageId) out.pageId = entry.pageId
    if (entry.untitled) out.untitled = true
    if (entry.field) out.field = entry.field
    if (entry.property) out.property = entry.property
    if (entry.end) out.end = entry.end
    if (entry.yearly) out.yearly = true
    if (entry.converted && from)
      out.converted = {
        calendarId: from.id,
        name: names.get(from.id) ?? '',
        text: formatDateValue(from.definition, entry.original),
        date: entry.original
      }
    if (entry.color) out.color = entry.color
    if (entry.image) out.image = entry.image
    if (entry.cover) out.cover = entry.cover
    if (entry.icon) out.icon = entry.icon
    if (entry.description) out.description = entry.description
    if (entry.groupId) out.groupId = entry.groupId
    if (entry.page) out.page = entry.page
    if (entry.hidden) out.hidden = true
    return out
  }
  return { calendar, entries: entries.map(view), raw: entries, outside }
}

/** La cronología para leerla, con lo que ve quien la pide. Si no existe o no la ve (un jugador, sin su marca), 404 */
async function viewedChronology(ctx: ActionContext, chronologyId: string, as: ReadAs) {
  const chronology = chronologyId ? await chronologiesRepo.findChronology(ctx.db, chronologyId) : null
  const { wiki, view } = await authorizedView(ctx, chronology?.worldId ?? '', as)
  if (!chronology || !view.seesChronology(chronology.id)) throw new NotFoundError('chronology')
  return { chronology, wiki, view }
}

async function authorizedChronology(ctx: ActionContext, chronologyId: string) {
  const chronology = chronologyId ? await chronologiesRepo.findChronology(ctx.db, chronologyId) : null
  const wiki = await authorizedWiki(ctx, 'page.write', chronology?.worldId ?? '')
  if (!chronology) throw new NotFoundError('chronology')
  return { chronology, wiki }
}

async function authorizedEvent(ctx: ActionContext, eventId: string) {
  const event = eventId ? await chronologiesRepo.findEvent(ctx.db, eventId) : null
  const wiki = await authorizedWiki(ctx, 'page.write', event?.worldId ?? '')
  if (!event) throw new NotFoundError('event')
  return { event, wiki }
}

/** El filtro que se guarda: lo que se dé sobre lo que había, con los grupos del mundo */
function filterFrom(
  base: ChronologyFilter,
  patch: Partial<ChronologyFilterValue> | undefined,
  groups: readonly GroupRow[]
): ChronologyFilter {
  const next = { ...DEFAULT_CHRONOLOGY_FILTER, ...base, ...(patch ?? {}) }
  const known = new Set(groups.map((g) => g.id))
  const unknown = next.groups.filter((id) => !known.has(id))
  if (unknown.length > 0)
    throw new InvalidRequestError('BAD_GROUP', `no son grupos de este mundo: ${unknown.join(', ')}`)
  return {
    pages: next.pages,
    templates: [...new Set(next.templates)],
    tags: [...new Set(next.tags.map((tag) => tag.trim()).filter(Boolean))],
    groups: [...new Set(next.groups)]
  }
}

function checkCalendar(rows: readonly CalendarRow[], calendarId: string | null | undefined) {
  if (rows.length === 0)
    throw new InvalidRequestError('NO_CALENDAR', 'este mundo aún no tiene calendario: crea uno antes')
  if (calendarId && !rows.some((row) => row.id === calendarId)) throw new NotFoundError('calendar')
}

/** Lo que se escribe de una fecha (el valor o la forma de la IA) contra los calendarios del mundo; BAD_DATE si no vale */
function dateFrom(
  rows: readonly CalendarRow[],
  value: DateValueInput | string,
  calendar: string | undefined,
  label: string
): DateValue {
  const fail = (message: string): never => {
    throw new InvalidRequestError('BAD_DATE', `${label}${message}`)
  }
  if (typeof value !== 'string') {
    const row = rows.find((r) => r.id === value.calendarId)
    if (!row) return fail('su calendario no es de este mundo')
    const problem = dateValueProblem(row.definition, value)
    if (problem) return fail(problem)
    return value as DateValue
  }
  let row: CalendarRow | undefined
  if (calendar) {
    const key = calendar.trim().toLowerCase()
    row = rows.find((r) => r.id === calendar || r.name.trim().toLowerCase() === key)
    if (!row) return fail(`no hay ningún calendario «${calendar}» (${rows.map((r) => r.name).join(', ') || 'ninguno'})`)
  } else row = rows.find((r) => r.isPrimary)
  if (!row) throw new InvalidRequestError('NO_CALENDAR', 'este mundo aún no tiene calendario: crea uno antes')
  const parsed = parseDateValue(row.definition, value)
  if (!parsed.ok) return fail(parsed.message)
  return { calendarId: row.id, ...parsed.value }
}

/** El texto de una página a partir de la descripción de un evento: un párrafo por cada bloque */
function bodyOf(description: string): Uint8Array | null {
  const paragraphs = description
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (paragraphs.length === 0) return null
  const doc: JSONContent = {
    type: 'doc',
    content: paragraphs.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] }))
  }
  return stateOf(doc)
}

/** Una página del mundo a la que se enlaza (no en la papelera); 404 si no */
async function livePage(ctx: ActionContext, wiki: WikiTarget, pageId: string) {
  const page = await pagesRepo.findPage(ctx.db, pageId)
  if (!page || page.worldId !== wiki.worldId) throw new NotFoundError('page')
  return page
}

type EventPatch = Partial<
  Pick<EventRow, 'title' | 'date' | 'color' | 'image' | 'icon' | 'description' | 'groupId' | 'pageId' | 'hidden'>
>

/** Lo escrito de un evento (al crearlo o cambiarlo), comprobado: lo que va a la fila y lo que hay que crear antes */
interface WrittenEvent {
  patch: EventPatch
  /** El grupo por su nombre, si no existe aún */
  newGroup: string | null
  newPage: { title: string; parentId: string | null } | null
}

async function readEvent(
  ctx: ActionContext,
  wiki: WikiTarget,
  rows: readonly CalendarRow[],
  groups: readonly GroupRow[],
  input: {
    title?: string | undefined
    date?: DateValueInput | string | undefined
    calendar?: string | undefined
    color?: string | null | undefined
    image?: { fileId: string; x: number; y: number } | null | undefined
    icon?: string | null | undefined
    description?: string | undefined
    groupId?: string | null | undefined
    group?: string | undefined
    pageId?: string | null | undefined
    newPage?: { title: string; parentId?: string | null | undefined } | undefined
    hidden?: boolean | undefined
  },
  label: string
): Promise<WrittenEvent> {
  const patch: EventPatch = {}
  if (input.title !== undefined) patch.title = input.title.trim()
  if (input.date !== undefined) patch.date = dateFrom(rows, input.date, input.calendar, label)
  if (input.color !== undefined) patch.color = input.color
  if (input.image !== undefined) {
    // Una imagen de este mundo o una común de su organización (como las portadas)
    if (input.image) {
      const file = await filesRepo.findFile(ctx.db, input.image.fileId)
      const usable =
        file && (file.worldId ? file.worldId === wiki.worldId : file.organizationId === wiki.organizationId)
      if (!file || !usable || file.kind !== 'image')
        throw new InvalidRequestError('BAD_IMAGE', `${label}la imagen tiene que ser de los archivos del mundo`)
    }
    patch.image = input.image
  }
  if (input.icon !== undefined) patch.icon = input.icon
  if (input.description !== undefined) patch.description = input.description
  if (input.hidden !== undefined) patch.hidden = input.hidden
  let newGroup: string | null = null
  if (input.groupId !== undefined) {
    if (input.groupId && !groups.some((g) => g.id === input.groupId)) throw new NotFoundError('group')
    patch.groupId = input.groupId
  } else if (input.group !== undefined) {
    const key = input.group.trim().toLowerCase()
    const found = groups.find((g) => g.name.trim().toLowerCase() === key)
    if (found) patch.groupId = found.id
    else newGroup = input.group.trim()
  }
  if (input.pageId !== undefined) {
    if (input.pageId) await livePage(ctx, wiki, input.pageId)
    patch.pageId = input.pageId
  }
  const newPage = input.newPage ? { title: input.newPage.title.trim(), parentId: input.newPage.parentId ?? null } : null
  if (newPage?.parentId) await livePage(ctx, wiki, newPage.parentId)
  return { patch, newGroup, newPage }
}

/** Para la cola de la IA y el historial: qué cronología o evento */
export async function chronologyRequest(ctx: ActionContext, action: string, input: Record<string, unknown>) {
  if (action === 'createChronology') return { name: String(input.name ?? '') }
  if ((action === 'updateChronology' || action === 'deleteChronology') && typeof input.chronologyId === 'string') {
    const { chronology } = await authorizedChronology(ctx, input.chronologyId)
    return { name: typeof input.name === 'string' ? input.name : chronology.name }
  }
  if (action === 'createTimelineEvents' && Array.isArray(input.events)) {
    const titles = input.events.map((e) => String((e as { title?: unknown }).title ?? '')).filter(Boolean)
    return { count: input.events.length, titles: titles.slice(0, 10) }
  }
  if (
    (action === 'updateTimelineEvent' || action === 'deleteTimelineEvent' || action === 'convertEventToPage') &&
    typeof input.eventId === 'string'
  ) {
    const { event } = await authorizedEvent(ctx, input.eventId)
    return { title: await eventTitle(ctx, event) }
  }
  return {}
}

/** El título de un evento: el suyo o el de su página */
async function eventTitle(ctx: ActionContext, event: EventRow) {
  if (event.title) return event.title
  if (!event.pageId) return ''
  return (await pagesRepo.findPage(ctx.db, event.pageId))?.title ?? ''
}

/** Las veces que una entrada cae entre esos días (para buscar por intervalo) */
function touches(calendar: WorldCalendar, entry: ChronologyEntry, from: number, to: number) {
  return entryOccurrences(calendar.definition, entry, from, to).length > 0
}

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export const chronologyActions = [
  implement(listChronologies, async (ctx, { worldId, campaignId, asCharacterId }) => {
    const { view } = await authorizedView(ctx, worldId, { campaignId, asCharacterId })
    const rows = (await chronologiesRepo.listChronologies(ctx.db, worldId)).filter((row) => view.seesChronology(row.id))
    const data = await worldData(ctx, worldId, view)
    return {
      chronologies: rows.map((row) => {
        const { calendar, entries } = entriesOf(data, row)
        const first = entries[0]
        const last = entries.at(-1)
        return {
          ...chronologyView(row),
          calendarName: calendar?.name ?? null,
          entries: entries.length,
          span: first && last ? { from: first.text, to: last.text } : null
        }
      }),
      groups: data.groups.map(groupView)
    }
  }),

  implement(getChronology, async (ctx, { chronologyId, from, to, text, campaignId, asCharacterId }) => {
    const { chronology, view } = await viewedChronology(ctx, chronologyId, { campaignId, asCharacterId })
    const data = await worldData(ctx, chronology.worldId, view)
    const { calendar, entries, raw, outside } = entriesOf(data, chronology)
    if (!calendar) throw new InvalidRequestError('NO_CALENDAR', 'este mundo aún no tiene calendario: crea uno antes')
    const seen = data.calendars.find((c) => c.id === calendar.id) as WorldCalendar
    const bound = (value: string | undefined, end: boolean) => {
      if (value === undefined) return end ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
      const parsed = parseDate(seen.definition, value)
      if (!parsed.ok) throw new InvalidRequestError('BAD_DATE', parsed.message)
      const [first, last] = dateSpan(seen.definition, parsed.date)
      return end ? last : first
    }
    const fromDay = bound(from, false)
    const toDay = bound(to, true)
    const wanted = text ? fold(text) : null
    const kept = entries.filter((entry, index) => {
      const source = raw[index]
      if (!source) return false
      if ((from !== undefined || to !== undefined) && !touches(seen, source, fromDay, toDay)) return false
      if (wanted && !fold(`${entry.title} ${entry.description} ${entry.field ?? ''}`).includes(wanted)) return false
      return true
    })
    return {
      chronology: chronologyView(chronology),
      calendar: {
        id: calendar.id,
        worldId: calendar.worldId,
        name: calendar.name,
        primary: calendar.isPrimary,
        definition: seen.definition,
        version: calendar.version
      },
      groups: data.groups.map(groupView),
      entries: kept,
      outside
    }
  }),

  implement(createChronology, async (ctx, { worldId, name, calendarId, filter }) => {
    const wiki = await authorizedWiki(ctx, 'page.write', worldId)
    const [rows, calendars, groups] = await Promise.all([
      chronologiesRepo.listChronologies(ctx.db, worldId),
      calendarsRepo.listCalendars(ctx.db, worldId),
      chronologiesRepo.listGroups(ctx.db, worldId)
    ])
    if (rows.length >= CHRONOLOGY_LIMITS.chronologies)
      throw new InvalidRequestError(
        'TOO_MANY_CHRONOLOGIES',
        `un mundo tiene como mucho ${CHRONOLOGY_LIMITS.chronologies} cronologías`
      )
    checkCalendar(calendars, calendarId)
    const created = await operation(
      ctx.db,
      historyContext(ctx, 'createChronology', { name }, { organizationId: wiki.organizationId, worldId }),
      (w) =>
        w.insert(schema.chronologies, {
          worldId,
          name,
          position: keyBetween(rows.at(-1)?.position ?? null, null),
          calendarId: calendarId ?? null,
          filter: filterFrom(DEFAULT_CHRONOLOGY_FILTER, filter, groups)
        })
    )
    ctx.realtime.publish(chronologiesChanged(wiki))
    return chronologyView(created)
  }),

  implement(updateChronology, async (ctx, { chronologyId, name, calendarId, filter, after }) => {
    const { chronology, wiki } = await authorizedChronology(ctx, chronologyId)
    const patch: Partial<Pick<ChronologyRow, 'name' | 'calendarId' | 'filter' | 'position'>> = {}
    if (name !== undefined) patch.name = name
    if (calendarId !== undefined) {
      checkCalendar(await calendarsRepo.listCalendars(ctx.db, chronology.worldId), calendarId)
      patch.calendarId = calendarId
    }
    if (filter !== undefined)
      patch.filter = filterFrom(
        chronology.filter,
        filter,
        await chronologiesRepo.listGroups(ctx.db, chronology.worldId)
      )
    if (after !== undefined) {
      const others = (await chronologiesRepo.listChronologies(ctx.db, chronology.worldId)).filter(
        (row) => row.id !== chronology.id
      )
      const index = after === null ? -1 : others.findIndex((row) => row.id === after)
      if (after !== null && index < 0) throw new NotFoundError('chronology')
      patch.position = keyBetween(others[index]?.position ?? null, others[index + 1]?.position ?? null)
    }
    if (Object.keys(patch).length === 0) return chronologyView(chronology)
    const saved = await operation(
      ctx.db,
      historyContext(
        ctx,
        'updateChronology',
        {
          name: name ?? chronology.name,
          ...(name !== undefined && name !== chronology.name ? { from: chronology.name, to: name } : {}),
          ...(after !== undefined && Object.keys(patch).length === 1 ? { moved: true } : {})
        },
        { organizationId: wiki.organizationId, worldId: chronology.worldId }
      ),
      (w) => w.update(schema.chronologies, chronology.id, patch)
    )
    ctx.realtime.publish(chronologiesChanged(wiki))
    return chronologyView(saved)
  }),

  implement(deleteChronology, async (ctx, { chronologyId }) => {
    const { chronology, wiki } = await authorizedChronology(ctx, chronologyId)
    await operation(
      ctx.db,
      historyContext(
        ctx,
        'deleteChronology',
        { name: chronology.name },
        { organizationId: wiki.organizationId, worldId: chronology.worldId }
      ),
      (w) => w.remove(schema.chronologies, chronology.id)
    )
    ctx.realtime.publish(chronologiesChanged(wiki))
    return { id: chronology.id }
  }),

  implement(updateTimelineGroups, async (ctx, { worldId, groups: wanted }) => {
    const wiki = await authorizedWiki(ctx, 'page.write', worldId)
    const [current, events, chronologies] = await Promise.all([
      chronologiesRepo.listGroups(ctx.db, worldId),
      chronologiesRepo.listEvents(ctx.db, worldId),
      chronologiesRepo.listChronologies(ctx.db, worldId)
    ])
    const byId = new Map(current.map((g) => [g.id, g]))
    for (const group of wanted) if (group.id && !byId.has(group.id)) throw new NotFoundError('group')
    const kept = new Set(wanted.flatMap((g) => (g.id ? [g.id] : [])))
    const removed = current.filter((g) => !kept.has(g.id))
    const gone = new Set(removed.map((g) => g.id))
    await operation(
      ctx.db,
      historyContext(
        ctx,
        'updateTimelineGroups',
        { names: wanted.map((g) => g.name), removed: removed.map((g) => g.name) },
        { organizationId: wiki.organizationId, worldId }
      ),
      async (w) => {
        // Lo que quedaba en un grupo que se quita, sin grupo; y fuera de los filtros (deshacer lo devuelve)
        for (const event of events)
          if (event.groupId && gone.has(event.groupId))
            await w.update(schema.timelineEvents, event.id, { groupId: null })
        for (const chronology of chronologies) {
          const groups = (chronology.filter.groups ?? []).filter((id) => !gone.has(id))
          if (groups.length !== (chronology.filter.groups ?? []).length)
            await w.update(schema.chronologies, chronology.id, { filter: { ...chronology.filter, groups } })
        }
        for (const group of removed) await w.remove(schema.timelineGroups, group.id)
        let previous: string | null = null
        for (const group of wanted) {
          const own = group.id ? byId.get(group.id) : undefined
          // El orden: se conserva la clave si sigue cabiendo entre la anterior y la siguiente
          const position: string =
            own && (previous === null || own.position > previous) ? own.position : keyBetween(previous, null)
          if (own) {
            if (own.name !== group.name || own.color !== group.color || own.position !== position)
              await w.update(schema.timelineGroups, own.id, { name: group.name, color: group.color, position })
          } else await w.insert(schema.timelineGroups, { worldId, name: group.name, color: group.color, position })
          previous = position
        }
      }
    )
    ctx.realtime.publish(chronologiesChanged(wiki))
    return { groups: (await chronologiesRepo.listGroups(ctx.db, worldId)).map(groupView) }
  }),

  implement(createTimelineEvents, async (ctx, { worldId, events }) => {
    const wiki = await authorizedWiki(ctx, 'page.write', worldId)
    const [calendars, groups, existing] = await Promise.all([
      calendarsRepo.listCalendars(ctx.db, worldId),
      chronologiesRepo.listGroups(ctx.db, worldId),
      chronologiesRepo.listEvents(ctx.db, worldId)
    ])
    if (existing.length + events.length > CHRONOLOGY_LIMITS.events)
      throw new InvalidRequestError('TOO_MANY_EVENTS', `un mundo tiene como mucho ${CHRONOLOGY_LIMITS.events} eventos`)
    // Todo se lee y se comprueba antes de escribir nada
    const written: WrittenEvent[] = []
    for (const [index, event] of events.entries())
      written.push(await readEvent(ctx, wiki, calendars, groups, event, `el evento n.º ${index + 1}: `))
    const newGroups = [...new Set(written.flatMap((w) => (w.newGroup ? [w.newGroup] : [])))]
    if (groups.length + newGroups.length > CHRONOLOGY_LIMITS.groups)
      throw new InvalidRequestError('TOO_MANY_GROUPS', `un mundo tiene como mucho ${CHRONOLOGY_LIMITS.groups} grupos`)
    const hiddenUnder = new Map<string | null, boolean>()
    for (const w of written)
      if (w.newPage && !hiddenUnder.has(w.newPage.parentId))
        hiddenUnder.set(
          w.newPage.parentId,
          w.newPage.parentId ? await knownBySomeone(ctx, worldId, w.newPage.parentId) : false
        )
    const titles = events.map((e, i) => e.title?.trim() || written[i]?.newPage?.title || '').filter(Boolean)
    const created = await operation(
      ctx.db,
      historyContext(
        ctx,
        'createTimelineEvents',
        { count: events.length, titles: titles.slice(0, 10) },
        { organizationId: wiki.organizationId, worldId }
      ),
      async (w) => {
        const groupIds = new Map<string, string>()
        let last = groups.at(-1)?.position ?? null
        for (const name of newGroups) {
          last = keyBetween(last, null)
          const row = await w.insert(schema.timelineGroups, { worldId, name, color: null, position: last })
          groupIds.set(name, row.id)
        }
        const rows: EventRow[] = []
        for (const item of written) {
          let pageId = item.patch.pageId ?? null
          if (item.newPage) {
            const page = await chronologiesRepo.insertEventPage(w, {
              worldId,
              parentId: item.newPage.parentId,
              title: item.newPage.title,
              hidden: hiddenUnder.get(item.newPage.parentId) ?? false,
              actorId: ctx.actor.userId
            })
            pageId = page.id
          }
          const date = item.patch.date as DateValue
          rows.push(
            await w.insert(schema.timelineEvents, {
              worldId,
              title: item.patch.title ?? '',
              date,
              color: item.patch.color ?? null,
              image: item.patch.image ?? null,
              icon: item.patch.icon ?? null,
              description: item.patch.description ?? '',
              groupId: item.newGroup ? (groupIds.get(item.newGroup) ?? null) : (item.patch.groupId ?? null),
              pageId,
              hidden: item.patch.hidden ?? false
            })
          )
        }
        return rows
      }
    )
    ctx.realtime.publish(chronologiesChanged(wiki))
    if (written.some((w) => w.newPage)) ctx.realtime.publish(pagesChanged(wiki))
    return { events: created.map((row) => eventView(row)) }
  }),

  implement(updateTimelineEvent, async (ctx, { eventId, ...input }) => {
    const { event, wiki } = await authorizedEvent(ctx, eventId)
    const [calendars, groups] = await Promise.all([
      calendarsRepo.listCalendars(ctx.db, event.worldId),
      chronologiesRepo.listGroups(ctx.db, event.worldId)
    ])
    // Una fecha escrita sin calendario: la del suyo, si no se dice otro
    const calendar = typeof input.date === 'string' && !input.calendar ? event.date.calendarId : input.calendar
    const written = await readEvent(ctx, wiki, calendars, groups, { ...input, calendar }, '')
    if (written.newGroup && groups.length >= CHRONOLOGY_LIMITS.groups)
      throw new InvalidRequestError('TOO_MANY_GROUPS', `un mundo tiene como mucho ${CHRONOLOGY_LIMITS.groups} grupos`)
    const title = (written.patch.title ?? event.title) || written.newPage?.title || ''
    const linked = written.newPage || (written.patch.pageId !== undefined ? written.patch.pageId : event.pageId)
    if (!title && !linked) throw new InvalidRequestError('EVENT_NEEDS_TITLE', 'un título, o una página enlazada')
    const hidden = written.newPage?.parentId
      ? await knownBySomeone(ctx, event.worldId, written.newPage.parentId)
      : false
    const saved = await operation(
      ctx.db,
      historyContext(
        ctx,
        'updateTimelineEvent',
        { title: title || (await eventTitle(ctx, event)) },
        { organizationId: wiki.organizationId, worldId: event.worldId }
      ),
      async (w) => {
        const patch: EventPatch = { ...written.patch }
        if (written.newGroup) {
          const row = await w.insert(schema.timelineGroups, {
            worldId: event.worldId,
            name: written.newGroup,
            color: null,
            position: keyBetween(groups.at(-1)?.position ?? null, null)
          })
          patch.groupId = row.id
        }
        if (written.newPage) {
          const page = await chronologiesRepo.insertEventPage(w, {
            worldId: event.worldId,
            parentId: written.newPage.parentId,
            title: written.newPage.title,
            hidden,
            actorId: ctx.actor.userId
          })
          patch.pageId = page.id
        }
        return Object.keys(patch).length > 0 ? w.update(schema.timelineEvents, event.id, patch) : event
      }
    )
    ctx.realtime.publish(chronologiesChanged(wiki))
    if (written.newPage) ctx.realtime.publish(pagesChanged(wiki))
    return eventView(saved)
  }),

  implement(deleteTimelineEvent, async (ctx, { eventId }) => {
    const { event, wiki } = await authorizedEvent(ctx, eventId)
    await operation(
      ctx.db,
      historyContext(
        ctx,
        'deleteTimelineEvent',
        { title: await eventTitle(ctx, event) },
        { organizationId: wiki.organizationId, worldId: event.worldId }
      ),
      (w) => w.remove(schema.timelineEvents, event.id)
    )
    ctx.realtime.publish(chronologiesChanged(wiki))
    return { id: event.id }
  }),

  // Convertir en página: la página nace con lo del evento (título, icono, portada, texto) y el evento se queda
  // enlazado a ella, sin título propio ni descripción (se leen en la página), con su fecha, su color y su grupo
  implement(convertEventToPage, async (ctx, { eventId, parentId, title }) => {
    const { event, wiki } = await authorizedEvent(ctx, eventId)
    if (parentId) await livePage(ctx, wiki, parentId)
    const name = title?.trim() || event.title || (await eventTitle(ctx, event))
    if (!name) throw new InvalidRequestError('EVENT_NEEDS_TITLE', 'dale un título a la página')
    const hidden = parentId ? await knownBySomeone(ctx, event.worldId, parentId) : false
    const body = bodyOf(event.description)
    const { page, saved } = await operation(
      ctx.db,
      historyContext(
        ctx,
        'convertEventToPage',
        { title: name },
        { organizationId: wiki.organizationId, worldId: event.worldId }
      ),
      async (w) => {
        const page = await chronologiesRepo.insertEventPage(w, {
          worldId: event.worldId,
          parentId,
          title: name,
          icon: event.icon,
          cover: event.image ?? null,
          hidden,
          body,
          actorId: ctx.actor.userId
        })
        const saved = await w.update(schema.timelineEvents, event.id, { pageId: page.id, title: '', description: '' })
        return { page, saved }
      }
    )
    ctx.realtime.publish(chronologiesChanged(wiki))
    ctx.realtime.publish(pagesChanged(wiki))
    return { pageId: page.id, event: eventView(saved) }
  })
]
