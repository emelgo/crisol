// Portado de packages/mesa/src/nucleo/medidas.test.ts (Crisol actual, commit 3f68f11)
import { describe, expect, it } from 'vitest'
import { cellCenter, type Grid } from './grid.ts'
import { cellsBetween, distancePerCell, distanceText, measurePath, straightCells } from './measure.ts'

const square: Grid = { type: 'square', size: 100, offsetX: 0, offsetY: 0 }
const at = (grid: Grid, q: number, r: number) => cellCenter(grid, { q, r })
const feet = { distance: 5, units: 'pies' }

describe('medir', () => {
  it('las tres reglas de diagonales en la cuadrada', () => {
    // Cuatro a la derecha y tres abajo: tres diagonales y una recta
    const a = at(square, 0, 0)
    const b = at(square, 4, 3)
    expect(cellsBetween(square, a, b, 'equal')).toBe(4)
    expect(cellsBetween(square, a, b, 'alternate')).toBe(5)
    expect(cellsBetween(square, a, b, 'euclidean')).toBe(5)
    // Dentro de la misma casilla, nada
    expect(cellsBetween(square, { x: 10, y: 10 }, { x: 90, y: 90 }, 'alternate')).toBe(0)
  })

  it('en hexagonal cuentan los pasos, con cualquier regla', () => {
    for (const type of ['hex-rows', 'hex-columns'] as const) {
      const hex: Grid = { type, size: 100, offsetX: 0, offsetY: 0 }
      const a = at(hex, 0, 0)
      const b = at(hex, 3, -1)
      for (const rule of ['equal', 'alternate', 'euclidean'] as const) expect(cellsBetween(hex, a, b, rule)).toBe(3)
    }
  })

  it('un camino con puntos intermedios: con alternas, la cuenta de diagonales sigue de un tramo al otro', () => {
    const points = [at(square, 0, 0), at(square, 1, 1), at(square, 2, 2), at(square, 3, 2)]
    expect(measurePath(square, points, 'equal')).toEqual({ cells: 3, segments: [1, 1, 1] })
    // La segunda diagonal (en el segundo tramo) cuenta doble
    expect(measurePath(square, points, 'alternate')).toEqual({ cells: 4, segments: [1, 2, 1] })
    // Sin rejilla, en línea recta con casillas de 100 px
    expect(
      measurePath(
        null,
        [
          { x: 0, y: 0 },
          { x: 300, y: 400 }
        ],
        'equal'
      ).cells
    ).toBe(5)
    expect(straightCells({ x: 0, y: 0 }, { x: 0, y: 150 }, 50)).toBe(3)
  })

  it('el texto en la unidad de la escena, con decimales o por bandas', () => {
    expect(distanceText(6, feet)).toBe('30 pies')
    expect(distanceText(3, { distance: 1.5, units: 'm' })).toBe('4,5 m')
    expect(distanceText(1.21 / 1.5, { distance: 1.5, units: 'm' }, 2)).toBe('1,21 m')
    expect(distanceText(2, { distance: 1, units: '' })).toBe('2')
    const bands = [
      { name: 'Lejos', maxCells: 12 },
      { name: 'Cerca', maxCells: 2 }
    ]
    expect(distanceText(2, feet, 1, bands)).toBe('Cerca')
    expect(distanceText(40, feet, 1, bands)).toBe('Lejos')
  })

  it('la escala de una barra: 700 px que miden 100 km, con casillas de 70 px, son 10 km por casilla', () => {
    expect(distancePerCell(100, 700, 70)).toBe(10)
    expect(distancePerCell(100, 0, 70)).toBe(0)
  })
})
