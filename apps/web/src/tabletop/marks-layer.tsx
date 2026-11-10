/**
 * Los textos, los sellos y los pines dejados en el mapa (docs/specs/herramientas-mesa.md), encima del lienzo: en la
 * mesa del máster y en la tele. Cada uno lleva su sitio en data-x, data-y y se coloca con la vista (placeMarks); los
 * textos y los sellos crecen con el zoom, los pines no. No reciben el ratón: los gestos los lleva la mesa
 */
import type { MarkView, ScreenMark } from '@crisol/contracts'
import type { Viewport } from '@crisol/tabletop'
import {
  ArrowRight,
  CircleDot,
  DoorOpen,
  Eye,
  Flame,
  Footprints,
  Key,
  Lightbulb,
  MapPin,
  Package,
  Skull,
  Swords,
  TriangleAlert,
  X
} from 'lucide-react'
import { type RefObject, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PinShape } from '../wiki/map/pin-shape.tsx'
import styles from './tools.module.css'
import { PIN_SIZE } from './tools.ts'

/** Los sellos de Lucide que se ofrecen, por su nombre */
export const STAMP_ICONS = {
  skull: Skull,
  package: Package,
  flame: Flame,
  'triangle-alert': TriangleAlert,
  x: X,
  'arrow-right': ArrowRight,
  'map-pin': MapPin,
  lightbulb: Lightbulb,
  key: Key,
  swords: Swords,
  'door-open': DoorOpen,
  footprints: Footprints,
  eye: Eye
} as const

export type StampIcon = keyof typeof STAMP_ICONS

/** El icono de un sello por su nombre (uno que no se conoce, un punto) */
export function StampGlyph({ icon, size }: { icon: string | null; size: number }) {
  const Icon = (icon && STAMP_ICONS[icon as StampIcon]) || CircleDot
  return <Icon aria-hidden="true" size={size} />
}

/** Coloca las marcas con la vista de ahora: los textos y los sellos, además, con su escala y su giro */
export function placeMarks(layer: HTMLElement | null, view: Viewport) {
  if (!layer) return
  for (const element of layer.children) {
    const mark = element as HTMLElement
    const x = Number(mark.dataset.x) * view.scale + view.x
    const y = Number(mark.dataset.y) * view.scale + view.y
    const rotate = Number(mark.dataset.rotation ?? 0)
    // Escalado con el mapa, centrado en su punto (data-center) o encima de él, como un pin
    mark.style.transform =
      mark.dataset.scaled !== undefined
        ? `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${view.scale}) rotate(${rotate}deg)`
        : mark.dataset.center !== undefined
          ? `translate(${x}px, ${y}px) translate(-50%, -50%)`
          : `translate(${x}px, ${y}px) translate(-50%, -100%)`
  }
}

type Placed = Extract<MarkView | ScreenMark, { kind: 'text' | 'stamp' | 'pin' }>

export function MarksLayer({
  layer,
  view,
  marks,
  big = false
}: {
  layer: RefObject<HTMLDivElement | null>
  view: RefObject<Viewport>
  marks: ReadonlyArray<MarkView | ScreenMark>
  /** La tele: los pines algo más grandes */
  big?: boolean
}) {
  const { t } = useTranslation()
  const placed = marks.filter(
    (mark): mark is Placed => mark.kind === 'text' || mark.kind === 'stamp' || mark.kind === 'pin'
  )
  useLayoutEffect(() => placeMarks(layer.current, view.current))
  return (
    <div ref={layer} className={styles.marks} aria-hidden="true">
      {placed.map((mark) => {
        const secret = 'hidden' in mark && mark.hidden
        if (mark.kind === 'text')
          return (
            <span
              key={mark.id}
              className={styles.text}
              data-x={mark.x}
              data-y={mark.y}
              data-rotation={mark.rotation ?? 0}
              data-scaled=""
              data-secret={secret || undefined}
              data-mark={mark.id}
              style={{ color: mark.color, fontSize: `${mark.size}px` }}
            >
              {mark.text}
            </span>
          )
        if (mark.kind === 'stamp')
          return (
            <span
              key={mark.id}
              className={styles.stamp}
              data-x={mark.x}
              data-y={mark.y}
              data-rotation={mark.rotation ?? 0}
              data-scaled=""
              data-secret={secret || undefined}
              data-mark={mark.id}
              style={{ inlineSize: `${mark.size}px`, blockSize: `${mark.size}px`, color: mark.color }}
            >
              {mark.fileId ? (
                <img src={`/api/files/${mark.fileId}`} alt="" />
              ) : (
                <StampGlyph icon={mark.icon} size={Math.round(mark.size * 0.55)} />
              )}
            </span>
          )
        const size = big ? PIN_SIZE * 1.3 : PIN_SIZE
        const label = mark.icon === 'number' || mark.icon === 'letter' ? mark.label : null
        return (
          <span
            key={mark.id}
            className={styles.pin}
            data-x={mark.x}
            data-y={mark.y}
            data-secret={secret || undefined}
            data-mark={mark.id}
            title={mark.label || t('tools.pin')}
          >
            <PinShape shape={0} color={mark.color ?? '#c9302c'} icon={label} size={size} />
          </span>
        )
      })}
    </div>
  )
}
