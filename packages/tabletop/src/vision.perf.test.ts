import { describe, expect, it } from 'vitest'
import type { Point } from './geometry.ts'
import { type Light, lightPolygon } from './light.ts'
import { type PartyToken, tokenSight } from './party-vision.ts'
import { partyView, prepareVision, type VisionScene, visibleForParty } from './visible-for-party.ts'
import { WallIndex } from './wall-index.ts'
import { type Edge, joinCollinear, type Wall, wallEdges } from './walls.ts'

/** Números pseudoaleatorios repetibles (mulberry32) */
function random(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const base = { sight: 'full', light: 'full', move: 'full', direction: 'both', door: null, locked: false } as const
let next = 0
const wall = (a: Point, b: Point, extra: Partial<Wall> = {}): Wall => ({ id: `w${++next}`, a, b, ...base, ...extra })
const light = (id: string, x: number, y: number, dim: number): Light => ({
  id,
  x,
  y,
  bright: dim / 2,
  dim,
  color: '#ffe2a8',
  intensity: 1,
  angle: 360,
  rotation: 0,
  walls: true,
  darkness: false
})

/**
 * Una mazmorra de 12 × 12 salas de 400 px (4.800 px de lado), con las paredes partidas en tramos de 50 px como las
 * exporta un editor de mapas y una puerta en cada pared entre salas (la mitad, abiertas): 2.496 tramos
 */
function dungeon(): { scene: VisionScene; tokens: PartyToken[] } {
  const rooms = 12
  const size = 400
  const piece = 50
  const walls: Wall[] = []
  const doors: Record<string, { open: boolean }> = {}
  const r = random(1)
  for (let line = 0; line <= rooms; line++)
    for (let k = 0; k < (rooms * size) / piece; k++) {
      const inner = line > 0 && line < rooms
      const isDoor = inner && k % (size / piece) === size / piece / 2
      for (const horizontal of [true, false]) {
        const a = horizontal ? { x: k * piece, y: line * size } : { x: line * size, y: k * piece }
        const b = horizontal ? { x: (k + 1) * piece, y: line * size } : { x: line * size, y: (k + 1) * piece }
        const w = wall(a, b, isDoor ? { door: 'door' } : {})
        if (isDoor && r() < 0.5) doors[w.id] = { open: true }
        walls.push(w)
      }
    }
  const lights = Array.from({ length: 20 }, (_, i) =>
    light(`l${i}`, (i % 6) * size * 2 + 200, Math.floor(i / 6) * size * 3 + 200, 300)
  )
  const tokens = Array.from({ length: 6 }, (_, i) => ({
    id: `pj${i}`,
    x: 1600 + i * 130,
    y: 2000 + (i % 2) * 120,
    radius: 25,
    senses: i % 2 === 0 ? { darkvision: 420 } : {}
  }))
  return { scene: { width: 4800, height: 4800, walls, doors, lights, darkness: 0.8 }, tokens }
}

/** Una cueva de 6.000 px: 10 cámaras de contorno irregular (150 tramos cada una) y 4 túneles largos (250 tramos) */
function cave(): { scene: VisionScene; tokens: PartyToken[] } {
  const r = random(2)
  const walls: Wall[] = []
  const centers: Point[] = []
  for (let i = 0; i < 10; i++) {
    const center = { x: 600 + (i % 5) * 1200, y: 1200 + Math.floor(i / 5) * 3000 }
    centers.push(center)
    const radius = 350 + r() * 200
    const points = Array.from({ length: 150 }, (_, k) => {
      const t = (k / 150) * Math.PI * 2
      const rr = radius * (1 + 0.15 * Math.sin(t * 5 + i) + 0.05 * (r() - 0.5))
      return { x: center.x + Math.cos(t) * rr, y: center.y + Math.sin(t) * rr }
    })
    // Una boca en cada cámara
    for (let k = 0; k < 150; k++) if (k < 145) walls.push(wall(points[k] as Point, points[(k + 1) % 150] as Point))
  }
  for (let tunnel = 0; tunnel < 4; tunnel++) {
    const y0 = 2200 + tunnel * 400
    for (const side of [-40, 40]) {
      let previous = { x: 100, y: y0 + side }
      for (let k = 1; k <= 125; k++) {
        const x = 100 + k * 46
        const p = { x, y: y0 + side + Math.sin(x / 300 + tunnel) * 120 + (r() - 0.5) * 6 }
        walls.push(wall(previous, p))
        previous = p
      }
    }
  }
  const lights = Array.from({ length: 20 }, (_, i) => {
    const c = centers[i % 10] as Point
    return light(`l${i}`, c.x + (i < 10 ? -120 : 120), c.y, 280)
  })
  const tokens = Array.from({ length: 6 }, (_, i) => {
    const c = centers[i % 3] as Point
    return { id: `pj${i}`, x: c.x + (i - 2.5) * 30, y: c.y + 40, radius: 25, senses: { darkvision: 420 } }
  })
  return { scene: { width: 6000, height: 6000, walls, doors: {}, lights, darkness: 0.8 }, tokens }
}

/** Mediana y p95 (ms) de `runs` vueltas, tras `warmup` de calentamiento */
function measure(runs: number, work: () => void, warmup = 3): { median: number; p95: number } {
  for (let i = 0; i < warmup; i++) work()
  const times: number[] = []
  for (let i = 0; i < runs; i++) {
    const start = performance.now()
    work()
    times.push(performance.now() - start)
  }
  times.sort((a, b) => a - b)
  const at = (q: number) => times[Math.min(times.length - 1, Math.floor(q * times.length))] as number
  return { median: at(0.5), p95: at(0.95) }
}

/** Los polígonos de las seis fichas y las veinte luces, con una lista (todos los tramos en cada rayo) o con el índice */
function polygons(scene: VisionScene, tokens: readonly PartyToken[], indexed: boolean): number {
  const sight: Edge[] = wallEdges(scene.walls, scene.doors, 'sight')
  const lightEdges: Edge[] = wallEdges(scene.walls, scene.doors, 'light')
  const sightSource = indexed ? new WallIndex(sight) : sight
  const lightSource = indexed ? new WallIndex(lightEdges) : lightEdges
  let points = 0
  const unlimited = Math.hypot(scene.width, scene.height) * 2
  for (const token of tokens)
    points += tokenSight(token, { plain: sightSource, withDarkness: sightSource }, unlimited).polygon.length
  for (const l of scene.lights) points += lightPolygon(l, lightSource).length
  return points
}

const row = (name: string, m: { median: number; p95: number }) =>
  `${name.padEnd(52)} mediana ${m.median.toFixed(1).padStart(7)} ms   p95 ${m.p95.toFixed(1).padStart(7)} ms`

// Se mide sola (CRISOL_RENDIMIENTO=1, `pnpm --filter @crisol/tabletop test:rendimiento`): con las demás pruebas a la
// vez, y con la cobertura, lo que se mide es la carga de la máquina
describe.skipIf(!process.env.CRISOL_RENDIMIENTO)('rendimiento de la visión (ADR-0018 § 5)', () => {
  for (const [name, make] of [
    ['mazmorra', dungeon],
    ['cueva', cave]
  ] as const) {
    it(`${name}: 2.500 tramos, seis fichas y 20 luces, p95 < 100 ms`, { timeout: 300_000 }, () => {
      const { scene, tokens } = make()
      expect(scene.walls.length).toBeGreaterThanOrEqual(2400)
      expect(scene.walls.length).toBeLessThanOrEqual(2600)
      const joined = { ...scene, walls: joinCollinear(scene.walls) }
      const lines = [`${name}: ${scene.walls.length} tramos (${joined.walls.length} tras unir los colineales)`]
      const before = measure(3, () => polygons(scene, tokens, false), 1)
      lines.push(row('antes: los polígonos, probando todos los tramos', before))
      const after = measure(50, () => polygons(scene, tokens, true))
      lines.push(row('después: los polígonos, con el índice', after))
      const full = measure(50, () => visibleForParty({ ...scene, tokens, manualFog: [] }))
      lines.push(row('lo que ve el grupo, todo (índices, luces, rejilla)', full))
      const fullJoined = measure(50, () => visibleForParty({ ...joined, tokens, manualFog: [] }))
      lines.push(row('lo mismo, con los tramos unidos', fullJoined))
      const prepared = prepareVision(scene)
      const moved = measure(50, () => partyView(prepared, tokens, []))
      lines.push(row('al soltar una ficha (lo de la escena ya preparado)', moved))
      process.stdout.write(`${lines.join('\n')}\n`)
      expect(full.p95).toBeLessThan(100)
      expect(after.median).toBeLessThan(before.median)
    })
  }
})
