import { describe, expect, it } from 'vitest'
import { modeFor, runUntil } from './avisa-hasta.ts'
import { memoryIo } from './io.ts'

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

describe('runUntil', () => {
  const failing = () => 3

  it('pasa sin decir nada si la orden sale bien', () => {
    const { io, out } = memoryIo()
    expect(runUntil(['2026-11-12', 'pnpm', 'limites'], '2026-11-01', () => 0, io)).toBe(0)
    expect(out).toEqual([])
  })

  it('antes de la fecha, un fallo deja un aviso pero sale en verde', () => {
    const { io, out } = memoryIo()
    expect(runUntil(['2026-11-12', 'pnpm', 'limites'], '2026-11-01', failing, io)).toBe(0)
    expect(out[0]).toMatch(/^::warning::«pnpm limites» ha fallado/)
  })

  it('desde la fecha, un fallo sale con el código de la orden', () => {
    const { io } = memoryIo()
    expect(runUntil(['2026-11-12', 'pnpm', 'limites'], '2026-11-12', failing, io)).toBe(3)
  })

  it('sin orden explica el uso', () => {
    const { io, err } = memoryIo()
    expect(runUntil(['2026-11-12'], '2026-11-01', failing, io)).toBe(2)
    expect(err[0]).toMatch(/^Uso:/)
  })
})
