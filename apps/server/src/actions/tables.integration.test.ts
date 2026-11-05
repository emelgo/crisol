import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined
const row = (from: number, to: number, text: string, extra: Record<string, unknown> = {}) => ({
  id: `f${from}`,
  from,
  to,
  text,
  ...extra
})

describe('las tablas aleatorias del máster', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let master: { userId: string; cookie: string }
  let worldId: string
  let campaignId: string
  let pageId: string

  const call = (name: string, payload: object, cookie = master.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const fails = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    return { status: response.statusCode, code: response.json().code as string, message: response.json().message }
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_tables'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY }
    })
    master = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Fateforge' }).returning()
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org?.id ?? '', userId: master.userId, role: 'owner' })
    worldId = (await ok200('createWorld', { name: 'Eana' })).id
    campaignId = (await ok200('createCampaign', { worldId, name: 'La Marca' })).id
    pageId = (await ok200('createPage', { worldId, title: 'Encuentros' })).id
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('una pestaña «Tabla»: sus filas se validan, se tira en el servidor y queda en el registro con lo que salió', async () => {
    const tab = await ok200('createPageTab', { pageId, kind: 'table' })
    expect(tab).toMatchObject({ kind: 'table', name: 'Tabla' })
    const empty = await ok200('getRandomTable', { tabId: tab.id })
    expect(empty).toEqual({
      table: expect.objectContaining({ formula: null, replacement: true, rows: [], version: 1 }),
      drawn: []
    })
    // Rangos que se pisan o dejan huecos: no se guarda y dice qué falla
    const bad = await fails('updateRandomTable', {
      tabId: tab.id,
      version: 1,
      formula: '1d6',
      rows: [row(1, 3, 'Lobos'), row(3, 5, 'Bandidos')]
    })
    expect(bad.code).toBe('BAD_TABLE')
    const saved = await ok200('updateRandomTable', {
      tabId: tab.id,
      version: 1,
      rows: [row(1, 1, 'Lobos'), row(2, 2, 'Bandidos'), row(3, 3, 'Nada')]
    })
    expect(saved.table).toMatchObject({ formula: null, version: 2 })
    const { roll } = await ok200('rollOnTable', { tabId: tab.id, campaignId, visibility: 'hidden' })
    expect(roll).toMatchObject({ formula: '1d3', label: 'Tabla', visibility: 'hidden' })
    expect(['Lobos', 'Bandidos', 'Nada']).toContain(roll.table.results[0].text)
    const { rolls } = await ok200('listRolls', { campaignId })
    expect(rolls[0].table.name).toBe('Tabla')
  })

  it('sin reemplazo: lo sacado no vuelve a salir hasta reiniciarla, por campaña; las anidadas también tiran', async () => {
    const inner = await ok200('createPageTab', { pageId, kind: 'table', name: 'Botín' })
    await ok200('updateRandomTable', { tabId: inner.id, version: 1, rows: [row(1, 1, '10 po')] })
    const tab = await ok200('createPageTab', { pageId, kind: 'table', name: 'Encuentro' })
    await ok200('updateRandomTable', {
      tabId: tab.id,
      version: 1,
      formula: '1d2',
      replacement: false,
      rows: [row(1, 1, 'Un cofre', { table: inner.id }), row(2, 2, 'Un trasgo')]
    })
    const first = await ok200('rollOnTable', { tabId: tab.id, campaignId })
    const second = await ok200('rollOnTable', { tabId: tab.id, campaignId })
    const texts = [first, second].flatMap((r) => r.roll.table.results.map((x: { text: string }) => x.text))
    expect(texts.sort()).toEqual(['Botín: 10 po', 'Un cofre', 'Un trasgo'])
    expect(second.drawn.sort()).toEqual(['f1', 'f2'])
    expect((await fails('rollOnTable', { tabId: tab.id, campaignId })).code).toBe('TABLE_EMPTY')
    // En otra campaña, todo puede salir
    const other = (await ok200('createCampaign', { worldId, name: 'Los Cuervos' })).id
    expect((await ok200('getRandomTable', { tabId: tab.id, campaignId: other })).drawn).toEqual([])
    await ok200('resetTableDraws', { tabId: tab.id, campaignId })
    expect((await ok200('getRandomTable', { tabId: tab.id, campaignId })).drawn).toEqual([])
    // Una tabla que lleva a sí misma o a una que no existe, no
    const loop = await fails('updateRandomTable', {
      tabId: tab.id,
      version: 2,
      rows: [row(1, 1, 'Otra vez', { table: tab.id }), row(2, 2, 'Nada', { table: crypto.randomUUID() })]
    })
    expect(loop.code).toBe('BAD_TABLE')
  })

  it('son del máster: quien no ve la wiki no las ve ni tira; en una campaña de otro mundo, no', async () => {
    const tab = await ok200('createPageTab', { pageId, kind: 'table' })
    await ok200('updateRandomTable', { tabId: tab.id, version: 1, rows: [row(1, 1, 'Algo')] })
    const url = (await ok200('getInvitation', { campaignId })).url as string
    const player = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: player.cookie }
    })
    expect((await fails('getRandomTable', { tabId: tab.id }, player.cookie)).status).toBe(404)
    expect((await fails('rollOnTable', { tabId: tab.id, campaignId }, player.cookie)).status).toBe(404)
    const costa = (await ok200('createWorld', { name: 'Costa' })).id
    const foreign = (await ok200('createCampaign', { worldId: costa, name: 'Faro' })).id
    expect((await fails('rollOnTable', { tabId: tab.id, campaignId: foreign })).code).toBe('BAD_CAMPAIGN')
  })
})
