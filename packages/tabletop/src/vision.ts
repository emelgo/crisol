// Portado de packages/mesa/src/nucleo/vision.ts (Crisol actual, commit 3f68f11)
/**
 * Lo que se ve (o lo que alumbra una luz) desde un punto entre muros: un polígono de visibilidad por barrido de rayos
 * hacia los extremos de los tramos. Un tramo limitado deja pasar el primero que se cruza y para en el segundo; uno de un
 * solo sentido solo para desde uno de sus lados. Con un índice espacial (`WallIndex`) cada rayo prueba solo los tramos
 * de las celdas que cruza, los extremos que no se ven no lanzan rayos y los cruces entre tramos sí (el contorno también
 * dobla en ellos); con una lista, se prueban todos los tramos en cada rayo, como antes.
 * Puro: sin DOM ni render.
 */
import type { Point } from './geometry.ts'
import { WallIndex } from './wall-index.ts'
import type { Edge } from './walls.ts'

/** Los tramos entre los que se mira: una lista (se prueban todos) o un índice */
export type EdgeSource = readonly Edge[] | WallIndex<Edge>

/** Un cono: su abertura (grados, 1–359) y hacia dónde mira (grados; 0 arriba, 90 a la derecha) */
export interface Cone {
  angle: number
  rotation: number
}

/** Lados del contorno: sin muros, el polígono es un círculo de tantos lados */
export const CONTOUR_SIDES = 48
/** Los extremos más lejos que esto (en radios) no lanzan rayos */
const ENDPOINT_REACH = 1.5
/** Cuánto se separan del extremo de un tramo los rayos que lo rozan (radianes) */
const GRAZE = 1e-4

/** Lado del punto respecto a a→b: >0 a la izquierda en pantalla (y hacia abajo), <0 a la derecha */
const side = (a: Point, b: Point, p: Point): number => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)

/** Si el tramo para lo que viene desde `origin` (los de un sentido dejan pasar desde su lado de paso) */
export function edgeBlocks(edge: Edge, origin: Point): boolean {
  if (!edge.pass) return true
  // En pantalla (y hacia abajo), «izquierda» de a→b es el lado con producto negativo
  const onLeft = side(edge.a, edge.b, origin) < 0
  return edge.pass === 'left' ? !onLeft : onLeft
}

/** Distancia (en unidades del rayo) a la que el rayo o + d·t corta el tramo, o null */
function cut(o: Point, d: Point, a: Point, b: Point): number | null {
  const ex = b.x - a.x
  const ey = b.y - a.y
  const den = d.x * ey - d.y * ex
  if (Math.abs(den) < 1e-12) return null
  const t = ((a.x - o.x) * ey - (a.y - o.y) * ex) / den
  const u = ((a.x - o.x) * d.y - (a.y - o.y) * d.x) / den
  return t > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 ? t : null
}

/** Dónde para un rayo: el primer tramo que para del todo o el segundo limitado */
class Stop {
  full = Number.POSITIVE_INFINITY
  limited1 = Number.POSITIVE_INFINITY
  limited2 = Number.POSITIVE_INFINITY

  reset(): void {
    this.full = Number.POSITIVE_INFINITY
    this.limited1 = Number.POSITIVE_INFINITY
    this.limited2 = Number.POSITIVE_INFINITY
  }

  add(t: number, limited: boolean): void {
    if (!limited) this.full = Math.min(this.full, t)
    else if (t < this.limited1) {
      this.limited2 = this.limited1
      this.limited1 = t
    } else if (t < this.limited2) this.limited2 = t
  }

  get at(): number {
    return Math.min(this.full, this.limited2)
  }
}

const stop = new Stop()

/** Hasta dónde llega un rayo (dirección unitaria) antes de pararse, como mucho `radius` */
function reach(origin: Point, dir: Point, source: EdgeSource, radius: number): number {
  stop.reset()
  const test = (edge: Edge): void => {
    if (!edgeBlocks(edge, origin)) return
    const t = cut(origin, dir, edge.a, edge.b)
    if (t !== null && t < radius) stop.add(t, edge.limited)
  }
  if (source instanceof WallIndex) source.walkRay(origin, dir, radius, test, (exit) => stop.at <= exit)
  else for (const edge of source) test(edge)
  return Math.min(radius, stop.at)
}

/** Todos los ángulos en [−π, π), como los de `atan2`: si no, el contorno se ordena en vueltas distintas y se cruza */
const wrap = (a: number): number => ((((a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI

/** Dónde se cortan dos tramos por dentro (no en un extremo de alguno), o null */
function crossing(p: Edge, q: Edge): Point | null {
  const rx = p.b.x - p.a.x
  const ry = p.b.y - p.a.y
  const sx = q.b.x - q.a.x
  const sy = q.b.y - q.a.y
  const den = rx * sy - ry * sx
  if (Math.abs(den) < 1e-12) return null
  const t = ((q.a.x - p.a.x) * sy - (q.a.y - p.a.y) * sx) / den
  const u = ((q.a.x - p.a.x) * ry - (q.a.y - p.a.y) * rx) / den
  const inside = 1e-9
  if (t <= inside || t >= 1 - inside || u <= inside || u >= 1 - inside) return null
  return { x: p.a.x + rx * t, y: p.a.y + ry * t }
}

/** Los cruces de los tramos de un índice, calculados una vez (en ellos también cambia el tramo que para un rayo) */
const crossingsCache = new WeakMap<WallIndex<Edge>, Point[]>()
function crossingsOf(index: WallIndex<Edge>): Point[] {
  const cached = crossingsCache.get(index)
  if (cached) return cached
  const out: Point[] = []
  index.forEachPair((p, q) => {
    const x = crossing(p, q)
    if (x) out.push(x)
  })
  crossingsCache.set(index, out)
  return out
}

/**
 * Los puntos que pueden dar un rayo: los extremos de los tramos, sin repetir; con índice, solo los cercanos y también
 * los cruces entre tramos
 */
function corners(origin: Point, source: EdgeSource, radius: number): Point[] {
  const far = radius * ENDPOINT_REACH
  const near = (p: Point): boolean => Math.hypot(p.x - origin.x, p.y - origin.y) <= far
  const indexed = source instanceof WallIndex
  const edges = indexed
    ? source.queryRect({ x: origin.x - far, y: origin.y - far, width: far * 2, height: far * 2 })
    : source
  const seen = new Set<string>()
  const out: Point[] = []
  for (const edge of edges)
    for (const p of [edge.a, edge.b]) {
      if (!near(p)) continue
      const key = `${p.x},${p.y}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(p)
    }
  if (indexed) for (const p of crossingsOf(source)) if (near(p)) out.push(p)
  return out
}

/**
 * El polígono de lo que se ve desde `origin` hasta `radius` (píxeles del mundo) entre los tramos. Con `cone`, solo lo
 * que cae en él (y el polígono empieza en el origen).
 */
export function visibilityPolygon(origin: Point, source: EdgeSource, radius: number, cone?: Cone): Point[] {
  const angles = new Set<number>()
  for (let i = 0; i < CONTOUR_SIDES; i++) angles.add(wrap((i / CONTOUR_SIDES) * Math.PI * 2))
  const indexed = source instanceof WallIndex
  for (const p of corners(origin, source, radius)) {
    const dx = p.x - origin.x
    const dy = p.y - origin.y
    const distance = Math.hypot(dx, dy)
    if (distance < 1e-9) continue
    // Con índice, un extremo tapado no cambia el contorno: no lanza rayos
    if (indexed) {
      const until = Math.min(distance, radius) - 1e-6
      if (until > 0 && reach(origin, { x: dx / distance, y: dy / distance }, source, until) < until) continue
    }
    const a = Math.atan2(dy, dx)
    angles.add(wrap(a - GRAZE))
    angles.add(wrap(a))
    angles.add(wrap(a + GRAZE))
  }
  let from = Number.NEGATIVE_INFINITY
  let to = Number.POSITIVE_INFINITY
  if (cone && cone.angle > 0 && cone.angle < 360) {
    // El rumbo de la mesa: 0 es arriba; en matemáticas, −90°
    const center = ((cone.rotation - 90) * Math.PI) / 180
    const half = (cone.angle * Math.PI) / 360
    from = center - half
    to = center + half
    angles.add(from)
    angles.add(to)
  }
  const normal = (a: number): number => {
    if (from === Number.NEGATIVE_INFINITY) return a
    let x = a
    while (x < from) x += Math.PI * 2
    while (x > from + Math.PI * 2) x -= Math.PI * 2
    return x
  }
  const sorted = [...angles]
    .map(normal)
    .filter((a) => from === Number.NEGATIVE_INFINITY || a <= to + 1e-12)
    .sort((x, y) => x - y)
  const points = sorted.map((a) => {
    const dir = { x: Math.cos(a), y: Math.sin(a) }
    const d = reach(origin, dir, source, radius)
    return { x: origin.x + dir.x * d, y: origin.y + dir.y * d }
  })
  return from === Number.NEGATIVE_INFINITY ? points : [origin, ...points]
}

/** Si `p` se ve desde `origin` (nada lo para entre los dos) */
export function canSee(origin: Point, p: Point, source: EdgeSource): boolean {
  const dx = p.x - origin.x
  const dy = p.y - origin.y
  const length = Math.hypot(dx, dy)
  if (length < 1e-9) return true
  return reach(origin, { x: dx / length, y: dy / length }, source, length) >= length - 1e-6
}

/** El área de un polígono simple (fórmula del cordón), en píxeles cuadrados */
export function polygonArea(polygon: readonly Point[]): number {
  let area = 0
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i] as Point
    const b = polygon[j] as Point
    area += (b.x + a.x) * (b.y - a.y)
  }
  return Math.abs(area) / 2
}
