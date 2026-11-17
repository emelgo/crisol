/** Los calendarios en la API en memoria de las pruebas (módulo 8): como el servidor, con la aritmética del dominio */
import type { CalendarView } from '@crisol/contracts'
import {
  addDays,
  blankCalendar,
  type CalendarDefinition,
  convertDate as convertBetween,
  copyCalendar,
  dateForm,
  dayNumber,
  describeDate as describeIn,
  formatRange,
  gregorianCalendar,
  invertedCorrespondence,
  keyBetween,
  monthNumber,
  normalizeCalendar,
  offsetToPrimary,
  parseDate,
  validateCalendar,
  yearLength
} from '@crisol/domain'
import { type ActionInput, type ActionOutput, ApiError } from './client.ts'

type Row = CalendarView & { position: string }
type Names =
  | 'listCalendars'
  | 'getCalendar'
  | 'createCalendar'
  | 'updateCalendar'
  | 'deleteCalendar'
  | 'describeDate'
  | 'convertDate'

/** Calendarios de partida para una prueba: el mundo, el nombre y su definición (el primero de cada mundo, principal) */
export interface FakeCalendar {
  id?: string
  worldId: string
  name: string
  primary?: boolean
  definition: CalendarDefinition
}

export function fakeCalendars(initial: readonly FakeCalendar[] = []) {
  const rows: Row[] = []
  let last: string | null = null
  for (const c of initial) {
    last = keyBetween(last, null)
    const first = !rows.some((r) => r.worldId === c.worldId)
    rows.push({
      id: c.id ?? crypto.randomUUID(),
      worldId: c.worldId,
      name: c.name,
      primary: c.primary ?? first,
      definition: structuredClone(c.definition),
      version: 1,
      position: last
    })
  }
  const ofWorld = (worldId: string) =>
    rows.filter((r) => r.worldId === worldId).sort((a, b) => (a.position < b.position ? -1 : 1))
  const find = (id: string) => {
    const row = rows.find((r) => r.id === id)
    if (!row) throw new ApiError('NOT_FOUND', 404)
    return row
  }
  const view = ({ position: _, ...row }: Row): CalendarView => structuredClone(row)
  const asWorld = (worldId: string) =>
    ofWorld(worldId).map((r) => ({ id: r.id, primary: r.primary, definition: r.definition }))
  const written = (input: Parameters<typeof normalizeCalendar>[0], others: Row[], primary: boolean) => {
    const { definition, problems } = normalizeCalendar(primary ? { ...input, correspondence: null } : input, {
      calendars: others.map((r) => ({ id: r.id, definition: r.definition })),
      primaryId: others.find((r) => r.primary)?.id ?? null
    })
    const anchor = definition.correspondence
      ? { anchor: others.find((r) => r.id === definition.correspondence?.calendarId)?.definition ?? null }
      : {}
    if ([...problems, ...validateCalendar(definition, anchor)].length > 0) throw new ApiError('BAD_CALENDAR', 400)
    return definition
  }
  const dateIn = (definition: CalendarDefinition, value: ActionInput<'describeDate'>['date']) => {
    const parsed = parseDate(
      definition,
      typeof value === 'string'
        ? value
        : {
            year: value.year,
            ...(value.month === undefined ? {} : { month: String(value.month) }),
            ...(value.day ? { day: value.day } : {})
          }
    )
    if (!parsed.ok) throw new ApiError('BAD_DATE', 400)
    return parsed.date
  }

  const handlers: { [N in Names]: (input: ActionInput<N>) => ActionOutput<N> } = {
    listCalendars: ({ worldId }) => ({ calendars: ofWorld(worldId).map(view) }),
    getCalendar: ({ calendarId }) => {
      const row = find(calendarId)
      return {
        calendar: view(row),
        months: row.definition.months.map((m) => ({
          id: m.id,
          name: m.name,
          number: monthNumber(row.definition, m.id),
          days: m.days,
          festival: !!m.festival,
          outsideWeek: !!m.outsideWeek
        })),
        yearLength: yearLength(row.definition),
        leapYearLength: null,
        convertible: offsetToPrimary(asWorld(row.worldId), row.id) !== null
      }
    },
    createCalendar: ({ worldId, name, from = 'blank' }) => {
      const others = ofWorld(worldId)
      const primary = others.length === 0
      const definition =
        from === 'blank'
          ? blankCalendar()
          : from === 'gregorian'
            ? gregorianCalendar()
            : 'copyOf' in from
              ? copyCalendar(find(from.copyOf).definition)
              : written(from.definition, others, primary)
      const row: Row = {
        id: crypto.randomUUID(),
        worldId,
        name,
        primary,
        definition,
        version: 1,
        position: keyBetween(others.at(-1)?.position ?? null, null)
      }
      rows.push(row)
      return view(row)
    },
    updateCalendar: ({ calendarId, version, name, primary, after, definition }) => {
      const row = find(calendarId)
      if (version !== undefined && version !== row.version) throw new ApiError('CALENDAR_CHANGED', 400)
      const others = ofWorld(row.worldId).filter((r) => r.id !== row.id)
      const becomes = primary === true && !row.primary
      if (definition) row.definition = written(definition, others, row.primary || becomes)
      if (name !== undefined) row.name = name
      if (after !== undefined) {
        const index = after === null ? -1 : others.findIndex((r) => r.id === after)
        row.position = keyBetween(others[index]?.position ?? null, others[index + 1]?.position ?? null)
      }
      if (becomes) {
        const previous = others.find((r) => r.primary)
        if (previous) {
          const inverse = invertedCorrespondence(
            { id: previous.id, primary: true, definition: previous.definition },
            { id: row.id, primary: false, definition: row.definition }
          )
          previous.primary = false
          if (inverse) previous.definition = { ...previous.definition, correspondence: inverse }
          previous.version++
        }
        row.primary = true
        row.definition = { ...row.definition, correspondence: null }
      }
      row.version++
      return view(row)
    },
    deleteCalendar: ({ calendarId }) => {
      const row = find(calendarId)
      if (row.primary && ofWorld(row.worldId).length > 1) throw new ApiError('CALENDAR_IS_PRIMARY', 400)
      for (const other of rows)
        if (other.definition.correspondence?.calendarId === row.id)
          other.definition = { ...other.definition, correspondence: null }
      rows.splice(rows.indexOf(row), 1)
      return { id: row.id }
    },
    describeDate: (input) => {
      const row = input.calendarId ? find(input.calendarId) : ofWorld(input.worldId ?? '').find((r) => r.primary)
      if (!row) throw new ApiError('NO_CALENDAR', 400)
      const date = dateIn(row.definition, input.date)
      const target = ofWorld(row.worldId).find((r) => r.primary)
      const converted = target && !row.primary ? convertBetween(asWorld(row.worldId), row.id, target.id, date) : null
      return {
        calendarId: row.id,
        calendar: row.name,
        date: describeIn(row.definition, date),
        primary:
          target && converted
            ? {
                calendarId: target.id,
                name: target.name,
                text: formatRange(target.definition, converted.start, converted.end),
                form: dateForm(target.definition, converted.start)
              }
            : null,
        added:
          input.addDays === undefined ? null : describeIn(row.definition, addDays(row.definition, date, input.addDays)),
        daysUntil:
          input.until === undefined
            ? null
            : dayNumber(row.definition, dateIn(row.definition, input.until)) - dayNumber(row.definition, date)
      }
    },
    convertDate: ({ calendarId, to, date: value }) => {
      const row = find(calendarId)
      const target = find(to)
      const date = dateIn(row.definition, value)
      const converted = convertBetween(asWorld(row.worldId), row.id, target.id, date)
      if (!converted) throw new ApiError('CALENDAR_NOT_CONVERTIBLE', 400)
      return {
        from: formatRange(row.definition, date, null),
        to: {
          calendarId: target.id,
          name: target.name,
          text: formatRange(target.definition, converted.start, converted.end),
          form: dateForm(target.definition, converted.start)
        }
      }
    }
  }
  return { handlers, rows }
}
