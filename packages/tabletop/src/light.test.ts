import { describe, expect, it } from 'vitest'
import {
  activeLights,
  ambientLight,
  BRIGHT_LEVEL,
  distanceToPixels,
  illuminationAt,
  LIGHT_TAIL,
  LIT_THRESHOLD,
  type Light,
  lightCone,
  lightPolygon,
  lightRadius,
  lightWithDarkvision,
  perceivedLight,
  perceivedReach
} from './light.ts'
import type { Edge } from './walls.ts'

const light = (extra: Partial<Light> = {}): Light => ({
  id: 'l',
  x: 0,
  y: 0,
  bright: 100,
  dim: 200,
  color: '#ffe2a8',
  intensity: 1,
  angle: 360,
  rotation: 0,
  walls: true,
  darkness: false,
  ...extra
})

describe('caída de la luz', () => {
  it('una antorcha (6 m brillante, 12 m tenue): brillante en su borde, penumbra en el tenue, nada pasada la cola', () => {
    expect(illuminationAt(0, 6, 12)).toBeGreaterThan(0.97)
    expect(illuminationAt(6, 6, 12)).toBeCloseTo(0.8, 2)
    expect(illuminationAt(12, 6, 12)).toBeCloseTo(0.4, 2)
    expect(illuminationAt(12 * LIGHT_TAIL, 6, 12)).toBe(0)
    expect(illuminationAt(0, 0, 0)).toBe(0)
  })

  it('cae siempre, sin escalones', () => {
    let before = illuminationAt(0, 6, 12)
    for (let d = 0.1; d < 12 * LIGHT_TAIL; d += 0.1) {
      const now = illuminationAt(d, 6, 12)
      expect(now).toBeLessThanOrEqual(before + 1e-9)
      expect(before - now).toBeLessThan(0.03)
      before = now
    }
  })

  it('luces solo tenues o solo brillantes', () => {
    expect(illuminationAt(5, 0, 5)).toBeCloseTo(0.4, 2)
    expect(illuminationAt(5, 5, 0)).toBeCloseTo(0.8, 2)
    expect(illuminationAt(5, 5, 5)).toBeCloseTo(0.8, 2)
  })
})

describe('lo que ven los ojos', () => {
  it('por debajo del umbral, oscuridad; por encima, la luz que hay', () => {
    expect(LIT_THRESHOLD).toBe(0.25)
    expect(perceivedLight(0.05, 0.25)).toBe(0)
    expect(perceivedLight(0.25, 0.25)).toBe(0.25)
    expect(perceivedLight(0.6, 0.25)).toBe(0.6)
    expect(perceivedLight(0.22, 0.25)).toBeGreaterThan(0)
    expect(perceivedLight(0.22, 0.25)).toBeLessThan(0.22)
    expect(perceivedLight(0.1, 0)).toBe(0.1)
  })

  it('con visión en la oscuridad, lo tenue se ve brillante; lo oscuro y lo brillante, igual', () => {
    expect(lightWithDarkvision(0.4, 0.25)).toBe(BRIGHT_LEVEL)
    expect(lightWithDarkvision(0.05, 0.25)).toBe(0.05)
    expect(lightWithDarkvision(0.95, 0.25)).toBe(0.95)
    expect(lightWithDarkvision(0.1, 0)).toBe(BRIGHT_LEVEL)
  })

  it('una antorcha se ve algo más allá de su tenue; una que no llega al umbral, nada', () => {
    const r = perceivedReach(6, 12, 1, 0.25)
    expect(r).toBeGreaterThan(12)
    expect(r).toBeLessThan(12 * LIGHT_TAIL)
    expect(perceivedLight(illuminationAt(r + 0.1, 6, 12), 0.25)).toBeLessThan(0.02)
    expect(perceivedReach(6, 12, 0.1, 0.25)).toBe(0)
  })
})

describe('las luces de la escena', () => {
  it('de unidades del juego a píxeles; la luz ambiental de la oscuridad', () => {
    expect(distanceToPixels(30, 5, 70)).toBe(420)
    expect(distanceToPixels(30, 0, 70)).toBe(30)
    expect(ambientLight(0)).toBe(1)
    expect(ambientLight(0.8)).toBeCloseTo(0.2)
    expect(ambientLight(2)).toBe(0)
  })

  it('las que alumbran: sin las apagadas, las sin radio ni las que esperan a que oscurezca', () => {
    const lights = [
      light({ id: 'a' }),
      light({ id: 'b' }),
      light({ id: 'farola', activeBelowAmbient: 0.3 }),
      light({ id: 'nada', bright: 0, dim: 0 })
    ]
    expect(activeLights(lights, 0, new Set(['b'])).map((l) => l.id)).toEqual(['a'])
    expect(activeLights(lights, 0.9).map((l) => l.id)).toEqual(['a', 'b', 'farola'])
  })

  it('su área: hasta donde se ve, en su cono y recortada por los muros si la cortan', () => {
    const wall: Edge = { a: { x: 50, y: -500 }, b: { x: 50, y: 500 }, limited: false, pass: null }
    const reach = perceivedReach(100, 200, 1, LIT_THRESHOLD)
    expect(lightRadius(light())).toBeCloseTo(reach)
    expect(lightRadius(light({ darkness: true }))).toBe(200)
    const right = (polygon: { x: number }[]) => Math.max(...polygon.map((p) => p.x))
    expect(right(lightPolygon(light(), [wall]))).toBeCloseTo(50)
    expect(right(lightPolygon(light({ walls: false }), [wall]))).toBeCloseTo(reach)
    expect(lightCone(light())).toBeUndefined()
    const cone = lightPolygon(light({ angle: 90, rotation: 270 }), [])
    expect(right(cone)).toBeLessThanOrEqual(1e-6)
    expect(lightPolygon(light({ intensity: 0.05 }), [])).toEqual([])
  })
})
