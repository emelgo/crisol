import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { diskStorage } from '../files/storage.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY, testDataDir } from '../testing.ts'

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
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY },
      storage: diskStorage(testDataDir())
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
  describe('lo que escribe un jugador no le deja ver ni tocar más de lo suyo (revisión)', () => {
    const grant = () => ok200('setPageEditors', { worldId, campaignId: marca, pageId: diary, editors: 'all' })
    const append = (markdown: string, cookie = ana.cookie) =>
      call('editPage', { pageId: diary, body: { mode: 'append', markdown } }, cookie)

    it('un archivo por su nombre no se resuelve (ni se le sirve), aunque exista', async () => {
      const uploaded = await app.inject({
        method: 'POST',
        url: `/api/files?worldId=${worldId}&name=plano-guarida.svg`,
        payload: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'),
        headers: { origin: BASE_URL, cookie: master.cookie, 'content-type': 'application/octet-stream' }
      })
      expect(uploaded.statusCode, uploaded.body).toBe(201)
      const file = uploaded.json()
      expect(file.id).toBeTruthy()
      await grant()
      expect((await append('![[plano-guarida.svg]]')).statusCode).toBe(200)
      expect(await text()).not.toContain(file.id)
      const served = await app.inject({ method: 'GET', url: `/api/files/${file.id}`, headers: { cookie: ana.cookie } })
      expect(served.statusCode).toBe(404)
    })

    it('editPage le devuelve su página proyectada; ni campos con el YAML, ni con el candado', async () => {
      const full = await ok200('getPage', { pageId: diary })
      await ok200('setPageProperties', {
        pageId: diary,
        properties: [...full.properties, { name: 'Traidor', type: 'text', value: 'El Canciller', hidden: true }]
      })
      await grant()
      const written = await append('Día 2.')
      expect(written.statusCode).toBe(200)
      expect(written.body).not.toContain('El Canciller')
      expect(written.json().page.editable).toBe(true)
      const yaml = await call(
        'editPage',
        { pageId: diary, body: { mode: 'replace', markdown: '---\nalias: Mío\n---\nTodo nuevo.' } },
        ana.cookie
      )
      expect(yaml.json().code).toBe('PLAYER_PAGE')
      await ok200('updatePage', { pageId: diary, locked: true })
      expect((await append('Día 3.')).json().code).toBe('PLAYER_PAGE')
      expect((await ok200('getPage', { pageId: diary }, ana.cookie)).editable).toBe(false)
    })

    it('un nombre solo se resuelve contra lo que conocen: ni a una página oculta, ni la delata un error', async () => {
      await ok200('createPages', {
        worldId,
        parentId: null,
        pages: [
          { key: 'v', title: 'El Villano' },
          { key: 't', title: 'Trama oculta' }
        ]
      })
      const trama = (await ok200('listPageTree', { worldId, levels: 2 })).pages.find(
        (p: { title: string }) => p.title === 'Trama oculta'
      ).id
      await ok200('createPage', { worldId, title: 'El Villano', parentId: trama })
      await grant()
      const written = await append('Creo que [[El Villano]] miente.')
      expect(written.statusCode).toBe(200)
      expect(written.body).not.toContain('Trama oculta')
      // El enlace queda sin resolver: con lo que escribió y sin la página (ni en el texto ni en sus enlaces)
      type Node = { type?: string; attrs?: Record<string, unknown>; content?: Node[] }
      const found: Node[] = []
      const walk = (node: Node) => {
        if (node.type === 'pageLink') found.push(node)
        for (const child of node.content ?? []) walk(child)
      }
      for (const block of (await ok200('getPageContent', { pageId: diary })).blocks as Node[]) walk(block)
      expect(found).toEqual([expect.objectContaining({ attrs: expect.objectContaining({ title: 'El Villano' }) })])
      expect(found[0]?.attrs?.pageId ?? null).toBeNull()
      const stored = await conn.db.select().from(schema.pageLinks)
      expect(stored.filter((link) => link.sourcePageId === diary).map((link) => link.targetPageId)).toEqual([null])
    })

    it('no se deja editar si el texto enlaza páginas que la campaña no conoce', async () => {
      const villain = (await ok200('createPage', { worldId, title: 'El Villano' })).id
      await ok200('editPage', { pageId: diary, body: { mode: 'append', markdown: `Ver [[El Villano]].` } })
      const refused = await call('setPageEditors', { worldId, campaignId: marca, pageId: diary, editors: 'all' })
      expect(refused.json().code).toBe('PAGE_HAS_HIDDEN_LINKS')
      await ok200('setKnowledge', { worldId, campaignId: marca, kind: 'page', targetId: villain, known: true })
      await grant()
    })

    it('si se le oculta la página, ya no la escribe; desde otra campaña suya, tampoco', async () => {
      await grant()
      await ok200('hide', { campaignId: marca, kind: 'page', targetId: diary })
      expect((await call('getPage', { pageId: diary }, ana.cookie)).statusCode).toBe(404)
      expect([403, 404]).toContain((await append('Día 4.')).statusCode)
      // Otra campaña de Ana que la conoce, sin permiso para editarla
      await ok200('setKnowledge', { worldId, campaignId: marca, kind: 'page', targetId: diary, known: true })
      const norte = (await ok200('listCampaigns', { worldId })).campaigns.find(
        (c: { name: string }) => c.name === 'Los del norte'
      ).id
      await join(norte, ana)
      await ok200('setKnowledge', { worldId, campaignId: norte, kind: 'page', targetId: diary, known: true })
      expect((await ok200('getPage', { pageId: diary, campaignId: marca }, ana.cookie)).editable).toBe(true)
      expect((await ok200('getPage', { pageId: diary, campaignId: norte }, ana.cookie)).editable).toBe(false)
    })

    it('una versión con secretos no vuelve a una página de jugadores', async () => {
      await ok200('editPage', {
        pageId: diary,
        body: { mode: 'append', markdown: '> [!secreto]\n> Algo del máster.' }
      })
      const versions = await ok200('listPageVersions', { pageId: diary })
      await ok200('editPage', { pageId: diary, body: { mode: 'replace', markdown: 'Limpio.' } })
      await grant()
      const withSecret = versions.versions[0]
      const restored = await call('restorePageVersion', { pageId: diary, versionId: withSecret.id })
      expect(restored.json().code).toBe('PLAYER_PAGE')
    })
  })
})
