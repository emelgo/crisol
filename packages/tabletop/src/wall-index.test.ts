import { describe, expect, it } from 'vitest'
import type { Point } from './geometry.ts'
import { type SegmentLike, WallIndex } from './wall-index.ts'

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

const segments = (n: number, seed: number, side = 1000, maxLength = 150): (SegmentLike & { id: number })[] => {
  const r = random(seed)
  return Array.from({ length: n }, (_, id) => {
    const a = { x: r() * side, y: r() * side }
    const angle = r() * Math.PI * 2
    const length = r() * maxLength
    return { id, a, b: { x: a.x + Math.cos(angle) * length, y: a.y + Math.sin(angle) * length } }
  })
}

const distanceToSegment = (p: Point, { a, b }: SegmentLike): number => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t)
}

/** Si los segmentos p→q y s se cortan (o se tocan) */
const crosses = (p: Point, q: Point, s: SegmentLike): boolean => {
  const side = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const d1 = side(s.a, s.b, p)
  const d2 = side(s.a, s.b, q)
  const d3 = side(p, q, s.a)
  const d4 = side(p, q, s.b)
  return d1 * d2 <= 0 && d3 * d4 <= 0
}

const ids = (list: readonly { id: number }[]) => list.map((s) => s.id).sort((x, y) => x - y)

describe('el índice espacial de los tramos', () => {
  const list = segments(800, 7)
  const index = new WallIndex(list)

  it('reparte los tramos en una rejilla de pocas celdas por tramo', () => {
    expect(index.columns * index.rows).toBeLessThanOrEqual(list.length * 4 + 64)
    expect(index.cellSize).toBeGreaterThan(8)
    // Con un lado pedido, ese
    expect(new WallIndex(list, 100).cellSize).toBe(100)
  })

  it('un círculo devuelve exactamente los tramos que lo tocan', () => {
    const r = random(3)
    for (let i = 0; i < 50; i++) {
      const center = { x: r() * 1200 - 100, y: r() * 1200 - 100 }
      const radius = r() * 200
      expect(ids(index.queryCircle(center, radius))).toEqual(
        ids(list.filter((s) => distanceToSegment(center, s) <= radius))
      )
    }
  })

  it('una caja devuelve todos los que la tocan (alguno más de sus celdas) y ninguno repetido', () => {
    const box = { x: 300, y: 300, width: 200, height: 100 }
    const found = index.queryRect(box)
    expect(new Set(found).size).toBe(found.length)
    const center = { x: 400, y: 350 }
    for (const s of list) if (distanceToSegment(center, s) <= 50) expect(found).toContain(s)
    // Fuera de la rejilla, nada
    expect(index.queryRect({ x: 5000, y: 5000, width: 10, height: 10 })).toEqual([])
    expect(index.queryRect({ x: 0, y: 0, width: Number.NaN, height: 1 })).toEqual([])
  })

  it('un segmento devuelve al menos todos los tramos que corta', () => {
    const r = random(11)
    for (let i = 0; i < 200; i++) {
      const p = { x: r() * 1400 - 200, y: r() * 1400 - 200 }
      const q = { x: r() * 1400 - 200, y: r() * 1400 - 200 }
      const found = new Set(index.querySegment(p, q))
      for (const s of list) if (crosses(p, q, s)) expect(found.has(s)).toBe(true)
    }
  })

  it('rayos horizontales, verticales y por las esquinas de las celdas no se saltan ninguno', () => {
    const grid = new WallIndex(list, 50)
    const cases: [Point, Point][] = [
      [
        { x: -10, y: 500 },
        { x: 1100, y: 500 }
      ],
      [
        { x: 500, y: 1100 },
        { x: 500, y: -10 }
      ],
      [
        { x: grid.minX, y: grid.minY },
        { x: grid.minX + 900, y: grid.minY + 900 }
      ],
      [
        { x: 1000, y: 1000 },
        { x: 0, y: 0 }
      ]
    ]
    for (const [p, q] of cases) {
      const found = new Set(grid.querySegment(p, q))
      for (const s of list) if (crosses(p, q, s)) expect(found.has(s)).toBe(true)
    }
  })

  it('el recorrido de un rayo para cuando se le pide, celda a celda y en orden', () => {
    const wall = (x: number) => ({ id: x, a: { x, y: -50 }, b: { x, y: 50 } })
    const walls = [wall(100), wall(300), wall(600)]
    const grid = new WallIndex(walls, 50)
    const seen: number[] = []
    grid.walkRay(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      1000,
      (s) => seen.push(s.id),
      () => seen.length > 0
    )
    expect(seen).toEqual([100])
    const all: number[] = []
    grid.walkRay(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      1000,
      (s) => all.push(s.id),
      () => false
    )
    expect(all).toEqual([100, 300, 600])
    // Uno que pasa por fuera de la rejilla no ve nada; uno sin largo, tampoco
    const none: number[] = []
    grid.walkRay(
      { x: 0, y: 500 },
      { x: 1, y: 0 },
      1000,
      (s) => none.push(s.id),
      () => false
    )
    grid.walkRay(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      0,
      (s) => none.push(s.id),
      () => false
    )
    grid.walkRay(
      { x: 700, y: 0 },
      { x: 0, y: 1 },
      10,
      (s) => none.push(s.id),
      () => false
    )
    expect(none).toEqual([])
  })

  it('vacío, o con tramos de largo cero, no falla', () => {
    const empty = new WallIndex<SegmentLike>([])
    expect(empty.queryCircle({ x: 0, y: 0 }, 100)).toEqual([])
    expect(empty.querySegment({ x: 0, y: 0 }, { x: 10, y: 10 })).toEqual([])
    const dot = { a: { x: 5, y: 5 }, b: { x: 5, y: 5 } }
    const single = new WallIndex([dot])
    expect(single.queryCircle({ x: 5, y: 6 }, 2)).toEqual([dot])
    expect(single.querySegment({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual([dot])
  })

  it('un lado diminuto se agranda para no crear millones de celdas', () => {
    const grid = new WallIndex(list, 0.01)
    expect(grid.columns * grid.rows).toBeLessThanOrEqual(list.length * 4 + 64)
  })
})
