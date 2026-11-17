import { describe, expect, it } from 'vitest'
import { particleCount, particlesAt } from './weather-particles.ts'

const screen = { width: 1280, height: 720 }

describe('las partículas de la capa de clima (8 · campaña)', () => {
  it('sin estado: la misma semilla y el mismo momento dan lo mismo en cualquier aparato', () => {
    const rain = { kind: 'rain' as const, intensity: 0.7, wind: 0.4 }
    expect(particlesAt(rain, screen, 12.5)).toEqual(particlesAt(rain, screen, 12.5))
    expect(particlesAt(rain, screen, 12.5)).not.toEqual(particlesAt(rain, screen, 12.6))
  })

  it('cuantas más intensidad, más partículas; sin intensidad, ninguna', () => {
    const snow = (intensity: number) => ({ kind: 'snow' as const, intensity, wind: 0 })
    expect(particleCount(snow(1), 1280, 720)).toBeGreaterThan(particleCount(snow(0.3), 1280, 720))
    expect(particlesAt(snow(0), screen, 3)).toEqual([])
    expect(particleCount({ kind: 'fog', intensity: 1, wind: 0 }, 1280, 720)).toBeLessThan(30)
  })

  it('la lluvia cae inclinada con el viento; sin viento, recta', () => {
    const windy = particlesAt({ kind: 'rain', intensity: 1, wind: 1 }, screen, 4)
    const still = particlesAt({ kind: 'rain', intensity: 1, wind: 0 }, screen, 4)
    expect(windy.every((p) => p.dx > 0 && p.dy > 0)).toBe(true)
    expect(still.every((p) => p.dx === 0)).toBe(true)
  })

  it('lo que cae se queda en la pantalla (con un margen)', () => {
    for (const kind of ['rain', 'snow', 'ash', 'fog'] as const) {
      for (const p of particlesAt({ kind, intensity: 1, wind: 0.5 }, screen, 987.3)) {
        expect(p.y).toBeGreaterThan(-200)
        expect(p.y).toBeLessThan(screen.height + 200)
        expect(p.alpha).toBeGreaterThan(0)
        expect(p.alpha).toBeLessThanOrEqual(1)
      }
    }
  })
})
