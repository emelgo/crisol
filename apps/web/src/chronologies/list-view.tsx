/**
 * La vista «Lista» (lienzo del módulo 8, pantalla 4; Everlore, timeline-tab-pane.tsx:1914-1995): una sola línea
 * vertical; a la izquierda la fecha corta y, debajo, la distancia a la anterior; en medio la raya con un rombo del
 * color del evento (un círculo, en una página con fecha); a la derecha la tarjeta. Se pinta por tramos: con miles de
 * entradas, lo que se ve y un poco más
 */
import type { ChronologyEntryView, TimelineGroupView } from '@crisol/contracts'
import { type CalendarDefinition, meanYearLength } from '@crisol/domain'
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TodayMark } from '../campaign-time/today-mark.tsx'
import { relativeDays } from '../campaign-time/words.ts'
import styles from './chronologies.module.css'
import { EventCard, entryColor } from './event-card.tsx'
import { distanceText, shortDate } from './layout.ts'

/** Cuántas se pintan de una vez */
const STEP = 150

export function ListView({
  worldId,
  definition,
  entries,
  groups,
  compact,
  menuFor,
  onEdit,
  today = null
}: {
  worldId: string
  definition: CalendarDefinition
  entries: readonly ChronologyEntryView[]
  groups: readonly TimelineGroupView[]
  compact: boolean
  /** El «⋯» de una entrada (el máster) */
  menuFor?: ((entry: ChronologyEntryView) => ReactNode) | undefined
  /** Editar un evento (el máster): al pulsar su título o con doble clic */
  onEdit?: ((entry: ChronologyEntryView) => void) | undefined
  /** El «hoy» de una campaña (8 · campaña): su línea y la distancia de cada entrada a él */
  today?: TodayMark | null
}) {
  const { t } = useTranslation()
  const [shown, setShown] = useState(STEP)
  const sentinel = useRef<HTMLLIElement>(null)
  const groupOf = (id: string | undefined) => groups.find((g) => g.id === id)
  // Al acercarse al final de lo pintado, el siguiente tramo
  useEffect(() => {
    const element = sentinel.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (seen) => {
        if (seen.some((entry) => entry.isIntersecting)) setShown((count) => count + STEP)
      },
      { rootMargin: '600px 0px' }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const visible = entries.slice(0, shown)
  const year = meanYearLength(definition)
  // La línea «Hoy», antes de la primera que viene después
  const todayAt = today ? entries.findIndex((entry) => entry.startDay > today.day) : -1
  const todayIndex = today ? (todayAt < 0 ? entries.length : todayAt) : -1
  const todayRow = today && (
    <li key="hoy" className={styles.todayRow} aria-label={t('campaignTime.todayLine', { date: today.text })}>
      <div className={styles.when}>
        <span className={styles.todayBadge}>{t('campaignTime.today')}</span>
      </div>
      <div className={styles.rail} aria-hidden="true">
        <span className={styles.todayDot} />
      </div>
      <p className={styles.todayLine}>
        {today.text}
        {today.campaign && <span> · {today.campaign}</span>}
      </p>
    </li>
  )
  return (
    <ol className={styles.list} aria-label={t('chronologies.views.list')}>
      {visible.map((entry, index) => {
        const group = groupOf(entry.groupId)
        const distance = today
          ? relativeDays(t, today.day, entry.startDay, year)
          : distanceText(definition, entries[index - 1], entry)
        const row = (
          <li
            key={entry.key}
            className={styles.listRow}
            data-future={(today && entry.startDay > today.day) || undefined}
            style={{ '--entry-color': entryColor(entry, group) } as CSSProperties}
            onDoubleClick={
              onEdit && entry.kind === 'event'
                ? (event) => {
                    if ((event.target as HTMLElement).closest('a, button')) return
                    onEdit(entry)
                  }
                : undefined
            }
          >
            <div className={styles.when}>
              <b>{shortDate(definition, entry)}</b>
              {distance && <small>{distance}</small>}
            </div>
            <div className={styles.rail} aria-hidden="true">
              <span className={styles.marker} data-kind={entry.kind} />
            </div>
            <EventCard
              worldId={worldId}
              entry={entry}
              group={group}
              compact={compact}
              actions={menuFor?.(entry)}
              titleAction={onEdit && entry.kind === 'event' ? () => onEdit(entry) : undefined}
            />
          </li>
        )
        return index === todayIndex ? [todayRow, row] : row
      })}
      {todayIndex >= visible.length && todayIndex === entries.length && todayRow}
      {shown < entries.length && <li ref={sentinel} className={styles.sentinel} aria-hidden="true" />}
    </ol>
  )
}
