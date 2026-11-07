import { describe, expect, it } from 'vitest'
import { Lru } from './lru.ts'

describe('lo que se guarda en memoria con tope', () => {
  it('pasado el tope se va lo que lleva más tiempo sin usarse (leer cuenta como usar), y se avisa', () => {
    const gone: string[] = []
    const lru = new Lru<string, number>(3, (key) => gone.push(key))
    lru.set('a', 1)
    lru.set('b', 2)
    lru.set('c', 3)
    expect(lru.get('a')).toBe(1)
    lru.set('d', 4)
    expect([...lru.keys()]).toEqual(['c', 'a', 'd'])
    expect(gone).toEqual(['b'])
    lru.set('c', 30)
    lru.set('e', 5)
    expect(gone).toEqual(['b', 'a'])
    expect(lru.size).toBe(3)
    expect(lru.has('a')).toBe(false)
    lru.delete('c')
    expect([...lru.keys()]).toEqual(['d', 'e'])
  })
})
