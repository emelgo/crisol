/**
 * Las otras vistas de un calendario en grande (calendars/view.tsx), junto al mes: la semana (sus días en columnas, con
 * lo que cae en cada uno y, entre ellos, los de fuera de la semana) y el año (sus meses en pequeño, las festividades con
 * su color; cada uno lleva a su mes). Su cabecera es la misma que la del mes: el título con sus datos y las flechas
 */
import type { ChronologyEntryView, TimelineGroupView } from '@crisol/contracts'
import {
  type CalendarDefinition,
  dateFromDay,
  entryOccurrences,
  formatDate,
  type GridDay,
  monthGrid,
  moonEvent,
  type WeekGrid,
  yearBounds,
  yearLength,
  yearStart
} from '@crisol/domain'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type CSSProperties, type KeyboardEvent, type ReactNode, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip } from '../chronologies/calendar-view.tsx'
import chrono from '../chronologies/chronologies.module.css'
import { shortWeekdays } from './preview.tsx'
import { SeasonFacts, seasonsOf, weekTitle } from './titles.tsx'
import styles from './view.module.css'

/** La cabecera de una vista: el título (h2) con sus datos debajo y las flechas para pasar de periodo */
export function PeriodHead({
  id,
  title,
  facts,
  previous,
  next,
  canStep = () => true,
  onStep
}: {
  id: string
  title: string
  facts?: ReactNode
  /** Lo que dicen las flechas («Semana anterior») */
  previous: string
  next: string
  /** Si se puede pasar a ese lado (en el borde de los años del calendario, no) */
  canStep?: (step: -1 | 1) => boolean
  onStep: (step: -1 | 1) => void
}) {
  return (
    <header className={chrono.calendarHead}>
      <div>
        <h2 id={id} className={chrono.calendarTitle}>
          {title}
        </h2>
        {facts && <p className={chrono.calendarFacts}>{facts}</p>}
      </div>
      <div className={chrono.calendarArrows}>
        <button type="button" aria-label={previous} title={previous} disabled={!canStep(-1)} onClick={() => onStep(-1)}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button type="button" aria-label={next} title={next} disabled={!canStep(1)} onClick={() => onStep(1)}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}

type Placed = ChronologyEntryView & { occurrence: string; startDay: number; endDay: number }

/** Lo que cae con día entre `first` y `last`, una vez por cada vez que cae (las que se repiten cada año) */
function placed(definition: CalendarDefinition, entries: readonly ChronologyEntryView[], first: number, last: number) {
  const out: Placed[] = []
  for (const entry of entries) {
    if (!entry.start.month || entry.start.day === undefined) continue
    for (const occurrence of entryOccurrences(definition, entry, first, last))
      out.push({
        ...entry,
        startDay: occurrence.startDay,
        endDay: occurrence.endDay,
        occurrence: `${entry.key}@${occurrence.startDay}`
      })
  }
  return out
}

/**
 * La semana: un día por columna, con su número (y su mes, el primero que sale y cuando empieza otro), sus lunas nuevas
 * y llenas y todo lo que cae en él. Con el teclado: las flechas pasan de día, Intro lo fija y Re Pág / Av Pág cambian
 * de semana
 */
export function WeekView({
  definition,
  week,
  entries,
  groups,
  selected,
  today,
  onSelect,
  onHover,
  onOpen,
  onStep
}: {
  definition: CalendarDefinition
  week: WeekGrid
  entries: readonly ChronologyEntryView[]
  groups: readonly TimelineGroupView[]
  selected: number | null
  today: number | null
  onSelect: (day: number) => void
  onHover: (day: number | null) => void
  onOpen: (entry: ChronologyEntryView) => void
  onStep: (step: -1 | 1) => void
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const [focusDay, setFocusDay] = useState<number | null>(null)
  const here = useMemo(() => placed(definition, entries, week.first, week.last), [definition, entries, week])
  const days = useMemo(
    () =>
      [...week.days.filter((d): d is GridDay => d !== null), ...week.outside].sort((a, b) => a.dayNumber - b.dayNumber),
    [week]
  )
  const groupOf = (id: string | undefined) => groups.find((g) => g.id === id)
  // No pasa de los años del calendario: la semana de antes o de después, si su día de al lado cabe
  const years = yearBounds(definition)
  const canStep = (step: -1 | 1) => {
    const year = dateFromDay(definition, step < 0 ? week.first - 1 : week.last + 1).year
    return year >= years.min && year <= years.max
  }
  const step = (by: -1 | 1) => {
    if (canStep(by)) onStep(by)
  }
  const inWeek = (day: number | null): day is number => day !== null && days.some((d) => d.dayNumber === day)
  const tabbable = inWeek(focusDay)
    ? focusDay
    : inWeek(selected)
      ? selected
      : inWeek(today)
        ? today
        : days[0]?.dayNumber

  const onKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      step(event.key === 'PageUp' ? -1 : 1)
      return
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const at = days.findIndex((d) => d.dayNumber === (focusDay ?? tabbable))
    const target = days[at + (event.key === 'ArrowLeft' ? -1 : 1)]
    if (!target) return step(event.key === 'ArrowLeft' ? -1 : 1)
    setFocusDay(target.dayNumber)
    document.getElementById(`dia-${titleId}-${target.dayNumber}`)?.focus()
  }

  const cell = (day: GridDay, index: number) => {
    const date = dateFromDay(definition, day.dayNumber)
    const month = definition.months.find((m) => m.id === date.month)
    // El mes, en el primero que sale y cuando empieza otro
    const showMonth = index === 0 || date.day === 1
    const chips = here.filter((e) => e.startDay <= day.dayNumber && e.endDay >= day.dayNumber)
    return (
      <td
        key={day.dayNumber}
        id={`dia-${titleId}-${day.dayNumber}`}
        tabIndex={day.dayNumber === tabbable ? 0 : -1}
        aria-label={formatDate(definition, date, { weekday: true })}
        aria-current={today === day.dayNumber ? 'date' : undefined}
        className={`${chrono.day} ${styles.weekDay}`}
        data-selected={selected === day.dayNumber || undefined}
        data-today={today === day.dayNumber || undefined}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('button, a')) return
          onSelect(day.dayNumber)
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
          event.preventDefault()
          onSelect(day.dayNumber)
        }}
        onFocus={(event) => {
          if (event.target !== event.currentTarget) return
          setFocusDay(day.dayNumber)
          onHover(day.dayNumber)
        }}
        onBlur={(event) => {
          if (event.target === event.currentTarget) onHover(null)
        }}
        onMouseEnter={() => onHover(day.dayNumber)}
        onMouseLeave={() => onHover(null)}
      >
        <span className={chrono.dayHead}>
          <span className={styles.weekNumber}>
            <span className={chrono.dayNumber} data-number>
              {day.day}
            </span>
            {showMonth && month && <span className={styles.weekMonth}>{month.name}</span>}
          </span>
          <span className={chrono.moons}>
            {definition.moons.flatMap((moon) => {
              const phase = moonEvent(moon, day.dayNumber)
              return phase
                ? [
                    <span
                      key={moon.id}
                      className={chrono.moon}
                      data-phase={phase}
                      style={{ '--moon-color': moon.color } as CSSProperties}
                      title={t(phase === 'new' ? 'chronologies.newMoon' : 'chronologies.fullMoon', { name: moon.name })}
                    />
                  ]
                : []
            })}
          </span>
        </span>
        {chips.map((entry) => (
          <Chip
            key={entry.occurrence}
            entry={entry}
            group={groupOf(entry.groupId)}
            starts
            continues={false}
            continued={false}
            draggable={false}
            onOpen={() => {
              onSelect(day.dayNumber)
              onOpen(entry)
            }}
          />
        ))}
      </td>
    )
  }

  // «Semana del 12 al 18 de Siega del año 1250 RC», y su estación como en el mes
  const title = weekTitle(t, definition, week.first, week.last)
  const seasons = seasonsOf(definition, [...week.days.filter((d): d is GridDay => Boolean(d)), ...week.outside])
  const columns = definition.weekdays.length || 7
  const weekdays = shortWeekdays(definition.weekdays)
  // Los de fuera de la semana, por su fiesta
  const outside = definition.months.flatMap((month) => {
    const list = week.outside.filter((d) => dateFromDay(definition, d.dayNumber).month === month.id)
    return list.length > 0 ? [{ month, days: list }] : []
  })
  let index = 0
  return (
    <div className={`${chrono.calendar} ${styles.period}`}>
      <PeriodHead
        id={titleId}
        title={title}
        facts={seasons.length > 0 ? <SeasonFacts seasons={seasons} /> : undefined}
        previous={t('calendars.view.previousWeek')}
        next={t('calendars.view.nextWeek')}
        canStep={canStep}
        onStep={step}
      />
      {week.days.length > 0 && (
        <table
          aria-labelledby={titleId}
          className={chrono.grid}
          style={{ '--columns': columns } as CSSProperties}
          onKeyDown={onKey}
        >
          <thead>
            <tr className={chrono.weekdays}>
              {weekdays.map((name, i) => (
                <th key={definition.weekdays[i] ?? i} scope="col" abbr={definition.weekdays[i]}>
                  <span aria-hidden="true">{name}</span>
                  <span className={chrono.srOnly}>{definition.weekdays[i]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className={chrono.week}>
              {week.days.map((day, i) =>
                day ? cell(day, index++) : <td key={`hueco-${i}`} className={`${chrono.blank} ${styles.weekDay}`} />
              )}
            </tr>
          </tbody>
        </table>
      )}
      {outside.length > 0 && (
        <div className={chrono.outside}>
          {outside.map(({ month, days: list }) => (
            <div key={month.id} className={chrono.outsideMonth}>
              <p
                className={chrono.outsideName}
                id={`${titleId}-${month.id}`}
                style={month.color ? ({ '--month-color': month.color } as CSSProperties) : undefined}
              >
                <b>{month.name}</b>
                <span>{t('chronologies.outsideWeek')}</span>
              </p>
              <table aria-labelledby={`${titleId}-${month.id}`} className={chrono.outsideDays} onKeyDown={onKey}>
                <tbody>
                  <tr>{list.map((day) => cell(day, index++))}</tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * El año: sus meses en pequeño, cada uno con sus semanas (los de fuera de la semana, en fila), los días con algo
 * marcados, hoy y el día fijado. Cada día se elige como en el mes (pasar el ratón enseña su ficha, pulsarlo la fija);
 * el nombre del mes lleva a él. Las flechas pasan de un día a otro dentro del mes
 */
export function YearView({
  definition,
  year,
  title,
  entries,
  selected,
  today,
  onMonth,
  onSelect,
  onHover,
  onStep
}: {
  definition: CalendarDefinition
  year: number
  title: string
  entries: readonly ChronologyEntryView[]
  selected: number | null
  today: number | null
  onMonth: (monthId: string) => void
  onSelect: (day: number) => void
  onHover: (day: number | null) => void
  onStep: (step: -1 | 1) => void
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const first = yearStart(definition, year)
  const last = first + yearLength(definition, year) - 1
  // Los días con algo (lo de varios días, cada uno de los suyos dentro del año)
  const busy = useMemo(() => {
    const days = new Set<number>()
    for (const entry of placed(definition, entries, first, last))
      for (let day = Math.max(first, entry.startDay); day <= Math.min(last, entry.endDay); day++) days.add(day)
    return days
  }, [definition, entries, first, last])
  const columns = definition.weekdays.length || 7
  const weekdays = shortWeekdays(definition.weekdays)
  // En cada mes, un solo día entra en el orden del tabulador: el fijado, hoy o el primero
  const focusDay = (days: readonly GridDay[]) =>
    (days.find((d) => d.dayNumber === selected) ?? days.find((d) => d.dayNumber === today) ?? days[0])?.dayNumber
  const mark = (day: GridDay, tabbable: number | undefined) => (
    <button
      type="button"
      key={day.dayNumber}
      className={styles.miniDay}
      tabIndex={day.dayNumber === tabbable ? 0 : -1}
      aria-label={formatDate(definition, dateFromDay(definition, day.dayNumber), { weekday: true })}
      aria-pressed={selected === day.dayNumber}
      data-busy={busy.has(day.dayNumber) || undefined}
      data-today={today === day.dayNumber || undefined}
      data-selected={selected === day.dayNumber || undefined}
      onClick={() => onSelect(day.dayNumber)}
      onMouseEnter={() => onHover(day.dayNumber)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(day.dayNumber)}
      onBlur={() => onHover(null)}
    >
      {day.day}
    </button>
  )
  // Las flechas, de un día a otro del mismo mes
  const onDaysKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
    const at = buttons.indexOf(event.target as HTMLButtonElement)
    const next = buttons[at + (event.key === 'ArrowLeft' ? -1 : 1)]
    if (!next) return
    next.focus()
    event.preventDefault()
  }
  return (
    <div className={`${chrono.calendar} ${styles.period}`}>
      <PeriodHead
        id={titleId}
        title={title}
        previous={t('calendars.view.previousYear')}
        next={t('calendars.view.nextYear')}
        canStep={(by) => {
          const { min, max } = yearBounds(definition)
          return year + by >= min && year + by <= max
        }}
        onStep={onStep}
      />
      <ol className={styles.year} aria-labelledby={titleId}>
        {definition.months.map((month) => {
          const grid = monthGrid(definition, year, month.id)
          const count = grid.weeks.flat().filter((d) => d && busy.has(d.dayNumber)).length
          const outsideCount = grid.outside.filter((d) => busy.has(d.dayNumber)).length
          const marked = count + outsideCount
          return (
            <li
              key={month.id}
              className={styles.yearMonth}
              data-festival={month.festival || undefined}
              style={month.color ? ({ '--month-color': month.color } as CSSProperties) : undefined}
            >
              <button
                type="button"
                className={styles.yearMonthName}
                aria-label={
                  marked > 0 ? t('calendars.view.monthWithDays', { name: month.name, count: marked }) : month.name
                }
                title={t('calendars.view.openMonth')}
                onClick={() => onMonth(month.id)}
              >
                {month.name}
              </button>
              {(() => {
                // Su estación (la de su primer día y, si cambia, también la del último)
                const days = [...grid.weeks.flat().filter((d): d is GridDay => Boolean(d)), ...grid.outside]
                const ends = [days[0], days.at(-1)].filter((d): d is GridDay => Boolean(d))
                const seasons = seasonsOf(definition, ends)
                return seasons.length > 0 ? (
                  <span className={`${chrono.calendarFacts} ${styles.yearSeason}`}>
                    <SeasonFacts seasons={seasons} />
                  </span>
                ) : null
              })()}
              {grid.weeks.length > 0 ? (
                // biome-ignore lint/a11y/noStaticElementInteractions: las flechas mueven el foco entre los días de dentro
                <div className={styles.mini} style={{ '--columns': columns } as CSSProperties} onKeyDown={onDaysKey}>
                  {weekdays.map((name, i) => (
                    <span key={definition.weekdays[i] ?? i} className={styles.miniHead} aria-hidden="true">
                      {name.charAt(0)}
                    </span>
                  ))}
                  {(() => {
                    const days = grid.weeks.flat().filter((d): d is GridDay => Boolean(d))
                    const tabbable = focusDay(days)
                    return grid.weeks
                      .flat()
                      .map((day, i) => (day ? mark(day, tabbable) : <span key={`hueco-${i}`} aria-hidden="true" />))
                  })()}
                </div>
              ) : (
                // biome-ignore lint/a11y/noStaticElementInteractions: las flechas mueven el foco entre los días de dentro
                <div className={`${styles.mini} ${styles.miniRow}`} onKeyDown={onDaysKey}>
                  {grid.outside.map((day) => mark(day, focusDay(grid.outside)))}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
