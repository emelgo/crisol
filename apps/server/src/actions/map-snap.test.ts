import { describe, expect, it } from 'vitest'
import { snapGeometry, verticesOf } from './map-snap.ts'

const IMAGE = { width: 1000, height: 500 }

describe('pegar lo que dibuja la IA a lo que ya hay (módulo 9)', () => {
  const border = verticesOf([
    {
      pieces: [
        [
          [0.5, 0.1],
          [0.5, 0.9],
          [0.9, 0.9]
        ]
      ]
    },
    { at: [0.2, 0.2] }
  ])

  it('los vértices de lo demás (un texto no tiene)', () => {
    expect(border).toEqual([
      [0.5, 0.1],
      [0.5, 0.9],
      [0.9, 0.9]
    ])
  })

  it('una región vecina: sus vértices cerca de la frontera se pegan a ella; los lejanos, no', () => {
    const neighbour = snapGeometry(
      {
        pieces: [
          [
            [0.505, 0.11],
            [0.1, 0.5],
            [0.497, 0.895]
          ]
        ]
      },
      { vertices: border, pins: [] },
      IMAGE
    )
    expect(neighbour).toEqual({
      pieces: [
        [
          [0.5, 0.1],
          [0.1, 0.5],
          [0.5, 0.9]
        ]
      ]
    })
  })

  it('una ruta: sus extremos, a los pines cercanos (y los recuerda); el resto, a los vértices', () => {
    const pins = [{ id: 'varn', x: 0.2, y: 0.2 }]
    const route = snapGeometry(
      {
        points: [
          [0.205, 0.203],
          [0.502, 0.5],
          [0.9, 0.895]
        ]
      },
      { vertices: border, pins },
      IMAGE
    )
    expect(route).toEqual({
      points: [
        [0.2, 0.2],
        [0.502, 0.5],
        [0.9, 0.9]
      ],
      from: 'varn',
      to: null
    })
  })

  it('un texto, tal cual', () => {
    const text = { at: [0.501, 0.1] as [number, number] }
    expect(snapGeometry(text, { vertices: border, pins: [] }, IMAGE)).toBe(text)
  })
})
