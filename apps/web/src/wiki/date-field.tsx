/**
 * El campo «Fecha» de una página (docs/specs/fechas.md; lienzo del módulo 8, pantalla 3): se lee como texto («12 de
 * Siega del año 412 RC») y al pulsarlo flota el selector junto al panel: el calendario (si hay más de uno), la precisión, el
 * mes con la semana del calendario (y lo que va fuera de ella, debajo), el año escrito a mano, «Añadir fin», «Cada año»
 * y «Borrar». Cada cambio se guarda al momento, como el resto del panel
 */
import type { CalendarView, PageProperty } from '@crisol/contracts'
import {
  CalendarDateError,
  type CalendarDefinition,
  clampYear,
  compareDates,
  convertDate,
  type DatePrecision,
  dayNumber,
  formatDate,
  formatDateValue,
  formatRange,
  formatYear,
  type GridDay,
  isValidDate,
  monthGrid,
  precisionOf,
  type WorldDate,
  yearBounds
} from '@crisol/domain'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, Repeat } from 'lucide-react'
import { type KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { YearInput } from '../calendars/date-input.tsx'
import { pagesOf, shortWeekdays, startYear } from '../calendars/preview.tsx'
import { useDismiss } from '../components/dismiss.ts'
import { Floating } from '../components/floating.tsx'
import styles from './date-field.module.css'
import { readAsInput, readAsKey, useReadAs } from './read-as.tsx'

export type DateValue = NonNullable<Extract<PageProperty, { type: 'date' }>['value']>

/** Los calendarios del mundo, con lo que ve quien lee (un jugador, sin las eras solo del máster) */
export function useWorldCalendars(worldId: string) {
  const api = useApi()
  const readAs = useReadAs()
  return useQuery({
    queryKey: ['calendars', worldId, ...readAsKey(readAs)],
    queryFn: () => api.call('listCalendars', { worldId, ...readAsInput(readAs) })
  })
}

/** Cómo se lee una fecha con su calendario; sin él (aún cargando, o ya no está), lo que guardó el servidor */
export function dateText(calendars: readonly CalendarView[] | undefined, value: DateValue | null, stored = ''): string {
  if (!value) return ''
  const calendar = calendars?.find((c) => c.id === value.calendarId)
  if (!calendar) return stored
  try {
    return formatDateValue(calendar.definition, value)
  } catch (error) {
    if (error instanceof CalendarDateError) return stored
    throw error
  }
}

/** Para leer: el texto y, si se repite, su icono */
export function DateText({ worldId, value, stored }: { worldId: string; value: DateValue | null; stored?: string }) {
  const { t } = useTranslation()
  const calendars = useWorldCalendars(worldId)
  const text = dateText(calendars.data?.calendars, value, stored)
  return (
    <span className={styles.text}>
      {text}
      {value?.yearly && <YearlyMark label={t('dates.repeats')} />}
    </span>
  )
}

function YearlyMark({ label }: { label: string }) {
  return (
    <span className={styles.yearly} title={label}>
      <Repeat size={12} aria-hidden="true" />
      <span className={styles.srOnly}>{label}</span>
    </span>
  )
}

/** El valor en el panel: un botón con su texto que abre el selector a su lado */
export function DateField({
  id,
  label,
  name,
  value,
  stored,
  worldId,
  allowEnd,
  onChange
}: {
  id: string
  /** Su nombre accesible («Valor de la propiedad 2») */
  label: string
  /** El de la propiedad, para el selector */
  name: string
  value: DateValue | null
  /** Cómo se lee según el servidor, mientras llegan los calendarios */
  stored?: string | undefined
  worldId: string
  /** Si se puede poner fin (un campo de plantilla sin «Con fin», no) */
  allowEnd: boolean
  onChange: (value: DateValue | null) => void
}) {
  const { t } = useTranslation()
  const calendars = useWorldCalendars(worldId)
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, close, box, button)
  const list = calendars.data?.calendars
  const text = dateText(list, value, stored)
  return (
    <>
      <button
        ref={button}
        id={id}
        type="button"
        className={styles.value}
        aria-haspopup="dialog"
        aria-expanded={open && Boolean(list)}
        data-property-open={(open && list) || undefined}
        // Con lo que enseña dentro: el nombre accesible contiene el texto visible (WCAG 2.5.3)
        aria-label={`${label}: ${text || t('properties.empty')}${value?.yearly ? `, ${t('dates.repeats').toLowerCase()}` : ''}`}
        onClick={() => setOpen(!open)}
      >
        {text ? <span>{text}</span> : <span className={styles.placeholder}>{t('properties.empty')}</span>}
        {value?.yearly && <YearlyMark label={t('dates.repeats')} />}
      </button>
      {open && list && (
        <Floating
          anchor={button}
          boxRef={box}
          placement="left-start"
          className={styles.picker}
          role="dialog"
          aria-label={name || label}
          data-property-popup=""
          // Con el tabulador fuera de él (a otro sitio de la página), se cierra: no se queda abierto a la espalda
          onBlur={(event) => {
            const to = event.relatedTarget as Node | null
            if (to && !box.current?.contains(to) && to !== button.current) close()
          }}
        >
          {list.length === 0 ? (
            <p className={styles.none}>
              {t('dates.noCalendar')}{' '}
              <Link to="/mundos/$worldId/calendarios" params={{ worldId }} className={styles.link}>
                {t('dates.toCalendars')}
              </Link>
            </p>
          ) : (
            <DatePicker
              calendars={list}
              value={value}
              allowEnd={allowEnd}
              onChange={onChange}
              onClear={() => {
                onChange(null)
                close()
                button.current?.focus()
              }}
            />
          )}
        </Floating>
      )}
    </>
  )
}

/** Lo que se ve en el selector: un año y uno de sus meses (por su página: el mes normal con sus fiestas de al lado) */
export interface View {
  year: number
  page: number
}

export function viewOf(definition: CalendarDefinition, date: WorldDate | null): View {
  const pages = pagesOf(definition)
  const page = date?.month
    ? pages.findIndex(
        (p) => p.month === date.month || p.before.includes(date.month ?? '') || p.after.includes(date.month ?? '')
      )
    : 0
  return { year: clampYear(definition, date?.year ?? startYear(definition)), page: Math.max(0, page) }
}

/** La página de al lado (la anterior o la siguiente), pasando de año al dar la vuelta */
export function pageStep(count: number, view: View, by: -1 | 1): View {
  const next = view.page + by
  if (next < 0) return { year: view.year - 1, page: count - 1 }
  if (next >= count) return { year: view.year + 1, page: 0 }
  return { year: view.year, page: next }
}

/** La fecha con otra precisión: lo que falta, del mes que se ve (o el primero) y el día 1 */
function withPrecision(date: WorldDate, precision: DatePrecision, month: string): WorldDate {
  if (precision === 'year') return { year: date.year }
  const own = date.month ?? month
  if (precision === 'month') return { year: date.year, month: own }
  return { year: date.year, month: own, day: date.day ?? 1 }
}

const RANK: Record<DatePrecision, number> = { year: 0, month: 1, day: 2 }

/**
 * La fecha con más precisión: la que se recuerda si es la misma (mismo año y, si lo tiene, mismo mes) y llega a ella;
 * si no, la de siempre. Así pasar a «Año» y volver a «Día» no pierde el día
 */
function refined(date: WorldDate, remembered: WorldDate | undefined, next: DatePrecision, month: string): WorldDate {
  const same =
    remembered &&
    remembered.year === date.year &&
    (date.month === undefined || date.month === remembered.month) &&
    RANK[precisionOf(remembered)] >= RANK[next]
  return withPrecision(same ? remembered : date, next, month)
}

/** Una fecha de un calendario en otro con la misma precisión; null si no tienen correspondencia */
function converted(calendars: readonly CalendarView[], from: string, to: string, date: WorldDate): WorldDate | null {
  const world = calendars.map((c) => ({ id: c.id, primary: c.primary, definition: c.definition }))
  const found = convertDate(world, from, to, date)?.start
  if (!found) return null
  return withPrecision(found, precisionOf(date), found.month)
}

const PRECISIONS: DatePrecision[] = ['year', 'month', 'day']

function DatePicker({
  calendars,
  value,
  allowEnd,
  onChange,
  onClear
}: {
  calendars: readonly CalendarView[]
  value: DateValue | null
  allowEnd: boolean
  onChange: (value: DateValue | null) => void
  onClear: () => void
}) {
  const { t } = useTranslation()
  const ids = useId()
  const grid = useRef<HTMLFieldSetElement>(null)
  const primary = calendars.find((c) => c.primary) ?? (calendars[0] as CalendarView)
  const [calendarId, setCalendarId] = useState(value?.calendarId ?? primary.id)
  const calendar = calendars.find((c) => c.id === calendarId) ?? primary
  const definition = calendar.definition
  // La fecha que se edita, si es de este calendario (otro, sin correspondencia: se elige de nuevo)
  const current = value && value.calendarId === calendar.id ? value : null
  const [editing, setEditing] = useState<'start' | 'end'>('start')
  // «Añadir fin»: se elige el fin, que no se guarda hasta pulsar un día
  const [addingEnd, setAddingEnd] = useState(false)
  const choosingEnd = editing === 'end' && (current?.end !== undefined || addingEnd)
  const target = current ? (choosingEnd ? (current.end ?? null) : current.start) : null
  // La fecha más precisa de esta vez, para no perderla al cambiar de precisión
  const remembered = useRef<{ start: WorldDate; end?: WorldDate | undefined } | null>(
    current ? { start: current.start, end: current.end } : null
  )
  const [chosen, setChosen] = useState<DatePrecision>('day')
  const precision = current ? precisionOf(current.start) : chosen
  const [view, setView] = useState<View>(() => viewOf(definition, target))
  const pages = pagesOf(definition)
  const page = pages[Math.min(view.page, pages.length - 1)] ?? pages[0]
  const viewMonth = page?.month ?? definition.months[0]?.id ?? ''

  // Al abrirlo, el foco va a lo elegido (o al primer día)
  useEffect(() => {
    const root = grid.current
    const focus =
      root?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? root?.querySelector<HTMLElement>('button')
    focus?.focus()
  }, [])
  // Al poner o quitar el fin, su botón desaparece: el foco va a lo que lo sustituye (elegir el fin, o «Añadir fin»)
  const foot = useRef<HTMLDivElement>(null)
  const hasEnd = current?.end !== undefined || addingEnd
  const hadEnd = useRef(hasEnd)
  useEffect(() => {
    if (hadEnd.current === hasEnd) return
    hadEnd.current = hasEnd
    const next = hasEnd ? 'input[type="radio"]:checked' : 'button'
    foot.current?.querySelector<HTMLElement>(next)?.focus()
  }, [hasEnd])

  const save = (next: Omit<DateValue, 'calendarId'>) => {
    const kept = remembered.current
    const compatible = kept && kept.start.year === next.start.year
    if (!kept || !compatible || RANK[precisionOf(next.start)] >= RANK[precisionOf(kept.start)])
      remembered.current = { start: next.start, end: next.end }
    setAddingEnd(false)
    onChange({ calendarId: calendar.id, ...next })
  }
  /** Elegir un año, un mes o un día: el inicio o el fin (si el fin queda antes, se cambian) */
  const pick = (date: WorldDate) => {
    if (!current) return save({ start: date })
    const { start, yearly } = current
    const end = current.end ?? (choosingEnd ? start : undefined)
    const rest = yearly && date.month !== undefined ? { yearly } : {}
    if (choosingEnd && end) {
      const before = compareDates(definition, date, start) < 0
      return save({ start: before ? date : start, end: before ? start : date, ...rest })
    }
    if (end && compareDates(definition, date, end) > 0) return save({ start: end, end: date, ...rest })
    save({ start: date, ...(end ? { end } : {}), ...rest })
  }
  const changePrecision = (next: DatePrecision) => {
    setChosen(next)
    if (!current) return
    const { start, end, yearly } = current
    const kept = remembered.current
    save({
      start: refined(start, kept?.start, next, viewMonth),
      ...(end ? { end: refined(end, kept?.end, next, viewMonth) } : {}),
      ...(yearly && next !== 'year' ? { yearly } : {})
    })
    // Lo recordado no cambia por pasar a menos precisión
    if (kept) remembered.current = kept
  }
  const changeCalendar = (id: string) => {
    setCalendarId(id)
    const next = calendars.find((c) => c.id === id)
    if (!next) return
    // Con correspondencia, la fecha pasa a él; sin ella, se queda como está hasta que se elija otra
    const start = value ? converted(calendars, value.calendarId, id, value.start) : null
    const end = value?.end && start ? converted(calendars, value.calendarId, id, value.end) : null
    if (value && start) {
      onChange({ calendarId: id, start, ...(end ? { end } : {}), ...(value.yearly ? { yearly: value.yearly } : {}) })
      setView(viewOf(next.definition, start))
    } else setView(viewOf(next.definition, null))
  }
  const years = yearBounds(definition)
  const stepPage = (by: -1 | 1) => {
    const next = pageStep(pages.length, view, by)
    if (next.year >= years.min && next.year <= years.max) setView(next)
  }
  const canPage = (by: -1 | 1) => {
    const year = pageStep(pages.length, view, by).year
    return year >= years.min && year <= years.max
  }
  // Pasar de año no sale de los del calendario
  const showYear = (year: number) => setView({ ...view, year: clampYear(definition, year) })

  // RePág y AvPág pasan de mes (con Mayúsculas, de año); el foco vuelve a la rejilla nueva
  const refocus = useRef(false)
  useEffect(() => {
    if (!refocus.current) return
    refocus.current = false
    grid.current?.querySelector<HTMLElement>('[data-choice][tabindex="0"]')?.focus()
  })
  const keys = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      const by = event.key === 'PageUp' ? -1 : 1
      refocus.current = true
      if (event.shiftKey || precision !== 'day') showYear(view.year + by)
      else stepPage(by)
      return
    }
    moveFocus(event)
  }

  // La lectura larga (con el día de la semana) y, si es de otro calendario, su equivalencia en el principal
  const readout = current
    ? precision === 'day' && !current.end
      ? formatDate(definition, current.start, { weekday: true })
      : formatDateValue(definition, current)
    : null
  const equivalent =
    current && calendar.id !== primary.id ? converted(calendars, calendar.id, primary.id, current.start) : null
  // Una fecha de otro calendario que no se puede pasar a este: se dice, y se lee en el suyo
  const elsewhere = value && !current ? dateText(calendars, value) : null
  const outside = target ? target.month !== undefined && !isValidDate(definition, target) : false

  return (
    <div className={styles.body}>
      {calendars.length > 1 && (
        <label className={styles.calendar}>
          <span className={styles.srOnly}>{t('dates.calendar')}</span>
          <select value={calendar.id} onChange={(event) => changeCalendar(event.target.value)}>
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <fieldset className={styles.segmented}>
        <legend className={styles.srOnly}>{t('dates.precision')}</legend>
        {PRECISIONS.map((p) => (
          <label key={p} data-on={precision === p || undefined}>
            <input
              type="radio"
              name={`${ids}-precision`}
              checked={precision === p}
              onChange={() => changePrecision(p)}
            />
            {t(`dates.${p}`)}
          </label>
        ))}
      </fieldset>
      <div className={styles.nav}>
        <button
          type="button"
          aria-label={t('dates.previousYear')}
          disabled={view.year <= years.min}
          onClick={() => showYear(view.year - 1)}
        >
          <ChevronsLeft size={16} aria-hidden="true" />
        </button>
        {precision === 'day' && (
          <button
            type="button"
            aria-label={t('dates.previousMonth')}
            disabled={!canPage(-1)}
            onClick={() => stepPage(-1)}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
        )}
        {precision === 'day' && (
          <select
            className={styles.month}
            aria-label={t('dates.monthShown')}
            value={view.page}
            onChange={(event) => setView({ ...view, page: Number(event.target.value) })}
          >
            {pages.map((p, i) => (
              <option key={p.month} value={i}>
                {definition.months.find((m) => m.id === p.month)?.name}
              </option>
            ))}
          </select>
        )}
        <span className={styles.year}>
          <YearInput
            aria-label={t('dates.yearShown')}
            definition={definition}
            value={view.year}
            onValue={(year) => setView({ ...view, year })}
          />
          {definition.yearSuffix && <span aria-hidden="true">{definition.yearSuffix}</span>}
        </span>
        {precision === 'day' && (
          <button type="button" aria-label={t('dates.nextMonth')} disabled={!canPage(1)} onClick={() => stepPage(1)}>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          aria-label={t('dates.nextYear')}
          disabled={view.year >= years.max}
          onClick={() => showYear(view.year + 1)}
        >
          <ChevronsRight size={16} aria-hidden="true" />
        </button>
      </div>
      <fieldset ref={grid} className={styles.choices} onKeyDown={keys}>
        <legend className={styles.srOnly}>{t('dates.choices')}</legend>
        {precision === 'year' && (
          // Doce años alrededor del que se ve
          <div className={styles.months} data-columns={3}>
            {Array.from({ length: 12 }, (_, i) => view.year - 4 + i).map((year) => {
              const pressed = target?.year === year
              const inView = target !== null && target.year >= view.year - 4 && target.year <= view.year + 7
              return (
                <button
                  key={year}
                  type="button"
                  className={styles.choice}
                  data-choice=""
                  aria-pressed={pressed}
                  tabIndex={pressed || (!inView && year === view.year) ? 0 : -1}
                  disabled={year < years.min || year > years.max}
                  onClick={() => pick({ year })}
                >
                  {formatYear(definition, year)}
                </button>
              )
            })}
          </div>
        )}
        {precision === 'month' && (
          <div className={styles.months} data-columns={3}>
            {definition.months.map((m, i) => {
              const pressed = target?.year === view.year && target.month === m.id
              const inView = target?.year === view.year && target.month !== undefined
              return (
                <button
                  key={m.id}
                  type="button"
                  className={styles.choice}
                  data-choice=""
                  data-festival={m.festival || undefined}
                  aria-pressed={pressed}
                  tabIndex={pressed || (!inView && i === 0) ? 0 : -1}
                  onClick={() => pick({ year: view.year, month: m.id })}
                >
                  {m.name}
                </button>
              )
            })}
          </div>
        )}
        {precision === 'day' && page && (
          <MonthDays
            definition={definition}
            year={view.year}
            page={page}
            value={current}
            target={target}
            editingEnd={choosingEnd}
            pick={pick}
          />
        )}
      </fieldset>
      <p className={styles.readout} aria-live="polite">
        {readout ?? elsewhere ?? <span className={styles.placeholder}>{t('dates.none')}</span>}
        {value?.yearly && <YearlyMark label={t('dates.repeats')} />}
      </p>
      {addingEnd && <p className={styles.equivalent}>{t('dates.pickEnd')}</p>}
      {elsewhere && <p className={styles.warning}>{t('dates.noEquivalent', { name: calendar.name })}</p>}
      {outside && <p className={styles.warning}>{t('dates.outside')}</p>}
      {equivalent && (
        <p className={styles.equivalent}>
          {t('dates.inPrimary', {
            name: primary.name,
            text: formatRange(primary.definition, equivalent, null)
          })}
        </p>
      )}
      <div ref={foot} className={styles.foot}>
        {current && (current.end || addingEnd) ? (
          <>
            <fieldset className={styles.segmented} data-small="">
              <legend className={styles.srOnly}>{t('dates.editing')}</legend>
              {(['start', 'end'] as const).map((which) => (
                <label key={which} data-on={editing === which || undefined}>
                  <input
                    type="radio"
                    name={`${ids}-editing`}
                    checked={editing === which}
                    onChange={() => {
                      setEditing(which)
                      setView(viewOf(definition, which === 'end' ? (current.end ?? current.start) : current.start))
                    }}
                  />
                  {t(`dates.${which}`)}
                </label>
              ))}
            </fieldset>
            <button
              type="button"
              className={styles.link}
              onClick={() => {
                setEditing('start')
                if (current.end) save({ start: current.start, ...(current.yearly ? { yearly: current.yearly } : {}) })
                else setAddingEnd(false)
              }}
            >
              {t('dates.removeEnd')}
            </button>
          </>
        ) : (
          allowEnd &&
          current && (
            <button
              type="button"
              className={styles.link}
              onClick={() => {
                setEditing('end')
                setAddingEnd(true)
              }}
            >
              <Plus size={14} aria-hidden="true" />
              {t('dates.addEnd')}
            </button>
          )
        )}
        {current && (
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={current.yearly === true}
              disabled={precision === 'year'}
              onChange={(event) => {
                const { yearly: _was, ...rest } = current
                save(event.target.checked ? { ...rest, yearly: true } : rest)
              }}
            />
            {t('dates.yearly')}
          </label>
        )}
        {value && (
          <button type="button" className={styles.clear} onClick={onClear}>
            {t('dates.clear')}
          </button>
        )}
      </div>
    </div>
  )
}

/** Las flechas mueven el foco entre los días (o los meses): izquierda y derecha, de uno en uno; arriba y abajo, por filas */
export function moveFocus(event: KeyboardEvent<HTMLElement>) {
  const keys: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 }
  const step = keys[event.key]
  if (step === undefined) return
  const all = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-choice]')]
  const at = all.indexOf(document.activeElement as HTMLButtonElement)
  if (at < 0) return
  event.preventDefault()
  const columns = Number(event.currentTarget.querySelector<HTMLElement>('[data-columns]')?.dataset.columns ?? 1)
  const by = Math.abs(step) === 2 ? Math.sign(step) * columns : step
  const next = all[Math.min(all.length - 1, Math.max(0, at + by))]
  if (!next) return
  // Una sola parada del tabulador: la que tiene el foco
  for (const button of all) button.tabIndex = button === next ? 0 : -1
  next.focus()
}

/** El mes con la semana del calendario y, debajo, sus días fuera de la semana (una festividad, su nombre delante) */
export function MonthDays({
  definition,
  year,
  page,
  value,
  target,
  editingEnd,
  pick
}: {
  definition: CalendarDefinition
  year: number
  page: { month: string; before: string[]; after: string[] }
  value: DateValue | null
  target: WorldDate | null
  /** Si se elige el fin (su extremo lleva el aro) */
  editingEnd: boolean
  pick: (date: WorldDate) => void
}) {
  const days = monthGrid(definition, year, page.month)
  const month = definition.months.find((m) => m.id === page.month)
  // Lo elegido: el día que se edita, y el tramo entre inicio y fin
  const span = value ? [dayNumber(definition, value.start), dayNumber(definition, value.end ?? value.start)] : null
  const chosen = target?.day !== undefined ? dayNumber(definition, target) : null
  // Los dos extremos de un periodo; el que se edita, con su aro
  const ranged = value?.end !== undefined && span !== null
  const edgeOf = (n: number) => {
    if (!ranged || (n !== span?.[0] && n !== span?.[1])) return undefined
    return (editingEnd ? n === span?.[1] : n === span?.[0]) ? 'editing' : 'other'
  }
  const shown = [...days.weeks.flat(), ...days.outside]
  // Si lo elegido no está en este mes, la parada del tabulador es su día 1
  const chosenHere = chosen !== null && shown.some((day) => day?.dayNumber === chosen)
  const button = (day: GridDay, monthId: string) => {
    const date = { year, month: monthId, day: day.day }
    return (
      <button
        type="button"
        className={styles.day}
        data-choice=""
        data-in-span={(ranged && day.dayNumber >= (span?.[0] ?? 0) && day.dayNumber <= (span?.[1] ?? 0)) || undefined}
        data-edge={edgeOf(day.dayNumber)}
        aria-pressed={chosen === day.dayNumber}
        aria-label={formatDate(definition, date, { weekday: true })}
        // Una parada del tabulador: lo elegido, o el primer día
        tabIndex={chosen === day.dayNumber || (!chosenHere && day.day === 1 && monthId === page.month) ? 0 : -1}
        onClick={() => pick(date)}
      >
        {day.day}
      </button>
    )
  }
  // Lo de fuera de la semana, en sus mismas columnas
  const columns = definition.weekdays.length || 7
  const strips = [...page.before, ...page.after].map((id) => ({
    id,
    month: definition.months.find((m) => m.id === id),
    days: monthGrid(definition, year, id).outside
  }))
  return (
    <>
      {days.weeks.length > 0 && (
        <table className={styles.grid} data-columns={definition.weekdays.length}>
          <thead>
            <tr>
              {shortWeekdays(definition.weekdays).map((short, i) => (
                <th key={definition.weekdays[i]} scope="col" abbr={definition.weekdays[i]}>
                  <span aria-hidden="true">{short}</span>
                  <span className={styles.srOnly}>{definition.weekdays[i]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.weeks.map((week) => (
              <tr key={week.find(Boolean)?.dayNumber}>
                {week.map((day, i) =>
                  day ? <td key={day.dayNumber}>{button(day, page.month)}</td> : <td key={`hueco-${i}`} />
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {/* Un mes entero fuera de la semana (o un calendario sin semana): sus días seguidos */}
      {days.outside.length > 0 && (
        <div className={styles.strip} data-columns={columns} style={{ ['--columns' as string]: columns }}>
          <span className={styles.stripName}>{month?.name}</span>
          <div className={styles.stripDays}>{days.outside.map((day) => button(day, page.month))}</div>
        </div>
      )}
      {strips.map((strip) => (
        <div key={strip.id} className={styles.strip} style={{ ['--columns' as string]: columns }}>
          <span className={styles.stripName}>{strip.month?.name}</span>
          <div className={styles.stripDays}>{strip.days.map((day) => button(day, strip.id))}</div>
        </div>
      ))}
    </>
  )
}
