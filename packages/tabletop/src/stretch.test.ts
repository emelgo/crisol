// Portado de packages/mesa/src/nucleo/nucleo.test.ts (Crisol actual, commit 3f68f11)
import { describe, expect, it } from 'vitest'
import { followMap, imageToWorld, NO_STRETCH, toStretch, worldSize, worldToImage } from './stretch.ts'

const near = (p: { x: number; y: number }, x: number, y: number): void => {
  expect(p.x).toBeCloseTo(x, 6)
  expect(p.y).toBeCloseTo(y, 6)
}

describe('estirar el mapa', () => {
  it('fuera de rango es ninguno', () => {
    expect(toStretch({ x: 1.02, y: 1 })).toEqual({ x: 1.02, y: 1, rotation: 0 })
    expect(toStretch({ x: 1, y: 1.1, rotation: -3 })).toEqual({ x: 1, y: 1.1, rotation: -3 })
    expect(toStretch({ x: 2, y: 1 })).toBe(NO_STRETCH)
    expect(toStretch({ x: 0.9, y: 1 })).toBe(NO_STRETCH)
    expect(toStretch({ x: 1, y: 1, rotation: 9 })).toEqual({ x: 1, y: 1, rotation: 0 })
    expect(toStretch(undefined)).toBe(NO_STRETCH)
    expect(toStretch('1.2')).toBe(NO_STRETCH)
  })

  it('imagen ↔ mundo y llevar lo colocado con el mapa', () => {
    const image = { width: 1000, height: 600 }
    const e = { x: 1.1, y: 1, rotation: 2 }
    const p = { x: 123, y: 456 }
    const back = worldToImage(imageToWorld(p, image, e), image, e)
    near(back, p.x, p.y)
    expect(worldSize(image, NO_STRETCH)).toEqual({ width: 1000, height: 600 })
    near(imageToWorld(p, image, NO_STRETCH), 123, 456)
    near(followMap(image, NO_STRETCH, { x: 1.2, y: 1, rotation: 0 })({ x: 100, y: 50 }), 120, 50)
  })

  it('girada, el mundo es la caja que contiene la imagen nivelada', () => {
    const size = worldSize({ width: 1000, height: 600 }, { x: 1, y: 1, rotation: 5 })
    const a = (5 * Math.PI) / 180
    expect(size.width).toBeCloseTo(1000 * Math.cos(a) + 600 * Math.sin(a), 6)
    expect(size.height).toBeCloseTo(1000 * Math.sin(a) + 600 * Math.cos(a), 6)
  })
})
