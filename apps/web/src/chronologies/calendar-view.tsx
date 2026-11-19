/**
 * La vista «Calendario» (lienzo del módulo 8, pantalla 6; Crisol antiguo, VistaMes y DetalleDia; Everlore,
 * timeline-tab-pane.tsx:1054-1229): el mes con tantas columnas como días tenga la semana del calendario; en cada día, su
 * número, las lunas nuevas y llenas y las fichas de lo que cae en él (lo de varios días, seguido de un día a otro);
 * arriba «Todo el mes»; debajo, lo que va fuera de la semana. Elegir un día abre su detalle (la fecha larga, la
 * estación, la era, las lunas y lo que pasa). El máster arrastra una ficha a otro día para cambiarle la fecha. Con el
 * teclado: las flechas recorren la rejilla, Intro abre el día y Re Pág / Av Pág cambian de mes. La vista grande de un
 * calendario (calendars/view.tsx) la lleva por fuera: el mes que se ve, el día elegido (su detalle, en su ficha), el día
 * por el que pasa el ratón (o el foco) y el hoy
 */
import type { ChronologyEntryView, TimelineGroupView } from '@crisol/contracts'
import {
  type CalendarDefinition,
  type CalendarSeason,
  dateFromDay,
  describeDate,
  entryOccurrences,
  eraOfDay,
  type FullDate,
  formatDate,
  type GridDay,
  monthGrid,
  moonEvent,
  seasonOfDay,
  yearBounds
} from '@crisol/domain'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, X } from 'lucide-react'
import {
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  useId,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { pagesOf, shortWeekdays } from '../calendars/preview.tsx'
import { focusOnMount } from '../components/focus.ts'
import { Icon } from '../components/icon.tsx'
import styles from './chronologies.module.css'
import { EventCard, entryColor, shownIcon } from './event-card.tsx'
import { weekSegments } from './layout.ts'

/** Cuántas fichas caben en un día antes de «+N más» */
const SLOTS = 3

type Page = ReturnType<typeof pagesOf>[number]

/** Lo que se ve: la página (el mes con sus fiestas de fuera de la semana) y el año */
export interface CalendarPlace {
  page: number
  year: number
}

/** La página en que sale un mes (o una fiesta de fuera de la semana) en un año */
export function placeOfMonth(pages: readonly Page[], month: string, year: number): CalendarPlace {
  const page = pages.findIndex((p) => p.month === month || p.before.includes(month) || p.after.includes(month))
  return { page: Math.max(0, page), year }
}

/** La página y el año en que cae una entrada */
function placeOf(pages: readonly Page[], entry: ChronologyEntryView | undefined) {
  if (!entry?.start.month) return { page: 0, year: entry?.start.year ?? 0 }
  return placeOfMonth(pages, entry.start.month, entry.start.year)
}

export function CalendarView({
  worldId,
  definition,
  entries,
  groups,
  compact,
  onCreateAt,
  onMove,
  onEdit,
  menuFor,
  where: shownPlace,
  onWhere,
  selected: chosenDay,
  onSelect,
  onHover,
  today = null,
  tools = null,
  banner = null,
  yearArrows = false,
  title = null
}: {
  worldId: string
  definition: CalendarDefinition
  entries: readonly ChronologyEntryView[]
  groups: readonly TimelineGroupView[]
  compact: boolean
  /** El mes que se ve, llevado por fuera (con onWhere); sin él, lo lleva ella */
  where?: CalendarPlace | undefined
  onWhere?: ((place: CalendarPlace) => void) | undefined
  /** El día elegido, llevado por fuera (con onSelect): su detalle va fuera y aquí no sale el suyo */
  selected?: number | null | undefined
  onSelect?: ((day: number) => void) | undefined
  /** El día por el que pasa el ratón o el foco (null al salir): la vista grande enseña su ficha */
  onHover?: ((day: number | null) => void) | undefined
  /** El día de hoy (su día absoluto), marcado en la rejilla */
  today?: number | null | undefined
  /** Lo que va en la cabecera, antes de las flechas */
  tools?: ReactNode
  /** Lo que va entre la cabecera y la rejilla (la franja de una festividad) */
  banner?: ReactNode
  /** También pasar de año */
  yearArrows?: boolean
  /** El título del mes, si se quiere otro (la vista grande: «Enero del año 1», un botón que lleva a otra fecha) */
  title?: ReactNode
  /** El máster: «+» en un día elegido */
  onCreateAt?: ((date: FullDate) => void) | undefined
  /** El máster: soltar una ficha en otro día (cuántos días se mueve) */
  onMove?: ((entry: ChronologyEntryView, days: number) => void) | undefined
  onEdit?: ((entry: ChronologyEntryView) => void) | undefined
  menuFor?: ((entry: ChronologyEntryView) => ReactNode) | undefined
}) {
  const { t } = useTranslation()
  const pages = useMemo(() => pagesOf(definition), [definition])
  // Abre en el mes de la última entrada con mes (o del último año)
  const [ownPlace, setOwnPlace] = useState(() =>
    placeOf(pages, [...entries].reverse().find((e) => e.start.month) ?? entries.at(-1))
  )
  const where = shownPlace ?? ownPlace
  const setWhere = (update: (place: CalendarPlace) => CalendarPlace) => {
    const next = update(where)
    if (onWhere) onWhere(next)
    else setOwnPlace(next)
  }
  const [ownSelected, setOwnSelected] = useState<number | null>(null)
  const selected = onSelect ? (chosenDay ?? null) : ownSelected
  const setSelected = (day: number | null) => {
    if (!onSelect) setOwnSelected(day)
    else if (day !== null) onSelect(day)
  }
  const [focusDay, setFocusDay] = useState<number | null>(null)
  const dragging = useRef<{ entry: ChronologyEntryView; from: number } | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const titleId = useId()
  const page = pages[where.page] ?? pages[0]
  const year = where.year
  const groupOf = (id: string | undefined) => groups.find((g) => g.id === id)

  const grid = useMemo(() => (page ? monthGrid(definition, year, page.month) : null), [definition, year, page])
  const outside = useMemo(
    () =>
      page
        ? [...page.before, ...page.after].map((id) => ({
            month: definition.months.find((m) => m.id === id),
            days: monthGrid(definition, year, id).outside
          }))
        : [],
    [definition, year, page]
  )
  const allDays = useMemo(
    () => [
      ...(grid?.weeks.flat().filter((d): d is GridDay => d !== null) ?? []),
      ...(grid?.outside ?? []),
      ...outside.flatMap((o) => o.days)
    ],
    [grid, outside]
  )
  const first = allDays.reduce((min, d) => Math.min(min, d.dayNumber), Number.POSITIVE_INFINITY)
  const last = allDays.reduce((max, d) => Math.max(max, d.dayNumber), Number.NEGATIVE_INFINITY)

  // Lo que cae este mes: las de día, por días (una vez por año si se repiten); las de mes, en «Todo el mes»
  const { daily, monthly } = useMemo(() => {
    const daily: Array<ChronologyEntryView & { occurrence: string }> = []
    const monthly: ChronologyEntryView[] = []
    if (!Number.isFinite(first)) return { daily, monthly }
    for (const entry of entries) {
      if (!entry.start.month) continue
      for (const occurrence of entryOccurrences(definition, entry, first, last)) {
        if (entry.start.day === undefined) monthly.push(entry)
        else
          daily.push({
            ...entry,
            startDay: occurrence.startDay,
            endDay: occurrence.endDay,
            occurrence: `${entry.key}@${occurrence.startDay}`
          })
      }
    }
    return { daily, monthly }
  }, [entries, definition, first, last])

  // Por páginas seguidas: pasar de año es correr tantas como tiene el año; no pasa de los años del calendario
  const years = yearBounds(definition)
  const count = Math.max(1, pages.length)
  const reach = (step: number) => {
    const total = where.year * count + where.page + step
    const year = Math.floor(total / count)
    return year < years.min || year > years.max ? null : { page: total - year * count, year }
  }
  const go = (step: number) => {
    const next = reach(step)
    if (!next) return
    setSelected(null)
    setWhere(() => next)
  }

  const firstDay = page ? dateFromDay(definition, first) : null
  // La estación del mes: la de su primer día y, si cambia antes de acabar, también la de su último
  const ends = [
    grid?.weeks.flat().find(Boolean) ?? grid?.outside[0],
    grid?.weeks.flat().findLast(Boolean) ?? grid?.outside.at(-1)
  ]
  const seasons =
    firstDay && Number.isFinite(first)
      ? ends
          .map((day) => (day ? seasonOfDay(definition, day.dayOfYear) : null))
          .filter(
            (one, index, all): one is CalendarSeason => one !== null && all.findIndex((o) => o?.id === one.id) === index
          )
      : []
  const era = Number.isFinite(first) ? eraOfDay(definition, first) : null
  const weekdays = shortWeekdays(definition.weekdays)

  /** Las fichas de un día, en su fila (lo de varios días, a la misma altura en toda la semana) */
  const chipsFor = (day: GridDay, row: Map<string, number> | null) => {
    const here = daily.filter((e) => e.startDay <= day.dayNumber && e.endDay >= day.dayNumber)
    if (compact) {
      return here.length > 0 ? (
        <span className={styles.dots} aria-hidden="true">
          {here.slice(0, 3).map((e) => (
            <span
              key={e.occurrence}
              className={styles.dot}
              style={{ '--entry-color': entryColor(e, groupOf(e.groupId)) } as CSSProperties}
            />
          ))}
        </span>
      ) : null
    }
    const slots: Array<(typeof here)[number] | null> = []
    for (const entry of here) {
      const slot = row?.get(entry.occurrence) ?? slots.length
      slots[slot] = entry
    }
    const visible = slots.slice(0, SLOTS)
    const more = here.length - visible.filter(Boolean).length
    return (
      <>
        {visible.map((entry, slot) =>
          entry ? (
            <Chip
              key={entry.occurrence}
              entry={entry}
              group={groupOf(entry.groupId)}
              starts={entry.startDay === day.dayNumber || day.weekday === 0}
              continues={entry.endDay > day.dayNumber}
              continued={entry.startDay < day.dayNumber}
              draggable={Boolean(onMove) && entry.kind === 'event' && !entry.converted}
              onDragStart={(event) => {
                dragging.current = { entry, from: day.dayNumber }
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', entry.key)
              }}
              onOpen={() => {
                setSelected(day.dayNumber)
                // Llevada por fuera (la vista grande de un calendario), la ficha también se abre
                if (onSelect) onEdit?.(entry)
              }}
            />
          ) : (
            // Un hueco para que lo de varios días siga a la misma altura en toda la semana
            <span key={`hueco-${day.dayNumber}-${slot}`} className={styles.chipGap} />
          )
        )}
        {more > 0 && (
          <button type="button" className={styles.more} onClick={() => setSelected(day.dayNumber)}>
            {t('chronologies.more', { count: more })}
          </button>
        )}
      </>
    )
  }

  const moonsOf = (day: number) =>
    definition.moons.flatMap((moon) => {
      const event = moonEvent(moon, day)
      return event
        ? [
            <span
              key={moon.id}
              className={styles.moon}
              data-phase={event}
              style={{ '--moon-color': moon.color } as CSSProperties}
              title={t(event === 'new' ? 'chronologies.newMoon' : 'chronologies.fullMoon', { name: moon.name })}
            />
          ]
        : []
    })

  const drop = (event: DragEvent, day: number) => {
    event.preventDefault()
    setOver(null)
    const drag = dragging.current
    dragging.current = null
    if (!drag || !onMove) return
    const delta = day - drag.from
    if (delta !== 0) onMove(drag.entry, delta)
  }
  const dropProps = (day: number) =>
    onMove
      ? {
          onDragOver: (event: DragEvent) => {
            if (!dragging.current) return
            event.preventDefault()
            setOver(day)
          },
          onDragLeave: () => setOver((current) => (current === day ? null : current)),
          onDrop: (event: DragEvent) => drop(event, day)
        }
      : {}

  /** Con el teclado: las flechas, por la rejilla (arriba y abajo, una semana); Intro, el detalle; Re/Av Pág, de mes */
  const onGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = focusDay ?? allDays[0]?.dayNumber
    if (at === undefined) return
    const width = definition.weekdays.length || 7
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -width, ArrowDown: width }
    if (event.key in moves) {
      event.preventDefault()
      const target = at + (moves[event.key] ?? 0)
      if (target < first || target > last) {
        if (!reach(target < first ? -1 : 1)) return
        go(target < first ? -1 : 1)
        setFocusDay(target)
        return
      }
      setFocusDay(target)
      requestAnimationFrame(() => document.getElementById(`dia-${titleId}-${target}`)?.focus())
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      go(event.key === 'PageUp' ? -1 : 1)
    }
  }
  // La parada del tabulador en la rejilla: la del último foco; si no, el día elegido, hoy o el primero
  const inMonth = (day: number | null | undefined): day is number => day != null && day >= first && day <= last
  const tabbable = inMonth(focusDay)
    ? focusDay
    : inMonth(selected)
      ? selected
      : inMonth(today)
        ? today
        : allDays[0]?.dayNumber

  const cell = (day: GridDay, row: Map<string, number> | null) => (
    <td
      key={day.dayNumber}
      id={`dia-${titleId}-${day.dayNumber}`}
      tabIndex={day.dayNumber === tabbable ? 0 : -1}
      aria-label={formatDate(definition, dateFromDay(definition, day.dayNumber), { weekday: true })}
      aria-current={today === day.dayNumber ? 'date' : undefined}
      className={styles.day}
      data-over={over === day.dayNumber || undefined}
      data-selected={selected === day.dayNumber || undefined}
      data-today={today === day.dayNumber || undefined}
      // Solo el foco de la celda (el de sus fichas, que sube, no la mueve)
      onFocus={(event) => {
        if (event.target !== event.currentTarget) return
        setFocusDay(day.dayNumber)
        onHover?.(day.dayNumber)
      }}
      onBlur={(event) => {
        if (event.target === event.currentTarget) onHover?.(null)
      }}
      onMouseEnter={onHover ? () => onHover(day.dayNumber) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('button, a')) return
        setSelected(day.dayNumber)
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
        event.preventDefault()
        setSelected(day.dayNumber)
      }}
      {...dropProps(day.dayNumber)}
    >
      <span className={styles.dayHead}>
        <span className={styles.dayNumber} data-number>
          {day.day}
        </span>
        <span className={styles.moons}>{moonsOf(day.dayNumber)}</span>
      </span>
      {chipsFor(day, row)}
    </td>
  )

  if (!page || !grid) return null
  const columns = definition.weekdays.length || 7
  return (
    <div className={styles.calendar} data-compact={compact || undefined}>
      <header className={styles.calendarHead}>
        <div>
          <h2 id={titleId} className={styles.calendarTitle}>
            {title ?? formatDate(definition, { year, month: page.month })}
          </h2>
          <p className={styles.calendarFacts}>
            {seasons.map((season) => (
              <span key={season.id}>
                <span
                  className={styles.seasonDot}
                  style={{ '--season-color': season.color ?? 'var(--color-muted)' } as CSSProperties}
                />
                {season.name}
              </span>
            ))}
            {era && <span>{era.name}</span>}
          </p>
        </div>
        {tools}
        <div className={styles.calendarArrows}>
          {yearArrows && (
            <button
              type="button"
              aria-label={t('calendars.view.previousYear')}
              title={t('calendars.view.previousYear')}
              onClick={() => go(-pages.length)}
              disabled={!reach(-pages.length)}
            >
              <ChevronsLeft size={18} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            aria-label={t('chronologies.previousMonth')}
            title={t('chronologies.previousMonth')}
            onClick={() => go(-1)}
            disabled={!reach(-1)}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t('chronologies.nextMonth')}
            title={t('chronologies.nextMonth')}
            onClick={() => go(1)}
            disabled={!reach(1)}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          {yearArrows && (
            <button
              type="button"
              aria-label={t('calendars.view.nextYear')}
              title={t('calendars.view.nextYear')}
              onClick={() => go(pages.length)}
              disabled={!reach(pages.length)}
            >
              <ChevronsRight size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>
      {banner}
      {monthly.length > 0 && (
        <div className={styles.allMonth}>
          <span className={styles.allMonthLabel}>{t('chronologies.allMonth')}</span>
          <div className={styles.allMonthChips}>
            {monthly.map((entry) => (
              <Chip
                key={entry.key}
                entry={entry}
                group={groupOf(entry.groupId)}
                starts
                continued={false}
                continues={false}
                draggable={false}
                onOpen={() => onEdit?.(entry)}
              />
            ))}
          </div>
        </div>
      )}
      <table
        aria-labelledby={titleId}
        className={styles.grid}
        style={{ '--columns': columns } as CSSProperties}
        onKeyDown={onGridKey}
      >
        <thead>
          <tr className={styles.weekdays}>
            {weekdays.map((name, index) => (
              <th key={definition.weekdays[index] ?? index} scope="col" abbr={definition.weekdays[index]}>
                <span aria-hidden="true">{name}</span>
                <span className={styles.srOnly}>{definition.weekdays[index]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.weeks.map((week) => {
            const segments = weekSegments(week, daily)
            const rows = new Map(segments.map((s) => [s.item.occurrence, s.row]))
            return (
              <tr key={week.find((d) => d)?.dayNumber} className={styles.week}>
                {week.map((day, index) =>
                  day ? cell(day, rows) : <td key={`hueco-${index}`} className={styles.blank} />
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      {outside.some((o) => o.days.length > 0) && (
        <div className={styles.outside}>
          {outside.map(({ month, days }) =>
            month && days.length > 0 ? (
              <div key={month.id} className={styles.outsideMonth}>
                <p
                  className={styles.outsideName}
                  id={`${titleId}-${month.id}`}
                  style={month.color ? ({ '--month-color': month.color } as CSSProperties) : undefined}
                >
                  <b>{month.name}</b>
                  <span>{t('chronologies.outsideWeek')}</span>
                </p>
                <table aria-labelledby={`${titleId}-${month.id}`} className={styles.outsideDays} onKeyDown={onGridKey}>
                  <tbody>
                    <tr>{days.map((day) => cell(day, null))}</tr>
                  </tbody>
                </table>
              </div>
            ) : null
          )}
        </div>
      )}
      {selected !== null && !onSelect && (
        <DayDetail
          side={(allDays.find((d) => d.dayNumber === selected)?.weekday ?? 0) >= columns / 2 ? 'start' : 'end'}
          worldId={worldId}
          definition={definition}
          day={selected}
          entries={[...daily.filter((e) => e.startDay <= selected && e.endDay >= selected)]}
          groups={groups}
          onClose={() => {
            setSelected(null)
            document.getElementById(`dia-${titleId}-${selected}`)?.focus()
          }}
          onCreate={onCreateAt ? () => onCreateAt(dateFromDay(definition, selected)) : undefined}
          onEdit={onEdit}
          menuFor={menuFor}
        />
      )}
    </div>
  )
}

/** La ficha de una entrada en un día (también en la semana de la vista grande de un calendario) */
export function Chip({
  entry,
  group,
  starts,
  continues,
  continued,
  draggable,
  onDragStart,
  onOpen
}: {
  entry: ChronologyEntryView
  group: TimelineGroupView | undefined
  starts: boolean
  continues: boolean
  continued: boolean
  draggable: boolean
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void
  onOpen: () => void
}) {
  const icon = shownIcon(entry)
  return (
    <button
      type="button"
      className={styles.chip}
      data-kind={entry.kind}
      data-continues={continues || undefined}
      data-continued={continued || undefined}
      data-hidden={entry.hidden || undefined}
      style={{ '--entry-color': entryColor(entry, group) } as CSSProperties}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onOpen}
      // Los tramos de en medio repiten la misma ficha: una sola parada del tabulador, en su primer día de la semana
      {...(starts ? {} : { tabIndex: -1, 'aria-hidden': true })}
      // El nombre siempre (los tramos de en medio no lo enseñan)
      aria-label={entry.field ? `${entry.title} · ${entry.field}` : entry.title}
    >
      {starts && (
        <>
          {icon && <Icon value={icon} size={12} />}
          <span className={styles.chipText}>{entry.title}</span>
        </>
      )}
    </button>
  )
}

/** El detalle de un día: la fecha larga, la estación, la era, el día del año, las lunas y lo que pasa */
function DayDetail({
  side,
  worldId,
  definition,
  day,
  entries,
  groups,
  onClose,
  onCreate,
  onEdit,
  menuFor
}: {
  side: 'start' | 'end'
  worldId: string
  definition: CalendarDefinition
  day: number
  entries: readonly ChronologyEntryView[]
  groups: readonly TimelineGroupView[]
  onClose: () => void
  onCreate?: (() => void) | undefined
  onEdit?: ((entry: ChronologyEntryView) => void) | undefined
  menuFor?: ((entry: ChronologyEntryView) => ReactNode) | undefined
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const described = describeDate(definition, dateFromDay(definition, day))
  return (
    <aside
      className={styles.dayDetail}
      data-side={side}
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <header className={styles.dayDetailHead}>
        <h3 id={titleId}>{described.text}</h3>
        <button
          ref={focusOnMount}
          type="button"
          className={styles.iconButton}
          aria-label={t('chronologies.closeDay')}
          onClick={onClose}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <p className={styles.dayFacts}>
        {[described.season, described.era?.name, t('chronologies.dayOfYear', { day: described.dayOfYear })]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {described.moons.length > 0 && (
        <ul className={styles.dayMoons}>
          {described.moons.map((moon) => (
            <li key={moon.id}>
              <span
                className={styles.moonDisc}
                style={{ '--moon-color': moon.color, '--lit': moon.illumination } as CSSProperties}
                aria-hidden="true"
              />
              <b>{moon.name}</b>
              <span>{moon.phase}</span>
            </li>
          ))}
        </ul>
      )}
      {entries.length > 0 ? (
        <div className={styles.dayEntries}>
          {entries.map((entry) => (
            <EventCard
              key={entry.key}
              worldId={worldId}
              entry={entry}
              group={groups.find((g) => g.id === entry.groupId)}
              compact
              headingLevel={4}
              actions={menuFor?.(entry)}
              titleAction={onEdit && entry.kind === 'event' ? () => onEdit(entry) : undefined}
            />
          ))}
        </div>
      ) : (
        <p className={styles.dayEmpty}>{t('chronologies.dayEmpty')}</p>
      )}
      {onCreate && (
        <button type="button" className={styles.dayAdd} onClick={onCreate}>
          <Plus size={16} aria-hidden="true" />
          {t('chronologies.addOnDay')}
        </button>
      )}
    </aside>
  )
}
