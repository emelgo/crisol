/**
 * Lo que la visión guarda en memoria: tiene tope (con muchas campañas y escenas no crece sin fin) y no da por buena una
 * vista que se calculaba cuando algo cambió
 */
import { connect, schema } from '@crisol/db'
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

  it('una vista que se estaba calculando cuando algo cambió no vale para peek', async () => {
    const vision = createVision(conn.db)
    const campaignId = crypto.randomUUID()
    const scene = {
      id: crypto.randomUUID(),
      worldId: crypto.randomUUID(),
      version: 1,
      updatedAt: new Date(),
      width: 400,
      height: 400,
      grid: schema.DEFAULT_SCENE_GRID,
      darkness: 0,
      automaticVision: false
    }
    const tokens = [{ id: crypto.randomUUID(), x: 100, y: 100, radius: 50, party: true }]
    await vision.view({ campaignId, scene, tokens })
    expect(vision.peek(campaignId, scene.id)).not.toBeNull()
    // Se pide otra (con la ficha en otro sitio) y, mientras, algo cambia en la mesa
    const moved = tokens.map((t) => ({ ...t, x: 300 }))
    const computing = vision.view({ campaignId, scene, tokens: moved })
    vision.invalidate({ campaignId })
    await computing
    expect(vision.peek(campaignId, scene.id)).toBeNull()
    await vision.close()
  })
})
