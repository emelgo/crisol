import { describe, expect, it } from 'vitest'
import { EMPTY, type Pool, type PoolAction, poolFormula, poolReducer, signed } from './pool.ts'

const run = (...actions: PoolAction[]): Pool => actions.reduce(poolReducer, EMPTY)

describe('los dados juntados', () => {
  it('pulsar suma uno; otro distinto va aparte, en el orden en que se añadió', () => {
    const pool = run({ type: 'add', sides: 8 }, { type: 'add', sides: 4 }, { type: 'add', sides: 8 })
    expect(pool.dice).toEqual([
      { sides: 8, count: 2 },
      { sides: 4, count: 1 }
    ])
    expect(poolFormula(pool)).toBe('2d8+1d4')
  })

  it('quitar resta uno; al llegar a cero, fuera; la × quita el dado entero', () => {
    const pool = run({ type: 'add', sides: 6 }, { type: 'add', sides: 6 }, { type: 'add', sides: 20 })
    expect(poolReducer(pool, { type: 'remove', sides: 6 }).dice).toEqual([
      { sides: 6, count: 1 },
      { sides: 20, count: 1 }
    ])
    expect(poolReducer(pool, { type: 'drop', sides: 6 }).dice).toEqual([{ sides: 20, count: 1 }])
    expect(poolReducer(pool, { type: 'remove', sides: 12 })).toEqual(pool)
  })

  it('el modificador, con su signo', () => {
    const pool = run({ type: 'add', sides: 6 }, { type: 'modifier', by: 1 }, { type: 'modifier', by: 1 })
    expect(poolFormula(pool)).toBe('1d6+2')
    expect(poolFormula(poolReducer(pool, { type: 'modifier', by: -5 }))).toBe('1d6-3')
    expect(signed(3)).toBe('+3')
    expect(signed(-2)).toBe('−2')
    expect(signed(0)).toBe('+0')
  })

  it('la ventaja va en el d20 (y pone uno si no hay); los demás d20, aparte; quitarla o quitar el d20 la apaga', () => {
    const pool = run({ type: 'add', sides: 6 }, { type: 'advantage', mode: 'advantage' })
    expect(poolFormula(pool)).toBe('1d6+2d20kh1')
    const two = poolReducer(pool, { type: 'add', sides: 20 })
    expect(poolFormula(poolReducer(two, { type: 'advantage', mode: 'disadvantage' }))).toBe('1d6+2d20kl1+1d20')
    expect(poolReducer(pool, { type: 'advantage', mode: 'advantage' }).advantage).toBe('none')
    expect(poolReducer(pool, { type: 'drop', sides: 20 }).advantage).toBe('none')
  })

  it('el d100 se escribe d100; vaciar lo deja todo como al empezar', () => {
    const pool = run({ type: 'add', sides: 100 }, { type: 'modifier', by: 1 })
    expect(poolFormula(pool)).toBe('1d100+1')
    expect(poolReducer(pool, { type: 'clear' })).toEqual(EMPTY)
  })
})
