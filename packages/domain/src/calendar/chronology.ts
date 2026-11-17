/**
 * Las cronologías de un mundo (módulo 8, capacidad `cronologias`; decisiones 4-10 de docs/specs/modulo-8.md): junta
 * los eventos sueltos y las páginas con fecha que deja pasar su filtro, en el calendario de la cronología (lo de otros
 * calendarios, convertido si tiene correspondencia; si no, fuera y contado), ordenados por el primer día que abarcan.
 * Y lo que necesitan sus vistas: las veces que cae lo que se repite, las columnas de la vista de meses y sus bandas.
 * Lo que ve cada uno (lo oculto, las páginas que no conoce) lo decide quien llama: aquí llega ya filtrado
 */
import { offsetToPrimary, type WorldCalendar } from './convert.ts'
import {
  addDays,
  addMonths,
  CalendarDateError,
  clampDate,
  dateFromDay,
  dateSpan,
  eraOfDay,
  occurrences,
  yearStart
} from './dates.ts'
import type { CalendarDefinition, WorldDate } from './definition.ts'
import { formatDate, formatYear } from './format.ts'
import type { DateValue } from './values.ts'

/** Qué deja pasar una cronología: las páginas con fecha (de esas plantillas o etiquetas) y los eventos de esos grupos */
export interface ChronologyFilter {
  /** Si salen las páginas con fecha */
  pages: boolean
  /** Solo las de estas plantillas (por su id; vacío, todas) */
  templates: string[]
  /** Solo las que llevan alguna de estas etiquetas (o una de dentro); vacío, todas */
  tags: string[]
  /** Solo los eventos de estos grupos (vacío, todos) */
  groups: string[]
}

export const DEFAULT_CHRONOLOGY_FILTER: ChronologyFilter = { pages: true, templates: [], tags: [], groups: [] }

/** La imagen de un evento: un archivo del mundo y su punto de encuadre (en %) */
export interface EventImage {
  fileId: string
  x: number
  y: number
}

/** Una página, como la enseña un evento enlazado */
export interface LinkedPage {
  id: string
  title: string
  icon: string | null
}

/** Un evento suelto, con su página enlazada ya resuelta para quien lee (null si no tiene o no la conoce) */
export interface ChronologyEvent {
  id: string
  /** El suyo; vacío, el de su página */
  title: string
  date: DateValue
  color: string | null
  image: EventImage | null
  icon: string | null
  description: string
  groupId: string | null
  page: LinkedPage | null
  hidden: boolean
}

/** Una página con fecha: sus fechas que van a las cronologías (sin las de campos fuera de ellas ni las ocultas) */
export interface ChronologyPage {
  id: string
  title: string
  icon: string | null
  cover: { fileId: string; x: number; y: number; zoom?: number | undefined } | null
  /** Su plantilla y las de las que viene */
  templates: readonly string[]
  tags: readonly string[]
  dates: ReadonlyArray<{ name: string; value: DateValue }>
}

export interface ChronologyEntry {
  /** Único en la cronología: `e:<evento>` o `p:<página>:<n.º de su fecha>` */
  key: string
  kind: 'event' | 'page'
  eventId: string | null
  /** La página de la fecha, o la enlazada al evento (si la conoce quien lee) */
  pageId: string | null
  title: string
  /** Un evento sin título propio (lleva el de su página) */
  untitled: boolean
  /** El nombre del campo, si la página tiene más de una fecha */
  field: string | null
  /** En una página con fecha, el nombre de su propiedad (para cambiarla) */
  property: string | null
  /** En el calendario de la cronología */
  start: WorldDate
  end: WorldDate | null
  yearly: boolean
  startDay: number
  endDay: number
  /** Si se convirtió desde otro calendario: cuál */
  converted: { calendarId: string } | null
  /** La fecha tal como se guardó (en su calendario) */
  original: DateValue
  color: string | null
  image: EventImage | null
  /** La portada de la página (en una página con fecha) */
  cover: ChronologyPage['cover']
  icon: string | null
  description: string
  groupId: string | null
  /** La página enlazada a un evento (en una página con fecha, null: es ella, pageId) */
  page: LinkedPage | null
  hidden: boolean
}

/** Si una página pasa el filtro: con alguna de sus plantillas y alguna de sus etiquetas (o una de dentro) */
function pagePasses(page: ChronologyPage, filter: ChronologyFilter): boolean {
  if (!filter.pages) return false
  if (filter.templates.length > 0 && !page.templates.some((t) => filter.templates.includes(t))) return false
  if (filter.tags.length === 0) return true
  const wanted = filter.tags.map((tag) => tag.toLowerCase())
  return page.tags.some((tag) => {
    const own = tag.toLowerCase()
    return wanted.some((w) => own === w || own.startsWith(`${w}/`))
  })
}

const eventPasses = (event: ChronologyEvent, filter: ChronologyFilter) =>
  filter.groups.length === 0 || (event.groupId !== null && filter.groups.includes(event.groupId))

interface Placed {
  start: WorldDate
  end: WorldDate | null
  yearly: boolean
  startDay: number
  endDay: number
  converted: { calendarId: string } | null
}

/**
 * Una fecha en el calendario de la cronología: tal cual si es del suyo; convertida (en días, sin repetir) si su
 * calendario tiene correspondencia (shift: lo que hay que sumar a sus días); null si no se puede (otro calendario sin
 * ella, o ya no cabe en el suyo)
 */
function place(
  from: WorldCalendar | undefined,
  target: WorldCalendar,
  shift: number | null,
  value: DateValue
): Placed | null {
  if (!from) return null
  try {
    const [first, ownLast] = dateSpan(from.definition, value.start)
    const last = value.end ? dateSpan(from.definition, value.end)[1] : ownLast
    if (from.id === target.id)
      return {
        start: value.start,
        end: value.end ?? null,
        yearly: value.yearly === true,
        startDay: first,
        endDay: last,
        converted: null
      }
    if (shift === null) return null
    const startDay = first + shift
    const endDay = last + shift
    return {
      start: dateFromDay(target.definition, startDay),
      end: endDay !== startDay ? dateFromDay(target.definition, endDay) : null,
      yearly: false,
      startDay,
      endDay,
      converted: { calendarId: value.calendarId }
    }
  } catch (error) {
    if (error instanceof CalendarDateError) return null
    throw error
  }
}

/**
 * Las entradas de una cronología, en orden, y cuántas fechas quedan fuera (de otro calendario sin correspondencia, o
 * que ya no caben en el suyo)
 */
export function chronologyEntries(input: {
  calendars: readonly WorldCalendar[]
  calendarId: string
  events: readonly ChronologyEvent[]
  pages: readonly ChronologyPage[]
  filter: ChronologyFilter
}): { entries: ChronologyEntry[]; outside: number } {
  const target = input.calendars.find((c) => c.id === input.calendarId)
  if (!target) return { entries: [], outside: 0 }
  // El desfase de cada calendario con el de la cronología (por el principal), una vez
  const byId = new Map(input.calendars.map((c) => [c.id, c]))
  const targetOffset = offsetToPrimary(input.calendars, target.id)
  const shifts = new Map(
    input.calendars.map((c) => {
      const own = c.id === target.id ? 0 : offsetToPrimary(input.calendars, c.id)
      return [c.id, own === null || targetOffset === null ? null : own - targetOffset] as const
    })
  )
  const placeIn = (value: DateValue) =>
    place(byId.get(value.calendarId), target, shifts.get(value.calendarId) ?? null, value)
  const entries: ChronologyEntry[] = []
  let outside = 0
  for (const event of input.events) {
    if (!eventPasses(event, input.filter)) continue
    const title = event.title.trim() || event.page?.title || ''
    if (!title) continue
    const placed = placeIn(event.date)
    if (!placed) {
      outside++
      continue
    }
    entries.push({
      key: `e:${event.id}`,
      kind: 'event',
      eventId: event.id,
      pageId: event.page?.id ?? null,
      title,
      untitled: !event.title.trim(),
      field: null,
      property: null,
      ...placed,
      original: event.date,
      color: event.color,
      image: event.image,
      cover: null,
      icon: event.icon,
      description: event.description,
      groupId: event.groupId,
      page: event.page,
      hidden: event.hidden
    })
  }
  for (const page of input.pages) {
    if (!pagePasses(page, input.filter)) continue
    const many = page.dates.length > 1
    page.dates.forEach((date, index) => {
      const placed = placeIn(date.value)
      if (!placed) {
        outside++
        return
      }
      entries.push({
        key: `p:${page.id}:${index}`,
        kind: 'page',
        eventId: null,
        pageId: page.id,
        title: page.title,
        untitled: false,
        field: many ? date.name : null,
        property: date.name,
        ...placed,
        original: date.value,
        color: null,
        image: null,
        cover: page.cover,
        icon: page.icon,
        description: '',
        groupId: null,
        page: null,
        hidden: false
      })
    })
  }
  const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })
  entries.sort((a, b) => a.startDay - b.startDay || collator.compare(a.title, b.title) || a.key.localeCompare(b.key))
  return { entries, outside }
}

export interface Occurrence {
  start: WorldDate
  end: WorldDate | null
  startDay: number
  endDay: number
}

/** Las veces que cae una entrada entre esos días: una por año si se repite; si no, la suya si los toca */
export function entryOccurrences(
  def: CalendarDefinition,
  entry: {
    start: WorldDate
    end?: WorldDate | null | undefined
    yearly?: boolean | undefined
    startDay: number
    endDay: number
  },
  from: number,
  to: number
): Occurrence[] {
  if (!entry.yearly) {
    return entry.startDay <= to && entry.endDay >= from
      ? [{ start: entry.start, end: entry.end ?? null, startDay: entry.startDay, endDay: entry.endDay }]
      : []
  }
  try {
    return occurrences(def, { start: entry.start, end: entry.end, yearly: true }, from, to).map((o) => ({
      start: o.start,
      end: o.end,
      startDay: dateSpan(def, o.start)[0],
      endDay: dateSpan(def, o.end ?? o.start)[1]
    }))
  } catch (error) {
    if (error instanceof CalendarDateError) return []
    throw error
  }
}

export type TimeZoom = 'years' | 'months' | 'days'

/** Una columna de la vista de meses: los días que abarca (el último incluido) y lo que dice */
export interface TimeColumn {
  key: string
  start: number
  end: number
  label: string
  year: number
  /** Una festividad (más estrecha) */
  festival: boolean
  color: string | null
}

/** Cuántas columnas se generan como mucho de una vez (la ventana crece al desplazarse) */
const MAX_COLUMNS = 4000

/** Las columnas que tocan los días [from, to] en ese zoom: un año, un mes (o festividad) o un día */
export function timeColumns(def: CalendarDefinition, zoom: TimeZoom, from: number, to: number): TimeColumn[] {
  const columns: TimeColumn[] = []
  const first = dateFromDay(def, from)
  if (zoom === 'years') {
    for (let year = first.year; columns.length < MAX_COLUMNS; year++) {
      const start = yearStart(def, year)
      if (start > to) break
      columns.push({
        key: `y${year}`,
        start,
        end: yearStart(def, year + 1) - 1,
        label: String(year),
        year,
        festival: false,
        color: null
      })
    }
    return columns
  }
  if (zoom === 'months') {
    let start = from - (first.day - 1)
    let year = first.year
    let index = def.months.findIndex((m) => m.id === first.month)
    while (start <= to && columns.length < MAX_COLUMNS && index >= 0) {
      const month = def.months[index]
      if (!month) break
      const [, last] = dateSpan(def, { year, month: month.id })
      columns.push({
        key: `m${year}:${month.id}`,
        start,
        end: last,
        label: month.name,
        year,
        festival: month.festival === true,
        color: month.color ?? null
      })
      start = last + 1
      index++
      if (index >= def.months.length) {
        index = 0
        year++
      }
    }
    return columns
  }
  for (let day = from; day <= to && columns.length < MAX_COLUMNS; day++) {
    const date = dateFromDay(def, day)
    const month = def.months.find((m) => m.id === date.month)
    columns.push({
      key: `d${day}`,
      start: day,
      end: day,
      label: String(date.day),
      year: date.year,
      festival: month?.festival === true,
      color: month?.color ?? null
    })
  }
  return columns
}

/** Una banda sobre las columnas: el año (en meses), el mes (en días) o la era (en años); '' si no hay */
export interface TimeBand {
  key: string
  label: string
  /** Cuántas columnas abarca */
  span: number
}

export function timeBands(def: CalendarDefinition, zoom: TimeZoom, columns: readonly TimeColumn[]): TimeBand[] {
  const bands: TimeBand[] = []
  const labelOf = (column: TimeColumn): [string, string] => {
    if (zoom === 'months') return [`y${column.year}`, formatYear(def, column.year, { year: column.year })]
    if (zoom === 'days') {
      const date = dateFromDay(def, column.start)
      return [`m${date.year}:${date.month}`, formatDate(def, { year: date.year, month: date.month })]
    }
    const era = eraOfDay(def, column.start)
    return [`e${era?.id ?? ''}`, era?.name ?? '']
  }
  for (const column of columns) {
    const [key, label] = labelOf(column)
    const last = bands.at(-1)
    if (last && last.key === key) last.span++
    else bands.push({ key, label, span: 1 })
  }
  return bands
}

/**
 * Reparte lo que se pinta en filas sin que se monte nada: cada cosa va en la primera fila donde lo anterior ya acabó
 * (en su orden; el fin, incluido)
 */
export function packRows(items: ReadonlyArray<{ start: number; end: number }>): number[] {
  const rowEnds: number[] = []
  return items.map((item) => {
    let row = rowEnds.findIndex((end) => end < item.start)
    if (row < 0) row = rowEnds.length
    rowEnds[row] = item.end
    return row
  })
}

/**
 * Una fecha movida en el tiempo (al arrastrarla en las vistas): por días (solo las de día), por meses (contando todas
 * las posiciones del año; una de mes, a otro mes) o por años; el fin se mueve igual. Lo que no tiene esa precisión no
 * se mueve (null)
 */
export function shiftDate(
  def: CalendarDefinition,
  value: { start: WorldDate; end?: WorldDate | undefined; yearly?: true | undefined },
  unit: 'days' | 'months' | 'years',
  steps: number
): { start: WorldDate; end?: WorldDate; yearly?: true } | null {
  if (steps === 0) return null
  const move = (date: WorldDate): WorldDate | null => {
    if (unit === 'years') return clampDate(def, { ...date, year: date.year + steps })
    if (date.month === undefined) return null
    if (unit === 'months') {
      const moved = addMonths(def, { year: date.year, month: date.month, day: date.day ?? 1 }, steps)
      return date.day === undefined ? { year: moved.year, month: moved.month } : moved
    }
    return date.day === undefined ? null : addDays(def, date, steps)
  }
  try {
    const start = move(value.start)
    const end = value.end ? move(value.end) : undefined
    if (!start || end === null) return null
    return { start, ...(end ? { end } : {}), ...(value.yearly ? { yearly: true as const } : {}) }
  } catch (error) {
    if (error instanceof CalendarDateError) return null
    throw error
  }
}
