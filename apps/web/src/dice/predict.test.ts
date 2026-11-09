import type { DiceRoll } from '@crisol/contracts'
import { describe, expect, it } from 'vitest'
import { fallingDice } from './falling.ts'
import { predictFalling } from './predict.ts'

const die = (sides: number | 'F', value: number, kept = true): DiceRoll['dice'][number] => ({ sides, value, kept })

describe('los dados que van a caer, antes del resultado', () => {
  it('los de la fórmula, en su orden, como los que caen con el resultado', () => {
    expect(predictFalling('2d6+1d20+3 # Golpe')).toEqual([6, 6, 20])
    expect(fallingDice([die(6, 3), die(6, 5), die(20, 12)]).map((d) => d.kind)).toEqual([6, 6, 20])
  })

  it('la ventaja (dos d20), el d100 (decenas y unidades) y los Fate', () => {
    expect(predictFalling('2d20kh1+5')).toEqual([20, 20])
    expect(predictFalling('1d100')).toEqual(['T', 10])
    expect(predictFalling('d%')).toEqual(['T', 10])
    expect(predictFalling('4dF')).toEqual(['F', 'F', 'F', 'F'])
  })

  it('si explotan o se repiten no se sabe cuántos caerán; sin dados que caigan, tampoco', () => {
    expect(predictFalling('1d6!')).toBeNull()
    expect(predictFalling('2d6r1')).toBeNull()
    expect(predictFalling('5')).toBeNull()
    expect(predictFalling('1d3')).toBeNull()
  })

  it('como mucho los que caben en la bandeja', () => {
    expect(predictFalling('40d6')).toHaveLength(20)
  })
})
