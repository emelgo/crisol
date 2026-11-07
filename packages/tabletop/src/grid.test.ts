// Portado de packages/mesa/src/nucleo/nucleo.test.ts (Crisol actual, commit 3f68f11)
import { describe, expect, it } from 'vitest'
import { pointInPolygon } from './geometry.ts'
import {
  cellAt,
  cellCenter,
  cellsIn,
  cellVertices,
  centerOnResize,
  columnLetters,
  dashSegment,
  drawnCells,
  footprintCells,
  type Grid,
  gridCrosses,
  gridLines,
  hexCircumradius,
  numberCells,
  pointInNewGrid,
  roundAxial,
  snapToken,
  stepsBetween,
  toGrid
} from './grid.ts'

const square: Grid = { type: 'square', size: 70, offsetX: 0, offsetY: 0 }
const rows: Grid = { type: 'hex-rows', size: 70, offsetX: 0, offsetY: 0 }
const columns: Grid = { type: 'hex-columns', size: 70, offsetX: 0, offsetY: 0 }
const near = (p: { x: number; y: number }, x: number, y: number): void => {
  expect(p.x).toBeCloseTo(x, 6)
  expect(p.y).toBeCloseTo(y, 6)
}

describe('la rejilla', () => {
  it('se lee de los datos guardados', () => {
    expect(toGrid({ type: 'hex-rows', size: 64, offsetX: 3, offsetY: 4 })).toEqual({
      type: 'hex-rows',
      size: 64,
      offsetX: 3,
      offsetY: 4
    })
    expect(toGrid({ size: 50 })).toEqual({ type: 'square', size: 50, offsetX: 0, offsetY: 0 })
    // Por debajo del mínimo se sube al mínimo; sin tamaño, no hay rejilla
    expect(toGrid({ type: 'hex-columns', size: 4 })?.size).toBe(10)
    expect(toGrid({ type: 'square', size: 0 })).toBeNull()
    expect(toGrid({ type: 'square', size: 50, offsetX: Number.NaN })?.offsetX).toBe(0)
    expect(toGrid(null)).toBeNull()
  })

  it('cuadrada: centros, celdas y pasos', () => {
    near(cellCenter(square, { q: 0, r: 0 }), 35, 35)
    near(cellCenter({ ...square, offsetX: 10 }, { q: 2, r: 1 }), 185, 105)
    expect(cellAt(square, { x: 140.5, y: 69 })).toEqual({ q: 2, r: 0 })
    expect(stepsBetween(square, { q: 0, r: 0 }, { q: 3, r: -2 })).toBe(3)
    expect(cellVertices(square, { x: 35, y: 35 })).toEqual([
      { x: 0, y: 0 },
      { x: 70, y: 0 },
      { x: 70, y: 70 },
      { x: 0, y: 70 }
    ])
  })

  it('hexagonal: la caja de (0, 0) empieza en el desplazamiento y el tamaño es de lado plano a lado plano', () => {
    // Por filas (vértice arriba): ancho 70; por columnas (lado plano arriba): alto 70
    near(cellCenter(rows, { q: 0, r: 0 }), 35, 70 / Math.sqrt(3))
    near(cellCenter(columns, { q: 0, r: 0 }), 70 / Math.sqrt(3), 35)
    expect(hexCircumradius(70)).toBeCloseTo(70 / Math.sqrt(3), 9)
    // Vecinos a la distancia de lado plano a lado plano
    const a = cellCenter(rows, { q: 0, r: 0 })
    const b = cellCenter(rows, { q: 0, r: 1 })
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(70, 6)
    for (const grid of [rows, columns])
      for (const cell of [
        { q: 0, r: 0 },
        { q: 3, r: -1 },
        { q: -2, r: 4 }
      ]) {
        expect(cellAt(grid, cellCenter(grid, cell))).toEqual(cell)
        const v = cellVertices(grid, cellCenter(grid, cell))
        expect(v).toHaveLength(6)
        // Un punto casi en un vértice, desde dentro, sigue en la celda
        const c = cellCenter(grid, cell)
        const corner = v[1] ?? c
        expect(cellAt(grid, { x: c.x + (corner.x - c.x) * 0.95, y: c.y + (corner.y - c.y) * 0.95 })).toEqual(cell)
      }
    expect(stepsBetween(rows, { q: 0, r: 0 }, { q: 2, r: -3 })).toBe(3)
    expect(roundAxial(0.4, 0.4)).toEqual({ q: 0, r: 1 })
  })

  it('al cambiar de tamaño o desplazamiento, un punto sigue en el mismo sitio de su casilla', () => {
    const to: Grid = { type: 'square', size: 35, offsetX: 10, offsetY: 20 }
    near(pointInNewGrid({ x: 105, y: 35 }, square, to), 10 + 52.5, 20 + 17.5)
  })

  it('fichas: huella impar al centro de la celda, par en la esquina o el vértice de abajo a la derecha', () => {
    expect([0.5, 1, 2, 3, 4].map(footprintCells)).toEqual([1, 1, 2, 3, 4])
    expect([0.5, 1, 2].map(drawnCells)).toEqual([0.5, 1, 2])
    near(snapToken(square, { x: 100, y: 10 }, 1), 105, 35)
    near(snapToken(square, { x: 100, y: 10 }, 2), 70, 0)
    near(snapToken(square, { x: 80, y: 80 }, 3), 105, 105)
    const center = cellCenter(rows, { q: 1, r: 1 })
    const big = snapToken(rows, { x: center.x + 30, y: center.y + 18 }, 2)
    // El vértice de las 4 en punto (30°)
    const vertex = cellVertices(rows, center)[2] ?? center
    near(big, vertex.x, vertex.y)
    // Por columnas, el vértice de abajo a la derecha está a ½ circunradio y ½ tamaño
    const c2 = cellCenter(columns, { q: 1, r: 1 })
    near(snapToken(columns, { x: c2.x + 20, y: c2.y + 34 }, 2), c2.x + hexCircumradius(70) / 2, c2.y + 35)
    expect(snapToken(null, { x: 3, y: 4 })).toEqual({ x: 3, y: 4 })
  })

  it('al redimensionar ajustada conserva la esquina de arriba a la izquierda (cuadrada) o la celda (hexagonal)', () => {
    near(centerOnResize(square, { x: 105, y: 105 }, 1, 2, true), 140, 140)
    near(centerOnResize(square, { x: 140, y: 140 }, 2, 3, true), 175, 175)
    near(centerOnResize(square, { x: 105, y: 105 }, 1, 2, false), 105, 105)
    const c = cellCenter(rows, { q: 2, r: 2 })
    const grown = centerOnResize(rows, c, 1, 2, true)
    near(centerOnResize(rows, grown, 2, 1, true), c.x, c.y)
    expect(centerOnResize(null, { x: 1, y: 2 }, 1, 2, true)).toEqual({ x: 1, y: 2 })
  })

  it('celdas a la vista: las de dentro y una de margen', () => {
    const cells = cellsIn(square, { x: 0, y: 0, width: 140, height: 70 })
    expect(cells).toContainEqual({ q: 0, r: 0 })
    expect(cells).toContainEqual({ q: 1, r: 0 })
    expect(cells).toContainEqual({ q: -1, r: -1 })
    expect(cells).not.toContainEqual({ q: 4, r: 0 })
  })

  it('líneas sin repetir lados, y trazo discontinuo', () => {
    expect(gridLines(square, { x: 0, y: 0, width: 140, height: 70 })).toHaveLength(3 + 2)
    const hex = gridLines(rows, { x: 0, y: 0, width: 300, height: 300 })
    const keys = new Set(hex.map(([a, b, c, d]) => `${Math.round((a + c) * 4)},${Math.round((b + d) * 4)}`))
    expect(keys.size).toBe(hex.length)
    expect(dashSegment([0, 0, 10, 0], 3, 2)).toEqual([
      [0, 0, 3, 0],
      [5, 0, 8, 0]
    ])
    expect(dashSegment([0, 0, 0, 0], 3, 2)).toEqual([])
    expect(dashSegment([0, 0, 10, 0], 0, 2)).toEqual([])
  })

  it('cruces: una «+» por esquina, sin repetir', () => {
    // 3 × 2 esquinas en un rectángulo de 2 × 1 casillas, dos brazos cada una
    const crosses = gridCrosses(square, { x: 0, y: 0, width: 140, height: 70 }, 5)
    expect(crosses).toHaveLength(3 * 2 * 2)
    expect(crosses[0]).toEqual([-5, 0, 5, 0])
    expect(crosses[1]).toEqual([0, -5, 0, 5])
    const hex = gridCrosses(rows, { x: 0, y: 0, width: 300, height: 300 }, 4)
    const centers = new Set(hex.map(([a, b, c, d]) => `${Math.round((a + c) * 4)},${Math.round((b + d) * 4)}`))
    expect(centers.size * 2).toBe(hex.length)
  })

  it('numeración: columna-fila, seguida y letra-número, también las celdas cortadas por el borde', () => {
    const map = { x: 0, y: 0, width: 210, height: 140 }
    expect(numberCells(square, map, 'column-row').map((c) => c.label)).toEqual([
      '0101',
      '0201',
      '0301',
      '0102',
      '0202',
      '0302'
    ])
    expect(numberCells(square, map, 'sequential').map((c) => c.label)).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(numberCells(square, map, 'letter-number').map((c) => c.label)).toEqual(['A1', 'B1', 'C1', 'A2', 'B2', 'C2'])
    // Una celda con menos de la mitad dentro no lleva número; con la mitad o más, sí (y su número no se sale)
    expect(numberCells(square, { x: 0, y: 0, width: 230, height: 70 }, 'sequential')).toHaveLength(3)
    const cut = numberCells(square, { x: 0, y: 0, width: 260, height: 70 }, 'sequential')
    expect(cut).toHaveLength(4)
    expect(cut[3]?.anchor.x).toBeLessThanOrEqual(260)
    expect([1, 26, 27, 53].map(columnLetters)).toEqual(['A', 'Z', 'AA', 'BA'])
  })

  it('numeración por columnas en la hexagonal de lado plano arriba', () => {
    const labels = numberCells(columns, { x: 0, y: 0, width: 200, height: 140 }, 'column-row')
    // Cada columna empieza a contar en su primera celda, de arriba abajo
    expect(labels[0]?.label).toBe('0101')
    expect(labels.map((c) => c.label)).toContain('0201')
    expect(labels.map((c) => c.label)).toContain('0102')
  })
})

describe('dentro de un polígono', () => {
  it('par-impar, también en un polígono cóncavo', () => {
    const shape = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 5, y: 4 },
      { x: 0, y: 10 }
    ]
    expect(pointInPolygon({ x: 2, y: 2 }, shape)).toBe(true)
    expect(pointInPolygon({ x: 5, y: 8 }, shape)).toBe(false)
    expect(pointInPolygon({ x: 20, y: 2 }, shape)).toBe(false)
    expect(pointInPolygon({ x: 1, y: 1 }, [])).toBe(false)
  })
})
