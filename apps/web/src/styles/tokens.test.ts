import { describe, expect, it } from 'vitest'
import tokens from './tokens.css?raw'

/** Los colores de un bloque de tokens (solo hay uno, :root: el tema oscuro) */
function colors(selector: string) {
  const block = tokens.slice(tokens.indexOf(`${selector} {`)).split('}')[0] ?? ''
  return Object.fromEntries([...block.matchAll(/--(color-[\w-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]))
}

/** Los colores de los efectos (brasas, humo y ceniza): los de una pieza en hex y los de solo canales (-rgb), en hex */
function effects(selector: string) {
  const block = tokens.slice(tokens.indexOf(`${selector} {`)).split('}')[0] ?? ''
  const hex = (n: string) => Number(n).toString(16).padStart(2, '0')
  return Object.fromEntries([
    ...[...block.matchAll(/--(fx-[\w-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]),
    ...[...block.matchAll(/--(fx-[\w-]+-rgb):\s*(\d+) (\d+) (\d+)/g)].map((m) => [
      m[1],
      `#${hex(m[2] ?? '')}${hex(m[3] ?? '')}${hex(m[4] ?? '')}`
    ])
  ])
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
  // Solo hay tema oscuro (Enrique, 2026-11-11)
  const theme = 'oscuro'
  const selector = ':root'
  it(`en el tema ${theme}, el texto, el atenuado y el acento llegan a 4,5:1 con el fondo y la superficie`, () => {
    const c = colors(selector)
    for (const text of ['color-text', 'color-muted', 'color-accent-text', 'color-ai']) {
      expect(contrast(c[text], c['color-bg'])).toBeGreaterThanOrEqual(4.5)
      expect(contrast(c[text], c['color-surface'])).toBeGreaterThanOrEqual(4.5)
      expect(contrast(c[text], c['color-raised'])).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast(c['color-on-accent'], c['color-accent'])).toBeGreaterThanOrEqual(4.5)
  })

  it(`en el tema ${theme}, los títulos de cada nivel y los enlaces llegan a 4,5:1 con el fondo, la superficie y lo realzado`, () => {
    const c = colors(selector)
    for (const text of ['color-h2', 'color-h3', 'color-h4', 'color-link']) {
      expect(contrast(c[text], c['color-bg'])).toBeGreaterThanOrEqual(4.5)
      expect(contrast(c[text], c['color-surface'])).toBeGreaterThanOrEqual(4.5)
      expect(contrast(c[text], c['color-raised'])).toBeGreaterThanOrEqual(4.5)
    }
  })

  it(`en el tema ${theme}, un secreto se lee: su rótulo y el texto a 4,5:1 sobre su fondo, y su borde a 3:1`, () => {
    const c = colors(selector)
    expect(contrast(c['color-secret-text'], c['color-secret'])).toBeGreaterThanOrEqual(4.5)
    expect(contrast(c['color-text'], c['color-secret'])).toBeGreaterThanOrEqual(4.5)
    expect(contrast(c['color-secret-rule'], c['color-secret'])).toBeGreaterThanOrEqual(3)
    expect(contrast(c['color-secret-rule'], c['color-surface'])).toBeGreaterThanOrEqual(3)
  })

  it(`en el tema ${theme}, el rótulo de cada recuadro llega a 4,5:1 sobre su fondo, y el texto de leer en voz alta también`, () => {
    const c = colors(selector)
    for (const label of ['color-tip', 'color-warning', 'color-danger', 'color-muted']) {
      expect(contrast(c[label], c['color-raised'])).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast(c['color-read-aloud-rule'], c['color-read-aloud'])).toBeGreaterThanOrEqual(4.5)
    expect(contrast(c['color-text'], c['color-read-aloud'])).toBeGreaterThanOrEqual(4.5)
  })

  it(`en el tema ${theme}, la barra de arriba se lee: su texto, el atenuado y el acento a 4,5:1`, () => {
    const c = colors(selector)
    for (const text of ['color-chrome-text', 'color-chrome-muted', 'color-chrome-accent']) {
      expect(contrast(c[text], c['color-chrome'])).toBeGreaterThanOrEqual(4.5)
    }
  })

  it(`en el tema ${theme}, el foco llega a 3:1 con el fondo`, () => {
    const c = colors(selector)
    expect(contrast(c['color-focus'], c['color-bg'])).toBeGreaterThanOrEqual(3)
  })

  it(`en el tema ${theme}, las brasas, el humo y la ceniza se ven: a 3:1 con el fondo y con la barra`, () => {
    const c = colors(selector)
    const fx = effects(selector)
    const names = ['fx-ember-1', 'fx-ember-2', 'fx-ember-3', 'fx-ember-4', 'fx-ember-5', 'fx-heat-rgb']
    names.push('fx-smoke-rgb', 'fx-ash-1', 'fx-ash-2', 'fx-ash-3', 'fx-ash-4', 'fx-ash-5', 'fx-ash-rgb')
    for (const name of names) {
      expect(fx[name], name).toMatch(/^#/)
      expect(contrast(fx[name], c['color-bg']), name).toBeGreaterThanOrEqual(3)
      expect(contrast(fx[name], c['color-raised']), name).toBeGreaterThanOrEqual(3)
    }
  })

  it(`en el tema ${theme}, el borde de los campos llega a 3:1 con el fondo y la superficie`, () => {
    const c = colors(selector)
    expect(c['color-field-border']).toMatch(/^#/)
    expect(contrast(c['color-field-border'], c['color-bg'])).toBeGreaterThanOrEqual(3)
    expect(contrast(c['color-field-border'], c['color-surface'])).toBeGreaterThanOrEqual(3)
  })

  it('el borde decorativo no llega: por eso los campos no lo usan', () => {
    const c = colors(':root')
    expect(contrast(c['color-border'], c['color-bg'])).toBeLessThan(3)
  })
})
