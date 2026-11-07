import type { SceneGrid } from '@crisol/contracts'
import { describe, expect, it } from 'vitest'
import {
  arrowMoves,
  dragMoves,
  dropAt,
  formationOf,
  initialOf,
  lifeState,
  tokenAt,
  tokenRadius,
  tokensIn
} from './tokens.ts'

const GRID: SceneGrid = {
  type: 'square',
  size: 100,
  offsetX: 0,
  offsetY: 0,
  distance: 5,
  units: 'pies',
  diagonals: 'equal',
  visible: true,
  color: '#000000',
  opacity: 0.3
}
const A = { id: 'a', x: 150, y: 150, size: 1 }
const B = { id: 'b', x: 250, y: 150, size: 1 }
const BIG = { id: 'c', x: 400, y: 400, size: 2 }

describe('las fichas en la mesa', () => {
  it('su radio sale de su tamaño en casillas; la que hay en un punto es la de encima', () => {
    expect(tokenRadius(A, GRID)).toBeCloseTo(42)
    expect(tokenRadius(BIG, GRID)).toBeCloseTo(84)
    expect(tokenAt([A, B], { x: 160, y: 140 }, GRID)?.id).toBe('a')
    expect(tokenAt([A, B], { x: 200, y: 150 }, GRID)).toBeNull()
    // Una encima de otra: la última
    expect(tokenAt([A, { ...A, id: 'arriba' }], { x: 150, y: 150 }, GRID)?.id).toBe('arriba')
    expect(tokenAt([BIG], { x: 480, y: 400 }, GRID)?.id).toBe('c')
    expect(tokenAt([A], { x: 195, y: 150 }, GRID)).toBeNull()
  })

  it('un recuadro elige las que tienen el centro dentro, se trace hacia donde se trace', () => {
    expect(tokensIn([A, B, BIG], { x: 300, y: 300 }, { x: 100, y: 100 }).map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('soltar: libre, o con Mayús en su casilla según su tamaño', () => {
    expect(dropAt({ x: 123.456, y: 87 }, 1, GRID, false)).toEqual({ x: 123.5, y: 87 })
    expect(dropAt({ x: 123, y: 87 }, 1, GRID, true)).toEqual({ x: 150, y: 50 })
    // Una de 2 casillas, en la esquina entre cuatro
    expect(dropAt({ x: 190, y: 210 }, 2, GRID, true)).toEqual({ x: 200, y: 200 })
    // Sin rejilla no hay a qué pegar
    expect(dropAt({ x: 123, y: 87 }, 1, { ...GRID, type: 'none' }, true)).toEqual({ x: 123, y: 87 })
  })

  it('arrastrar varias: todas lo mismo que la que se lleva (que es la que pega)', () => {
    expect(dragMoves([A, B], A, { x: 340, y: 160 }, GRID, true)).toEqual([
      { tokenId: 'a', x: 350, y: 150 },
      { tokenId: 'b', x: 450, y: 150 }
    ])
  })

  it('las flechas mueven una casilla', () => {
    expect(arrowMoves([A], 'ArrowDown', GRID)).toEqual([{ tokenId: 'a', x: 150, y: 250 }])
    expect(arrowMoves([A], 'Enter', GRID)).toBeNull()
    expect(arrowMoves([], 'ArrowDown', GRID)).toBeNull()
  })

  it('la formación de un encuentro: por clave, en casillas desde la de arriba a la izquierda', () => {
    expect(
      formationOf(
        [
          { key: 'goblin', unique: false, x: 250, y: 150 },
          { key: 'goblin', unique: false, x: 350, y: 160 },
          { key: 'jefe', unique: true, x: 250, y: 350 }
        ],
        GRID
      )
    ).toEqual([
      {
        key: 'goblin',
        unique: false,
        at: [
          { dx: 0, dy: 0 },
          { dx: 1, dy: 0 }
        ]
      },
      { key: 'jefe', unique: true, at: [{ dx: 0, dy: 2 }] }
    ])
  })

  it('el estado en palabras y la inicial', () => {
    expect(lifeState({ value: 7, max: 7 })).toBe('unhurt')
    expect(lifeState({ value: 5, max: 7 })).toBe('hurt')
    expect(lifeState({ value: 3, max: 7 })).toBe('bloodied')
    expect(lifeState({ value: 1, max: 7 })).toBe('dying')
    expect(lifeState({ value: 0, max: 7 })).toBe('down')
    expect(lifeState(null)).toBeNull()
    expect(initialOf('lía')).toBe('L')
  })
})
