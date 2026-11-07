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

// El rayo en curso, sin cierres ni objetos nuevos por rayo: un barrido lanza miles
const stop = new Stop()
const rayDir = { x: 0, y: 0 }
let rayOrigin: Point = { x: 0, y: 0 }
let rayMax = 0

function testEdge(edge: Edge): void {
  if (!edgeBlocks(edge, rayOrigin)) return
  const t = cut(rayOrigin, rayDir, edge.a, edge.b)
  if (t !== null && t < rayMax) stop.add(t, edge.limited)
}

const stopAfter = (exit: number): boolean => stop.at <= exit

/** Hasta dónde llega un rayo (dirección unitaria) antes de pararse, como mucho `radius` */
function reach(origin: Point, dx: number, dy: number, source: EdgeSource, radius: number): number {
  stop.reset()
  rayOrigin = origin
  rayDir.x = dx
  rayDir.y = dy
  rayMax = radius
  if (source instanceof WallIndex) source.walkRay(origin, rayDir, radius, testEdge, stopAfter)
  else for (const edge of source) testEdge(edge)
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

/** Las esquinas de un índice (los extremos sin repetir y los cruces entre tramos), por las celdas del índice */
interface Corners {
  xs: Float64Array
  ys: Float64Array
  starts: Uint32Array
}

const cornersCache = new WeakMap<WallIndex<Edge>, Corners>()

/** Las esquinas de un índice, calculadas una vez (en los cruces también cambia el tramo que para un rayo) */
function cornersOf(index: WallIndex<Edge>): Corners {
  const cached = cornersCache.get(index)
  if (cached) return cached
  const raw: Point[] = []
  for (const edge of index.items) raw.push(edge.a, edge.b)
  index.forEachPair((p, q) => {
    const x = crossing(p, q)
    if (x) raw.push(x)
  })
  const cellOf = (p: Point): number => {
    const c = Math.min(index.columns - 1, Math.max(0, Math.floor((p.x - index.minX) / index.cellSize)))
    const r = Math.min(index.rows - 1, Math.max(0, Math.floor((p.y - index.minY) / index.cellSize)))
    return r * index.columns + c
  }
  // Por celdas y, en cada una, sin repetir (son pocas)
  const cells = index.columns * index.rows
  const counts = new Uint32Array(cells + 1)
  for (const p of raw) {
    const cell = cellOf(p) + 1
    counts[cell] = (counts[cell] as number) + 1
  }
  for (let i = 1; i < counts.length; i++) counts[i] = (counts[i] as number) + (counts[i - 1] as number)
  const fill = counts.slice()
  const grouped: Point[] = new Array(raw.length)
  for (const p of raw) {
    const cell = cellOf(p)
    grouped[fill[cell] as number] = p
    fill[cell] = (fill[cell] as number) + 1
  }
  const xs = new Float64Array(raw.length)
  const ys = new Float64Array(raw.length)
  const starts = new Uint32Array(cells + 1)
  let n = 0
  for (let cell = 0; cell < cells; cell++) {
    starts[cell] = n
    const first = n
    for (let k = counts[cell] as number; k < (counts[cell + 1] as number); k++) {
      const p = grouped[k] as Point
      let repeated = false
      for (let j = first; j < n && !repeated; j++) repeated = xs[j] === p.x && ys[j] === p.y
      if (repeated) continue
      xs[n] = p.x
      ys[n] = p.y
      n += 1
    }
  }
  starts[cells] = n
  const corners = { xs, ys, starts }
  cornersCache.set(index, corners)
  return corners
}

/** Cada punto que puede dar un rayo a `far` o menos del origen: con índice, sus esquinas; con lista, sus extremos */
function forEachCorner(origin: Point, source: EdgeSource, far: number, visit: (x: number, y: number) => void): void {
  const near = (x: number, y: number): boolean => Math.hypot(x - origin.x, y - origin.y) <= far
  if (!(source instanceof WallIndex)) {
    const seen = new Set<string>()
    for (const edge of source)
      for (const p of [edge.a, edge.b]) {
        const key = `${p.x},${p.y}`
        if (!near(p.x, p.y) || seen.has(key)) continue
        seen.add(key)
        visit(p.x, p.y)
      }
    return
  }
  if (source.items.length === 0) return
  const { xs, ys, starts } = cornersOf(source)
  const column = (x: number) =>
    Math.min(source.columns - 1, Math.max(0, Math.floor((x - source.minX) / source.cellSize)))
  const row = (y: number) => Math.min(source.rows - 1, Math.max(0, Math.floor((y - source.minY) / source.cellSize)))
  const r1 = row(origin.y + far)
  const c0 = column(origin.x - far)
  const c1 = column(origin.x + far)
  for (let r = row(origin.y - far); r <= r1; r++) {
    const from = starts[r * source.columns + c0] as number
    const to = starts[r * source.columns + c1 + 1] as number
    for (let k = from; k < to; k++) {
      const x = xs[k] as number
      const y = ys[k] as number
      if (near(x, y)) visit(x, y)
    }
  }
}

/**
 * El polígono de lo que se ve desde `origin` hasta `radius` (píxeles del mundo) entre los tramos. Con `cone`, solo lo
 * que cae en él (y el polígono empieza en el origen).
 */
export function visibilityPolygon(origin: Point, source: EdgeSource, radius: number, cone?: Cone): Point[] {
  const angles: number[] = []
  for (let i = 0; i < CONTOUR_SIDES; i++) angles.push(wrap((i / CONTOUR_SIDES) * Math.PI * 2))
  const indexed = source instanceof WallIndex
  forEachCorner(origin, source, radius * ENDPOINT_REACH, (x, y) => {
    const dx = x - origin.x
    const dy = y - origin.y
    const distance = Math.hypot(dx, dy)
    if (distance < 1e-9) return
    // Con índice, una esquina tapada no cambia el contorno: no lanza rayos
    if (indexed) {
      const until = Math.min(distance, radius) - 1e-6
      if (until > 0 && reach(origin, dx / distance, dy / distance, source, until) < until) return
    }
    const a = Math.atan2(dy, dx)
    angles.push(wrap(a - GRAZE), wrap(a), wrap(a + GRAZE))
  })
  let from = Number.NEGATIVE_INFINITY
  let to = Number.POSITIVE_INFINITY
  if (cone && cone.angle > 0 && cone.angle < 360) {
    // El rumbo de la mesa: 0 es arriba; en matemáticas, −90°
    const center = ((cone.rotation - 90) * Math.PI) / 180
    const half = (cone.angle * Math.PI) / 360
    from = center - half
    to = center + half
    angles.push(from, to)
  }
  const sorted = Float64Array.from(angles, (a) => {
    if (from === Number.NEGATIVE_INFINITY) return a
    let x = a
    while (x < from) x += Math.PI * 2
    while (x > from + Math.PI * 2) x -= Math.PI * 2
    return x
  }).sort()
  const points: Point[] = from === Number.NEGATIVE_INFINITY ? [] : [origin]
  let last = Number.NaN
  for (const a of sorted) {
    if (a === last || a > to + 1e-12) continue
    last = a
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    const d = reach(origin, dx, dy, source, radius)
    points.push({ x: origin.x + dx * d, y: origin.y + dy * d })
  }
  return points
}

/** Si `p` se ve desde `origin` (nada lo para entre los dos) */
export function canSee(origin: Point, p: Point, source: EdgeSource): boolean {
  const dx = p.x - origin.x
  const dy = p.y - origin.y
  const length = Math.hypot(dx, dy)
  if (length < 1e-9) return true
  return reach(origin, dx / length, dy / length, source, length) >= length - 1e-6
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
