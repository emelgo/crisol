/** Lo que la visión guarda en memoria tiene tope: con muchas campañas y escenas no crece sin fin */
import { connect } from '@crisol/db'
import { freshTestDatabase } from '@crisol/db/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createVision, VISION_KEEP } from './vision.ts'

describe('la memoria de la visión', () => {
  let conn: ReturnType<typeof connect>

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_vision_memory'), { max: 1 })
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('los caminos apuntados de muchas campañas y escenas no pasan del tope (se van los de hace más rato)', async () => {
    const vision = createVision(conn.db)
    const move = { tokenId: crypto.randomUUID(), from: { x: 0, y: 0 }, to: { x: 100, y: 0 } }
    const keys = Array.from({ length: VISION_KEEP * 3 }, () => [crypto.randomUUID(), crypto.randomUUID()] as const)
    for (const [campaignId, sceneId] of keys) vision.walked(campaignId, sceneId, [move])
    expect(vision.memory().walks).toBe(VISION_KEEP)
    const [lastCampaign, lastScene] = keys.at(-1) ?? ['', '']
    expect(vision.takeWalked(lastCampaign, lastScene)).toEqual([move])
    const [firstCampaign, firstScene] = keys[0] ?? ['', '']
    expect(vision.takeWalked(firstCampaign, firstScene)).toEqual([])
    await vision.close()
  })
})
