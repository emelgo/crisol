// Portado de packages/mesa/src/nucleo/dibujo.ts (Crisol actual, commit 3f68f11)
/**
 * Geometría de los dibujos de la mesa: trazos como polilíneas, formas convertidas en sus puntos, la goma que parte los
 * trazos, qué toca un punto y lo que queda de un trazo dentro de una zona (para no mandar a la pantalla lo que cae en
 * la niebla). Puro.
 */
import type { Point } from './geometry.ts'

/** Separación mínima (píxeles del mundo) entre los puntos de un trazo a mano alzada */
export const STROKE_SPACING = 2
/** Lado por defecto de un sello: una casilla de 100 px */
export const STAMP_SIDE = 100

/** Lo que se lee de un dibujo: su tipo (un sello es `stamp`), sus puntos y su grosor (o el lado del sello) */
export interface DrawingShape {
  type?: unknown
  points?: readonly Point[] | undefined
  width?: unknown
}

export const isStamp = (d: DrawingShape): boolean => d.type === 'stamp'

/** Añade un punto al trazo si se aleja lo bastante del último */
export function followStroke(points: readonly Point[], p: Point): Point[] {
  const last = points[points.length - 1]
  if (last && Math.hypot(p.x - last.x, p.y - last.y) < STROKE_SPACING) return [...points]
  return [...points, { x: p.x, y: p.y }]
}

/** Los cinco puntos (cerrado) del rectángulo de esquina a esquina */
export const rectanglePoints = (a: Point, b: Point): Point[] => [
  { x: a.x, y: a.y },
  { x: b.x, y: a.y },
  { x: b.x, y: b.y },
  { x: a.x, y: b.y },
  { x: a.x, y: a.y }
]

/** Los puntos (cerrado) del círculo con ese centro que pasa por `edge` */
export function circlePoints(center: Point, edge: Point, sides = 64): Point[] {
  const radius = Math.hypot(edge.x - center.x, edge.y - center.y)
  return Array.from({ length: sides + 1 }, (_, i) => {
    const angle = (i / sides) * Math.PI * 2
    return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius }
  })
}

const distanceToSegment = (p: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = dx * dx + dy * dy
  const k = length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length))
  return Math.hypot(p.x - (a.x + k * dx), p.y - (a.y + k * dy))
}

/**
 * Parte un trazo en los tramos de puntos que cumplen `keep`: en los tramos donde puede cambiar (`near`), se añaden
 * puntos cada `step` para cortar justo por el borde
 */
function splitWhere(
  points: readonly Point[],
  keep: (p: Point) => boolean,
  near: (a: Point, b: Point) => boolean,
  step: number
): Point[][] {
  const first = points[0]
  if (!first) return []
  const dense: Point[] = [first]
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Point
    const b = points[i] as Point
    if (near(a, b)) {
      const n = Math.min(2000, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step))
      for (let k = 1; k < n; k++) dense.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n })
    }
    dense.push(b)
  }
  const runs: Point[][] = []
  let current: Point[] = []
  for (const p of dense) {
    if (keep(p)) current.push(p)
    else {
      if (current.length > 0) runs.push(current)
      current = []
    }
  }
  if (current.length > 0) runs.push(current)
  return runs
}

/**
 * Lo que queda de un trazo tras pasar la goma (un círculo): los tramos de puntos fuera de ella, o null si la goma no
 * lo tocó. Una lista vacía es que lo borró entero
 */
export function splitByEraser(points: readonly Point[], center: Point, radius: number, width = 0): Point[][] | null {
  // Toca la tinta: el trazo tiene su grosor
  const reach = radius + width / 2
  const inside = (p: Point): boolean => Math.hypot(p.x - center.x, p.y - center.y) <= reach
  const first = points[0]
  if (!first) return null
  const touches =
    points.length === 1
      ? inside(first)
      : points.some((p, i) => i > 0 && distanceToSegment(center, points[i - 1] as Point, p) <= reach)
  if (!touches) return null
  // Donde pasa la goma, más puntos: corta justo por ella aunque sea más fina que el tramo
  const step = Math.max(0.5, reach / 2)
  return splitWhere(
    points,
    (p) => !inside(p),
    (a, b) => distanceToSegment(center, a, b) <= reach + step,
    step
  )
}

/**
 * Los tramos de un trazo que caen dentro de una zona (lo que puede ver la pantalla), mirando un punto cada `step`
 * píxeles: lo de fuera se quita
 */
export function strokeInside(points: readonly Point[], inside: (p: Point) => boolean, step: number): Point[][] {
  return splitWhere(points, inside, () => true, Math.max(1, step))
}

/** Si el punto toca el dibujo: un sello en todo su cuadrado; un trazo a media anchura de su línea (más `slack`) */
export function touchesDrawing(d: DrawingShape, p: Point, slack: number): boolean {
  const points = d.points ?? []
  const width = typeof d.width === 'number' ? d.width : 1
  if (isStamp(d)) {
    const c = points[0]
    const half = (typeof d.width === 'number' ? d.width : STAMP_SIDE) / 2 + slack
    return !!c && Math.abs(p.x - c.x) <= half && Math.abs(p.y - c.y) <= half
  }
  const reach = width / 2 + slack
  const first = points[0]
  if (points.length === 1 && first) return Math.hypot(p.x - first.x, p.y - first.y) <= reach
  for (let i = 1; i < points.length; i++)
    if (distanceToSegment(p, points[i - 1] as Point, points[i] as Point) <= reach) return true
  return false
}
