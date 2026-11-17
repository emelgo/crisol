import { describe, expect, it } from 'vitest'
import { planTravel } from './travel.ts'

describe('los viajes (8 · campaña)', () => {
  it('días de camino según el ritmo, redondeados hacia arriba, más el descanso', () => {
    expect(planTravel({ distance: 120, speed: 24, pace: 'normal', restDays: 0 })).toEqual({ travelDays: 5, days: 5 })
    expect(planTravel({ distance: 120, speed: 30, pace: 'fast', restDays: 0 })).toEqual({ travelDays: 3.01, days: 4 })
    expect(planTravel({ distance: 120, speed: 24, pace: 'slow', restDays: 2 })).toEqual({ travelDays: 7.46, days: 10 })
    // Un trecho corto es un día; nada, ninguno
    expect(planTravel({ distance: 3, speed: 24, pace: 'normal', restDays: 0 }).days).toBe(1)
    expect(planTravel({ distance: 0, speed: 24, pace: 'normal', restDays: 0 }).days).toBe(0)
  })
})
