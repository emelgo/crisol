// Portado de packages/mesa/src/nucleo/movimiento.ts (Crisol actual, commit 3f68f11)
/**
 * Los muros frenan el paso: una ficha no atraviesa un muro ni una puerta cerrada (las abiertas dejan pasar; los muros
 * de un sentido, solo desde su lado de paso). Para validar en el servidor el movimiento de un jugador y para dejar la
 * ficha en el último sitio libre del camino, ajustado a la rejilla si la escena ajusta. Puro.
 */
import type { Point } from './geometry.ts'
import { WallIndex } from './wall-index.ts'
import { type DoorStates, type Edge, type Wall, wallEdges } from './walls.ts'

/** Los tramos que paran el paso: todos los muros que lo paran salvo las puertas abiertas (y la pared que tapan) */
export const movementEdges = (walls: readonly Wall[], doors: DoorStates): Edge[] => wallEdges(walls, doors, 'move')

const side = (a: Point, b: Point, p: Point): number => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)

/** Si el segmento p→q cruza el tramo (o acaba encima de él) */
function crosses(p: Point, q: Point, edge: Edge): boolean {
  const d1 = side(edge.a, edge.b, p)
  const d2 = side(edge.a, edge.b, q)
  const d3 = side(p, q, edge.a)
  const d4 = side(p, q, edge.b)
  // Acabar justo encima del muro también es cruzarlo (salir de encima de uno, no)
  if (!((d1 > 0 && d2 <= 0) || (d1 < 0 && d2 >= 0))) return false
  if (!((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0) || d3 === 0 || d4 === 0)) return false
  if (!edge.pass) return true
  // En pantalla (y hacia abajo), «izquierda» de a→b es el lado con producto negativo
  const fromLeft = d1 < 0
  return edge.pass === 'left' ? !fromLeft : fromLeft
}

/** Si ir en línea recta de p a q atraviesa algún tramo (con un índice, solo prueba los de su camino) */
export function crossesWall(p: Point, q: Point, edges: readonly Edge[] | WallIndex<Edge>): boolean {
  const near = edges instanceof WallIndex ? edges.querySegment(p, q) : edges
  return near.some((edge) => crosses(p, q, edge))
}

/**
 * Hasta dónde llega una ficha que se mueve de `from` a `to` sin atravesar muros: el destino (ajustado) si el camino está
 * libre; si no, el último punto libre del camino cada `step` píxeles, ajustado y sin cruzar ningún muro desde el origen.
 */
export function freeDestination(
  from: Point,
  to: Point,
  edges: readonly Edge[] | WallIndex<Edge>,
  snap: (p: Point) => Point = (p) => p,
  step = 10
): Point {
  const end = snap(to)
  if (!crossesWall(from, end, edges)) return end
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  const steps = Math.max(1, Math.ceil(distance / step))
  for (let i = steps - 1; i > 0; i--) {
    const k = i / steps
    const p = snap({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k })
    if (!crossesWall(from, p, edges)) return p
  }
  return from
}
