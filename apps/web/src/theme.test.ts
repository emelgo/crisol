import { describe, expect, it } from 'vitest'
import { initialTheme, nextTheme } from './theme.ts'

describe('initialTheme', () => {
  it('respeta el tema que eligió la persona', () => {
    expect(initialTheme('light', true)).toBe('light')
    expect(initialTheme('dark', false)).toBe('dark')
  })

  it('sin elección, sigue al sistema', () => {
    expect(initialTheme(null, true)).toBe('dark')
    expect(initialTheme(null, false)).toBe('light')
  })

  it('ignora un valor guardado que no es un tema', () => {
    expect(initialTheme('morado', true)).toBe('dark')
  })
})

describe('nextTheme', () => {
  it('alterna entre claro y oscuro', () => {
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('light')
  })
})
