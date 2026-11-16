/**
 * La vista «Lista» (lienzo del módulo 8, pantalla 4; Everlore, timeline-tab-pane.tsx:1914-1995): una sola línea
 * vertical; a la izquierda la fecha corta y, debajo, la distancia a la anterior; en medio la raya con un rombo del
 * color del evento (un círculo, en una página con fecha); a la derecha la tarjeta. Se pinta por tramos: con miles de
 * entradas, lo que se ve y un poco más
 */
import type { ChronologyEntryView, TimelineGroupView } from '@crisol/contracts'
import type { CalendarDefinition } from '@crisol/domain'
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  onEdit
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
  return (
    <ol className={styles.list} aria-label={t('chronologies.views.list')}>
      {visible.map((entry, index) => {
        const group = groupOf(entry.groupId)
        const distance = distanceText(definition, entries[index - 1], entry)
        return (
          <li
            key={entry.key}
            className={styles.listRow}
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
      })}
      {shown < entries.length && <li ref={sentinel} className={styles.sentinel} aria-hidden="true" />}
    </ol>
  )
}
