/**
 * El campo «Fecha» de una página (docs/specs/fechas.md; lienzo del módulo 8, pantalla 3): se lee como texto («12 de
 * Siega de 412 RC») y al pulsarlo flota el selector junto al panel: el calendario (si hay más de uno), la precisión, el
 * mes con la semana del calendario (y lo que va fuera de ella, debajo), el año escrito a mano, «Añadir fin», «Cada año»
 * y «Borrar». Cada cambio se guarda al momento, como el resto del panel
 */
import type { CalendarView, PageProperty } from '@crisol/contracts'
import {
  CalendarDateError,
  type CalendarDefinition,
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
  type WorldDate
} from '@crisol/domain'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Repeat } from 'lucide-react'
import { type KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { IntegerInput } from '../calendars/date-input.tsx'
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
        aria-expanded={open}
        // Con lo que enseña dentro: el nombre accesible contiene el texto visible (WCAG 2.5.3)
        aria-label={`${label}: ${text || t('properties.empty')}`}
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
interface View {
  year: number
  page: number
}

function viewOf(definition: CalendarDefinition, date: WorldDate | null): View {
  const pages = pagesOf(definition)
  const page = date?.month
    ? pages.findIndex(
        (p) => p.month === date.month || p.before.includes(date.month ?? '') || p.after.includes(date.month ?? '')
      )
    : 0
  return { year: date?.year ?? startYear(definition), page: Math.max(0, page) }
}

/** La fecha con otra precisión: lo que falta, del mes que se ve (o el primero) y el día 1 */
function withPrecision(date: WorldDate, precision: DatePrecision, month: string): WorldDate {
  if (precision === 'year') return { year: date.year }
  const own = date.month ?? month
  if (precision === 'month') return { year: date.year, month: own }
  return { year: date.year, month: own, day: date.day ?? 1 }
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
  const target = current ? (editing === 'end' && current.end ? current.end : current.start) : null
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
  const hasEnd = current?.end !== undefined
  const hadEnd = useRef(hasEnd)
  useEffect(() => {
    if (hadEnd.current === hasEnd) return
    hadEnd.current = hasEnd
    const next = hasEnd ? 'input[type="radio"]:checked' : 'button'
    foot.current?.querySelector<HTMLElement>(next)?.focus()
  }, [hasEnd])

  const save = (next: Omit<DateValue, 'calendarId'>) => onChange({ calendarId: calendar.id, ...next })
  /** Elegir un año, un mes o un día: el inicio o el fin (si el fin queda antes, se cambian) */
  const pick = (date: WorldDate) => {
    if (!current) return save({ start: date })
    const { start, end, yearly } = current
    const rest = yearly && date.month !== undefined ? { yearly } : {}
    if (editing === 'end' && end) {
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
    save({
      start: withPrecision(start, next, viewMonth),
      ...(end ? { end: withPrecision(end, next, viewMonth) } : {}),
      ...(yearly && next !== 'year' ? { yearly } : {})
    })
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
  const stepPage = (by: -1 | 1) => {
    let next = view.page + by
    let year = view.year
    if (next < 0) {
      next = pages.length - 1
      year--
    } else if (next >= pages.length) {
      next = 0
      year++
    }
    setView({ year, page: next })
  }

  // La lectura larga (con el día de la semana) y, si es de otro calendario, su equivalencia en el principal
  const readout = current
    ? precision === 'day' && !current.end
      ? formatDate(definition, current.start, { weekday: true })
      : formatDateValue(definition, current)
    : null
  const equivalent =
    current && calendar.id !== primary.id ? converted(calendars, calendar.id, primary.id, current.start) : null
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
          onClick={() => setView({ ...view, year: view.year - 1 })}
        >
          <ChevronsLeft size={16} aria-hidden="true" />
        </button>
        {precision === 'day' && (
          <button type="button" aria-label={t('dates.previousMonth')} onClick={() => stepPage(-1)}>
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
          <IntegerInput
            aria-label={t('dates.yearShown')}
            value={view.year}
            onValue={(year) => setView({ ...view, year })}
          />
          {definition.yearSuffix && <span aria-hidden="true">{definition.yearSuffix}</span>}
        </span>
        {precision === 'day' && (
          <button type="button" aria-label={t('dates.nextMonth')} onClick={() => stepPage(1)}>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          aria-label={t('dates.nextYear')}
          onClick={() => setView({ ...view, year: view.year + 1 })}
        >
          <ChevronsRight size={16} aria-hidden="true" />
        </button>
      </div>
      <fieldset ref={grid} className={styles.choices} onKeyDown={moveFocus}>
        <legend className={styles.srOnly}>{t('dates.choices')}</legend>
        {precision === 'year' && (
          <button
            type="button"
            className={styles.yearChoice}
            aria-pressed={target?.year === view.year}
            onClick={() => pick({ year: view.year })}
          >
            {formatYear(definition, view.year)}
          </button>
        )}
        {precision === 'month' && (
          <div className={styles.months} data-columns={3}>
            {definition.months.map((m) => (
              <button
                key={m.id}
                type="button"
                className={styles.choice}
                data-festival={m.festival || undefined}
                aria-pressed={target?.year === view.year && target.month === m.id}
                onClick={() => pick({ year: view.year, month: m.id })}
              >
                {m.name}
              </button>
            ))}
          </div>
        )}
        {precision === 'day' && page && (
          <MonthDays definition={definition} year={view.year} page={page} value={current} target={target} pick={pick} />
        )}
      </fieldset>
      <p className={styles.readout} aria-live="polite">
        {readout ?? <span className={styles.placeholder}>{t('dates.none')}</span>}
        {current?.yearly && <YearlyMark label={t('dates.repeats')} />}
      </p>
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
        {current?.end ? (
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
                      setView(viewOf(definition, which === 'end' ? (current.end ?? null) : current.start))
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
                save({ start: current.start, ...(current.yearly ? { yearly: current.yearly } : {}) })
              }}
            >
              {t('dates.removeEnd')}
            </button>
          </>
        ) : (
          allowEnd && (
            <button
              type="button"
              className={styles.link}
              disabled={!current}
              onClick={() => {
                if (!current) return
                setEditing('end')
                save({ ...current, end: current.start })
              }}
            >
              {t('dates.addEnd')}
            </button>
          )
        )}
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={current?.yearly === true}
            disabled={!current || precision === 'year'}
            onChange={(event) => {
              if (!current) return
              const { yearly: _was, ...rest } = current
              save(event.target.checked ? { ...rest, yearly: true } : rest)
            }}
          />
          {t('dates.yearly')}
        </label>
        <button type="button" className={styles.clear} disabled={!value} onClick={onClear}>
          {t('dates.clear')}
        </button>
      </div>
    </div>
  )
}

/** Las flechas mueven el foco entre los días (o los meses): izquierda y derecha, de uno en uno; arriba y abajo, por filas */
function moveFocus(event: KeyboardEvent<HTMLElement>) {
  const keys: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 }
  const step = keys[event.key]
  if (step === undefined) return
  const all = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-choice]')]
  const at = all.indexOf(document.activeElement as HTMLButtonElement)
  if (at < 0) return
  event.preventDefault()
  const columns = Number(event.currentTarget.querySelector<HTMLElement>('[data-columns]')?.dataset.columns ?? 1)
  const by = Math.abs(step) === 2 ? Math.sign(step) * columns : step
  all[Math.min(all.length - 1, Math.max(0, at + by))]?.focus()
}

/** El mes con la semana del calendario y, debajo, sus días fuera de la semana (una festividad, su nombre delante) */
function MonthDays({
  definition,
  year,
  page,
  value,
  target,
  pick
}: {
  definition: CalendarDefinition
  year: number
  page: { month: string; before: string[]; after: string[] }
  value: DateValue | null
  target: WorldDate | null
  pick: (date: WorldDate) => void
}) {
  const days = monthGrid(definition, year, page.month)
  const month = definition.months.find((m) => m.id === page.month)
  // Lo elegido: el día que se edita, y el tramo entre inicio y fin
  const span = value ? [dayNumber(definition, value.start), dayNumber(definition, value.end ?? value.start)] : null
  const chosen = target?.day !== undefined ? dayNumber(definition, target) : null
  const button = (day: GridDay, monthId: string) => {
    const date = { year, month: monthId, day: day.day }
    return (
      <button
        type="button"
        className={styles.day}
        data-choice=""
        data-in-span={(span && day.dayNumber >= (span[0] ?? 0) && day.dayNumber <= (span[1] ?? 0)) || undefined}
        aria-pressed={chosen === day.dayNumber}
        aria-label={formatDate(definition, date, { weekday: true })}
        // Una parada del tabulador: lo elegido, o el primer día
        tabIndex={chosen === day.dayNumber || (chosen === null && day.day === 1 && monthId === page.month) ? 0 : -1}
        onClick={() => pick(date)}
      >
        {day.day}
      </button>
    )
  }
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
        <div className={styles.strip} data-columns={Math.min(7, days.outside.length)}>
          <span className={styles.stripName}>{month?.name}</span>
          <div className={styles.stripDays}>{days.outside.map((day) => button(day, page.month))}</div>
        </div>
      )}
      {strips.map((strip) => (
        <div key={strip.id} className={styles.strip}>
          <span className={styles.stripName}>{strip.month?.name}</span>
          <div className={styles.stripDays}>{strip.days.map((day) => button(day, strip.id))}</div>
        </div>
      ))}
    </>
  )
}
