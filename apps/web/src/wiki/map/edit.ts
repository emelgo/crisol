/**
 * Las cuentas de dibujar y retocar en un mapa (módulo 9), en coordenadas de 0 a 1: pegar un punto a los vértices y
 * pines cercanos (fronteras vecinas sin huecos), mover una pieza entera, añadir y quitar vértices. Puras, para el visor y
 * sus pruebas
 */
import type { MapElementView, MapGeometry, MapPinView } from '@crisol/contracts'
import type { Size } from './geometry.ts'

export type Point = [number, number]

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** Los vértices de lo dibujado (menos lo que se edita) y los pines: a donde se pega un punto */
export function snapTargets(
  elements: readonly MapElementView[],
  pins: readonly Pick<MapPinView, 'x' | 'y'>[],
  except: string | null
): Point[] {
  const out: Point[] = pins.map((pin) => [pin.x, pin.y])
  for (const element of elements) {
    if (element.id === except) continue
    const { geometry } = element
    if ('pieces' in geometry) for (const piece of geometry.pieces) for (const p of piece) out.push([p[0], p[1]])
    if ('points' in geometry) for (const p of geometry.points) out.push([p[0], p[1]])
  }
  return out
}

/**
 * El punto, pegado al objetivo más cercano si está a menos de `radius` píxeles de pantalla (con la escala `k` y el
 * tamaño de la imagen); si no, tal cual
 */
export function snapped(point: Point, targets: readonly Point[], image: Size, k: number, radius = 10) {
  let best: Point | null = null
  let bestDistance = radius
  for (const target of targets) {
    const distance = Math.hypot((target[0] - point[0]) * image.width * k, (target[1] - point[1]) * image.height * k)
    if (distance <= bestDistance) {
      best = target
      bestDistance = distance
    }
  }
  return { point: best ? ([best[0], best[1]] as Point) : point, snapped: best !== null }
}

/** La geometría movida entera (sin salirse de la imagen) */
export function moved(geometry: MapGeometry, dx: number, dy: number): MapGeometry {
  const shift = (p: readonly number[]): Point => [clamp01((p[0] ?? 0) + dx), clamp01((p[1] ?? 0) + dy)]
  if ('pieces' in geometry) return { pieces: geometry.pieces.map((piece) => piece.map(shift)) }
  // Movida, una ruta deja de empezar o acabar en su pin
  if ('points' in geometry) return { points: geometry.points.map(shift), from: null, to: null }
  return { ...geometry, at: shift(geometry.at) }
}

/** Dónde está un vértice: en qué pieza (una ruta tiene una sola) y en qué puesto */
export type VertexRef = { piece: number; index: number }

/** Las listas de puntos de una geometría (las piezas de una región o la línea de una ruta) */
export function ringsOf(geometry: MapGeometry): Point[][] {
  if ('pieces' in geometry) return geometry.pieces.map((piece) => piece.map((p) => [p[0], p[1]] as Point))
  if ('points' in geometry) return [geometry.points.map((p) => [p[0], p[1]] as Point)]
  return []
}

function withRings(geometry: MapGeometry, rings: Point[][]): MapGeometry {
  if ('pieces' in geometry) return { pieces: rings }
  if ('points' in geometry) return { ...geometry, points: rings[0] ?? [] }
  return geometry
}

/** El vértice movido a otro sitio (en una ruta, el primero o el último dejan su pin) */
export function withVertex(geometry: MapGeometry, ref: VertexRef, point: Point): MapGeometry {
  const rings = ringsOf(geometry)
  const ring = rings[ref.piece]
  if (!ring || ref.index < 0 || ref.index >= ring.length) return geometry
  ring[ref.index] = [clamp01(point[0]), clamp01(point[1])]
  const next = withRings(geometry, rings)
  if ('points' in next && 'points' in geometry) {
    if (ref.index === 0) next.from = null
    if (ref.index === ring.length - 1) next.to = null
  }
  return next
}

/** Un vértice nuevo tras `ref` (en el lado que va de él al siguiente) */
export function insertedVertex(geometry: MapGeometry, ref: VertexRef, point: Point): MapGeometry {
  const rings = ringsOf(geometry)
  const ring = rings[ref.piece]
  if (!ring) return geometry
  ring.splice(ref.index + 1, 0, [clamp01(point[0]), clamp01(point[1])])
  return withRings(geometry, rings)
}

/** Sin un vértice, si le quedan bastantes (una pieza, 3; una ruta, 2); si no, null */
export function withoutVertex(geometry: MapGeometry, ref: VertexRef): MapGeometry | null {
  const rings = ringsOf(geometry)
  const ring = rings[ref.piece]
  const least = 'pieces' in geometry ? 3 : 2
  if (!ring || ring.length <= least) return null
  ring.splice(ref.index, 1)
  return withRings(geometry, rings)
}

/** Los puntos medios de cada lado (para el «+» que añade un vértice), con el vértice tras el que irían */
export function midpoints(geometry: MapGeometry): { ref: VertexRef; at: Point }[] {
  const closed = 'pieces' in geometry
  return ringsOf(geometry).flatMap((ring, piece) =>
    ring.flatMap((a, index) => {
      const b = ring[index + 1] ?? (closed ? ring[0] : undefined)
      if (!b) return []
      return [{ ref: { piece, index }, at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Point }]
    })
  )
}
