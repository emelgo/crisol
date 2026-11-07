// Portado de packages/mesa/src/nucleo/alineacion.test.ts (Crisol actual, commit 3f68f11)
import { describe, expect, it } from 'vitest'
import { gridAtPoint, gridFromMeasures, nearestNode, normalizeGrid, nudgeGrid, sizeFromMeasure } from './align.ts'
import { cellAt, cellCenter, cellVertices, type Grid } from './grid.ts'

/** Si dos rejillas son la misma red: mismo tipo y tamaño, y los centros de una son centros de la otra */
const same = (a: Grid, b: Grid): void => {
  expect(a.type).toBe(b.type)
  expect(a.size).toBeCloseTo(b.size, 3)
  for (const cell of [
    { q: 0, r: 0 },
    { q: 3, r: 2 },
    { q: -2, r: 5 }
  ]) {
    const c = cellCenter(a, cell)
    const inB = cellCenter(b, cellAt(b, c))
    expect(inB.x).toBeCloseTo(c.x, 2)
    expect(inB.y).toBeCloseTo(c.y, 2)
  }
}

describe('alinear la rejilla', () => {
  it('cuadrada: tamaño medio, desplazamiento entre 0 y una celda, y cuánto difieren', () => {
    const r = gridFromMeasures('square', [
      { a: { x: 105, y: 175 }, b: { x: 175, y: 175 } },
      { a: { x: 875, y: 105 }, b: { x: 945, y: 105.5 } },
      { a: { x: 175, y: 735 }, b: { x: 245, y: 735 } }
    ])
    expect(r).not.toBeNull()
    expect(r?.grid.size).toBeCloseTo(70, 2)
    expect(r?.grid.offsetX).toBeCloseTo(35, 1)
    expect(r?.grid.offsetY).toBeCloseTo(35, 1)
    expect(r?.sizes).toEqual([70, 70.002, 70])
    expect(r?.deviation).toBeLessThan(1)
  })

  it('una medida desviada se nota en la diferencia; sin medidas válidas no hay rejilla', () => {
    const r = gridFromMeasures('square', [
      { a: { x: 0, y: 0 }, b: { x: 70, y: 0 } },
      { a: { x: 703, y: 700 }, b: { x: 773, y: 700 } }
    ])
    expect(r?.deviation).toBeGreaterThan(1)
    expect(gridFromMeasures('square', [{ a: { x: 5, y: 5 }, b: { x: 5.5, y: 5 } }])).toBeNull()
    expect(gridFromMeasures('square', [])).toBeNull()
  })

  for (const type of ['hex-rows', 'hex-columns'] as const) {
    it(`${type}: dos esquinas contiguas de un hexágono dan la red entera`, () => {
      const real: Grid = { type, size: 60, offsetX: 13, offsetY: 27 }
      const measures = [
        { q: 1, r: 1 },
        { q: 6, r: 2 },
        { q: 2, r: 7 }
      ].map((cell, i) => {
        const v = cellVertices(real, cellCenter(real, cell))
        return { a: v[i] ?? { x: 0, y: 0 }, b: v[i + 1] ?? { x: 0, y: 0 } }
      })
      const r = gridFromMeasures(type, measures)
      expect(r).not.toBeNull()
      if (r) same(r.grid, real)
      expect(r?.deviation).toBeLessThan(0.01)
    })
  }

  it('en la hexagonal, el lado medido por √3 es el tamaño', () => {
    expect(sizeFromMeasure('hex-rows', { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } })).toBeCloseTo(10 * Math.sqrt(3), 9)
    expect(sizeFromMeasure('square', { a: { x: 0, y: 0 }, b: { x: 0, y: 10 } })).toBe(10)
  })

  it('libre: intersección o centro en el punto; las flechas la empujan', () => {
    const sq = gridAtPoint('square', 50, { x: 333, y: 412 })
    expect(sq).toEqual({ type: 'square', size: 50, offsetX: 33, offsetY: 12 })
    expect(nudgeGrid(sq, 18, -0.5)).toEqual({ type: 'square', size: 50, offsetX: 1, offsetY: 11.5 })
    const hex = gridAtPoint('hex-rows', 60, { x: 500, y: 300 })
    const c = cellCenter(hex, cellAt(hex, { x: 500, y: 300 }))
    expect(c.x).toBeCloseTo(500, 3)
    expect(c.y).toBeCloseTo(300, 3)
  })

  it('normalizar no cambia la red y deja el desplazamiento entre 0 y una celda', () => {
    const r: Grid = { type: 'hex-columns', size: 64, offsetX: 900, offsetY: -455 }
    const n = normalizeGrid(r)
    same(n, r)
    expect(n.offsetX).toBeGreaterThanOrEqual(0)
    expect(n.offsetY).toBeGreaterThanOrEqual(0)
    // Un tamaño por debajo del mínimo sube al mínimo
    expect(normalizeGrid({ type: 'square', size: 3, offsetX: 0, offsetY: 0 }).size).toBe(10)
  })

  it('el nudo más cercano', () => {
    expect(nearestNode({ type: 'square', size: 50, offsetX: 10, offsetY: 20 }, { x: 74, y: 21 })).toEqual({
      x: 60,
      y: 20
    })
  })
})
