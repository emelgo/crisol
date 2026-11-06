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
const GOBLIN = 'guerrero_goblin_2014'

/** Una espada propia del mundo, hecha para el 5e */
const espada = {
  type: 'arma',
  key: 'espada_de_valdren',
  data: { name: { es: 'Espada de Valdren' }, categoria: 'marcial', dano: '1d8', tipo_dano: 'cortante' }
}

describe('el compendio y la partida para los jugadores (docs/specs/compendio-jugadores.md)', () => {
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
  const putWorld = (items: worldContentRepo.WorldContentValues[]) =>
    worldContentRepo.putContent(
      conn.db,
      { organizationId, worldId, actorId: master.userId, via: 'ui', action: 'putWorldContent' },
      worldId,
      five,
      items
    )
  const keysOf = (items: { key: string }[]) => items.map((i) => i.key)

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_compendium_players'), { max: 4 })
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
    const url = (await ok200('getInvitation', { campaignId })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: ana.cookie }
    })
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  describe('el compendio del sistema', () => {
    it('un tipo oculto no le sale a la jugadora: ni en los tipos, ni al buscar, ni en las carpetas, ni al leer', async () => {
      const before = await ok200('searchCampaignContent', { campaignId, query: 'goblin' }, ana.cookie)
      expect(before.items.length).toBeGreaterThan(0)

      const updated = await ok200('updateCampaign', { campaignId, hiddenTypes: ['criatura'] })
      expect(updated.hiddenTypes).toEqual(['criatura'])

      const compendium = await ok200('getCampaignCompendium', { campaignId }, ana.cookie)
      expect(compendium.types.map((t: { key: string }) => t.key)).not.toContain('criatura')
      expect(JSON.stringify(compendium.sections)).not.toContain('"criatura"')
      expect((await ok200('searchCampaignContent', { campaignId, query: 'goblin' }, ana.cookie)).items).toEqual([])
      expect((await ok200('browseCampaignContent', { campaignId, type: 'criatura' }, ana.cookie)).items).toEqual([])
      expect(await ok200('getCampaignContent', { campaignId, keys: [GOBLIN] }, ana.cookie)).toEqual({
        items: [],
        missing: [GOBLIN]
      })
      // Lo demás, como siempre
      expect(
        (await ok200('browseCampaignContent', { campaignId, type: 'arma' }, ana.cookie)).items.length
      ).toBeGreaterThan(0)
      // El máster lo sigue viendo todo, y sabe qué oculta; ella no sabe qué se le oculta
      const mine = await ok200('getCampaignCompendium', { campaignId })
      expect(mine.types.map((t: { key: string }) => t.key)).toContain('criatura')
      expect((await ok200('getCampaign', { campaignId })).campaign.hiddenTypes).toEqual(['criatura'])
      expect((await ok200('getCampaign', { campaignId }, ana.cookie)).campaign.hiddenTypes).toEqual([])
    })

    it('ocultar tipos es del máster', async () => {
      const response = await call('updateCampaign', { campaignId, hiddenTypes: [] }, ana.cookie)
      expect([403, 404]).toContain(response.statusCode)
    })
  })

  describe('el compendio del mundo', () => {
    it('una entrada es del máster hasta que la revela; revelada, la ve marcada y sale en lo nuevo; oculta, se va', async () => {
      await putWorld([espada])
      const sees = async () => {
        const found = await ok200('searchCampaignContent', { campaignId, query: 'valdren' }, ana.cookie)
        const browsed = await ok200('browseCampaignContent', { campaignId, type: 'arma' }, ana.cookie)
        const read = await ok200('getCampaignContent', { campaignId, keys: ['espada_de_valdren'] }, ana.cookie)
        return {
          found: found.items,
          browsed: browsed.items.filter((i: { key: string }) => i.key === 'espada_de_valdren'),
          read: read.items
        }
      }
      expect(await sees()).toEqual({ found: [], browsed: [], read: [] })

      const revealed = await ok200('reveal', { worldId, campaignId, kind: 'content', targetId: 'espada_de_valdren' })
      expect(revealed).toMatchObject({ pageUnknown: false })
      const now = await sees()
      expect(now.found).toEqual([expect.objectContaining({ key: 'espada_de_valdren', world: true })])
      expect(now.browsed).toEqual([expect.objectContaining({ world: true })])
      expect(now.read).toEqual([expect.objectContaining({ key: 'espada_de_valdren', type: 'arma' })])
      // Del compendio del mundo como tal (su id, sus copias) nada: es del máster
      expect(now.read[0].world).toBeUndefined()
      expect((await ok200('getCampaignCompendium', { campaignId }, ana.cookie)).world).toBeNull()
      const news = await ok200('listNews', { campaignId }, ana.cookie)
      expect(news.news).toEqual([expect.objectContaining({ kind: 'content', targetId: 'espada_de_valdren' })])
      const group = await ok200('listCampaignKnowledge', { campaignId })
      expect(JSON.stringify(group)).toContain('Espada de Valdren')

      await ok200('hide', { campaignId, kind: 'content', targetId: 'espada_de_valdren' })
      expect(await sees()).toEqual({ found: [], browsed: [], read: [] })
    })

    it('revelada, la puede llevar su personaje', async () => {
      await putWorld([espada])
      const thora = (await ok200('createCharacter', { campaignId, name: 'Thora' }, ana.cookie)).character
      const play = { items: [{ id: 'e1', key: 'espada_de_valdren' }] }
      const before = await call('updateCharacter', { characterId: thora.id, version: 1, play }, ana.cookie)
      expect(before.statusCode).toBe(400)
      await ok200('reveal', { worldId, campaignId, kind: 'content', targetId: 'espada_de_valdren' })
      const after = await ok200('updateCharacter', { characterId: thora.id, version: 1, play }, ana.cookie)
      expect(after.state.carried).toMatchObject([{ id: 'e1', name: 'Espada de Valdren' }])
    })
  })

  describe('las criaturas en juego', () => {
    it('la jugadora ve las que están a la vista con su estado en palabras, sin números ni hoja', async () => {
      const goblins = (await ok200('putInPlay', { campaignId, key: GOBLIN, count: 3 })).creatures
      const [boss] = (await ok200('putInPlay', { campaignId, key: GOBLIN, unique: true, name: 'Jefe', hidden: true }))
        .creatures
      expect(boss.hidden).toBe(true)
      await ok200('playCreature', { creatureId: goblins[0].id, version: goblins[0].version, damage: 2 })
      await ok200('playCreature', { creatureId: goblins[1].id, version: goblins[1].version, damage: 4 })
      await ok200('playCreature', { creatureId: goblins[2].id, version: goblins[2].version, damage: 7 })

      const seen = await call('listVisibleInPlay', { campaignId }, ana.cookie)
      expect(seen.statusCode).toBe(200)
      expect(seen.json().creatures).toEqual([
        { id: goblins[0].id, name: 'Goblin 1', img: null, state: 'hurt' },
        { id: goblins[1].id, name: 'Goblin 2', img: null, state: 'bloodied' },
        { id: goblins[2].id, name: 'Goblin 3', img: null, state: 'down' }
      ])
      expect(seen.body).not.toContain('Jefe')
      expect(seen.body).not.toMatch(/"(life|stats|play|value|max|pg|ca)"/)

      // A la vista con un clic: le aparece
      await ok200('setCreatureHidden', { creatureId: boss.id, hidden: false })
      const now = await ok200('listVisibleInPlay', { campaignId }, ana.cookie)
      expect(now.creatures.map((c: { name: string; state: string }) => [c.name, c.state])).toContainEqual([
        'Jefe',
        'unhurt'
      ])
      // La lista del máster sigue siendo suya
      for (const [name, payload] of [
        ['listInPlay', { campaignId }],
        ['getInPlay', { creatureId: boss.id }],
        ['setCreatureHidden', { creatureId: boss.id, hidden: true }]
      ] as const) {
        const response = await call(name, payload, ana.cookie)
        expect([403, 404], `${name}: ${response.body}`).toContain(response.statusCode)
      }
    })
  })
})
