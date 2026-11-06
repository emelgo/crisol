import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

describe('revelar en partida (docs/specs/revelar.md)', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let master: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let bruno: { userId: string; cookie: string }
  let worldId: string
  let marca: string
  let lia: string
  let bram: string
  let aldoria: string
  let varn: string
  let secrets: { id: string; text: string }[]

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
  const content = async (cookie: string) =>
    JSON.stringify((await ok200('getPageContent', { pageId: aldoria }, cookie)).blocks)
  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_reveal'), { max: 4 })
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
    ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    bruno = await signUpTestUser(auth, { name: 'Bruno', email: 'bruno@crisol.test' })
    await join(marca, ana)
    await join(marca, bruno)
    const [row] = await conn.db
      .insert(schema.characters)
      .values({ campaignId: marca, ownerId: ana.userId, name: 'Lía', system: 'blank', build: {}, play: {} })
      .returning()
    lia = row?.id ?? ''
    const [other] = await conn.db
      .insert(schema.characters)
      .values({ campaignId: marca, ownerId: bruno.userId, name: 'Bram', system: 'blank', build: {}, play: {} })
      .returning()
    bram = other?.id ?? ''
    const created = await ok200('createPages', {
      worldId,
      parentId: null,
      pages: [
        {
          key: 'a',
          title: 'Aldoria',
          markdown: ['Un reino.', '', '## El pacto de Varn', '', '> [!secreto]', '> Varn vendió el paso.'].join('\n')
        },
        { key: 'v', title: 'Varn' }
      ]
    })
    aldoria = created.pages.find((p: { title: string }) => p.title === 'Aldoria').id
    varn = created.pages.find((p: { title: string }) => p.title === 'Varn').id
    secrets = (await conn.db.select().from(schema.documents))
      .filter((d) => d.pageId === aldoria && d.kind === 'secret')
      .map((d) => ({ id: d.id, text: d.text ?? '' }))
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('revelar un secreto a Lía con su página: lo ve su dueña, le llega lo nuevo y nadie más lo ve', async () => {
    const secret = secrets[0]?.id ?? ''
    const result = await ok200('reveal', {
      worldId,
      kind: 'secret',
      targetId: secret,
      characters: [lia],
      alsoPage: true
    })
    expect(result).toEqual({ told: 1, pageUnknown: false })
    expect(await content(ana.cookie)).toContain('Varn vendió el paso')
    expect((await call('getPageContent', { pageId: aldoria }, bruno.cookie)).statusCode).toBe(404)
    // Lo nuevo de Ana: el secreto, en Aldoria
    const news = await ok200('listNews', { campaignId: marca }, ana.cookie)
    expect(news.news).toEqual([expect.objectContaining({ kind: 'secret', targetId: secret, pageId: aldoria })])
    expect((await ok200('listNews', { campaignId: marca }, bruno.cookie)).news).toEqual([])
    // Al abrir la página deja de ser nuevo
    await ok200('seeNews', { campaignId: marca, pageId: aldoria }, ana.cookie)
    expect((await ok200('listNews', { campaignId: marca }, ana.cookie)).news).toEqual([])
    // En el historial, una sola operación con su frase
    const history = await ok200('listHistory', { worldId })
    expect(history.entries[0]).toMatchObject({
      action: 'reveal',
      details: { kind: 'secret', name: 'Aldoria', campaign: 'La Marca', characters: ['Lía'], page: 'Aldoria' }
    })
  })

  it('sin la página: no lo verán hasta conocerla (y lo dice)', async () => {
    const result = await ok200('reveal', { worldId, kind: 'secret', targetId: secrets[0]?.id })
    expect(result).toEqual({ told: 0, pageUnknown: true })
    await ok200('reveal', { worldId, kind: 'page', targetId: aldoria })
    expect(await content(bruno.cookie)).toContain('Varn vendió el paso')
  })

  it('a quién le aparece y «Lo que sabe el grupo», con el título de la sección del secreto', async () => {
    await ok200('reveal', { worldId, kind: 'page', targetId: aldoria })
    const result = await ok200('reveal', { worldId, kind: 'secret', targetId: secrets[0]?.id, characters: [lia] })
    expect(result.told).toBe(1)
    const known = await ok200('listCampaignKnowledge', { campaignId: marca })
    expect(
      known.campaign.map((k: { kind: string; name: string; audience: unknown }) => [k.kind, k.name, k.audience])
    ).toEqual([
      ['secret', 'El pacto de Varn', [{ id: lia, name: 'Lía' }]],
      ['page', 'Aldoria', 'all']
    ])
  })

  it('ocultar otra vez: se le va al momento, lo nuevo también, y queda en el historial', async () => {
    await ok200('reveal', { worldId, kind: 'page', targetId: aldoria })
    await ok200('reveal', { worldId, kind: 'secret', targetId: secrets[0]?.id })
    await ok200('hide', { campaignId: marca, kind: 'secret', targetId: secrets[0]?.id })
    expect(await content(ana.cookie)).not.toContain('Varn vendió el paso')
    expect(
      (await ok200('listNews', { campaignId: marca }, ana.cookie)).news.map((n: { kind: string }) => n.kind)
    ).toEqual(['page'])
    // Una página que sabe el mundo: ocultarla deja «no la conocen»
    await ok200('setKnowledge', { worldId, campaignId: null, kind: 'page', targetId: varn, known: true })
    await ok200('hide', { campaignId: marca, kind: 'page', targetId: varn })
    expect((await call('getPage', { pageId: varn }, ana.cookie)).statusCode).toBe(404)
    const history = await ok200('listHistory', { worldId })
    expect(history.entries[0]).toMatchObject({ action: 'hideKnowledge', details: { kind: 'page', name: 'Varn' } })
  })

  it('deshacer una revelación: deja de verlo y deja de ser nuevo', async () => {
    await ok200('reveal', { worldId, kind: 'page', targetId: aldoria })
    const history = await ok200('listHistory', { worldId })
    await ok200('undoOperation', { operationId: history.entries[0].id })
    expect((await call('getPage', { pageId: aldoria }, ana.cookie)).statusCode).toBe(404)
    expect((await ok200('listNews', { campaignId: marca }, ana.cookie)).news).toEqual([])
  })

  it('quién conoce cada secreto, para su cabecera; los jugadores no lo piden', async () => {
    await ok200('reveal', { worldId, kind: 'secret', targetId: secrets[0]?.id, characters: [lia], alsoPage: true })
    const known = await ok200('getSecretsKnowledge', { pageId: aldoria })
    expect(known.secrets).toEqual([
      { documentId: secrets[0]?.id, campaigns: [{ campaignId: marca, audience: [{ id: lia, name: 'Lía' }] }] }
    ])
    expect(known.campaigns[0]).toMatchObject({ name: 'La Marca', seesPage: [{ id: lia, name: 'Lía' }] })
    for (const [name, data] of [
      ['getSecretsKnowledge', { pageId: aldoria }],
      ['listCampaignKnowledge', { campaignId: marca }],
      ['reveal', { worldId, kind: 'page', targetId: varn }],
      ['hide', { campaignId: marca, kind: 'page', targetId: aldoria }]
    ] as const) {
      expect((await call(name, data, ana.cookie)).statusCode, name).toBe(404)
    }
  })

  it('con varias campañas en el mundo hay que decir cuál', async () => {
    await ok200('createCampaign', { worldId, name: 'Los del norte' })
    const response = await call('reveal', { worldId, kind: 'page', targetId: aldoria })
    expect(response.statusCode).toBe(400)
    expect(response.json().code).toBe('CAMPAIGN_REQUIRED')
  })
  describe('revelar solo suma: no le quita nada a nadie', () => {
    const sees = async (pageId: string, cookie: string) =>
      (await call('getPage', { pageId }, cookie)).statusCode === 200
    const secret = () => secrets[0]?.id ?? ''

    it('a Lía, una página que ya sabía toda la campaña: Bruno la sigue viendo y no se escribe nada', async () => {
      await ok200('reveal', { worldId, kind: 'page', targetId: aldoria })
      const again = await ok200('reveal', { worldId, kind: 'page', targetId: aldoria, characters: [lia] })
      expect(again).toEqual({ told: 0, pageUnknown: false })
      expect(await sees(aldoria, bruno.cookie)).toBe(true)
      const marks = await conn.db.select().from(schema.knowledge)
      expect(marks.filter((m) => m.campaignId === marca && m.targetId === aldoria)).toEqual([
        expect.objectContaining({ known: true, characters: null })
      ])
    })

    it('a Lía, una subpágina que la campaña sabía por su madre: Bruno la sigue viendo', async () => {
      const child = (await ok200('createPage', { worldId, title: 'Puerto', parentId: aldoria })).id
      await ok200('reveal', { worldId, kind: 'page', targetId: aldoria })
      await ok200('reveal', { worldId, kind: 'page', targetId: child, characters: [lia] })
      expect(await sees(child, bruno.cookie)).toBe(true)
    })

    it('un secreto de Lía, revelado también a Bram: lo ven los dos', async () => {
      await ok200('reveal', { worldId, kind: 'page', targetId: aldoria })
      await ok200('reveal', { worldId, kind: 'secret', targetId: secret(), characters: [lia] })
      await ok200('reveal', { worldId, kind: 'secret', targetId: secret(), characters: [bram] })
      expect(await content(ana.cookie)).toContain('Varn vendió')
      expect(await content(bruno.cookie)).toContain('Varn vendió')
    })

    it('con la página, cuando la sabía Lía y el secreto es para Bram: Lía no pierde la página', async () => {
      await ok200('reveal', { worldId, kind: 'page', targetId: aldoria, characters: [lia] })
      const result = await ok200('reveal', {
        worldId,
        kind: 'secret',
        targetId: secret(),
        characters: [bram],
        alsoPage: true
      })
      expect(result.pageUnknown).toBe(false)
      expect(await sees(aldoria, ana.cookie)).toBe(true)
      expect(await sees(aldoria, bruno.cookie)).toBe(true)
      expect(await content(bruno.cookie)).toContain('Varn vendió')
      expect(await content(ana.cookie)).not.toContain('Varn vendió')
    })

    it('si alguno de los elegidos no sabe la página, lo dice', async () => {
      await ok200('reveal', { worldId, kind: 'page', targetId: aldoria, characters: [lia] })
      const result = await ok200('reveal', { worldId, kind: 'secret', targetId: secret(), characters: [lia, bram] })
      expect(result.pageUnknown).toBe(true)
      // Bruno no sabe la página: ni la ve (ni el secreto); Lía sí
      expect(await sees(aldoria, bruno.cookie)).toBe(false)
      expect(await content(ana.cookie)).toContain('Varn vendió')
      expect((await ok200('reveal', { worldId, kind: 'secret', targetId: secret() })).pageUnknown).toBe(true)
    })

    it('un secreto solo de Lía en una página de los dos: a Bruno no le llega por ningún lado', async () => {
      await ok200('reveal', { worldId, kind: 'page', targetId: aldoria })
      await ok200('reveal', { worldId, kind: 'secret', targetId: secret(), characters: [lia] })
      expect(await content(ana.cookie)).toContain('Varn vendió')
      expect(await content(bruno.cookie)).not.toContain('Varn vendió')
      expect(JSON.stringify(await ok200('readPage', { pageId: aldoria }, bruno.cookie))).not.toContain('Varn vendió')
      const searched = await ok200('searchWiki', { worldId, query: 'vendió', page: 1 }, bruno.cookie)
      expect(JSON.stringify(searched)).not.toContain('vendió')
      const hers = await ok200('searchWiki', { worldId, query: 'vendió', page: 1 }, ana.cookie)
      expect(JSON.stringify(hers)).toContain('vendió')
      const news = await ok200('listNews', { campaignId: marca }, bruno.cookie)
      expect(news.news.map((n: { kind: string }) => n.kind)).toEqual(['page'])
    })
  })
})
