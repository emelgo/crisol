/**
 * Lo que se ve mientras se dibuja o se retoca en un mapa (módulo 9): la región o la ruta a medio dibujar, con su goma
 * hasta el cursor, y los tiradores de lo elegido (sus vértices y el «+» de cada lado), que guardan su tamaño en pantalla
 * como los pines (--inv-k). El visor lleva la cuenta; esto solo pinta y avisa
 */
import type { MapGeometry } from '@crisol/contracts'
import type { PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { midpoints, type Point, ringsOf, type VertexRef } from './edit.ts'
import { pathOf, type Size } from './geometry.ts'
import styles from './map.module.css'

export type Draft = { kind: 'region' | 'path'; points: Point[] }

/** Lo que se está dibujando: lo puesto y la goma hasta el cursor (pegado, si se pega) */
export function DraftLayer({
  image,
  draft,
  cursor,
  variant = 'draft'
}: {
  image: Size
  draft: Draft
  cursor: Point | null
  /** Medir: su propia línea, más marcada (no es algo que se dibuja) */
  variant?: 'draft' | 'measure'
}) {
  const points = cursor ? [...draft.points, cursor] : draft.points
  const closed = draft.kind === 'region' && points.length > 2
  return (
    <svg
      className={styles.drawing}
      viewBox={`0 0 ${image.width} ${image.height}`}
      width={image.width}
      height={image.height}
      aria-hidden="true"
    >
      {closed && <path d={pathOf(points, image, true)} className={styles.draftFill} />}
      <path
        d={pathOf(points, image, false)}
        className={variant === 'measure' ? styles.measureLine : styles.draftLine}
      />
      {draft.points.map(([x, y], index) => (
        <circle
          key={index}
          className={styles.draftDot}
          cx={x * image.width}
          cy={y * image.height}
          r={5}
          data-first={index === 0 || undefined}
        />
      ))}
    </svg>
  )
}

/**
 * Los tiradores de lo elegido: arrastrar un vértice lo mueve; el «+» de un lado añade uno; el botón derecho lo quita.
 * Fuera del orden del tabulador: con el teclado se cambia todo lo demás en su panel, y la forma, con la IA
 */
export function EditHandles({
  geometry,
  onVertexDown,
  onMidpointDown,
  onVertexRemove
}: {
  geometry: MapGeometry
  onVertexDown: (event: PointerEvent<HTMLElement>, ref: VertexRef) => void
  onMidpointDown: (event: PointerEvent<HTMLElement>, ref: VertexRef, at: Point) => void
  onVertexRemove: (ref: VertexRef) => void
}) {
  const { t } = useTranslation()
  const rings = ringsOf(geometry)
  return (
    <div className={styles.handles}>
      {midpoints(geometry).map(({ ref, at }) => (
        <button
          type="button"
          tabIndex={-1}
          key={`m-${ref.piece}-${ref.index}`}
          className={styles.midpoint}
          aria-label={t('map.edit.addVertex')}
          title={t('map.edit.addVertex')}
          style={{ insetInlineStart: `${at[0] * 100}%`, insetBlockStart: `${at[1] * 100}%` }}
          onPointerDown={(event) => onMidpointDown(event, ref, at)}
        />
      ))}
      {rings.flatMap((ring, piece) =>
        ring.map(([x, y], index) => (
          <button
            type="button"
            tabIndex={-1}
            key={`v-${piece}-${index}`}
            className={styles.vertex}
            aria-label={t('map.edit.vertex')}
            title={t('map.edit.vertex')}
            style={{ insetInlineStart: `${x * 100}%`, insetBlockStart: `${y * 100}%` }}
            onPointerDown={(event) => onVertexDown(event, { piece, index })}
            onContextMenu={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onVertexRemove({ piece, index })
            }}
          />
        ))
      )}
    </div>
  )
}
