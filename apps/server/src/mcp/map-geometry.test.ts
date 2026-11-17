import { describe, expect, it } from 'vitest'
import { fromAi, MAX_DRAWN_POINTS, simplify } from './map-geometry.ts'

describe('lo que dibuja la IA en un mapa, antes de guardarlo (módulo 9)', () => {
  it('de los píxeles de la imagen que vio a 0–1 (sin salirse); sin vista, ya venía en 0–1', () => {
    const view = { width: 1600, height: 1000 }
    expect(fromAi({ at: [800, 250], rotate: 10 }, view)).toEqual({ at: [0.5, 0.25], rotate: 10 })
    expect(
      fromAi(
        {
          points: [
            [-20, 500],
            [1700, 500]
          ],
          from: 'varn'
        },
        view
      )
    ).toEqual({
      points: [
        [0, 0.5],
        [1, 0.5]
      ],
      from: 'varn'
    })
    expect(fromAi({ at: [0.3, 0.4] })).toEqual({ at: [0.3, 0.4] })
  })

  it('simplificar: sin los puntos que no cambian la forma', () => {
    const line: [number, number][] = [
      [0, 0],
      [0.25, 0.0001],
      [0.5, 0],
      [0.5, 0.5]
    ]
    expect(simplify(line, 0.001)).toEqual([
      [0, 0],
      [0.5, 0],
      [0.5, 0.5]
    ])
  })

  it('una pieza cerrada a mano no repite el primer vértice, y una ruta con muchos puntos cabe', () => {
    const square = fromAi({
      pieces: [
        [
          [0.1, 0.1],
          [0.4, 0.1],
          [0.4, 0.4],
          [0.1, 0.4],
          [0.1, 0.1]
        ]
      ]
    })
    expect(square).toEqual({
      pieces: [
        [
          [0.1, 0.1],
          [0.4, 0.1],
          [0.4, 0.4],
          [0.1, 0.4]
        ]
      ]
    })
    // Un zigzag de 2000 puntos: se queda en lo que cabe
    const zigzag = Array.from({ length: 2000 }, (_, i) => [i / 2000, i % 2 === 0 ? 0.1 : 0.2])
    const route = fromAi({ points: zigzag })
    expect('points' in route && route.points.length).toBeLessThanOrEqual(MAX_DRAWN_POINTS)
    expect('points' in route && route.points.length).toBeGreaterThanOrEqual(2)
  })
})
