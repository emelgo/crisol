import { describe, expect, it } from 'vitest'
import { planTravel, restSchedule } from './travel.ts'

describe('los viajes (8 · campaña)', () => {
  it('días de camino según el ritmo, redondeados hacia arriba, más el descanso', () => {
    expect(planTravel({ distance: 120, speed: 24, pace: 'normal', restDays: 0 })).toMatchObject({
      travelDays: 5,
      days: 5
    })
    expect(planTravel({ distance: 120, speed: 30, pace: 'fast', restDays: 0 })).toMatchObject({
      travelDays: 3.01,
      days: 4
    })
    expect(planTravel({ distance: 120, speed: 24, pace: 'slow', restDays: 2 })).toMatchObject({
      travelDays: 7.46,
      days: 10
    })
    // Un trecho corto es un día; nada, ninguno
    expect(planTravel({ distance: 3, speed: 24, pace: 'normal', restDays: 0 }).days).toBe(1)
    expect(planTravel({ distance: 0, speed: 24, pace: 'normal', restDays: 0 }).days).toBe(0)
  })

  it('los descansos, repartidos por el camino (nunca antes de salir)', () => {
    const letters = (walked: number, rest: number) =>
      restSchedule(walked, rest)
        .map((d) => (d === 'travel' ? 'C' : 'D'))
        .join('')
    expect(letters(6, 2)).toBe('CCDCCDCC')
    expect(letters(5, 1)).toBe('CCCDCC')
    expect(letters(3, 0)).toBe('CCC')
    expect(letters(1, 2)).toBe('CDD')
    expect(planTravel({ distance: 120, speed: 24, pace: 'normal', restDays: 1 }).schedule).toHaveLength(6)
  })
})
