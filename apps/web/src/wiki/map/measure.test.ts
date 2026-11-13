import { describe, expect, it } from 'vitest'
import { distanceOf, pixelLength, roundDays, roundDistance, scaleFrom, travelDays } from './measure.ts'

const IMAGE = { width: 1000, height: 500 }
/** 100 píxeles de la imagen son 25 km */
const SCALE = { length: 100, value: 25, unit: 'km' }

describe('medir en un mapa (módulo 9)', () => {
  it('lo largo de unos tramos, en píxeles de la imagen (no de 0 a 1: la imagen no es cuadrada)', () => {
    expect(
      pixelLength(
        [
          [0, 0],
          [0.3, 0],
          [0.3, 0.8]
        ],
        IMAGE
      )
    ).toBe(300 + 400)
    expect(pixelLength([[0.5, 0.5]], IMAGE)).toBe(0)
  })

  it('con la escala, lo que miden de verdad; sin escala, nada', () => {
    const line: [number, number][] = [
      [0, 0],
      [0.4, 0]
    ]
    expect(distanceOf(line, IMAGE, SCALE)).toBe(100)
    expect(distanceOf(line, IMAGE, null)).toBeNull()
  })

  it('calibrar: la escala sale de una raya y de lo que mide; una raya sin largo o una medida en cero, no', () => {
    expect(scaleFrom([0, 0], [0.1, 0], IMAGE, 100, 'km')).toEqual({ length: 100, value: 100, unit: 'km' })
    expect(scaleFrom([0.2, 0.2], [0.2, 0.2], IMAGE, 100, 'km')).toBeNull()
    expect(scaleFrom([0, 0], [0.1, 0], IMAGE, 0, 'km')).toBeNull()
  })

  it('los días de viaje: 340 km son 11 días a pie, 6 a caballo y 3 en barco', () => {
    const days = travelDays(340, { foot: 30, horse: 60, ship: 120 })
    expect(roundDays(days.foot)).toEqual({ lessThanOne: false, days: 11 })
    expect(roundDays(days.horse)).toEqual({ lessThanOne: false, days: 6 })
    expect(roundDays(days.ship)).toEqual({ lessThanOne: false, days: 3 })
    expect(roundDays(0.2)).toEqual({ lessThanOne: true, days: 1 })
    expect(roundDays(0)).toEqual({ lessThanOne: false, days: 0 })
  })

  it('las distancias, redondeadas como se dicen', () => {
    expect(roundDistance(340.4)).toBe(340)
    expect(roundDistance(12.345)).toBe(12.3)
  })
})
