/**
 * Pegar lo que dibuja la IA a lo que ya hay (módulo 9): los vértices de una región o una ruta, a los de lo demás que
 * estén muy cerca (fronteras vecinas sin huecos), y los extremos de una ruta, a los pines (y entonces la ruta los
 * recuerda). La IA da coordenadas aproximadas: sin esto, dos reinos vecinos dejarían una rendija entre ellos
 */
import type { MapGeometry } from '@crisol/contracts'

type Point = [number, number]
export type SnapTargets = { vertices: readonly Point[]; pins: readonly { id: string; x: number; y: number }[] }

/** Lo que se pega: a menos de este trozo del lado mayor de la imagen (1,2 %: unos 20 px en una de 1600) */
export const SNAP_TOLERANCE = 0.012

/** Los vértices de lo dibujado (menos lo que se cambia) */
export function verticesOf(geometries: readonly MapGeometry[]): Point[] {
  const out: Point[] = []
  for (const geometry of geometries) {
    if ('pieces' in geometry) for (const piece of geometry.pieces) for (const p of piece) out.push([p[0], p[1]])
    if ('points' in geometry) for (const p of geometry.points) out.push([p[0], p[1]])
  }
  return out
}

function nearest<T>(point: Point, candidates: readonly T[], at: (c: T) => Point, image: Size, tolerance: number) {
  const limit = tolerance * Math.max(image.width, image.height)
  let best: T | null = null
  let bestDistance = limit
  for (const candidate of candidates) {
    const [x, y] = at(candidate)
    const distance = Math.hypot((x - point[0]) * image.width, (y - point[1]) * image.height)
    if (distance <= bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}

type Size = { width: number; height: number }

/** La geometría con sus vértices pegados a lo cercano; un texto, tal cual */
export function snapGeometry(
  geometry: MapGeometry,
  targets: SnapTargets,
  image: Size,
  tolerance = SNAP_TOLERANCE
): MapGeometry {
  const toVertex = (p: readonly number[]): Point => {
    const point: Point = [p[0] ?? 0, p[1] ?? 0]
    return nearest(point, targets.vertices, (v) => v, image, tolerance) ?? point
  }
  if ('pieces' in geometry) return { pieces: geometry.pieces.map((piece) => piece.map(toVertex)) }
  if (!('points' in geometry)) return geometry
  const points = geometry.points.map(toVertex)
  // Los extremos, a un pin si lo hay cerca (manda sobre un vértice)
  const end = (index: number) => {
    const p = geometry.points[index]
    if (!p) return null
    return nearest([p[0], p[1]], targets.pins, (pin) => [pin.x, pin.y], image, tolerance)
  }
  const first = end(0)
  const last = end(points.length - 1)
  if (first) points[0] = [first.x, first.y]
  if (last) points[points.length - 1] = [last.x, last.y]
  return {
    points,
    from: first?.id ?? geometry.from ?? null,
    to: last?.id ?? geometry.to ?? null
  }
}
