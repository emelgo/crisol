import { describe, expect, it } from 'vitest'
import { keyBetween } from './order.ts'

describe('claves de orden', () => {
  it('la primera, y una antes y otra después de ella', () => {
    const first = keyBetween(null, null)
    expect(keyBetween(null, first) < first).toBe(true)
    expect(keyBetween(first, null) > first).toBe(true)
  })

  it('siempre cae entre las dos', () => {
    const a = keyBetween(null, null)
    const c = keyBetween(a, null)
    const b = keyBetween(a, c)
    expect(a < b && b < c).toBe(true)
  })

  it('añadir al final muchas veces no alarga la clave sin medida', () => {
    let last: string | null = null
    for (let i = 0; i < 5000; i++) last = keyBetween(last, null)
    expect(last?.length).toBeLessThanOrEqual(4)
  })

  it('poner delante muchas veces tampoco', () => {
    let first: string | null = null
    for (let i = 0; i < 5000; i++) first = keyBetween(null, first)
    expect(first?.length).toBeLessThanOrEqual(4)
  })

  it('meter una y otra vez en el mismo hueco mantiene el orden', () => {
    const low = keyBetween(null, null)
    let high = keyBetween(low, null)
    for (let i = 0; i < 200; i++) {
      const mid = keyBetween(low, high)
      expect(low < mid && mid < high).toBe(true)
      high = mid
    }
  })

  it('inserciones al azar dejan la lista ordenada y sin repetidas', () => {
    let seed = 7
    const random = () => {
      seed = (seed * 48271) % 2147483647
      return seed / 2147483647
    }
    const keys: string[] = []
    for (let i = 0; i < 1000; i++) {
      const at = Math.floor(random() * (keys.length + 1))
      keys.splice(at, 0, keyBetween(keys[at - 1] ?? null, keys[at] ?? null))
    }
    expect([...keys].sort()).toEqual(keys)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('se niega si las dos no están en orden', () => {
    const a = keyBetween(null, null)
    const b = keyBetween(a, null)
    expect(() => keyBetween(b, a)).toThrow()
    expect(() => keyBetween(a, a)).toThrow()
  })

  it('se niega con una clave mal formada', () => {
    expect(() => keyBetween('', null)).toThrow()
    expect(() => keyBetween('a00', null)).toThrow()
    expect(() => keyBetween('!', null)).toThrow()
  })
})
