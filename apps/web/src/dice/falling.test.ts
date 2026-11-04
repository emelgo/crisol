import { describe, expect, it } from 'vitest'
import { fallingDice, MAX_FALLING } from './falling.ts'

const die = (sides: number | 'F', value: number, kept = true) => ({ sides, value, kept })

describe('los dados que caen de una tirada', () => {
  it('cada dado con su cara: el 10 del d10 es el 0; el d%, un dado de decenas y otro de unidades; el Fate, +, − o nada', () => {
    expect(fallingDice([die(20, 17), die(10, 10), die(6, 3, false)])).toEqual([
      { kind: 20, label: '17', kept: true, critical: false },
      { kind: 10, label: '0', kept: true, critical: false },
      { kind: 6, label: '3', kept: false, critical: false }
    ])
    expect(fallingDice([die(100, 47)])).toEqual([
      { kind: 'T', label: '40', kept: true, critical: false },
      { kind: 10, label: '7', kept: true, critical: false }
    ])
    expect(fallingDice([die(100, 100)]).map((d) => d.label)).toEqual(['00', '0'])
    expect(fallingDice([die('F', 1), die('F', -1), die('F', 0)]).map((d) => d.label)).toEqual(['+', '−', ''])
  })

  it('brilla el 20 natural que cuenta; los dados sin sólido (d3, d7) no caen; como mucho, 20', () => {
    expect(fallingDice([die(20, 20, false), die(20, 20)]).map((d) => d.critical)).toEqual([false, true])
    expect(fallingDice([die(3, 2), die(7, 5)])).toEqual([])
    expect(fallingDice(Array.from({ length: 30 }, () => die(6, 1)))).toHaveLength(MAX_FALLING)
  })
})
