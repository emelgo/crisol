import { describe, expect, it } from 'vitest'
import { bySiblingPlace, keyBetween, placeAmong } from './order.ts'

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

describe('el orden a mano entre hermanas', () => {
  const order = (items: { id: string; position: string | null }[]) =>
    [...items].sort((a, b) => ((a.position ?? '') < (b.position ?? '') ? -1 : 1)).map((item) => item.id)

  it('primero las que tienen puesto, por él (como la collation "C", con mayúsculas antes); detrás, las demás, por nombre', () => {
    const items = [
      { name: 'ámbar', position: null },
      { name: 'Zeta', position: 'a1' },
      { name: 'beta', position: undefined },
      { name: 'alfa', position: 'Zz' },
      { name: 'Ábaco', position: null }
    ]
    expect([...items].sort(bySiblingPlace).map((item) => item.name)).toEqual(['alfa', 'Zeta', 'Ábaco', 'ámbar', 'beta'])
  })

  it('si todas tenían puesto, solo cambia el de la movida, delante o detrás de su ancla', () => {
    const placed = [
      { id: 'a', position: 'a0' },
      { id: 'b', position: 'a1' },
      { id: 'c', position: 'a2' }
    ]
    const [before] = placeAmong(placed, 'c', { before: 'b' })
    expect(before?.id).toBe('c')
    expect((before?.position ?? '') > 'a0' && (before?.position ?? '') < 'a1').toBe(true)
    const last = placeAmong(placed, 'a', { after: 'c' })
    expect(last).toHaveLength(1)
    expect((last[0]?.position ?? '') > 'a2').toBe(true)
  })

  it('la primera vez (alguna sin puesto) se rellenan todas en el orden nuevo, también la movida si venía de fuera', () => {
    const unplaced = [
      { id: 'a', position: null },
      { id: 'b', position: null },
      { id: 'c', position: null }
    ]
    const filled = placeAmong(unplaced, 'c', { after: 'a' })
    expect(filled.map((f) => f.id)).toEqual(['a', 'c', 'b'])
    expect(order(filled)).toEqual(['a', 'c', 'b'])
    // Una que llega de otra carpeta, delante de la primera
    const arrived = placeAmong(unplaced, 'z', { before: 'a' })
    expect(order(arrived)).toEqual(['z', 'a', 'b', 'c'])
  })

  it('sin ancla, o con una que no es de ellas, al final', () => {
    const placed = [
      { id: 'a', position: 'a0' },
      { id: 'b', position: 'a1' }
    ]
    expect((placeAmong(placed, 'z', {})[0]?.position ?? '') > 'a1').toBe(true)
    expect((placeAmong(placed, 'z', { before: 'otra' })[0]?.position ?? '') > 'a1').toBe(true)
  })
})
