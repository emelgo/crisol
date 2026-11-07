// Portado de packages/mesa/src/nucleo/chinchetas.test.ts (Crisol actual, commit 3f68f11)
import { describe, expect, it } from 'vitest'
import { cellCenter, type Grid } from './grid.ts'
import { linkedCellAt, nextPinLabel, pinIcon } from './pins.ts'

describe('pines de la mesa', () => {
  it('su icono y su color: de la tabla, un nombre de Lucide o el de por defecto', () => {
    expect(pinIcon('treasure')).toEqual({ icon: 'gem', color: '#c9962c' })
    expect(pinIcon('sword')).toEqual({ icon: 'sword', color: '#b8433a' })
    expect(pinIcon('<script>')).toEqual(pinIcon('pin'))
    expect(pinIcon(undefined)).toEqual(pinIcon('pin'))
    expect(pinIcon('number').icon).toBe('')
  })

  it('la etiqueta siguiente de una serie', () => {
    expect(nextPinLabel('number', ['1', '2', 4])).toBe('3')
    expect(nextPinLabel('letter', ['A', 'B'])).toBe('C')
  })

  it('en una rejilla cuadrada, toda la casilla del pin lleva a su página', () => {
    const square: Grid = { type: 'square', size: 70, offsetX: 0, offsetY: 0 }
    const pins = [
      { id: 'a', x: 100, y: 100, cell: true },
      { id: 'b', x: 30, y: 30 }
    ]
    expect(linkedCellAt(pins, square, { x: 75, y: 136 })?.id).toBe('a')
    expect(linkedCellAt(pins, square, { x: 145, y: 100 })).toBeNull()
    // Un pin suelto (sin `cell`) no enlaza su casilla
    expect(linkedCellAt(pins, square, { x: 10, y: 10 })).toBeNull()
  })

  it('en una hexagonal, el hexágono; sin rejilla, nada', () => {
    const hex: Grid = { type: 'hex-rows', size: 70, offsetX: 0, offsetY: 0 }
    const center = cellCenter(hex, { q: 1, r: 1 })
    const pins = [{ id: 'h', x: center.x + 5, y: center.y - 5, cell: true }]
    expect(linkedCellAt(pins, hex, { x: center.x - 20, y: center.y + 10 })?.id).toBe('h')
    expect(linkedCellAt(pins, null, center)).toBeNull()
  })
})
