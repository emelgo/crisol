import { describe, expect, it } from 'vitest'
import { summarize } from './summary.ts'

describe('la pizarra en palabras (módulo 9)', () => {
  it('tarjetas, notas y quién va con quién, como se lee; sin lo borrado ni flechas sueltas', () => {
    const summary = summarize(
      [
        { id: 'd', type: 'embeddable', x: 0, y: 0, customData: { pageId: 'p1', title: 'Viejo' } },
        { id: 'n', type: 'rectangle', x: 300, y: 150, boundElements: [{ id: 'nt', type: 'text' }] },
        { id: 'nt', type: 'text', text: 'La noche del eclipse', containerId: 'n', x: 310, y: 180 },
        {
          id: 'a',
          type: 'arrow',
          x: 100,
          y: 50,
          startBinding: { elementId: 'd' },
          endBinding: { elementId: 'n' },
          boundElements: [{ id: 'at', type: 'text' }]
        },
        { id: 'at', type: 'text', text: 'estaba allí', containerId: 'a' },
        { id: 'q', type: 'text', text: '¿Quién abrió la cripta?', x: 900, y: 300 },
        { id: 'suelta', type: 'arrow', startBinding: null, endBinding: null },
        { id: 'borrada', type: 'text', text: 'nada', isDeleted: true }
      ],
      (pageId) => (pageId === 'p1' ? 'Doran el Cojo' : undefined)
    )
    expect(summary.cards).toEqual([{ id: 'd', pageId: 'p1', title: 'Doran el Cojo' }])
    expect(summary.notes.map((note) => note.text)).toEqual(['La noche del eclipse', '¿Quién abrió la cripta?'])
    expect(summary.links).toEqual([
      { id: 'a', from: 'Doran el Cojo', to: 'La noche del eclipse', label: 'estaba allí' }
    ])
  })
})
