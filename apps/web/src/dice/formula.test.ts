import { describe, expect, it } from 'vitest'
import { addDie, explain } from './formula.ts'

describe('los dados rápidos', () => {
  it('añaden un dado: otro igual que el último suma uno, uno distinto se suma aparte, y el nombre se queda', () => {
    expect(addDie('', 20)).toBe('1d20')
    expect(addDie('1d6', 6)).toBe('2d6')
    expect(addDie('2d6', 20)).toBe('2d6+1d20')
    expect(addDie('1d20+5', 6)).toBe('1d20+5+1d6')
    expect(addDie('d%', 100)).toBe('2d%')
    expect(addDie('1d6 # Daño', 6)).toBe('2d6 # Daño')
  })
})

describe('la tirada, explicada mientras se escribe', () => {
  it('dicha en español, con su nombre; si no vale, por qué', () => {
    expect(explain('2d20kh1+5 # Ataque')).toEqual({ ok: true, text: 'Ventaja (2d20, se queda el mayor) + 5 · Ataque' })
    expect(explain('1d20+')).toEqual({ ok: false, text: 'No se entiende «1d20+» al final' })
    expect(explain('')).toEqual({ ok: false, text: 'Escribe una tirada, como 1d20+5' })
  })
})
