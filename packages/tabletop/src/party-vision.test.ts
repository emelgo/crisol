import { describe, expect, it } from 'vitest'
import type { Light } from './light.ts'
import { darknessEdges, darknessZones, seesInMagicalDarkness, tokenSight } from './party-vision.ts'
import { visibilityPolygon } from './vision.ts'
import type { Edge } from './walls.ts'

const darkness = (extra: Partial<Light> = {}): Light => ({
  id: 'osc',
  x: 0,
  y: 0,
  bright: 0,
  dim: 100,
  color: '#000000',
  intensity: 1,
  angle: 360,
  rotation: 0,
  walls: true,
  darkness: true,
  ...extra
})
const farthest = (polygon: { x: number; y: number }[], o = { x: 100, y: 100 }) =>
  Math.max(...polygon.map((p) => Math.hypot(p.x - o.x, p.y - o.y)))

describe('lo que ve cada ficha del grupo', () => {
  it('su polígono hasta su alcance, su huella y sus sentidos en píxeles', () => {
    const sight = tokenSight(
      {
        id: 'a',
        x: 100,
        y: 100,
        radius: 35,
        range: 500,
        senses: { darkvision: 840, blindsight: 140, tremorsense: 420 }
      },
      { plain: [], withDarkness: [] }
    )
    expect(farthest(sight.polygon)).toBeCloseTo(500)
    // La visión en la oscuridad no pasa del alcance de su vista
    expect(sight).toMatchObject({ id: 'a', footprint: 35, darkvision: 500, beyondDarkness: 140, tremorsense: 420 })
  })

  it('sin alcance ve hasta donde se le diga; sin sentidos, ninguno; con cono, solo hacia donde mira', () => {
    const sight = tokenSight({ id: 'a', x: 100, y: 100 }, { plain: [], withDarkness: [] }, 2000)
    expect(farthest(sight.polygon)).toBeCloseTo(2000)
    expect(sight).toMatchObject({ footprint: 0, darkvision: 0, beyondDarkness: 0, tremorsense: 0 })
    const cone = tokenSight({ id: 'a', x: 100, y: 100, angle: 90, rotation: 180 }, { plain: [], withDarkness: [] }, 50)
    expect(Math.min(...cone.polygon.map((p) => p.y))).toBeGreaterThanOrEqual(100 - 1e-6)
  })

  it('la vista ciega o verdadera mira sin los bordes de la oscuridad; la demás, con ellos', () => {
    const wall: Edge = { a: { x: 150, y: -1000 }, b: { x: 150, y: 1000 }, limited: false, pass: null }
    const sources = { plain: [], withDarkness: [wall] }
    const right = (polygon: { x: number }[]) => Math.max(...polygon.map((p) => p.x))
    expect(right(tokenSight({ id: 'a', x: 100, y: 100, range: 300 }, sources).polygon)).toBeCloseTo(150)
    expect(
      right(tokenSight({ id: 'a', x: 100, y: 100, range: 300, senses: { truesight: 10 } }, sources).polygon)
    ).toBeCloseTo(400)
    expect(seesInMagicalDarkness({ blindsight: 5 })).toBe(true)
    expect(seesInMagicalDarkness({ darkvision: 5 })).toBe(false)
    expect(seesInMagicalDarkness(undefined)).toBe(false)
  })
})

describe('la oscuridad mágica', () => {
  it('solo las luces de oscuridad dan zona, recortada por los muros', () => {
    const torch = { ...darkness({ id: 'antorcha' }), darkness: false }
    const zones = darknessZones([torch, darkness()], [])
    expect(zones).toHaveLength(1)
    expect(farthest(zones[0] ?? [], { x: 0, y: 0 })).toBeCloseTo(100, 0)
    // Un muro a 40 a la derecha la corta
    const wall: Edge = { a: { x: 40, y: -200 }, b: { x: 40, y: 200 }, limited: false, pass: null }
    const cut = darknessZones([darkness()], [wall])
    expect(Math.max(...(cut[0] ?? []).map((p) => p.x))).toBeLessThanOrEqual(40 + 1e-6)
  })

  it('su borde para la vista: desde fuera no se ve a través de ella', () => {
    const zones = darknessZones([darkness({ x: 300, y: 100, dim: 47 })], [])
    const edges = darknessEdges(zones)
    expect(edges).toHaveLength(zones[0]?.length ?? 0)
    const polygon = visibilityPolygon({ x: 100, y: 100 }, edges, 2000)
    const right = Math.max(...polygon.filter((p) => Math.abs(p.y - 100) < 1).map((p) => p.x))
    expect(right).toBeCloseTo(253, 0)
  })
})
