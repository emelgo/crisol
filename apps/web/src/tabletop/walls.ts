/**
 * El editor de muros, puertas y luces de la mesa (docs/specs/vision.md), lo que no es dibujo: pegar el punto (a un
 * extremo cercano o, con Mayús, a las esquinas de la rejilla), los muros encadenados clic a clic, lo que se manda por
 * cada tipo, qué muro, extremo o luz hay bajo el cursor y mover un extremo con los muros que se tocan en él. Puro
 */
import type { SceneGrid, WallView } from '@crisol/contracts'
import type { Point } from '@crisol/tabletop'
import type { OverlayShape } from './renderer.ts'
import { cellSide } from './tokens.ts'

/** Lo que se dibuja: los tipos ya hechos, las dos puertas y el muro de un sentido */
export const DRAW_KINDS = ['wall', 'door', 'secret', 'window', 'invisible', 'low', 'object', 'oneWay'] as const
export type DrawKind = (typeof DRAW_KINDS)[number]

/** Lo que se manda por un tramo de un tipo */
export type WallInput = {
  a: Point
  b: Point
  kind: 'wall' | 'low' | 'invisible' | 'window' | 'object'
  door?: 'door' | 'secret'
  direction?: 'left'
}

export function wallInputFor(kind: DrawKind, a: Point, b: Point): WallInput {
  if (kind === 'door' || kind === 'secret') return { a, b, kind: 'wall', door: kind }
  if (kind === 'oneWay') return { a, b, kind: 'wall', direction: 'left' }
  return { a, b, kind }
}

/** El tipo de un muro que ya está (una puerta lo es aunque frene otra cosa) */
export function drawKindOf(wall: WallView): DrawKind | 'custom' {
  if (wall.door === 'secret') return 'secret'
  if (wall.door === 'door') return 'door'
  if (wall.direction !== 'both') return 'oneWay'
  return wall.kind
}

const round = (value: number) => Math.round(value * 10) / 10

/**
 * Dónde cae un punto al dibujar: en el extremo de un muro si está a menos de `tolerance` (para encadenar con lo que
 * hay); si no, con Mayús, en la esquina de la rejilla más cercana; si no, donde cae
 */
export function snapPoint(
  p: Point,
  options: { grid: SceneGrid; shift: boolean; endpoints: readonly Point[]; tolerance: number }
): Point {
  let best: Point | null = null
  let distance = options.tolerance
  for (const end of options.endpoints) {
    const d = Math.hypot(end.x - p.x, end.y - p.y)
    if (d <= distance) {
      best = end
      distance = d
    }
  }
  if (best) return { x: best.x, y: best.y }
  const { grid } = options
  if (options.shift && grid.type !== 'none') {
    // En las hexagonales, a las esquinas de su caja: basta para cerrar salas
    const side = grid.size
    return {
      x: round(grid.offsetX + Math.round((p.x - grid.offsetX) / side) * side),
      y: round(grid.offsetY + Math.round((p.y - grid.offsetY) / side) * side)
    }
  }
  return { x: round(p.x), y: round(p.y) }
}

/** Los puntos de unos muros que se dibujan seguidos */
export interface Chain {
  points: Point[]
}

const near = (a: Point, b: Point, tolerance: number) => Math.hypot(a.x - b.x, a.y - b.y) <= tolerance

/**
 * Un clic al dibujar: empieza, añade un tramo o acaba. Acaba un clic sobre el último punto (el doble clic) o sobre el
 * primero (cierra la figura con ese último tramo)
 */
export function chainClick(chain: Chain | null, p: Point, tolerance: number): { chain: Chain; done: boolean } {
  if (!chain || chain.points.length === 0) return { chain: { points: [p] }, done: false }
  const last = chain.points.at(-1) as Point
  if (near(last, p, tolerance)) return { chain, done: true }
  const first = chain.points[0] as Point
  if (chain.points.length >= 2 && near(first, p, tolerance))
    return { chain: { points: [...chain.points, first] }, done: true }
  return { chain: { points: [...chain.points, p] }, done: false }
}

/** Los tramos de una cadena, de un tipo (sin los que no miden nada) */
export function chainSegments(chain: Chain | null, kind: DrawKind): WallInput[] {
  if (!chain) return []
  const out: WallInput[] = []
  for (let i = 1; i < chain.points.length; i++) {
    const a = chain.points[i - 1] as Point
    const b = chain.points[i] as Point
    if (a.x === b.x && a.y === b.y) continue
    out.push(wallInputFor(kind, a, b))
  }
  return out
}

/** La distancia de un punto a un tramo */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length2 = dx * dx + dy * dy
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2))
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t)
}

/** El muro más cercano a un punto, si está a `tolerance` o menos */
export function wallAt<T extends Pick<WallView, 'a' | 'b'>>(
  walls: readonly T[],
  p: Point,
  tolerance: number
): T | null {
  let best: T | null = null
  let distance = tolerance
  for (const wall of walls) {
    const d = distanceToSegment(p, wall.a, wall.b)
    if (d <= distance) {
      best = wall
      distance = d
    }
  }
  return best
}

/** Los extremos de unos muros, sin repetir */
export function endpointsOf(walls: readonly Pick<WallView, 'a' | 'b'>[]): Point[] {
  const seen = new Map<string, Point>()
  for (const wall of walls)
    for (const p of [wall.a, wall.b]) {
      const key = `${p.x},${p.y}`
      if (!seen.has(key)) seen.set(key, { x: p.x, y: p.y })
    }
  return [...seen.values()]
}

/** El extremo más cercano a un punto, si está a `tolerance` o menos */
export function endpointAt(walls: readonly Pick<WallView, 'a' | 'b'>[], p: Point, tolerance: number): Point | null {
  let best: Point | null = null
  let distance = tolerance
  for (const end of endpointsOf(walls)) {
    const d = Math.hypot(end.x - p.x, end.y - p.y)
    if (d <= distance) {
      best = end
      distance = d
    }
  }
  return best
}

/** Mover un extremo: cada muro que tiene uno en `from` lo lleva a `to` (los que se tocan siguen tocándose) */
export function moveEndpoint(
  walls: readonly Pick<WallView, 'id' | 'a' | 'b'>[],
  from: Point,
  to: Point
): Array<{ id: string; a?: Point; b?: Point }> {
  const at = (p: Point) => p.x === from.x && p.y === from.y
  const out: Array<{ id: string; a?: Point; b?: Point }> = []
  for (const wall of walls) {
    if (!at(wall.a) && !at(wall.b)) continue
    out.push({ id: wall.id, ...(at(wall.a) ? { a: { ...to } } : {}), ...(at(wall.b) ? { b: { ...to } } : {}) })
  }
  return out
}

/** Cuántos muros y cuántas puertas */
export function wallStats(walls: readonly Pick<WallView, 'door'>[]): { walls: number; doors: number } {
  const doors = walls.filter((wall) => wall.door).length
  return { walls: walls.length - doors, doors }
}

/** Una medida de la rejilla (pies) en píxeles del mapa */
export const feetToPixels = (value: number, grid: SceneGrid) => (value / grid.distance) * cellSide(grid)

/** La luz bajo el cursor */
export function lightAt<T extends { x: number; y: number }>(
  lights: readonly T[],
  p: Point,
  tolerance: number
): T | null {
  let best: T | null = null
  let distance = tolerance
  for (const light of lights) {
    const d = Math.hypot(light.x - p.x, light.y - p.y)
    if (d <= distance) {
      best = light
      distance = d
    }
  }
  return best
}

/** Los colores de cada tipo de muro (los del lienzo) */
export const WALL_COLORS = {
  wall: 0x4fd1e8,
  door: 0xf2c260,
  locked: 0xe59a52,
  secret: 0xc39bff,
  window: 0x9ad7e4,
  invisible: 0x4fd1e8,
  low: 0x4f9fb0,
  object: 0x7fb8c4,
  oneWay: 0xff8a4c,
  selected: 0xffffff
} as const

/**
 * Cómo se ven los muros en la mesa del máster: cada tipo con su color (la puerta abierta, a trazos; la ventana, fina;
 * el invisible, a puntos), la elegida con un aro blanco debajo, la flecha de los de un sentido hacia donde dejan pasar
 * y, al editar, sus extremos. `scale`: píxeles de la pantalla por píxel del mapa; `faint`, apagados (ver como el grupo)
 */
export function wallShapes(
  walls: readonly WallView[],
  options: {
    doors: Readonly<Record<string, boolean>>
    selected: string | null
    scale: number
    endpoints: boolean
    faint?: boolean
  }
): OverlayShape[] {
  const shapes: OverlayShape[] = []
  const alpha = options.faint ? 0.45 : 0.95
  for (const wall of walls) {
    const kind = drawKindOf(wall)
    const open = wall.door ? (options.doors[wall.id] ?? wall.open) : false
    if (wall.id === options.selected)
      shapes.push({ kind: 'line', a: wall.a, b: wall.b, color: WALL_COLORS.selected, width: 9, alpha: 0.9 })
    const color =
      kind === 'door'
        ? wall.locked
          ? WALL_COLORS.locked
          : WALL_COLORS.door
        : kind === 'custom' || kind === 'oneWay'
          ? WALL_COLORS.wall
          : WALL_COLORS[kind]
    const width = options.faint ? 2 : kind === 'window' ? 2.5 : wall.door ? 6 : 4
    const dash: readonly [number, number] | undefined = open ? [10, 8] : kind === 'invisible' ? [3, 6] : undefined
    shapes.push({ kind: 'line', a: wall.a, b: wall.b, color, width, alpha, ...(dash ? { dash } : {}) })
    if (kind === 'oneWay' && !options.faint) {
      // Una marca en medio, hacia el lado por donde deja pasar
      const mx = (wall.a.x + wall.b.x) / 2
      const my = (wall.a.y + wall.b.y) / 2
      const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y) || 1
      const side = wall.direction === 'left' ? 1 : -1
      const k = (12 / options.scale / length) * side
      const tip = { x: mx + (wall.b.y - wall.a.y) * k, y: my - (wall.b.x - wall.a.x) * k }
      shapes.push({ kind: 'line', a: { x: mx, y: my }, b: tip, color: WALL_COLORS.oneWay, width: 3 })
    }
  }
  if (options.endpoints)
    for (const end of endpointsOf(walls))
      shapes.push({ kind: 'dot', at: end, color: WALL_COLORS.wall, radius: 4.5, stroke: 0x0b0b0c })
  return shapes
}
