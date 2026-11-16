/**
 * La vista previa del editor (lienzo, pantalla 2): un mes a medio editar con su semana, los días fuera de la semana que
 * le siguen en una franja, las lunas nuevas y llenas, el día del año de cada día, y debajo su estación, su era y cuándo
 * está cada luna nueva o llena. Flechas para pasar de mes y de año. Cambia al momento con lo que se escribe
 */
import {
  type CalendarDefinition,
  dayNumber,
  eraOfDay,
  formatDate,
  type GridDay,
  monthGrid,
  moonEvent,
  seasonOfDay
} from '@crisol/domain'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAnnounce } from '../components/announcer.tsx'
import styles from './editor.module.css'

/** Lo que se enseña con cada mes normal: los fuera de la semana que van justo detrás (y, antes del primero, los de delante) */
function pagesOf(definition: CalendarDefinition) {
  const regular = definition.months.map((m, i) => ({ m, i })).filter(({ m }) => !m.outsideWeek)
  if (regular.length === 0) return definition.months.map((m) => ({ month: m.id, before: [], after: [] as string[] }))
  return regular.map(({ i }, k) => {
    const next = regular[k + 1]?.i ?? definition.months.length
    const after = definition.months.slice(i + 1, next).map((m) => m.id)
    const before = k === 0 ? definition.months.slice(0, i).map((m) => m.id) : []
    return { month: definition.months[i]?.id ?? '', before, after }
  })
}

/**
 * Los nombres cortos de los días de la semana para la cabecera de la rejilla: sus primeras letras, las justas para que
 * no se repitan («Lu», «Ma»…); si empiezan igual («Día 1», «Día 2»), sus iniciales («D1»)
 */
export function shortWeekdays(names: readonly string[]): string[] {
  for (let k = 2; k <= 4; k++) {
    const short = names.map((n) => n.slice(0, k))
    if (new Set(short).size === names.length) return short.map((s) => s.toUpperCase())
  }
  return names.map((n) =>
    n
      .split(/\s+/)
      .map((word) => (/^\d+$/.test(word) ? word : word.charAt(0)))
      .join('')
      .toUpperCase()
  )
}

/** El año con que se abre: el del principio de su última era (lo más reciente), o el 1 */
const startYear = (definition: CalendarDefinition) =>
  definition.eras.reduce((year, era) => Math.max(year, era.start.year), Number.NEGATIVE_INFINITY) ===
  Number.NEGATIVE_INFINITY
    ? 1
    : Math.max(...definition.eras.map((era) => era.start.year))

export function MonthPreview({
  definition,
  valid,
  follow = null
}: {
  definition: CalendarDefinition
  valid: boolean
  /** El mes que se está editando: la vista previa va a él */
  follow?: string | null
}) {
  const { t } = useTranslation()
  const announce = useAnnounce()
  const [year, setYear] = useState(() => startYear(definition))
  const [page, setPage] = useState(0)
  const [followed, setFollowed] = useState<string | null>(null)
  /** Al pasar de mes o de año con las flechas, se dice cuál se ve (no mientras se escribe) */
  const show = (nextPage: number, nextYear: number) => {
    setPage(nextPage)
    setYear(nextYear)
    const month = pages[nextPage]?.month
    if (valid && month) announce(formatDate(definition, { year: nextYear, month }))
  }
  const pages = pagesOf(definition)
  // Al pasar a otro mes en el editor, la vista previa va a la página donde sale
  if (follow !== followed) {
    setFollowed(follow)
    const target = pages.findIndex(
      (p) => p.month === follow || p.before.includes(follow ?? '') || p.after.includes(follow ?? '')
    )
    if (target >= 0 && target !== page) setPage(target)
  }
  const at = Math.min(page, Math.max(0, pages.length - 1))
  const current = pages[at]
  const step = (delta: number) => {
    let next = at + delta
    let nextYear = year
    if (next < 0) {
      next = pages.length - 1
      nextYear--
    } else if (next >= pages.length) {
      next = 0
      nextYear++
    }
    show(next, nextYear)
  }
  const nav = (
    <div className={styles.previewNav}>
      <button type="button" aria-label={t('calendars.editor.previousYear')} onClick={() => show(at, year - 1)}>
        <ChevronsLeft size={16} aria-hidden="true" />
      </button>
      <button type="button" aria-label={t('calendars.editor.previousMonth')} onClick={() => step(-1)}>
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      <h3 className={styles.previewTitle}>
        {valid && current ? formatDate(definition, { year, month: current.month }) : '—'}
      </h3>
      <button type="button" aria-label={t('calendars.editor.nextMonth')} onClick={() => step(1)}>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
      <button type="button" aria-label={t('calendars.editor.nextYear')} onClick={() => show(at, year + 1)}>
        <ChevronsRight size={16} aria-hidden="true" />
      </button>
    </div>
  )
  if (!valid || !current)
    return (
      <>
        {nav}
        <p className={styles.muted}>{t('calendars.editor.noPreview')}</p>
      </>
    )
  const grid = monthGrid(definition, year, current.month)
  const strips = [...current.before, ...current.after].map((id) => ({
    id,
    name: definition.months.find((m) => m.id === id)?.name ?? '',
    color: definition.months.find((m) => m.id === id)?.color ?? null,
    days: monthGrid(definition, year, id).outside
  }))
  const month = definition.months.find((m) => m.id === current.month)
  const first = dayNumber(definition, { year, month: current.month, day: 1 })
  const firstDay = grid.weeks.flat().find(Boolean) ?? grid.outside[0]
  const season = firstDay ? seasonOfDay(definition, firstDay.dayOfYear) : null
  const era = eraOfDay(definition, first)
  const days = [...grid.weeks.flat().filter((d): d is GridDay => d !== null), ...grid.outside]
  const moonText = definition.moons.map((moon) => {
    const news = days.filter((d) => moonEvent(moon, d.dayNumber) === 'new').map((d) => d.day)
    const fulls = days.filter((d) => moonEvent(moon, d.dayNumber) === 'full').map((d) => d.day)
    const parts = [
      news.length > 0 ? t('calendars.editor.moonNew', { days: news.join(', ') }) : '',
      fulls.length > 0 ? t('calendars.editor.moonFull', { days: fulls.join(', ') }) : ''
    ].filter(Boolean)
    return { moon, text: parts.join(', ') }
  })
  const cell = (day: GridDay, color: string | null | undefined) => (
    <DayCell key={day.dayNumber} day={day} definition={definition} color={color} />
  )
  return (
    <>
      {nav}
      {grid.weeks.length > 0 && (
        <table className={styles.grid} style={{ ['--columns' as string]: definition.weekdays.length }}>
          <thead>
            <tr>
              {shortWeekdays(definition.weekdays).map((short, i) => (
                <th key={i} scope="col" abbr={definition.weekdays[i]}>
                  <span aria-hidden="true">{short}</span>
                  <span className={styles.srOnly}>{definition.weekdays[i]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.weeks.map((week) => (
              <tr key={week.find(Boolean)?.dayNumber}>
                {week.map((day, i) =>
                  day ? (
                    <td key={day.dayNumber}>{cell(day, month?.festival ? month.color : null)}</td>
                  ) : (
                    <td key={`hueco-${i}`} aria-hidden="true" />
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {strips.map((strip) => (
        <div
          key={strip.id}
          className={styles.strip}
          style={strip.color ? { ['--month-color' as string]: strip.color } : {}}
        >
          <span className={styles.stripName}>{strip.name}</span>
          <ol className={styles.stripDays}>
            {strip.days.map((day) => (
              <li key={day.dayNumber}>{cell(day, strip.color)}</li>
            ))}
          </ol>
        </div>
      ))}
      <ul className={styles.legend}>
        {(season || era) && (
          <li>
            <span className={styles.dot} style={{ ['--dot' as string]: season?.color ?? 'var(--color-muted)' }} />
            {[season?.name, era?.name].filter(Boolean).join(' · ')}
          </li>
        )}
        {moonText.map(({ moon, text }) =>
          text ? (
            <li key={moon.id}>
              <span className={styles.dot} style={{ ['--dot' as string]: moon.color }} />
              {t('calendars.editor.moonDays', { name: moon.name, days: text })}
            </li>
          ) : null
        )}
      </ul>
    </>
  )
}

function DayCell({
  day,
  definition,
  color
}: {
  day: GridDay
  definition: CalendarDefinition
  color: string | null | undefined
}) {
  const { t } = useTranslation()
  const marks = definition.moons
    .map((moon) => ({ moon, event: moonEvent(moon, day.dayNumber) }))
    .filter((mark) => mark.event !== null)
  return (
    <div
      className={styles.day}
      data-festival={color ? true : undefined}
      style={color ? { ['--month-color' as string]: color } : {}}
      title={t('calendars.editor.dayOfYear', { n: day.dayOfYear })}
    >
      <span className={styles.dayNumber}>{day.day}</span>
      {marks.length > 0 && (
        <span className={styles.moonMarks}>
          {marks.map(({ moon, event }) => (
            <span
              key={moon.id}
              className={styles.moonMark}
              data-event={event}
              style={{ ['--moon-color' as string]: moon.color }}
              role="img"
              aria-label={t(event === 'new' ? 'calendars.editor.newMoonMark' : 'calendars.editor.fullMoonMark', {
                name: moon.name
              })}
            />
          ))}
        </span>
      )}
      <span className={styles.dayOfYear}>
        <span aria-hidden="true">{day.dayOfYear}</span>
        <span className={styles.srOnly}>{t('calendars.editor.dayOfYear', { n: day.dayOfYear })}</span>
      </span>
    </div>
  )
}
