import type { LogEntry, ScreenView } from '@crisol/contracts'
import { describe, expect, it } from 'vitest'
import { bubbleOf } from './bubbles.tsx'

const screen = {
  scene: { grid: { size: 100 } },
  tokens: [{ id: 't1', name: 'Lía', x: 500, y: 300, size: 1 }]
} as unknown as ScreenView

const said = (patch: Partial<Extract<LogEntry, { kind: 'message' }>>): LogEntry => ({
  kind: 'message',
  id: crypto.randomUUID(),
  campaignId: crypto.randomUUID(),
  by: { userId: 'lucia', name: 'Lucía', color: null },
  ai: false,
  style: 'ic',
  speaker: { kind: 'character', id: crypto.randomUUID(), name: 'Lía' },
  text: '¿Quién anda ahí?',
  whisper: null,
  deleted: false,
  createdAt: new Date().toISOString(),
  ...patch
})

describe('las burbujas de lo dicho en personaje', () => {
  it('sale encima de la ficha del personaje que habla', () => {
    expect(bubbleOf(said({}), screen)).toEqual([
      expect.objectContaining({ name: 'Lía', text: '¿Quién anda ahí?', x: 500, y: 244 })
    ])
  })
  it('ni los susurros, ni fuera de personaje, ni quien no tiene ficha en la escena', () => {
    expect(bubbleOf(said({ whisper: [{ id: 'master', name: '' }] }), screen)).toEqual([])
    expect(bubbleOf(said({ style: 'ooc' }), screen)).toEqual([])
    expect(bubbleOf(said({ speaker: { kind: 'character', id: crypto.randomUUID(), name: 'Bram' } }), screen)).toEqual(
      []
    )
  })
})
