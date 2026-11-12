import { connect, schema } from '@crisol/db'
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
const ARROW = 'flecha_acida_2014'

describe('tirar las acciones de una entrada del compendio (revisión, tanda 7)', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let master: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let campaignId: string

  const call = (name: string, payload: object, cookie = master.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const code = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    return { status: response.statusCode, code: response.json().code as string }
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_content_rolls'), { max: 4 })
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
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org.id, userId: master.userId, role: 'owner' })
    const worldId = (await ok200('createWorld', { name: 'Valdren' })).id
    const five = (await ok200('importSystem', { file: exampleFile('5e') })).system.id
    campaignId = (await ok200('createCampaign', { worldId, name: 'La Marca', system: five })).id
    // Las dos ediciones (de serie, lo que está en las dos sale en la nueva)
    await ok200('updateCampaign', { campaignId, systemChoices: { sources: ['srd51', 'srd521'], duplicates: 'both' } })
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

  it('sus acciones dicen su clave y lo que se tira de cada una', async () => {
    const { items } = await ok200('getCampaignContent', { campaignId, keys: [GOBLIN, ARROW] })
    const goblin = items.find((i: { key: string }) => i.key === GOBLIN)
    expect(goblin.play.actions[0]).toMatchObject({ key: 'cimitarra', rolls: ['attack', 'damage'] })
    const arrow = items.find((i: { key: string }) => i.key === ARROW)
    expect(arrow.play.actions[0]).toMatchObject({ key: 'lanzar', rolls: ['attack', 'damage'] })
  })

  it('una criatura tira con su propia hoja, al registro de la campaña; el daño se puede aplicar', async () => {
    const attack = (
      await ok200('rollContentAction', {
        campaignId,
        key: GOBLIN,
        action: { key: 'cimitarra', part: 'attack' },
        visibility: 'hidden'
      })
    ).roll
    expect(attack.label).toBe('Goblin · Cimitarra')
    expect(attack.formula).toMatch(/d20/)
    expect(attack.visibility).toBe('hidden')
    const damage = (
      await ok200('rollContentAction', { campaignId, key: GOBLIN, action: { key: 'cimitarra', part: 'damage' } })
    ).roll
    expect(damage.label).toBe('Goblin · Cimitarra · daño')
    expect(damage.apply).toMatchObject({ kind: 'damage', parts: [{ type: 'cortante' }] })
    const { rolls } = await ok200('listRolls', { campaignId })
    expect(rolls.map((r: { id: string }) => r.id)).toEqual(expect.arrayContaining([attack.id, damage.id]))
    // Lo que no tiene: un error claro
    expect(
      await code('rollContentAction', { campaignId, key: GOBLIN, action: { key: 'cimitarra', part: 'heal' } })
    ).toEqual({ status: 400, code: 'BAD_ROLL' })
  })

  it('un conjuro, con la hoja de un personaje; sin él, CHARACTER_REQUIRED; la jugadora, con el suyo y sin ocultas', async () => {
    expect(
      await code('rollContentAction', { campaignId, key: ARROW, action: { key: 'lanzar', part: 'damage' } }, ana.cookie)
    ).toEqual({ status: 400, code: 'CHARACTER_REQUIRED' })
    const thora = (await ok200('createCharacter', { campaignId, name: 'Thora' }, ana.cookie)).character
    const damage = (
      await ok200(
        'rollContentAction',
        { campaignId, key: ARROW, action: { key: 'lanzar', part: 'damage' }, characterId: thora.id },
        ana.cookie
      )
    ).roll
    expect(damage.label).toBe('Thora · Flecha ácida · daño')
    expect(damage.formula).toBe('4d4 + 2d4')
    // Oculta, no: es del máster
    expect(
      await code(
        'rollContentAction',
        {
          campaignId,
          key: ARROW,
          action: { key: 'lanzar', part: 'damage' },
          characterId: thora.id,
          visibility: 'hidden'
        },
        ana.cookie
      )
    ).toEqual({ status: 400, code: 'VISIBILITY_NOT_ALLOWED' })
    // El personaje de otra persona, no
    const mine = (await ok200('createCharacter', { campaignId, name: 'Del máster' })).character
    expect(
      (
        await code(
          'rollContentAction',
          { campaignId, key: ARROW, action: { key: 'lanzar', part: 'damage' }, characterId: mine.id },
          ana.cookie
        )
      ).status
    ).toBe(404)
  })

  it('lo que la campaña no ve no se tira', async () => {
    await ok200('updateCampaign', { campaignId, hiddenTypes: ['criatura'] })
    expect(
      (
        await code(
          'rollContentAction',
          { campaignId, key: GOBLIN, action: { key: 'cimitarra', part: 'attack' } },
          ana.cookie
        )
      ).status
    ).toBe(404)
    expect(
      (await code('rollContentAction', { campaignId, key: 'nada', action: { key: 'x', part: 'attack' } })).status
    ).toBe(404)
  })
})
