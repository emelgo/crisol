import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

describe('la página que escriben los jugadores (docs/specs/pagina-de-jugadores.md)', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let master: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let bruno: { userId: string; cookie: string }
  let carla: { userId: string; cookie: string }
  let worldId: string
  let marca: string
  let lia: string
  let diary: string
  let aldoria: string

  const call = (name: string, payload: object, cookie = master.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const join = async (campaignId: string, who: { cookie: string }) => {
    const url = (await ok200('getInvitation', { campaignId })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: who.cookie }
    })
  }
  const text = async (cookie = master.cookie) =>
    JSON.stringify((await ok200('getPageContent', { pageId: diary }, cookie)).blocks)

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_player_pages'), { max: 4 })
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
    worldId = (await ok200('createWorld', { name: 'Valdren' })).id
    marca = (await ok200('createCampaign', { worldId, name: 'La Marca' })).id
    const norte = (await ok200('createCampaign', { worldId, name: 'Los del norte' })).id
    ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    bruno = await signUpTestUser(auth, { name: 'Bruno', email: 'bruno@crisol.test' })
    carla = await signUpTestUser(auth, { name: 'Carla', email: 'carla@crisol.test' })
    await join(marca, ana)
    await join(marca, bruno)
    await join(norte, carla)
    const [row] = await conn.db
      .insert(schema.characters)
      .values({ campaignId: marca, ownerId: ana.userId, name: 'Lía', system: 'blank', build: {}, play: {} })
      .returning()
    lia = row?.id ?? ''
    await conn.db
      .insert(schema.characters)
      .values({ campaignId: marca, ownerId: bruno.userId, name: 'Bram', system: 'blank', build: {}, play: {} })
    const created = await ok200('createPages', {
      worldId,
      parentId: null,
      pages: [
        { key: 'd', title: 'Diario de la compañía', markdown: 'Lo que pasó.' },
        { key: 'a', title: 'Aldoria', markdown: ['Un reino.', '', '> [!secreto]', '> Varn vendió el paso.'].join('\n') }
      ]
    })
    diary = created.pages.find((p: { title: string }) => p.title === 'Diario de la compañía').id
    aldoria = created.pages.find((p: { title: string }) => p.title === 'Aldoria').id
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('a toda la campaña: la ven y la pueden escribir; la otra campaña, no; «Quién la conoce» lo dice', async () => {
    await ok200('setPageEditors', { worldId, campaignId: marca, pageId: diary, editors: 'all' })
    expect((await ok200('getPage', { pageId: diary }, ana.cookie)).editable).toBe(true)
    expect((await ok200('getPage', { pageId: diary }, bruno.cookie)).editable).toBe(true)
    expect((await call('getPage', { pageId: diary }, carla.cookie)).statusCode).toBe(404)
    expect((await ok200('getPage', { pageId: diary })).editedByPlayers).toBe(true)
    expect((await ok200('getPage', { pageId: aldoria })).editedByPlayers).toBe(false)
    const known = await ok200('getPageKnowledge', { pageId: diary })
    expect(known.campaigns.find((c: { name: string }) => c.name === 'La Marca')).toMatchObject({
      editors: 'all',
      audience: 'all'
    })
    expect(known.campaigns.find((c: { name: string }) => c.name === 'Los del norte').editors).toBe('none')
  })

  it('escribe su texto con editPage (lo ve el máster y queda a su nombre); ni el título ni secretos', async () => {
    await ok200('setPageEditors', { worldId, campaignId: marca, pageId: diary, editors: 'all' })
    await ok200('editPage', { pageId: diary, body: { mode: 'append', markdown: 'Día 1: el faro.' } }, ana.cookie)
    expect(await text()).toContain('Día 1: el faro.')
    const history = await ok200('listHistory', { worldId, limit: 5 })
    expect(history.entries[0]).toMatchObject({ action: 'editPage', actor: { name: 'Ana' } })

    for (const [payload, code] of [
      [{ pageId: diary, title: 'Otro' }, 'PLAYER_PAGE'],
      [{ pageId: diary, body: { mode: 'append', markdown: '> [!secreto]\n> Mío.' } }, 'PLAYER_PAGE']
    ] as const) {
      const response = await call('editPage', payload, ana.cookie)
      expect(response.statusCode, JSON.stringify(payload)).toBe(400)
      expect(response.json().code).toBe(code)
    }
    // Lo demás de la página sigue siendo del máster
    for (const [name, payload] of [
      ['updatePage', { pageId: diary, title: 'Otro' }],
      ['setPagePanel', { pageId: diary, blocks: [] }],
      ['deletePage', { pageId: diary }],
      ['createPageDocument', { pageId: diary, kind: 'secret' }],
      ['editPage', { pageId: aldoria, body: { mode: 'append', markdown: 'Hola' } }]
    ] as const) {
      expect([403, 404], name).toContain((await call(name, payload, ana.cookie)).statusCode)
    }
  })

  it('a unos personajes: solo sus dueños; el otro ni la ve si no la conocía', async () => {
    await ok200('setPageEditors', { worldId, campaignId: marca, pageId: diary, editors: [lia] })
    expect((await ok200('getPage', { pageId: diary }, ana.cookie)).editable).toBe(true)
    expect((await call('getPage', { pageId: diary }, bruno.cookie)).statusCode).toBe(404)
    expect(
      (await call('editPage', { pageId: diary, body: { mode: 'append', markdown: 'Yo' } }, bruno.cookie)).statusCode
    ).toBe(404)
  })

  it('no se deja editar una página con secretos, y en una de jugadores el máster no crea secretos', async () => {
    const refused = await call('setPageEditors', { worldId, campaignId: marca, pageId: aldoria, editors: 'all' })
    expect(refused.statusCode).toBe(400)
    expect(refused.json().code).toBe('PAGE_HAS_SECRETS')
    await ok200('setPageEditors', { worldId, campaignId: marca, pageId: diary, editors: 'all' })
    const secret = await call('createPageDocument', { pageId: diary, kind: 'secret' })
    expect(secret.json().code).toBe('PLAYER_PAGE')
    const written = await call('editPage', { pageId: diary, body: { mode: 'append', markdown: '> [!secreto]\n> No.' } })
    expect(written.json().code).toBe('PLAYER_PAGE')
  })

  it('quitárselo: la sigue viendo, pero ya no la escribe; y se deshace como lo demás', async () => {
    await ok200('setPageEditors', { worldId, campaignId: marca, pageId: diary, editors: 'all' })
    await ok200('setPageEditors', { worldId, campaignId: marca, pageId: diary, editors: null })
    const page = await ok200('getPage', { pageId: diary }, ana.cookie)
    expect(page.editable).toBe(false)
    expect([403, 404]).toContain(
      (await call('editPage', { pageId: diary, body: { mode: 'append', markdown: 'Yo' } }, ana.cookie)).statusCode
    )
    // Deshacer lo último (quitárselo): vuelve a poder
    const history = await ok200('listHistory', { worldId, limit: 1 })
    expect(history.entries[0].action).toBe('setPageEditors')
    await ok200('undoOperation', { operationId: history.entries[0].id })
    expect((await ok200('getPage', { pageId: diary }, ana.cookie)).editable).toBe(true)
  })

  it('solo quien lleva la wiki deja editar', async () => {
    const response = await call(
      'setPageEditors',
      { worldId, campaignId: marca, pageId: diary, editors: 'all' },
      ana.cookie
    )
    expect([403, 404]).toContain(response.statusCode)
  })
})
