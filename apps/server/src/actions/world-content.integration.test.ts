import { connect, schema, worldContentRepo } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { exampleFile } from '@crisol/systems/examples'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

/** Una espada propia del mundo, hecha para el 5e */
const espada = {
  type: 'arma',
  key: 'espada_de_valdren',
  data: { name: { es: 'Espada de Valdren' }, categoria: 'marcial', dano: '1d8', tipo_dano: 'cortante' }
}

describe('el compendio del mundo (docs/specs/compendio-mundo.md)', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let master: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let organizationId: string
  let worldId: string
  let campaignId: string
  let five: string

  const call = (name: string, payload: object, cookie = master.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const join = async (cookie: string, campaign = campaignId) => {
    const url = (await ok200('getInvitation', { campaignId: campaign })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie }
    })
  }
  /** Lo del mundo, puesto directamente (las acciones para hacerlo llegan con la tarea 4) */
  const putWorld = (items: worldContentRepo.WorldContentValues[], world = worldId, systemId = five) =>
    worldContentRepo.putContent(
      conn.db,
      { organizationId, worldId: world, actorId: master.userId, via: 'ui', action: 'putWorldContent' },
      world,
      systemId,
      items
    )

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_world_content'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY }
    })
    master = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Mesa' }).returning()
    if (!org) throw new Error('sin organización')
    organizationId = org.id
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: master.userId, role: 'owner' })
    worldId = (await ok200('createWorld', { name: 'Valdren' })).id
    five = (await ok200('importSystem', { file: exampleFile('5e') })).system.id
    campaignId = (await ok200('createCampaign', { worldId, name: 'La Marca', system: five })).id
    ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    await join(ana.cookie)
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('el máster lo ve en el compendio de la campaña, marcado: en los tipos, al buscar, en las carpetas y al leer', async () => {
    await putWorld([espada])
    const compendium = await ok200('getCampaignCompendium', { campaignId })
    expect(compendium.world).toMatchObject({ worldId, systemId: five, writable: true, count: 1 })
    expect(compendium.world.types.length).toBeGreaterThan(0)

    const found = await ok200('searchCampaignContent', { campaignId, query: 'valdren' })
    expect(found.items).toEqual([expect.objectContaining({ key: 'espada_de_valdren', world: true, source: null })])
    const other = await ok200('searchCampaignContent', { campaignId, query: 'espada larga' })
    expect(other.items.every((h: { world?: boolean }) => !h.world)).toBe(true)

    const browsed = await ok200('browseCampaignContent', { campaignId, type: 'arma' })
    expect(browsed.items.find((i: { key: string }) => i.key === 'espada_de_valdren')).toMatchObject({ world: true })

    const read = await ok200('getCampaignContent', { campaignId, keys: ['espada_de_valdren'] })
    expect(read.items).toEqual([
      expect.objectContaining({
        key: 'espada_de_valdren',
        source: null,
        world: { id: expect.any(String), version: 1, origin: null }
      })
    ])
  })

  it('si una clave está en las dos capas, en la campaña manda la del mundo', async () => {
    await putWorld([
      { ...espada, key: 'espada_larga_2024', data: { ...espada.data, name: { es: 'Espada larga del valle' } } }
    ])
    const read = await ok200('getCampaignContent', { campaignId, keys: ['espada_larga_2024'] })
    expect(read.items[0]).toMatchObject({ data: { name: { es: 'Espada larga del valle' } }, world: { version: 1 } })
    const found = await ok200('searchCampaignContent', { campaignId, query: 'espada larga', type: 'arma' })
    expect(found.items.filter((h: { key: string }) => h.key === 'espada_larga_2024')).toHaveLength(1)
  })

  it('una copia sabe si su original ha cambiado o ya no está', async () => {
    const [original] = (await ok200('getSystemContent', { systemId: five, keys: ['guerrero_goblin_2014'] })).items
    const { contentFingerprint } = await import('@crisol/systems')
    await putWorld([
      {
        type: original.type,
        key: 'goblin_jefe',
        data: { ...original.data, name: { es: 'Goblin jefe' } },
        origin: {
          layer: 'system',
          systemId: five,
          key: 'guerrero_goblin_2014',
          fingerprint: contentFingerprint(original),
          data: original.data
        }
      },
      {
        type: original.type,
        key: 'goblin_perdido',
        data: { name: { es: 'Goblin perdido' } },
        origin: { layer: 'system', systemId: five, key: 'no_esta', fingerprint: 'x', data: {} }
      }
    ])
    const read = async () =>
      (await ok200('getCampaignContent', { campaignId, keys: ['goblin_jefe', 'goblin_perdido'] })).items
    const [jefe, perdido] = await read()
    expect(jefe.world.origin).toEqual({
      layer: 'system',
      systemId: five,
      key: 'guerrero_goblin_2014',
      name: 'Goblin',
      changed: false,
      missing: false
    })
    expect(perdido.world.origin).toMatchObject({ name: null, missing: true, changed: false })

    const system = await ok200('getSystem', { systemId: five })
    await ok200('putSystemContent', {
      systemId: five,
      version: system.version,
      items: [{ ...original, data: { ...original.data, pg: 99 } }]
    })
    expect((await read())[0].world.origin.changed).toBe(true)
  })

  it('la jugadora no ve el compendio del mundo (hasta el módulo 5)', async () => {
    await putWorld([espada])
    const compendium = await ok200('getCampaignCompendium', { campaignId }, ana.cookie)
    expect(compendium.world).toBeNull()
    expect(JSON.stringify(compendium)).not.toContain('espada_de_valdren')
    expect((await ok200('searchCampaignContent', { campaignId, query: 'valdren' }, ana.cookie)).items).toEqual([])
    const browsed = await ok200('browseCampaignContent', { campaignId, type: 'arma' }, ana.cookie)
    expect(browsed.items.some((i: { key: string }) => i.key === 'espada_de_valdren')).toBe(false)
    expect(await ok200('getCampaignContent', { campaignId, keys: ['espada_de_valdren'] }, ana.cookie)).toEqual({
      items: [],
      missing: ['espada_de_valdren']
    })
  })

  it('pero lo que lleva su personaje del mundo, sí, en su hoja', async () => {
    await putWorld([espada])
    const created = (await ok200('createCharacter', { campaignId, name: 'Thora' }, ana.cookie)).character
    const saved = await ok200(
      'updateCharacter',
      { characterId: created.id, version: 1, play: { items: [{ id: 'e1', key: 'espada_de_valdren' }] } },
      ana.cookie
    )
    expect(saved.state.carried).toMatchObject([{ id: 'e1', name: 'Espada de Valdren', type: 'arma' }])
  })

  it('otra campaña del mundo con otro sistema, u otro mundo, no lo ven', async () => {
    await putWorld([espada])
    const blank = (await ok200('createCampaign', { worldId, name: 'Otra', system: 'blank' })).id
    expect((await ok200('getCampaignCompendium', { campaignId: blank })).world).toBeNull()
    const elsewhere = (await ok200('createWorld', { name: 'Lejos' })).id
    const far = (await ok200('createCampaign', { worldId: elsewhere, name: 'Lejana', system: five })).id
    const compendium = await ok200('getCampaignCompendium', { campaignId: far })
    expect(compendium.world).toMatchObject({ worldId: elsewhere, count: 0 })
    expect((await ok200('searchCampaignContent', { campaignId: far, query: 'valdren' })).items).toEqual([])
  })
})
