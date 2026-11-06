import { describe, expect, it } from 'vitest'
import { bookChunks, chunksOf } from './chunks.ts'

describe('los trozos (docs/specs/biblioteca.md)', () => {
  it('los párrafos juntos mientras caben; uno largo, por frases; lo que no llega, fuera', () => {
    const short = 'La guardia de la ciudad viste capas grises y patrulla las murallas.'
    expect(chunksOf(`${short}\n\n${short}`)).toEqual([`${short}\n${short}`])
    const long = Array.from({ length: 40 }, (_, i) => `La frase número ${i} de un párrafo muy largo.`).join(' ')
    const parts = chunksOf(long)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.every((p) => p.length <= 1200)).toBe(true)
    expect(parts.join(' ')).toBe(long)
    expect(chunksOf('12')).toEqual([])
  })

  it('los de un libro, con su página, su orden y una huella que cambia con la página', () => {
    const text = 'Un texto suficientemente largo para ser un trozo.'
    const chunks = bookChunks([text, '', text])
    expect(chunks.map((c) => [c.page, c.position])).toEqual([
      [1, 0],
      [3, 0]
    ])
    expect(chunks[0]?.hash).not.toBe(chunks[1]?.hash)
  })
})
