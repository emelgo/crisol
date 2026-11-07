import { describe, expect, it } from 'vitest'
import { type Point, pointInPolygon } from './geometry.ts'
import { canSee, edgeBlocks, polygonArea, visibilityPolygon } from './vision.ts'
import { WallIndex } from './wall-index.ts'
import { type Edge, type Wall, wallEdges } from './walls.ts'

const wall = (x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall => ({
  id: `${x1},${y1},${x2},${y2}`,
  a: { x: x1, y: y1 },
  b: { x: x2, y: y2 },
  sight: 'full',
  light: 'full',
  move: 'full',
  direction: 'both',
  door: null,
  locked: false,
  ...extra
})
const farthest = (polygon: Point[], o = { x: 0, y: 0 }): number =>
  Math.max(...polygon.map((p) => Math.hypot(p.x - o.x, p.y - o.y)))
const edges = (walls: Wall[]) => wallEdges(walls, {}, 'sight')

describe('visión entre muros', () => {
  it('sin muros, un círculo del radio; un muro corta lo que hay detrás', () => {
    expect(farthest(visibilityPolygon({ x: 0, y: 0 }, [], 100))).toBeCloseTo(100)
    const t = edges([wall(-50, 20, 50, 20)])
    expect(canSee({ x: 0, y: 0 }, { x: 0, y: 30 }, t)).toBe(false)
    expect(canSee({ x: 0, y: 0 }, { x: 0, y: 10 }, t)).toBe(true)
    expect(canSee({ x: 0, y: 0 }, { x: 0, y: -80 }, t)).toBe(true)
    expect(canSee({ x: 0, y: 0 }, { x: 0, y: 0 }, t)).toBe(true)
    const polygon = visibilityPolygon({ x: 0, y: 0 }, t, 100)
    // Hacia abajo se para en el muro
    const down = polygon.filter((p) => Math.abs(p.x) < 5 && p.y > 0)
    expect(Math.max(...down.map((p) => p.y))).toBeCloseTo(20, 0)
  })

  it('muros limitados: se ve a través del primero, no del segundo', () => {
    const t = edges([wall(-50, 20, 50, 20, { sight: 'limited' }), wall(-50, 40, 50, 40, { sight: 'limited' })])
    expect(canSee({ x: 0, y: 0 }, { x: 0, y: 30 }, t)).toBe(true)
    expect(canSee({ x: 0, y: 0 }, { x: 0, y: 50 }, t)).toBe(false)
    // Uno limitado y uno entero: para en el entero
    const mixed = edges([wall(-50, 20, 50, 20, { sight: 'limited' }), wall(-50, 40, 50, 40)])
    expect(canSee({ x: 0, y: 0 }, { x: 0, y: 50 }, mixed)).toBe(false)
  })

  it('un solo sentido: deja pasar desde su lado de paso', () => {
    // a→b hacia la derecha (x crece): en pantalla, su izquierda es arriba (y menor)
    const left = edges([wall(-50, 0, 50, 0, { direction: 'left' })])
    expect(canSee({ x: 0, y: -10 }, { x: 0, y: 10 }, left)).toBe(true)
    expect(canSee({ x: 0, y: 10 }, { x: 0, y: -10 }, left)).toBe(false)
    const right = edges([wall(-50, 0, 50, 0, { direction: 'right' })])
    expect(canSee({ x: 0, y: 10 }, { x: 0, y: -10 }, right)).toBe(true)
    expect(canSee({ x: 0, y: -10 }, { x: 0, y: 10 }, right)).toBe(false)
    const [edge] = left
    expect(edge && edgeBlocks(edge, { x: 0, y: 10 })).toBe(true)
  })

  it('cono: solo hacia donde mira', () => {
    const polygon = visibilityPolygon({ x: 0, y: 0 }, [], 100, { angle: 90, rotation: 90 })
    // Mira a la derecha: nada a la izquierda del origen
    expect(Math.min(...polygon.map((p) => p.x))).toBeGreaterThanOrEqual(-1e-6)
    expect(Math.max(...polygon.map((p) => p.x))).toBeCloseTo(100)
    expect(polygon[0]).toEqual({ x: 0, y: 0 })
    // Un cono de 360° es mirar alrededor
    expect(visibilityPolygon({ x: 0, y: 0 }, [], 100, { angle: 360, rotation: 0 })).toHaveLength(48)
  })

  it('el polígono no se cruza consigo mismo al rozar el extremo de un muro (va siempre en el mismo sentido)', () => {
    const t = edges([wall(700, 140, 700, 560), wall(700, 560, 1050, 560)])
    const origin = { x: 455, y: 350 }
    for (const source of [t, new WallIndex(t)]) {
      const polygon = visibilityPolygon(origin, source, 1092)
      const angles = polygon.map((q) => Math.atan2(q.y - origin.y, q.x - origin.x))
      for (let i = 1; i < angles.length; i++) expect(angles[i]).toBeGreaterThanOrEqual((angles[i - 1] ?? 0) - 1e-9)
    }
  })

  it('el área de un polígono', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ]
    expect(polygonArea(square)).toBe(100)
    expect(polygonArea([...square].reverse())).toBe(100)
  })
})

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

const distanceToBoundary = (q: Point, polygon: readonly Point[]): number => {
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i] as Point
    const b = polygon[(i + 1) % polygon.length] as Point
    const dx = b.x - a.x
    const dy = b.y - a.y
    const l2 = dx * dx + dy * dy
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2))
    best = Math.min(best, Math.hypot(q.x - a.x - dx * t, q.y - a.y - dy * t))
  }
  return best
}

describe('con el índice espacial', () => {
  // Una prueba por escena (ocho escenas, cada una con su semilla), para que ninguna roce el tiempo límite
  it.each(Array.from({ length: 8 }, (_, scene) => scene))(
    'en la escena al azar %i (que se cruzan, con limitados y de un sentido), el polígono es justo lo que se ve',
    (scene) => {
      const r = random(42 + scene)
      {
        const list: Edge[] = Array.from({ length: 150 }, () => {
          const a = { x: r() * 1000, y: r() * 1000 }
          const angle = r() * Math.PI * 2
          const length = 20 + r() * 120
          const kind = r()
          return {
            a,
            b: { x: a.x + Math.cos(angle) * length, y: a.y + Math.sin(angle) * length },
            limited: kind < 0.2,
            pass: kind > 0.9 ? 'left' : kind > 0.85 ? 'right' : null
          }
        })
        const index = new WallIndex(list)
        for (let k = 0; k < 4; k++) {
          const origin = { x: r() * 1000, y: r() * 1000 }
          const radius = k === 0 ? 1e6 : 100 + r() * 400
          const fast = visibilityPolygon(origin, index, radius)
          // Cada punto del mapa está dentro si y solo si se ve (salvo a menos de un píxel del borde)
          for (let p = 0; p < 500; p++) {
            const q = { x: r() * 1000, y: r() * 1000 }
            const distance = Math.hypot(q.x - origin.x, q.y - origin.y)
            if (distanceToBoundary(q, fast) < 1 || Math.abs(distance - radius) < radius * 0.003) continue
            expect(pointInPolygon(q, fast)).toBe(distance < radius && canSee(origin, q, list))
          }
          for (let p = 0; p < 20; p++) {
            const target = { x: r() * 1000, y: r() * 1000 }
            expect(canSee(origin, target, index)).toBe(canSee(origin, target, list))
          }
        }
      }
    }
  )

  it('en una mazmorra, los extremos de las otras salas no lanzan rayos', () => {
    // 6 × 6 salas cerradas de 100 px
    const walls: Wall[] = []
    for (let i = 0; i <= 6; i++) {
      walls.push(wall(0, i * 100, 600, i * 100), wall(i * 100, 0, i * 100, 600))
    }
    const list = wallEdges(walls, {}, 'sight')
    const origin = { x: 250, y: 250 }
    const brute = visibilityPolygon(origin, list, 1e6)
    const fast = visibilityPolygon(origin, new WallIndex(list), 1e6)
    expect(polygonArea(fast)).toBeCloseTo(polygonArea(brute), 6)
    expect(polygonArea(fast)).toBeCloseTo(100 * 100, 6)
    expect(fast.length).toBeLessThan(brute.length / 2)
  })
})
