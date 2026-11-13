import { describe, expect, it } from 'vitest'
import { buildChanges, edgeToward, INK } from './board-ai.ts'

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

  it('con la tinta de Excalidraw (la que su tema oscuro pinta clara), no un gris claro que saldría negro', () => {
    const { elements } = buildChanges(
      [],
      [{ ref: 'a', shape: 'rectangle', text: 'Puerto', column: 0, row: 0 }],
      [],
      () => '',
      () => ''
    )
    expect(INK).toBe('#1e1e1e')
    for (const element of elements) expect(element.strokeColor).toBe(INK)
  })

  it('las flechas, de borde a borde (con su hueco): no tachan lo de dentro', () => {
    const box = { id: 'b', type: 'rectangle', x: 0, y: 0, width: 200, height: 100 }
    expect(edgeToward(box, { x: 1000, y: 50 })).toEqual({ x: 208, y: 50 })
    expect(edgeToward(box, { x: 100, y: -500 })).toEqual({ x: 100, y: -8 })
    const { elements } = buildChanges(
      [],
      [
        { ref: 'a', shape: 'rectangle', text: 'A', column: 0, row: 0 },
        { ref: 'b', shape: 'rectangle', text: 'B', column: 2, row: 0 }
      ],
      [{ from: 'a', to: 'b' }],
      () => '',
      () => ''
    )
    const arrow = elements.find((element) => element.type === 'arrow')
    // La caja A va de 0 a 220 de ancho: la flecha sale tras su borde y llega antes del de B (en 600)
    expect(arrow?.x).toBe(228)
    expect((arrow?.points as number[][])[1]?.[0]).toBe(600 - 8 - 228)
  })
})
