import { describe, expect, it } from 'vitest'
import { historyCutoff, purgeAt, trashCutoff } from './retention.ts'

describe('cuánto se guarda', () => {
  const now = new Date('2026-10-29T04:00:00Z')

  it('lo borrado se puede restaurar 30 días; luego se purga', () => {
    expect(purgeAt(new Date('2026-10-01T10:00:00Z')).toISOString()).toBe('2026-10-31T10:00:00.000Z')
    expect(trashCutoff(now).toISOString()).toBe('2026-09-29T04:00:00.000Z')
  })

  it('el historial guarda 90 días', () => {
    expect(historyCutoff(now).toISOString()).toBe('2026-07-31T04:00:00.000Z')
  })

  it('un borrado de justo hace 30 días aún no se purga; uno de un poco antes, sí', () => {
    const cutoff = trashCutoff(now)
    expect(new Date('2026-09-29T04:00:00Z') < cutoff).toBe(false)
    expect(new Date('2026-09-29T03:59:59Z') < cutoff).toBe(true)
  })
})
