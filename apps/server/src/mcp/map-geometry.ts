/**
 * Lo que dibuja la IA en un mapa (módulo 9), antes de guardarlo: sus puntos, de los píxeles de la imagen que vio
 * (imagen_mapa) a 0–1, y simplificados (sin los que no cambian la forma, y como mucho los que caben), como recomienda el
 * estudio del módulo 9: la IA acierta más en píxeles de lo que ve que en coordenadas sueltas
 */
import type { MapGeometry } from '@crisol/contracts'

type Point = [number, number]
export type View = { width: number; height: number }
export type Loose =
  | { pieces: number[][][] }
  | { points: number[][]; from?: string | null; to?: string | null }
  | { at: number[]; rotate?: number; arc?: number }

/** Lo más que se guarda de cada pieza o ruta dibujada por la IA */
export const MAX_DRAWN_POINTS = 400
/** Lo que se tolera al simplificar, en partes de la imagen (unos 2 px en una de 1600) */
const TOLERANCE = 0.0012

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** Un punto, de los píxeles de la vista (si la hay) a 0–1 */
const toUnit = (p: readonly number[], view: View | undefined): Point => {
  const [x = 0, y = 0] = p
  return view ? [clamp01(x / view.width), clamp01(y / view.height)] : [clamp01(x), clamp01(y)]
}

/** La distancia de un punto a un segmento */
function distanceToSegment(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const length = dx * dx + dy * dy
  if (length === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

/** Douglas–Peucker: los puntos que hacen la forma, sin los que se apartan menos que la tolerancia */
export function simplify(points: readonly Point[], tolerance: number): Point[] {
  if (points.length <= 2) return [...points]
  const first = points[0] as Point
  const last = points[points.length - 1] as Point
  let index = 0
  let farthest = 0
  for (let i = 1; i < points.length - 1; i++) {
    const distance = distanceToSegment(points[i] as Point, first, last)
    if (distance > farthest) {
      farthest = distance
      index = i
    }
  }
  if (farthest <= tolerance) return [first, last]
  return [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(points.slice(index), tolerance)]
}

/** Simplificada hasta que quepa (subiendo la tolerancia) y sin puntos repetidos seguidos */
function fit(points: Point[], least: number) {
  const unique = points.filter((p, i) => i === 0 || p[0] !== points[i - 1]?.[0] || p[1] !== points[i - 1]?.[1])
  let tolerance = TOLERANCE
  let out = simplify(unique, tolerance)
  while (out.length > MAX_DRAWN_POINTS) {
    tolerance *= 2
    out = simplify(unique, tolerance)
  }
  return out.length >= least ? out : unique.slice(0, Math.max(least, unique.length))
}

/** La geometría de la IA, lista para guardar: en 0–1 y simplificada */
export function fromAi(geometry: Loose, view?: View): MapGeometry {
  if ('pieces' in geometry) {
    return {
      pieces: geometry.pieces.map((piece) => {
        const ring = piece.map((p) => toUnit(p, view))
        // Una pieza cerrada a mano (el último igual al primero): sin repetirlo
        const closed = ring.length > 3 && ring[0]?.[0] === ring.at(-1)?.[0] && ring[0]?.[1] === ring.at(-1)?.[1]
        return fit(closed ? ring.slice(0, -1) : ring, 3)
      })
    }
  }
  if ('points' in geometry) {
    return {
      points: fit(
        geometry.points.map((p) => toUnit(p, view)),
        2
      ),
      ...(geometry.from !== undefined ? { from: geometry.from } : {}),
      ...(geometry.to !== undefined ? { to: geometry.to } : {})
    }
  }
  return {
    at: toUnit(geometry.at, view),
    ...(geometry.rotate !== undefined ? { rotate: geometry.rotate } : {}),
    ...(geometry.arc !== undefined ? { arc: geometry.arc } : {})
  }
}
