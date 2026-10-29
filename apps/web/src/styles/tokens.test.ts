import { describe, expect, it } from 'vitest'
import tokens from './tokens.css?raw'

/** Los colores de un bloque de tokens (el claro, :root; el oscuro, :root[data-theme="dark"]) */
function colors(selector: string) {
  const block = tokens.slice(tokens.indexOf(`${selector} {`)).split('}')[0] ?? ''
  return Object.fromEntries([...block.matchAll(/--(color-[\w-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]))
}

/** El contraste entre dos colores, como lo define WCAG */
function contrast(a = '', b = '') {
  const luminance = (hex: string) => {
    const [r = 0, g = 0, bl = 0] = [1, 3, 5].map((i) => {
      const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [light = 0, dark = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

describe('los tokens de color', () => {
  for (const [theme, selector] of [
    ['claro', ':root'],
    ['oscuro', ':root[data-theme="dark"]']
  ] as const) {
    it(`en el tema ${theme}, el borde de los campos llega a 3:1 con el fondo y la superficie`, () => {
      const c = colors(selector)
      expect(c['color-field-border']).toMatch(/^#/)
      expect(contrast(c['color-field-border'], c['color-bg'])).toBeGreaterThanOrEqual(3)
      expect(contrast(c['color-field-border'], c['color-surface'])).toBeGreaterThanOrEqual(3)
    })
  }

  it('el borde decorativo no llega: por eso los campos no lo usan', () => {
    const c = colors(':root')
    expect(contrast(c['color-border'], c['color-bg'])).toBeLessThan(3)
  })
})
