// Portado de packages/mesa/src/nucleo/vision.ts y luz.ts (Crisol actual, commit 3f68f11)
/**
 * Los muros de una escena y lo que paran: la vista, la luz y el paso, cada uno «nada», «limitado» (el primero que se
 * cruza deja pasar; el segundo no) o «del todo»; de un solo sentido si se quiere. Las puertas son muros con su estado
 * aparte, por campaña: abiertas no paran nada (ni la pared dibujada debajo). Y, al importar, la unión de los tramos
 * colineales y seguidos. Puro: sin DOM ni render.
 */
import type { Point } from './geometry.ts'
import { WallIndex } from './wall-index.ts'

export type Restriction = 'none' | 'limited' | 'full'
/** Por qué lado deja pasar un muro de un solo sentido: a la izquierda o a la derecha de a→b en pantalla (y hacia abajo) */
export type WallDirection = 'both' | 'left' | 'right'
export type DoorKind = 'door' | 'secret'
export type Channel = 'sight' | 'light' | 'move' | 'sound'

export interface Wall {
  id: string
  a: Point
  b: Point
  sight: Restriction
  light: Restriction
  move: Restriction
  /** Lo que para del sonido (docs/specs/sonido-mapa.md); sin decirlo, nada */
  sound?: Restriction
  direction: WallDirection
  door: DoorKind | null
  locked: boolean
}

/** El estado de cada puerta en una campaña, por el id de su muro; una puerta sin estado está cerrada */
export type DoorStates = Readonly<Record<string, { open: boolean }>>

/** Un tramo que para un canal, ya decidido */
export interface Edge {
  a: Point
  b: Point
  limited: boolean
  /** Lado por el que deja pasar, o null si para por los dos */
  pass: 'left' | 'right' | null
}

export const isDoorOpen = (wall: Wall, doors: DoorStates): boolean =>
  wall.door !== null && doors[wall.id]?.open === true

/**
 * Cuánto puede separarse una puerta de la línea del muro y seguir «encima» de él: unos píxeles o, en puertas largas,
 * el 15 % de su largo (dibujada a mano no queda exacta); y cuánto puede torcerse respecto a la pared (12°).
 */
const NEAR = 4
const NEAR_RELATIVE = 0.15
const MAX_TILT = Math.sin((12 * Math.PI) / 180)

/**
 * Los muros con el hueco de cada puerta abierta que está encima de ellos: si se dibuja la pared seguida y la puerta
 * sobre ella, al abrirla la pared tampoco tapa ese tramo (pasan la luz, la vista y las fichas).
 */
export function withDoorGaps(walls: readonly Wall[], doors: DoorStates): Wall[] {
  const open = walls.filter((w) => isDoorOpen(w, doors))
  if (open.length === 0) return [...walls]
  // Cada pared mira solo las puertas abiertas que tiene cerca
  const nearby = new WallIndex(open)
  const reach = Math.max(...open.map((d) => Math.max(NEAR, Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y) * NEAR_RELATIVE)))
  const out: Wall[] = []
  for (const wall of walls) {
    const dx = wall.b.x - wall.a.x
    const dy = wall.b.y - wall.a.y
    const length = Math.hypot(dx, dy)
    if (wall.door !== null || length === 0) {
      out.push(wall)
      continue
    }
    // Los tramos (en 0–1 a lo largo del muro) que tapan las puertas abiertas que están sobre su línea
    const gaps: [number, number][] = []
    const off = (q: Point): number => Math.abs((q.x - wall.a.x) * dy - (q.y - wall.a.y) * dx) / length
    const along = (q: Point): number => ((q.x - wall.a.x) * dx + (q.y - wall.a.y) * dy) / (length * length)
    const box = {
      x: Math.min(wall.a.x, wall.b.x) - reach,
      y: Math.min(wall.a.y, wall.b.y) - reach,
      width: Math.abs(dx) + reach * 2,
      height: Math.abs(dy) + reach * 2
    }
    for (const door of nearby.queryRect(box)) {
      const doorLength = Math.hypot(door.b.x - door.a.x, door.b.y - door.a.y)
      if (doorLength === 0) continue
      const tolerance = Math.max(NEAR, doorLength * NEAR_RELATIVE)
      // Casi paralela a la pared (el seno del ángulo entre las dos)
      const sine = Math.abs((door.b.x - door.a.x) * dy - (door.b.y - door.a.y) * dx) / (length * doorLength)
      if (sine > MAX_TILT || off(door.a) > tolerance || off(door.b) > tolerance) continue
      const t0 = Math.min(along(door.a), along(door.b))
      const t1 = Math.max(along(door.a), along(door.b))
      if (t1 <= 0 || t0 >= 1) continue
      gaps.push([Math.max(0, t0), Math.min(1, t1)])
    }
    if (gaps.length === 0) {
      out.push(wall)
      continue
    }
    gaps.sort((x, y) => x[0] - y[0])
    const at = (t: number): Point => ({ x: wall.a.x + dx * t, y: wall.a.y + dy * t })
    let from = 0
    for (const [t0, t1] of gaps) {
      if (t0 > from + 1e-6) out.push({ ...wall, a: at(from), b: at(t0) })
      from = Math.max(from, t1)
    }
    if (from < 1 - 1e-6) out.push({ ...wall, a: at(from), b: at(1) })
  }
  return out
}

/**
 * Los tramos que paran un canal: sin las puertas abiertas (ni la pared que tapan) ni los que no lo paran. Para el paso,
 * «limitado» para del todo.
 */
export const wallEdges = (walls: readonly Wall[], doors: DoorStates, channel: Channel): Edge[] =>
  gappedWallEdges(withDoorGaps(walls, doors), doors, channel)

/** Los tramos que paran un canal de unos muros que ya llevan los huecos de sus puertas (`withDoorGaps`) */
export function gappedWallEdges(walls: readonly Wall[], doors: DoorStates, channel: Channel): Edge[] {
  const out: Edge[] = []
  for (const wall of walls) {
    const restriction = wall[channel] ?? 'none'
    if (restriction === 'none' || isDoorOpen(wall, doors)) continue
    if (wall.a.x === wall.b.x && wall.a.y === wall.b.y) continue
    out.push({
      a: wall.a,
      b: wall.b,
      limited: channel !== 'move' && restriction === 'limited',
      pass: wall.direction === 'both' ? null : wall.direction
    })
  }
  return out
}

/** Distancia de p al segmento a–b y en qué punto de él cae (0–1) */
function toSegment(p: Point, a: Point, b: Point): { distance: number; t: number } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length2 = dx * dx + dy * dy
  const raw = length2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2
  const t = Math.max(0, Math.min(1, raw))
  return { distance: Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)), t: raw }
}

/** Un extremo de un muro: el muro y si es su `a` (0) o su `b` (1) */
type End = { wall: number; end: 0 | 1 }

/**
 * Une los muros colineales y seguidos (comparten un extremo, a `tolerance` píxeles como mucho) que paran lo mismo: un
 * mapa importado trae cada pared partida en muchos tramos y la visión los recorre todos. Ningún punto de los muros
 * originales queda a más de `tolerance` de su tramo unido. Las puertas quedan aparte, como venían; los de un solo
 * sentido solo se unen con los que van en su mismo sentido; los de largo cero se quitan. Cada tramo unido lleva el id
 * del primero de los suyos.
 */
export function joinCollinear(walls: readonly Wall[], tolerance = 0.5): Wall[] {
  const doors = walls.filter((w) => w.door !== null)
  const plain = walls.filter((w) => w.door === null && (w.a.x !== w.b.x || w.a.y !== w.b.y))
  // Los extremos, juntados en vértices (los que caen a menos de `tolerance`)
  const vertexOf: number[] = []
  const vertices: Point[] = []
  const buckets = new Map<string, number[]>()
  const cell = Math.max(tolerance, 1e-6)
  const vertexFor = (p: Point): number => {
    const cx = Math.floor(p.x / cell)
    const cy = Math.floor(p.y / cell)
    for (let x = cx - 1; x <= cx + 1; x++)
      for (let y = cy - 1; y <= cy + 1; y++)
        for (const v of buckets.get(`${x},${y}`) ?? []) {
          const q = vertices[v]
          if (q && Math.hypot(q.x - p.x, q.y - p.y) <= tolerance) return v
        }
    vertices.push(p)
    const key = `${cx},${cy}`
    const list = buckets.get(key)
    if (list) list.push(vertices.length - 1)
    else buckets.set(key, [vertices.length - 1])
    return vertices.length - 1
  }
  for (const wall of plain) vertexOf.push(vertexFor(wall.a), vertexFor(wall.b))
  const incident = new Map<number, End[]>()
  plain.forEach((_, i) => {
    for (const end of [0, 1] as const) {
      const v = vertexOf[i * 2 + end] as number
      const list = incident.get(v)
      if (list) list.push({ wall: i, end })
      else incident.set(v, [{ wall: i, end }])
    }
  })
  const kind = (w: Wall): string => `${w.sight}|${w.light}|${w.move}|${w.direction}`
  const point = (i: number, end: 0 | 1): Point => vertices[vertexOf[i * 2 + end] as number] as Point
  // En cada vértice, cada extremo se enlaza con otro como mucho: el que sigue más recto
  const link = new Map<string, End>()
  const keyOf = (e: End): string => `${e.wall}:${e.end}`
  for (const [v, ends] of incident) {
    const here = vertices[v] as Point
    const pairs: { x: End; y: End; distance: number }[] = []
    for (let i = 0; i < ends.length; i++)
      for (let j = i + 1; j < ends.length; j++) {
        const x = ends[i] as End
        const y = ends[j] as End
        const wx = plain[x.wall] as Wall
        const wy = plain[y.wall] as Wall
        if (x.wall === y.wall || kind(wx) !== kind(wy)) continue
        // Los de un sentido: uno acaba donde empieza el otro
        if (wx.direction !== 'both' && x.end === y.end) continue
        const far = toSegment(here, point(x.wall, x.end === 0 ? 1 : 0), point(y.wall, y.end === 0 ? 1 : 0))
        if (far.distance <= tolerance && far.t > 0 && far.t < 1) pairs.push({ x, y, distance: far.distance })
      }
    pairs.sort((p, q) => p.distance - q.distance)
    for (const { x, y } of pairs) {
      if (link.has(keyOf(x)) || link.has(keyOf(y))) continue
      link.set(keyOf(x), y)
      link.set(keyOf(y), x)
    }
  }
  // Las cadenas: desde un muro con un extremo suelto (o cualquiera, si la cadena se cierra)
  const visited = new Uint8Array(plain.length)
  const out: Wall[] = []
  const walk = (start: number, startEnd: 0 | 1): void => {
    // Recorre desde el extremo `startEnd` del primero
    const chain: { wall: number; forward: boolean }[] = []
    let current: End | undefined = { wall: start, end: startEnd }
    while (current && !visited[current.wall]) {
      visited[current.wall] = 1
      chain.push({ wall: current.wall, forward: current.end === 0 })
      const exit: End = { wall: current.wall, end: current.end === 0 ? 1 : 0 }
      current = link.get(keyOf(exit))
    }
    const first = chain[0]
    if (!first) return
    const points: Point[] = [point(first.wall, first.forward ? 0 : 1)]
    for (const step of chain) points.push(point(step.wall, step.forward ? 1 : 0))
    const base = plain[first.wall] as Wall
    // Los de un sentido conservan su orientación
    if (base.direction !== 'both' && !first.forward) points.reverse()
    const ids = chain.map((step) => (plain[step.wall] as Wall).id)
    if (base.direction !== 'both' && !first.forward) ids.reverse()
    // Tramos tan largos como quepan sin que un punto intermedio se aleje más de `tolerance`
    let s = 0
    while (s < points.length - 1) {
      let e = s + 1
      while (e + 1 < points.length) {
        const a = points[s] as Point
        const b = points[e + 1] as Point
        let fits = true
        for (let k = s + 1; k <= e; k++) if (toSegment(points[k] as Point, a, b).distance > tolerance) fits = false
        if (!fits) break
        e += 1
      }
      out.push({ ...base, id: ids[s] ?? base.id, a: points[s] as Point, b: points[e] as Point })
      s = e
    }
  }
  plain.forEach((_, i) => {
    if (visited[i]) return
    const loose = !link.has(`${i}:0`) ? 0 : !link.has(`${i}:1`) ? 1 : null
    if (loose !== null) walk(i, loose)
  })
  plain.forEach((_, i) => {
    if (!visited[i]) walk(i, 0)
  })
  return [...out, ...doors]
}
