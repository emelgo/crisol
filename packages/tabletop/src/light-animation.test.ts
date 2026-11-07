import { describe, expect, it } from 'vitest'
import { animateLight, isAnimated, type LightAnimation } from './light-animation.ts'

describe('luces animadas', () => {
  it('cada animación se mueve dentro de su margen y nunca pasa de su valor', () => {
    for (const animation of ['torch', 'candle', 'pulse', 'magic'] as LightAnimation[]) {
      expect(isAnimated(animation)).toBe(true)
      const values = Array.from({ length: 200 }, (_, i) => animateLight(animation, 'luz-1', i * 0.05))
      for (const v of values) {
        expect(v.intensity).toBeGreaterThanOrEqual(0.7)
        expect(v.intensity).toBeLessThanOrEqual(1)
        expect(v.bright).toBeGreaterThanOrEqual(0.8)
        expect(v.bright).toBeLessThanOrEqual(1)
      }
      // Se mueve
      expect(new Set(values.map((v) => v.intensity.toFixed(3))).size).toBeGreaterThan(10)
    }
  })

  it('sin animación, quieta; dos luces no parpadean a la vez', () => {
    expect(isAnimated('none')).toBe(false)
    expect(animateLight('none', 'x', 3)).toEqual({ intensity: 1, bright: 1 })
    expect(animateLight('torch', 'luz-a', 1)).not.toEqual(animateLight('torch', 'luz-b', 1))
  })
})
