import { describe, expect, it } from 'vitest'
import { buildChanges } from './board-ai.ts'

describe('lo que dibuja la IA en la pizarra (módulo 9)', () => {
  it('con trazo limpio y letra normal, como lo nuevo de la web', () => {
    const { elements } = buildChanges(
      [],
      [
        { ref: 'a', shape: 'rectangle', text: 'Puerto', column: 0, row: 0 },
        { ref: 'b', text: 'Nota', column: 1, row: 0 }
      ],
      [{ from: 'a', to: 'b' }],
      (pageId) => `/mundos/m/wiki/${pageId}`,
      () => ''
    )
    expect(elements.length).toBeGreaterThan(0)
    for (const element of elements) expect(element.roughness).toBe(0)
    const texts = elements.filter((element) => element.type === 'text')
    expect(texts.map((text) => text.fontFamily)).toEqual([6, 6])
  })
})
