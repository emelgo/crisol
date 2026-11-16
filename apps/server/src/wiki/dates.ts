/**
 * Las propiedades «Fecha» de las páginas (docs/specs/fechas.md, ADR-0029): comprobarlas contra los calendarios del
 * mundo, ponerles cómo se leen (para la búsqueda, sin lo solo del máster), leer la forma que escribe la IA
 * (`1250-Siega-18`) y darlas legibles al leer una página
 */
import { type PageProperty, pageProperty } from '@crisol/contracts'
import { calendarsRepo, type Database, pagesRepo } from '@crisol/db'
import {
  CalendarDateError,
  type CalendarDefinition,
  convertDate,
  type DateValue,
  dateValueForm,
  dateValueProblem,
  fieldKey,
  formatDateValue,
  formatRange,
  parseDateValue,
  type WorldCalendar
} from '@crisol/domain'
import type { WritableProperty } from '@crisol/editor/markdown'
import { InvalidRequestError } from '../actions/context.ts'

type CalendarRow = calendarsRepo.CalendarRow

/** Lo que ve quien lee: el máster, todo; un jugador (o el máster viendo como uno), sin las eras solo del máster */
export const seenDefinition = (definition: CalendarDefinition, full: boolean): CalendarDefinition =>
  full ? definition : { ...definition, eras: definition.eras.filter((era) => !era.hidden) }

export const worldCalendars = (rows: readonly CalendarRow[], full = true): WorldCalendar[] =>
  rows.map((row) => ({ id: row.id, primary: row.isPrimary, definition: seenDefinition(row.definition, full) }))

type DateProperty = Extract<PageProperty, { type: 'date' }>

const hasDates = (properties: readonly PageProperty[]) => properties.some((p) => p.type === 'date')

/** Los calendarios del mundo, solo si hacen falta (alguna propiedad con fecha) */
export async function calendarsFor(db: Database, worldId: string, properties: readonly PageProperty[]) {
  return hasDates(properties) ? calendarsRepo.listCalendars(db, worldId) : []
}

/** Cómo se lee una fecha para cualquiera (sin las eras solo del máster): lo que se guarda para la búsqueda */
export const publicText = (definition: CalendarDefinition, value: Omit<DateValue, 'calendarId'>) =>
  formatDateValue(seenDefinition(definition, false), value)

/**
 * Las propiedades con sus fechas comprobadas (su calendario es del mundo, cabe en él, el fin no va antes) y con cómo se
 * leen. BAD_DATE con el motivo si alguna no vale
 */
export function stampDates<P extends PageProperty>(rows: readonly CalendarRow[], properties: readonly P[]): P[] {
  return properties.map((property) => {
    if (property.type !== 'date') return property
    const { text: _old, ...rest } = property as DateProperty
    if (!rest.value) return rest as P
    const calendarId = rest.value.calendarId
    const calendar = rows.find((row) => row.id === calendarId)
    if (!calendar) throw new InvalidRequestError('BAD_DATE', `«${property.name}»: su calendario no es de este mundo`)
    const problem = dateValueProblem(calendar.definition, rest.value)
    if (problem) throw new InvalidRequestError('BAD_DATE', `«${property.name}»: ${problem}`)
    return { ...rest, text: publicText(calendar.definition, rest.value) } as P
  })
}

/** Lo mismo, leyendo antes los calendarios del mundo si hace falta */
export async function checkDates<P extends PageProperty>(db: Database, worldId: string, properties: readonly P[]) {
  return stampDates(await calendarsFor(db, worldId, properties), properties)
}

/** Una fecha que escribe la IA: su forma (o null) y, aparte, el fin, «cada año» y el calendario */
export interface WrittenDate {
  name: string
  type: 'date'
  value: string | null
  end?: string | undefined
  yearly?: boolean | undefined
  calendar?: string | undefined
}

/**
 * Las propiedades que se escriben a mano (la IA, el YAML) con sus fechas ya leídas contra el calendario: las que la IA
 * da como fecha y los textos del YAML que van a una propiedad o un campo de fecha (por su nombre, en shapes). El
 * calendario: el que se diga, el que ya tenga esa propiedad o el principal
 */
export function readWrittenDates<W extends { name: string; type: string }>(
  rows: readonly CalendarRow[],
  wanted: readonly (W | WrittenDate)[],
  shapes: readonly PageProperty[]
): (Exclude<W, WrittenDate> | DateProperty)[] {
  const shapeOf = (name: string) =>
    shapes.find((shape): shape is DateProperty => shape.type === 'date' && fieldKey(shape.name) === fieldKey(name))
  return wanted.map((property) => {
    const written = asWritten(property, shapeOf(property.name))
    if (!written) return property as Exclude<W, WrittenDate>
    if (written.value === null) return { name: written.name, type: 'date', value: null }
    const calendar = pickCalendar(rows, written, shapeOf(written.name))
    const parsed = parseDateValue(calendar.definition, written.value, { end: written.end, yearly: written.yearly })
    if (!parsed.ok) throw new InvalidRequestError('BAD_DATE', `«${written.name}»: ${parsed.message}`)
    return { name: written.name, type: 'date', value: { calendarId: calendar.id, ...parsed.value } }
  })
}

/** La fecha escrita de una propiedad: la que da la IA, o el texto del YAML que va a una propiedad de fecha */
function asWritten(
  property: { name: string; type: string; value?: unknown },
  shape: DateProperty | undefined
): WrittenDate | null {
  if (property.type === 'date') return property as WrittenDate
  if (property.type !== 'text' || !shape) return null
  const text = String(property.value ?? '').trim()
  return { name: property.name, type: 'date', value: text === '' ? null : text }
}

function pickCalendar(rows: readonly CalendarRow[], written: WrittenDate, shape: DateProperty | undefined) {
  if (written.calendar) {
    const key = fieldKey(written.calendar)
    const found = rows.find((row) => row.id === written.calendar || fieldKey(row.name) === key)
    if (!found) {
      const names = rows.map((row) => row.name).join(', ') || 'ninguno'
      throw new InvalidRequestError(
        'BAD_DATE',
        `no hay ningún calendario «${written.calendar}» (los del mundo: ${names})`
      )
    }
    return found
  }
  const own = shape?.value ? rows.find((row) => row.id === shape.value?.calendarId) : undefined
  const found = own ?? rows.find((row) => row.isPrimary)
  if (!found) throw new InvalidRequestError('NO_CALENDAR', 'este mundo aún no tiene calendario: crea uno antes')
  return found
}

/** Si alguna propiedad escrita es una fecha (o un texto que puede ir a una): entonces hacen falta los calendarios */
export const writesDates = (wanted: readonly { name: string; type: string }[], shapes: readonly PageProperty[]) =>
  wanted.some(
    (p) =>
      p.type === 'date' ||
      (p.type === 'text' && shapes.some((s) => s.type === 'date' && fieldKey(s.name) === fieldKey(p.name)))
  )

/** Las fechas de una página, legibles para quien lee (full: con lo solo del máster), para la IA */
export function readableDates(rows: readonly CalendarRow[], properties: readonly PageProperty[], full: boolean) {
  const calendars = worldCalendars(rows, full)
  const primary = calendars.find((c) => c.primary)
  return properties.flatMap((property) => {
    if (property.type !== 'date' || !property.value) return []
    const value = property.value
    const row = rows.find((each) => each.id === value.calendarId)
    const calendar = calendars.find((c) => c.id === value.calendarId)
    if (!row || !calendar) return []
    const converted =
      primary && primary.id !== calendar.id ? convertDate(calendars, calendar.id, primary.id, value.start) : null
    return [
      {
        name: property.name,
        calendar: row.name,
        text: formatDateValue(calendar.definition, value),
        form: dateValueForm(calendar.definition, value),
        primary: converted && primary ? formatRange(primary.definition, converted.start, converted.end) : null
      }
    ]
  })
}

/** Las propiedades para el YAML de un Markdown: las fechas, en la forma de la IA (vacías, sin nada) */
export function markdownProperties(
  rows: readonly CalendarRow[],
  properties: readonly PageProperty[],
  full: boolean
): WritableProperty[] {
  return properties.map((property): WritableProperty => {
    if (property.type !== 'date') return property
    const value = property.value
    const calendar = value ? rows.find((row) => row.id === value.calendarId) : undefined
    const form = value && calendar ? dateValueForm(seenDefinition(calendar.definition, full), value) : ''
    return { name: property.name, type: 'text', value: form }
  })
}

/**
 * Las páginas cuyas fechas de ese calendario se leen distinto con su definición nueva (un mes renombrado, otro sufijo),
 * con cómo se leen ya al día: van en la misma operación que el cambio del calendario
 */
export async function retextedPages(db: Database, calendarId: string, definition: CalendarDefinition) {
  const rows = await pagesRepo.datedPages(db, calendarId)
  return rows.flatMap((row) => {
    let changed = false
    const properties = row.properties.map((item) => {
      const parsed = pageProperty.safeParse(item)
      if (!parsed.success || parsed.data.type !== 'date' || parsed.data.value?.calendarId !== calendarId) return item
      let text: string
      try {
        text = publicText(definition, parsed.data.value)
      } catch (error) {
        // Una fecha cuyo mes ya no está no llega aquí (quitarlo se impide); si llegara, se queda como estaba
        if (error instanceof CalendarDateError) return item
        throw error
      }
      if (text === parsed.data.text) return item
      changed = true
      return { ...(item as object), text }
    })
    return changed ? [{ id: row.id, properties }] : []
  })
}
