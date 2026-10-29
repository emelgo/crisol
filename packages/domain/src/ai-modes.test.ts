import { describe, expect, it } from 'vitest'
import {
  type ActionKind,
  AI_MODES,
  type AiDecision,
  type AiMode,
  aiDecision,
  approvalExpiresAt,
  approvalStatus,
  DEFAULT_AI_MODE
} from './ai-modes.ts'

const HOUR = 60 * 60 * 1000

describe('modos de IA', () => {
  it('por defecto, copiloto (como hoy)', () => {
    expect(DEFAULT_AI_MODE).toBe('copilot')
    expect(AI_MODES).toEqual(['readOnly', 'assistant', 'copilot'])
  })

  // Cada modo × cada tipo de acción
  const expected: Record<AiMode, Record<ActionKind, AiDecision>> = {
    readOnly: { read: 'run', write: 'refuse', delete: 'refuse', players: 'refuse' },
    assistant: { read: 'run', write: 'ask', delete: 'ask', players: 'ask' },
    copilot: { read: 'run', write: 'run', delete: 'ask', players: 'ask' }
  }
  for (const [mode, byKind] of Object.entries(expected)) {
    for (const [kind, decision] of Object.entries(byKind)) {
      it(`${mode} × ${kind}: ${decision}`, () => {
        expect(aiDecision(mode as AiMode, kind as ActionKind)).toBe(decision)
      })
    }
  }
})

describe('cola de aprobación', () => {
  const requestedAt = new Date('2026-10-29T10:00:00Z')

  it('una petición caduca a las 24 h', () => {
    expect(approvalExpiresAt(requestedAt)).toEqual(new Date('2026-10-30T10:00:00Z'))
  })

  it('pendiente hasta su hora; desde entonces, caducada', () => {
    const pending = { status: 'pending' as const, expiresAt: approvalExpiresAt(requestedAt) }
    expect(approvalStatus(pending, new Date(requestedAt.getTime() + 24 * HOUR - 1))).toBe('pending')
    expect(approvalStatus(pending, new Date(requestedAt.getTime() + 24 * HOUR))).toBe('expired')
  })

  it('lo ya decidido no caduca', () => {
    const later = new Date(requestedAt.getTime() + 48 * HOUR)
    for (const status of ['approved', 'done', 'failed', 'rejected'] as const) {
      expect(approvalStatus({ status, expiresAt: approvalExpiresAt(requestedAt) }, later)).toBe(status)
    }
  })
})
