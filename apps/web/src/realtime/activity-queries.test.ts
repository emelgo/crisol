import type { DiceRoll, LogEntry } from '@crisol/contracts'
import { describe, expect, it } from 'vitest'
import { queriesFor } from './context.tsx'

const campaignId = crypto.randomUUID()
const worldId = crypto.randomUUID()

describe('la insignia de la actividad (8 · campaña) se vuelve a pedir', () => {
  it('con su aviso, con lo nuevo del registro, con cada tirada y con lo revelado', () => {
    expect(queriesFor({ type: 'changed', what: 'activity', campaignId })).toContainEqual(['activity', campaignId])
    expect(queriesFor({ type: 'logged', campaignId, entry: {} as LogEntry })).toContainEqual(['activity', campaignId])
    expect(queriesFor({ type: 'rolled', campaignId, roll: {} as DiceRoll })).toContainEqual(['activity', campaignId])
    expect(
      queriesFor({ type: 'revealed', worldId, campaignId, kind: 'page', targetId: 'x', pageId: null, title: 'Varn' })
    ).toContainEqual(['activity', campaignId])
  })
})
