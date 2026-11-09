import { describe, expect, it } from 'vitest'
import { visibilityIn } from './visibility.ts'

describe('quién ve la tirada en otra campaña', () => {
  it('lo recordado, si vale; si no, lo más privado que tenga quien tira, nunca para todos', () => {
    expect(visibilityIn('all', 'master')).toBe('all')
    expect(visibilityIn('hidden', 'master')).toBe('hidden')
    expect(visibilityIn('self', 'master')).toBe('hidden')
    expect(visibilityIn('master', 'master')).toBe('hidden')
    expect(visibilityIn('hidden', 'player')).toBe('self')
    expect(visibilityIn('master', 'player')).toBe('master')
  })
})
