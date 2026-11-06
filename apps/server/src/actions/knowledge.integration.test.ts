import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

describe('lo que sabe cada campaña (docs/specs/conocimiento.md)', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let master: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let bruno: { userId: string; cookie: string }
  let worldId: string
  let marca: string
  let norte: string
  let lia: string
  let bram: string
  const page: Record<string, string> = {}

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
  const join = async (campaignId: string, who: { cookie: string }) => {
    const url = (await ok200('getInvitation', { campaignId })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: who.cookie }
    })
  }
  const character = async (campaignId: string, ownerId: string, name: string) => {
    const [row] = await conn.db
      .insert(schema.characters)
      .values({ campaignId, ownerId, name, system: 'blank', build: {}, play: {} })
      .returning()
    return row?.id ?? ''
  }
  const mark = (input: object) =>
    ok200('setKnowledge', { worldId, campaignId: marca, kind: 'page', known: true, ...input })

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_knowledge'), { max: 4 })
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
    norte = (await ok200('createCampaign', { worldId, name: 'Los del norte' })).id
    ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    bruno = await signUpTestUser(auth, { name: 'Bruno', email: 'bruno@crisol.test' })
    await join(marca, ana)
    await join(norte, bruno)
    lia = await character(marca, ana.userId, 'Lía')
    bram = await character(marca, master.userId, 'Bram')
    page.sur = (await ok200('createPage', { worldId, title: 'Reinos del sur', parentId: null })).id
    page.aldoria = (await ok200('createPage', { worldId, title: 'Aldoria', parentId: page.sur })).id
    page.capital = (await ok200('createPage', { worldId, title: 'La capital', parentId: page.aldoria })).id
    page.varn = (await ok200('createPage', { worldId, title: 'Varn', parentId: null })).id
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('sin marcas, ninguna campaña conoce nada', async () => {
    const known = await ok200('getPageKnowledge', { pageId: page.capital })
    expect(known.world).toEqual({ own: null, known: false, from: null })
    expect(known.campaigns).toEqual([
      expect.objectContaining({ name: 'La Marca', audience: 'none', from: null, own: null, knowsWorld: true }),
      expect.objectContaining({ name: 'Los del norte', audience: 'none', from: null })
    ])
    expect(known.campaigns[0].characters).toEqual([
      { id: lia, name: 'Lía' },
      { id: bram, name: 'Bram' }
    ])
  })

  it('dar a conocer una página a una campaña: sus subpáginas lo heredan, y se dice de dónde', async () => {
    const result = await mark({ targetId: page.aldoria })
    expect(result.page.campaigns[0]).toMatchObject({
      audience: 'all',
      own: { known: true, characters: null },
      from: { pageId: page.aldoria, title: 'Aldoria', layer: 'campaign' }
    })
    const capital = await ok200('getPageKnowledge', { pageId: page.capital })
    expect(capital.campaigns.map((c: { audience: unknown }) => c.audience)).toEqual(['all', 'none'])
    expect(capital.campaigns[0].from).toEqual({ pageId: page.aldoria, title: 'Aldoria', layer: 'campaign' })
  })

  it('a unos personajes, con sus nombres; los de otra campaña no valen', async () => {
    const result = await mark({ targetId: page.varn, characters: [lia] })
    expect(result.page.campaigns[0].audience).toEqual([{ id: lia, name: 'Lía' }])
    const other = await character(norte, bruno.userId, 'Sela')
    expect(
      await code('setKnowledge', {
        worldId,
        campaignId: marca,
        kind: 'page',
        targetId: page.varn,
        known: true,
        characters: [other]
      })
    ).toEqual({
      status: 400,
      code: 'BAD_CHARACTERS'
    })
    expect(
      await code('setKnowledge', {
        worldId,
        campaignId: null,
        kind: 'page',
        targetId: page.varn,
        known: true,
        characters: [lia]
      })
    ).toEqual({ status: 400, code: 'CHARACTERS_NEED_CAMPAIGN' })
  })

  it('lo que sabe el mundo lo saben las campañas que parten de él', async () => {
    await mark({ campaignId: null, targetId: page.sur })
    await ok200('updateCampaign', { campaignId: norte, knowsWorld: false })
    const known = await ok200('getPageKnowledge', { pageId: page.aldoria })
    expect(known.world).toEqual({
      own: null,
      known: true,
      from: { pageId: page.sur, title: 'Reinos del sur', layer: 'world' }
    })
    expect(known.campaigns.map((c: { audience: unknown; knowsWorld: boolean }) => [c.audience, c.knowsWorld])).toEqual([
      ['all', true],
      ['none', false]
    ])
  })

  it('quitar la marca vuelve a heredar; marcar se deshace', async () => {
    await mark({ targetId: page.aldoria })
    await mark({ targetId: page.aldoria, known: null })
    expect((await ok200('getPageKnowledge', { pageId: page.aldoria })).campaigns[0].audience).toBe('none')
    await mark({ targetId: page.capital })
    const history = await ok200('listHistory', { worldId })
    const set = history.entries.find((op: { action: string }) => op.action === 'setKnowledge')
    expect(set.details).toMatchObject({ kind: 'page', name: 'La capital', campaign: 'La Marca', known: true })
    await ok200('undoOperation', { operationId: set.id })
    expect((await ok200('getPageKnowledge', { pageId: page.capital })).campaigns[0].audience).toBe('none')
  })

  it('solo quien lleva la wiki marca y ve quién conoce: para un jugador, no existe', async () => {
    expect(await code('getPageKnowledge', { pageId: page.aldoria }, ana.cookie)).toMatchObject({ status: 404 })
    expect(
      await code(
        'setKnowledge',
        { worldId, campaignId: marca, kind: 'page', targetId: page.aldoria, known: true },
        ana.cookie
      )
    ).toMatchObject({ status: 404 })
  })

  it('lo que se marca y la campaña, de este mundo', async () => {
    const otherWorld = (await ok200('createWorld', { name: 'Otro' })).id
    const foreign = (await ok200('createPage', { worldId: otherWorld, title: 'Ajena', parentId: null })).id
    expect(
      await code('setKnowledge', { worldId, campaignId: marca, kind: 'page', targetId: foreign, known: true })
    ).toMatchObject({
      status: 404
    })
    const otherCampaign = (await ok200('createCampaign', { worldId: otherWorld, name: 'Fuera' })).id
    expect(
      await code('setKnowledge', { worldId, campaignId: otherCampaign, kind: 'page', targetId: page.varn, known: true })
    ).toMatchObject({ status: 404 })
    expect(
      await code('setKnowledge', { worldId, campaignId: marca, kind: 'page', targetId: 'nada', known: true })
    ).toMatchObject({
      status: 404
    })
  })

  it('una campaña nueva empieza con lo del mundo, de cero o con lo de otra', async () => {
    await mark({ targetId: page.aldoria })
    await mark({ targetId: page.varn, characters: [lia] })
    await mark({ campaignId: null, targetId: page.sur })
    const copy = (
      await ok200('createCampaign', { worldId, name: 'Copia', knowledge: { start: 'campaign', campaignId: marca } })
    ).id
    const fresh = await ok200('createCampaign', { worldId, name: 'De cero', knowledge: { start: 'none' } })
    expect(fresh.knowsWorld).toBe(false)
    const aldoria = await ok200('getPageKnowledge', { pageId: page.aldoria })
    const byName = (name: string) => aldoria.campaigns.find((c: { name: string }) => c.name === name)
    expect(byName('Copia')).toMatchObject({ audience: 'all', from: { layer: 'campaign' } })
    expect(byName('De cero')).toMatchObject({ audience: 'none' })
    // Lo de los personajes de la otra no pasa
    const varn = await ok200('getPageKnowledge', { pageId: page.varn })
    expect(varn.campaigns.find((c: { campaignId: string }) => c.campaignId === copy).audience).toBe('none')
    const otherWorld = (await ok200('createWorld', { name: 'Otro' })).id
    expect(
      await code('createCampaign', {
        worldId: otherWorld,
        name: 'X',
        knowledge: { start: 'campaign', campaignId: marca }
      })
    ).toEqual({ status: 400, code: 'BAD_KNOWLEDGE_CAMPAIGN' })
  })

  it('una subpágina nueva bajo una página que alguna campaña conoce nace oculta; bajo una desconocida, hereda', async () => {
    await mark({ targetId: page.aldoria })
    const plan = (await ok200('createPage', { worldId, title: 'El plan del rey', parentId: page.aldoria })).id
    const known = await ok200('getPageKnowledge', { pageId: plan })
    expect(known.world.own).toBe(false)
    expect(known.campaigns[0]).toMatchObject({ audience: 'none', from: { pageId: plan, layer: 'world' } })
    const batch = await ok200('createPages', {
      worldId,
      parentId: page.capital,
      pages: [
        { key: 'a', title: 'Barrio' },
        { key: 'b', title: 'Taberna', parent: 'a' }
      ]
    })
    const barrio = batch.pages.find((p: { title: string }) => p.title === 'Barrio').id
    const taberna = batch.pages.find((p: { title: string }) => p.title === 'Taberna').id
    expect((await ok200('getPageKnowledge', { pageId: barrio })).world.own).toBe(false)
    expect((await ok200('getPageKnowledge', { pageId: taberna })).world.own).toBeNull()
    const free = (await ok200('createPage', { worldId, title: 'Libre', parentId: page.varn })).id
    expect((await ok200('getPageKnowledge', { pageId: free })).world.own).toBeNull()
  })
})

describe('lo que lee un jugador (docs/specs/conocimiento.md)', () => {
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
  const page: Record<string, string> = {}

  const call = (name: string, payload: object, cookie = master.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const status = async (name: string, payload: object, cookie = master.cookie) =>
    (await call(name, payload, cookie)).statusCode
  const join = async (campaignId: string, who: { cookie: string }) => {
    const url = (await ok200('getInvitation', { campaignId })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: who.cookie }
    })
  }
  const character = async (campaignId: string, ownerId: string, name: string) => {
    const [row] = await conn.db
      .insert(schema.characters)
      .values({ campaignId, ownerId, name, system: 'blank', build: {}, play: {} })
      .returning()
    return row?.id ?? ''
  }
  const mark = (input: object) =>
    ok200('setKnowledge', { worldId, campaignId: marca, kind: 'page', known: true, ...input })
  /** Los documentos de los secretos de una página, en el orden en que se escribieron */
  const secretsOf = async (pageId: string) => {
    const rows = await conn.db.select().from(schema.documents)
    return rows.filter((d) => d.pageId === pageId && d.kind === 'secret').map((d) => ({ id: d.id, text: d.text ?? '' }))
  }
  const titles = (pages: { title: string }[]) => pages.map((p) => p.title)

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_knowledge_read'), { max: 4 })
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
    await join(marca, ana)
    await join(norte, bruno)
    lia = await character(marca, ana.userId, 'Lía')
    bram = await character(marca, master.userId, 'Bram')
    const created = await ok200('createPages', {
      worldId,
      parentId: null,
      pages: [
        { key: 'sur', title: 'Reinos del sur' },
        {
          key: 'aldoria',
          title: 'Aldoria',
          parent: 'sur',
          markdown: [
            'La capital es [[La capital]]; al norte vive [[Varn]] y más allá [[Varn|el viejo]].',
            '',
            '> [!secreto]',
            '> El rey ha muerto.',
            '',
            '> [!secreto]',
            '> Bram es el heredero.',
            '',
            '%%Nota para mí%%'
          ].join('\n')
        },
        { key: 'capital', title: 'La capital', parent: 'aldoria' },
        { key: 'varn', title: 'Varn' }
      ]
    })
    for (const p of created.pages as { title: string; id: string }[]) page[p.title] = p.id
    await mark({ targetId: page.Aldoria })
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('el árbol: lo que ve, colgando de la primera antecesora que ve; el de otra campaña, nada', async () => {
    const tree = await ok200('listPageTree', { worldId, levels: 6 }, ana.cookie)
    expect(
      tree.pages.map((p: { title: string; level: number; parentId: string | null }) => [p.title, p.level, p.parentId])
    ).toEqual([
      ['Aldoria', 1, null],
      ['La capital', 2, page.Aldoria]
    ])
    expect(titles((await ok200('listPageChildren', { worldId, parentId: null }, ana.cookie)).pages)).toEqual([
      'Aldoria'
    ])
    expect((await ok200('listPageTree', { worldId }, bruno.cookie)).pages).toEqual([])
    expect(await status('listPageChildren', { worldId, parentId: page['Reinos del sur'] }, ana.cookie)).toBe(404)
    // El máster, todo
    expect((await ok200('listPageTree', { worldId, levels: 6 })).pages).toHaveLength(4)
  })

  it('la página: la que no ve no existe; la que ve, con su ruta visible y sin lo oculto', async () => {
    expect(await status('getPage', { pageId: page.Varn }, ana.cookie)).toBe(404)
    expect(await status('getPage', { pageId: page.Aldoria }, bruno.cookie)).toBe(404)
    await ok200('setPageProperties', {
      pageId: page.Aldoria,
      properties: [
        { name: 'Capital', type: 'text', value: 'Vel' },
        { name: 'Lealtad real', type: 'text', value: 'Varn', hidden: true },
        { name: 'Aliados', type: 'pages', value: [page['La capital'], page.Varn] }
      ]
    })
    await ok200('setPagePanel', {
      pageId: page.Aldoria,
      blocks: [
        { id: 'abcdef', type: 'text', title: 'Clima', text: 'Templado' },
        { id: 'ghijkl', type: 'text', title: 'Plan', text: 'Invadir el norte', hidden: true }
      ]
    })
    const seen = await ok200('getPage', { pageId: page['La capital'] }, ana.cookie)
    expect(seen.path.map((p: { title: string }) => p.title)).toEqual(['Aldoria', 'La capital'])
    expect(seen.parentId).toBe(page.Aldoria)
    const aldoria = await ok200('getPage', { pageId: page.Aldoria }, ana.cookie)
    expect(aldoria.parentId).toBeNull()
    expect(aldoria.hasChildren).toBe(true)
    expect(aldoria.properties).toEqual([
      { name: 'Capital', type: 'text', value: 'Vel' },
      { name: 'Aliados', type: 'pages', value: [page['La capital']] }
    ])
    expect(aldoria.panel.map((b: { title: string }) => b.title)).toEqual(['Clima'])
    // El máster, todo
    const full = await ok200('getPage', { pageId: page.Aldoria })
    expect(full.properties).toHaveLength(3)
    expect(full.panel).toHaveLength(2)
  })

  it('el cuerpo: sin los secretos que no ve ni las notas; los enlaces a lo que no ve, sin destino ni título', async () => {
    const content = await ok200('getPageContent', { pageId: page.Aldoria }, ana.cookie)
    const text = JSON.stringify(content.blocks)
    expect(text).not.toContain('El rey ha muerto')
    expect(text).not.toContain('Nota para mí')
    expect(text).not.toContain(page.Varn)
    expect(text).not.toContain('"title":"Varn"')
    const links = content.blocks[0].content.filter((n: { type: string }) => n.type === 'pageLink')
    expect(links.map((l: { attrs: object }) => l.attrs)).toEqual([
      expect.objectContaining({ pageId: page['La capital'], title: 'La capital' }),
      { pageId: null, title: '', anchor: null, label: null },
      { pageId: null, title: '', anchor: null, label: 'el viejo' }
    ])
    // Revelado a Lía, lo ve su dueña; a Bram, no
    const [rey, heredero] = await secretsOf(page.Aldoria ?? '')
    await mark({ kind: 'secret', targetId: rey?.id, characters: [lia] })
    await mark({ kind: 'secret', targetId: heredero?.id, characters: [bram] })
    const after = JSON.stringify((await ok200('getPageContent', { pageId: page.Aldoria }, ana.cookie)).blocks)
    expect(after).toContain('El rey ha muerto')
    expect(after).not.toContain('Bram es el heredero')
    // El máster lo ve todo
    const full = JSON.stringify((await ok200('getPageContent', { pageId: page.Aldoria })).blocks)
    expect(full).toContain('Bram es el heredero')
    expect(full).toContain('Nota para mí')
  })

  it('en Markdown (su IA), igual: los enlaces a lo que no ve, como su texto o «desconocido»', async () => {
    const read = await ok200('readPage', { pageId: page.Aldoria }, ana.cookie)
    expect(read.markdown).toContain('[[La capital]]')
    expect(read.markdown).toContain('al norte vive desconocido y más allá el viejo')
    expect(read.markdown).not.toContain('Varn')
    expect(read.markdown).not.toContain('secreto')
    expect(read.markdown).not.toContain('Nota')
  })

  it('las recientes, solo las que ve, con su ruta visible', async () => {
    const recent = await ok200('listRecentPages', { worldId, limit: 10 }, ana.cookie)
    expect(recent.pages.map((p: { title: string }) => p.title).sort()).toEqual(['Aldoria', 'La capital'])
    expect(
      recent.pages.find((p: { title: string }) => p.title === 'La capital').path.map((p: { title: string }) => p.title)
    ).toEqual(['Aldoria'])
  })

  it('las tablas del panel, solo con las páginas que ve', async () => {
    const liga = (await ok200('createPage', { worldId, title: 'La liga', parentId: page.Aldoria, template: 'faccion' }))
      .id
    await mark({ targetId: liga })
    const pnjs = await ok200('createPages', {
      worldId,
      parentId: liga,
      pages: [
        { key: 'a', title: 'Mira', template: 'pnj', markdown: `---\nFacción: "[[La liga]]"\n---\n` },
        { key: 'b', title: 'Topo', template: 'pnj', markdown: `---\nFacción: "[[La liga]]"\n---\n` }
      ]
    })
    const mira = pnjs.pages.find((p: { title: string }) => p.title === 'Mira').id
    await mark({ targetId: mira })
    const tables = await ok200('getPageTables', { pageId: liga }, ana.cookie)
    expect(tables.tables[0].rows.map((r: { title: string }) => r.title)).toEqual(['Mira'])
    expect((await ok200('getPageTables', { pageId: liga })).tables[0].rows).toHaveLength(2)
  })

  it('ver como un personaje: el máster lee lo que lee su dueño', async () => {
    const [rey] = await secretsOf(page.Aldoria ?? '')
    await mark({ kind: 'secret', targetId: rey?.id, characters: [lia] })
    const asLia = await ok200('getPageContent', { pageId: page.Aldoria, campaignId: marca, asCharacterId: lia })
    expect(JSON.stringify(asLia.blocks)).toContain('El rey ha muerto')
    const asCampaign = await ok200('getPageContent', {
      pageId: page.Aldoria,
      campaignId: marca,
      asCharacterId: 'campaign'
    })
    expect(JSON.stringify(asCampaign.blocks)).not.toContain('El rey ha muerto')
    expect(await status('getPage', { pageId: page.Varn, campaignId: marca, asCharacterId: lia })).toBe(404)
    // Un jugador no puede ver como otro
    expect(await status('getPage', { pageId: page.Aldoria, campaignId: marca, asCharacterId: bram }, ana.cookie)).toBe(
      200
    )
    const asBram = await ok200(
      'getPageContent',
      { pageId: page.Aldoria, campaignId: marca, asCharacterId: bram },
      ana.cookie
    )
    expect(JSON.stringify(asBram.blocks)).toContain('El rey ha muerto')
  })
})
