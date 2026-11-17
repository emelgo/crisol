/**
 * La pantalla del máster (módulos 8 y 10 · campaña, decisión 24): lo elegido en el cajón G (la nota fijada, lo que
 * enseña y las tablas del mundo) se guarda en el servidor por campaña y escena, sale en la mesa en otro aparato y se
 * deshace; las tablas se tiran ocultas al registro
 */
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { desc, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined
const row = (from: number, to: number, text: string) => ({ id: `r${from}`, from, to, text })

describe('la pantalla del máster (8 · campaña)', () => {
  let conn: ReturnType<typeof connect>
  let auth: ReturnType<typeof createTestAuth>
  let app: ReturnType<typeof buildApp>
  let master: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let worldId: string
  let campaignId: string
  let sceneId: string

  const call = (name: string, payload: object, cookie = master.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const fails = async (name: string, payload: object, code: string, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.json().code, response.body).toBe(code)
  }
  const table = async (world: string, title: string) => {
    const pageId = (await ok200('createPage', { worldId: world, title })).id
    const tab = await ok200('createPageTab', { pageId, kind: 'table', name: 'Encuentros' })
    await ok200('updateRandomTable', { tabId: tab.id, version: 1, rows: [row(1, 1, 'Lobos'), row(2, 2, 'Bandidos')] })
    return { pageId, tabId: tab.id as string }
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_gm_screen'), { max: 4 })
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
    worldId = (await ok200('createWorld', { name: 'Eana' })).id
    campaignId = (await ok200('createCampaign', { worldId, name: 'La Marca' })).id
    ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    const url = (await ok200('getInvitation', { campaignId })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: ana.cookie }
    })
    sceneId = (await ok200('createScene', { worldId, name: 'El molino' })).id
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('la nota fijada y las tablas elegidas: en la mesa (otro aparato la lee igual) y se deshace', async () => {
    const { pageId, tabId } = await table(worldId, 'Caminos')
    expect((await ok200('listRandomTables', { worldId })).tables).toEqual([
      { tabId, name: 'Encuentros', pageId, pageTitle: 'Caminos' }
    ])
    await fails('setGmScreen', { campaignId, sceneId, note: pageId }, 'SCENE_NOT_OPEN')
    await ok200('openScene', { campaignId, sceneId })
    expect((await ok200('getCampaignTable', { campaignId })).gmScreen).toBeNull()
    const saved = await ok200('setGmScreen', { campaignId, note: pageId, tables: [tabId, tabId], characters: false })
    expect(saved).toEqual({ sceneId, gmScreen: { note: pageId, statblocks: true, characters: false, tables: [tabId] } })
    expect((await ok200('getCampaignTable', { campaignId })).gmScreen).toEqual(saved.gmScreen)
    await ok200('setGmScreen', { campaignId, statblocks: false })
    expect((await ok200('getCampaignTable', { campaignId })).gmScreen).toMatchObject({
      note: pageId,
      statblocks: false
    })

    const [op] = await conn.db
      .select()
      .from(schema.operations)
      .where(eq(schema.operations.action, 'setGmScreen'))
      .orderBy(desc(schema.operations.createdAt))
    expect(op?.campaignId).toBe(campaignId)
    expect((await ok200('undoOperation', { operationId: op?.id })).status).toBe('undone')
    expect((await ok200('getCampaignTable', { campaignId })).gmScreen).toMatchObject({ statblocks: true })
  })

  it('tirar una tabla elegida: oculta al registro (la jugadora no la ve); nada de otro mundo; solo el máster', async () => {
    const { tabId } = await table(worldId, 'Caminos')
    await ok200('openScene', { campaignId, sceneId })
    const rolled = await ok200('rollOnTable', { tabId, campaignId, visibility: 'hidden' })
    expect(rolled.roll).toMatchObject({ visibility: 'hidden', label: 'Encuentros' })
    expect(rolled.roll.table.results[0].text).toMatch(/Lobos|Bandidos/)
    const seen = (await ok200('listLog', { campaignId }, ana.cookie)).entries
    expect(seen.filter((e: { kind: string }) => e.kind === 'roll')).toEqual([])

    const other = (await ok200('createWorld', { name: 'Otro' })).id
    const foreign = await table(other, 'Fuera')
    await fails('setGmScreen', { campaignId, tables: [foreign.tabId] }, 'NOT_FOUND')
    await fails('setGmScreen', { campaignId, note: foreign.pageId }, 'NOT_FOUND')
    await fails('setGmScreen', { campaignId, statblocks: false }, 'FORBIDDEN', ana.cookie)
    expect((await call('listRandomTables', { worldId }, ana.cookie)).statusCode).toBe(404)
  })
})
