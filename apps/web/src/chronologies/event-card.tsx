/**
 * La tarjeta de una entrada (lienzo del módulo 8, pantallas 4 y 7; Everlore, timeline-tab-pane.tsx:963-1052): una
 * franja de proporción fija (6:1; 3:1 en el móvil) con su color o su imagen con su encuadre, un degradado oscuro abajo,
 * el grupo como píldora arriba, el título con su icono, la fecha, dos líneas de descripción y la página enlazada como
 * chip. Una página con fecha, igual, con su portada y la marca «Página». La misma en la lista, el detalle del día y la
 * vista previa del cuadro del evento
 */
import type { ChronologyEntryView, TimelineGroupView } from '@crisol/contracts'
import { EyeOff, FileText, Repeat } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '../components/icon.tsx'
import { colorHex } from '../routes/world-look.ts'
import { PageLink } from '../wiki/read-as.tsx'
import styles from './chronologies.module.css'

/** Lo que pinta una tarjeta (una entrada, o lo que se está escribiendo en el cuadro del evento) */
export type CardEntry = Pick<
  ChronologyEntryView,
  | 'kind'
  | 'title'
  | 'text'
  | 'yearly'
  | 'field'
  | 'color'
  | 'image'
  | 'cover'
  | 'icon'
  | 'untitled'
  | 'description'
  | 'page'
  | 'hidden'
  | 'pageId'
  | 'converted'
>

/** El color de una entrada: el suyo, el de su grupo o el de la línea (las páginas, el azul de los enlaces) */
export function entryColor(entry: Pick<CardEntry, 'kind' | 'color'>, group: TimelineGroupView | undefined): string {
  if (entry.color) return colorHex(entry.color as never) ?? entry.color
  if (group?.color) return colorHex(group.color) ?? 'var(--color-muted)'
  return entry.kind === 'page' ? 'var(--color-link)' : 'var(--color-muted)'
}

/** El icono que se ve: el suyo o, sin título propio, el de su página */
export const shownIcon = (entry: Pick<CardEntry, 'icon' | 'untitled' | 'page'>) =>
  entry.icon ?? (entry.untitled ? (entry.page?.icon ?? null) : null)

/** La imagen de fondo: la del evento o la portada de la página, con su encuadre */
function backdrop(entry: CardEntry): { url: string; x: number; y: number } | null {
  const image = entry.image ?? entry.cover
  return image ? { url: `/api/files/${image.fileId}`, x: image.x, y: image.y } : null
}

export function EventCard({
  worldId,
  entry,
  group,
  actions,
  titleAction,
  compact = false,
  headingLevel = 3
}: {
  worldId: string
  entry: CardEntry
  group: TimelineGroupView | undefined
  /** El «⋯» del máster */
  actions?: ReactNode
  /** Pulsar el título (un evento, para el máster: editarlo) */
  titleAction?: (() => void) | undefined
  /** Más baja (3:1), para el móvil */
  compact?: boolean
  headingLevel?: 3 | 4
}) {
  const { t } = useTranslation()
  const color = entryColor(entry, group)
  const image = backdrop(entry)
  const icon = shownIcon(entry)
  const Heading = headingLevel === 3 ? 'h3' : 'h4'
  const title = (
    <>
      {icon && <Icon value={icon} size={18} className={styles.cardIcon} />}
      <span>{entry.title}</span>
      {entry.field && <span className={styles.cardField}> · {entry.field}</span>}
    </>
  )
  return (
    <article
      className={styles.eventCard}
      data-compact={compact || undefined}
      data-hidden={entry.hidden || undefined}
      style={{ '--entry-color': color } as CSSProperties}
    >
      <div className={styles.cardBand} aria-hidden="true">
        {image && (
          <img
            src={image.url}
            alt=""
            className={styles.cardImage}
            style={{ objectPosition: `${image.x}% ${image.y}%` }}
          />
        )}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          {entry.kind === 'page' ? (
            <span className={styles.cardPill}>
              <FileText size={12} aria-hidden="true" />
              {t('chronologies.page')}
            </span>
          ) : (
            group && (
              <span className={styles.cardPill} style={{ '--pill-color': color } as CSSProperties}>
                <span className={styles.pillDot} aria-hidden="true" />
                {group.name}
              </span>
            )
          )}
          {entry.hidden && (
            <span className={styles.cardPill} title={t('chronologies.hiddenNote')}>
              <EyeOff size={12} aria-hidden="true" />
              {t('chronologies.hidden')}
            </span>
          )}
          {actions && <div className={styles.cardActions}>{actions}</div>}
        </div>
        <Heading className={styles.cardTitle}>
          {entry.kind === 'page' && entry.pageId ? (
            <PageLink worldId={worldId} pageId={entry.pageId} className={styles.cardTitleLink}>
              {title}
            </PageLink>
          ) : titleAction ? (
            <button type="button" className={styles.cardTitleButton} onClick={titleAction}>
              {title}
            </button>
          ) : (
            title
          )}
        </Heading>
        <p className={styles.cardDate}>
          {entry.yearly && <Repeat size={12} aria-label={t('chronologies.yearly')} className={styles.cardYearly} />}
          {entry.text}
          {entry.converted && <span className={styles.cardConverted}> · {entry.converted.text}</span>}
        </p>
        {entry.description && <p className={styles.cardDescription}>{entry.description}</p>}
        {entry.kind === 'event' && entry.page && !entry.untitled && (
          <PageLink worldId={worldId} pageId={entry.page.id} className={styles.cardChip}>
            {entry.page.icon && <Icon value={entry.page.icon} size={12} />}
            {entry.page.title}
          </PageLink>
        )}
        {entry.kind === 'event' && entry.page && entry.untitled && (
          <PageLink worldId={worldId} pageId={entry.page.id} className={styles.cardChip}>
            {t('chronologies.openPage')}
          </PageLink>
        )}
      </div>
    </article>
  )
}
