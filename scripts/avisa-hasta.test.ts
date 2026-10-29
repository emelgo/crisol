import { describe, expect, it } from 'vitest'
import { modeFor } from './avisa-hasta.ts'

describe('modeFor', () => {
  it('avisa antes de la fecha límite', () => {
    expect(modeFor('2026-11-11', '2026-11-12')).toBe('avisa')
  })

  it('bloquea desde la fecha límite', () => {
    expect(modeFor('2026-11-12', '2026-11-12')).toBe('bloquea')
  })

  it('bloquea después de la fecha límite', () => {
    expect(modeFor('2027-01-01', '2026-11-12')).toBe('bloquea')
  })

  it('rechaza una fecha mal escrita', () => {
    expect(() => modeFor('2026-11-11', '12/11/2026')).toThrow('AAAA-MM-DD')
  })
})
