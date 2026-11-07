/**
 * Las teselas de la pantalla cuando la vista del grupo no está fresca (docs/specs/vision.md): las que se piden a la vez
 * comparten un solo cálculo de la vista por campaña y escena
 */
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../app.ts'
import { diskStorage } from '../files/storage.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY, testDataDir } from '../testing.ts'
import * as projection from './projection.ts'

vi.mock('./projection.ts', async (original) => {
  const real = await original<typeof import('./projection.ts')>()
  return { ...real, visionOf: vi.fn(real.visionOf) }
})

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined
/** Una tesela de mentira: al servidor le basta su cabecera de WebP */
const TILE = Buffer.concat([Buffer.from('RIFF'), Buffer.from([20, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(16)])

describe('las teselas de la pantalla con la vista sin calcular', () => {
  let conn: ReturnType<typeof connect>
  let app: FastifyInstance

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_screen_tiles'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
  })

  afterEach(async () => {
    await app.close()
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('las que se piden a la vez calculan la vista una sola vez', async () => {
    const auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY },
      storage: diskStorage(testDataDir())
    })
    await app.ready()
    const owner = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Mesa' }).returning()
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org?.id ?? '', userId: owner.userId, role: 'owner' })
    const call = async (name: string, payload: object) => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/actions/${name}`,
        payload,
        headers: { origin: BASE_URL, cookie: owner.cookie }
      })
      expect(response.statusCode, response.body).toBe(200)
      return response.json()
    }
    const worldId = (await call('createWorld', { name: 'Valdren' })).id
    const campaignId = (await call('createCampaign', { worldId, name: 'La Marca' })).id
    const pageId = (await call('createPage', { worldId, title: 'Cripta' })).id
    const tab = await call('createPageTab', { pageId, kind: 'scene' })
    const sceneId = (await call('getScene', { tabId: tab.id })).id
    const version = crypto.randomUUID()
    const put = await app.inject({
      method: 'PUT',
      url: `/api/scenes/${sceneId}/tiles/${version}/0/0/0`,
      payload: TILE,
      headers: { origin: BASE_URL, cookie: owner.cookie, 'content-type': 'image/webp' }
    })
    expect(put.statusCode).toBe(204)
    await call('setSceneImage', { sceneId, width: 2048, height: 2048, tiles: { version, size: 512, levels: 3 } })
    await call('presentScene', { campaignId, sceneId })
    await call('changeFog', { campaignId, mode: 'reveal', shape: 'rectangle', x: 0, y: 0, width: 2048, height: 2048 })
    const visionOf = vi.mocked(projection.visionOf)
    visionOf.mockClear()
    const tiles = ['0/0/0', '2/0/0', '2/1/0', '2/0/1', '2/1/1', '2/2/2', '2/3/3', '1/1/1']
    const answers = await Promise.all(
      tiles.map((at) =>
        app.inject({
          method: 'GET',
          url: `/api/campaigns/${campaignId}/screen/tiles/${version}/${at}`,
          headers: { cookie: owner.cookie }
        })
      )
    )
    // La que se subió llega; las demás no existen, pero todas miraron la misma vista
    expect(answers[0]?.statusCode).toBe(200)
    expect(visionOf).toHaveBeenCalledTimes(1)
  })
})
