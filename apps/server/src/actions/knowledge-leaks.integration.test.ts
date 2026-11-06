/**
 * Las fugas que encontró la revisión de `conocimiento` (2026-11-06), cada una con lo que debe pasar: lo de dentro de un
 * secreto revelado, los enlaces que salen, los campos ocultos en los filtros, el resolutor de nombres, las campañas de
 * cero, «lo mismo que otra», las marcas del mundo en pestañas y «ver como» en los mapas
 */
import { connect, loadMemberships, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { actorFrom } from '@crisol/domain'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import { errorText } from '../mcp/approvals.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'
import { implementationsByName } from './implementations.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

describe('las fugas de la revisión de conocimiento (ADR-0017)', () => {
  let conn: ReturnType<typeof connect>
  let auth: ReturnType<typeof createTestAuth>
  let app: ReturnType<typeof buildApp>
  let master: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let worldId: string
  let marca: string
  let norte: string
  let lia: string
  const page: Record<string, string> = {}

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
  const character = async (campaignId: string, ownerId: string, name: string) => {
    const [row] = await conn.db
      .insert(schema.characters)
      .values({ campaignId, ownerId, name, system: 'blank', build: {}, play: {} })
      .returning()
    return row?.id ?? ''
  }
  const mark = (input: object) =>
    ok200('setKnowledge', { worldId, campaignId: marca, kind: 'page', known: true, ...input })
  const secretsOf = async (pageId: string) => {
    const rows = await conn.db.select().from(schema.documents)
    return rows.filter((d) => d.pageId === pageId && d.kind === 'secret').map((d) => ({ id: d.id, text: d.text ?? '' }))
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_knowledge_leaks'), { max: 4 })
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
    await join(marca, ana)
    lia = await character(marca, ana.userId, 'Lía')
    const created = await ok200('createPages', {
      worldId,
      parentId: null,
      pages: [
        {
          key: 'aldoria',
          title: 'Aldoria',
          markdown: [
            'Un reino antiguo.',
            '',
            '> [!secreto]',
            '> El rey trata con [[Varn]] y guarda ![[Varn]] en su cámara.',
            '',
            '%%Su amante es [[Mira]]%%'
          ].join('\n')
        },
        { key: 'varn', title: 'Varn' },
        { key: 'mira', title: 'Mira' }
      ]
    })
    for (const p of created.pages as { title: string; id: string }[]) page[p.title] = p.id
    await mark({ targetId: page.Aldoria })
    await mark({ targetId: page.Mira })
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('un enlace a una página oculta dentro de un secreto revelado: como sin resolver, sin su id ni su título de ahora', async () => {
    const [secret] = await secretsOf(page.Aldoria ?? '')
    await mark({ kind: 'secret', targetId: secret?.id })
    await ok200('updatePage', { pageId: page.Varn, title: 'Varn el traidor' })
    const content = JSON.stringify((await ok200('getPageContent', { pageId: page.Aldoria }, ana.cookie)).blocks)
    const markdown = (await ok200('readPage', { pageId: page.Aldoria }, ana.cookie)).markdown
    expect(content).toContain('El rey trata con')
    expect(content).not.toContain(page.Varn)
    expect(content).not.toContain('traidor')
    expect(markdown).toContain('El rey trata con Varn')
    expect(markdown).not.toContain('traidor')
    expect(markdown).not.toContain('[[Varn')
  })

  it('los salientes de una página, sin los enlaces de sus notas ni de sus secretos sin revelar', async () => {
    const links = await ok200('getPageLinks', { pageId: page.Aldoria }, ana.cookie)
    expect(links.outgoing.map((l: { title: string }) => l.title)).not.toContain('Mira')
  })

  it('buscar por campo: solo entre lo que ve; lo oculto da lo mismo que lo que no existe', async () => {
    const plan = (await ok200('createPage', { worldId, title: 'El plan del rey', parentId: null })).id
    await ok200('setPageProperties', {
      pageId: plan,
      properties: [{ name: 'alias', type: 'list', value: ['Aldoria'] }]
    })
    const search = (pageName: string) =>
      call('searchWiki', { worldId, template: 'pnj', field: { name: 'Facción', page: pageName }, page: 1 }, ana.cookie)
    const ambiguous = await search('Aldoria')
    expect(ambiguous.statusCode).toBe(200)
    // Lo que le llega a su IA por el MCP (errorText de mcp/approvals.ts)
    const impl = implementationsByName.get('searchWiki')
    const ctx = {
      db: conn.db,
      actor: actorFrom(ana.userId, await loadMemberships(conn.db, ana.userId)),
      via: 'ai',
      tool: 'buscar_paginas',
      realtime: { publish() {} }
    }
    let text = ''
    try {
      await impl?.handler(ctx as never, {
        worldId,
        template: 'pnj',
        field: { name: 'Facción', page: 'Aldoria' },
        page: 1
      })
    } catch (error) {
      text = errorText(error)
    }
    expect(text).not.toContain('El plan del rey')
    expect(text).not.toContain(plan)
    const hidden = await search('Varn')
    const missing = await search('Nadie se llama así')
    expect(hidden.json().code).toBe(missing.json().code)
  })

  it('getMap lee como jugador: «ver como» no enseña los pines ocultos y una jugadora de dos campañas lo abre', async () => {
    const tab = await ok200('createPageTab', { pageId: page.Aldoria, kind: 'map', name: 'Mapa' })
    const map = await ok200('getMap', { tabId: tab.id })
    await ok200('createMapPin', { mapId: map.id, x: 0.3, y: 0.3, label: 'Cueva', hidden: true })
    const asCampaign = await ok200('getMap', { tabId: tab.id, campaignId: marca, asCharacterId: 'campaign' })
    expect(asCampaign.pins.map((p: { label: string }) => p.label)).not.toContain('Cueva')
    // Una jugadora de dos campañas del mundo no puede abrir el mapa ni diciendo desde cuál
    await join(norte, ana)
    const two = await call('getMap', { tabId: tab.id, campaignId: marca }, ana.cookie)
    expect(two.statusCode).toBe(200)
  })

  it('«lo mismo que otra»: la copia no sabe más que la original', async () => {
    // Todo el mundo conoce Varn; en La Marca, solo Lía
    await ok200('setKnowledge', { worldId, campaignId: null, kind: 'page', targetId: page.Varn, known: true })
    await mark({ targetId: page.Varn, characters: [lia] })
    const asMarca = await call('getPage', { pageId: page.Varn, campaignId: marca, asCharacterId: 'campaign' })
    expect(asMarca.statusCode).toBe(404)
    const copia = (
      await ok200('createCampaign', { worldId, name: 'Copia', knowledge: { start: 'campaign', campaignId: marca } })
    ).id
    const asCopia = await call('getPage', { pageId: page.Varn, campaignId: copia, asCharacterId: 'campaign' })
    expect(asCopia.statusCode).toBe(404)
  })
  it('un campo de enlace «Oculto» no llena la tabla del panel ni sale buscando por campo', async () => {
    const liga = (await ok200('createPage', { worldId, title: 'La liga', parentId: null, template: 'faccion' })).id
    await mark({ targetId: liga })
    const pnjs = await ok200('createPages', {
      worldId,
      parentId: null,
      pages: [{ key: 'a', title: 'Topo', template: 'pnj', markdown: `---\nFacción: "[[La liga]]"\n---\n` }]
    })
    const topo = pnjs.pages[0].id
    await mark({ targetId: topo })
    const full = await ok200('getPage', { pageId: topo })
    const properties = full.properties.map((p: { name: string }) => (p.name === 'Facción' ? { ...p, hidden: true } : p))
    await ok200('setPageProperties', { pageId: topo, properties })
    const seenTopo = await ok200('getPage', { pageId: topo }, ana.cookie)
    const tables = await ok200('getPageTables', { pageId: liga }, ana.cookie)
    expect(tables.tables[0].rows.map((r: { title: string }) => r.title)).not.toContain('Topo')
    const byField = await ok200(
      'searchWiki',
      { worldId, template: 'pnj', field: { name: 'Facción', page: 'La liga' }, page: 1 },
      ana.cookie
    )
    expect(byField.results.map((r: { title: string }) => r.title)).not.toContain('Topo')
  })

  it('unas etiquetas «Ocultas» no se encuentran buscando por etiqueta', async () => {
    await ok200('setPageProperties', {
      pageId: page.Mira,
      properties: [{ name: 'etiquetas', type: 'list', value: ['traidora'], hidden: true }]
    })
    const seen = await ok200('getPage', { pageId: page.Mira }, ana.cookie)
    expect(seen.properties).toEqual([])
    const found = await ok200('searchWiki', { worldId, tag: 'traidora', page: 1 }, ana.cookie)
    expect(found.results.map((r: { title: string }) => r.title)).not.toContain('Mira')
  })

  it('un alias «Oculto» no sale en «Mencionado en»', async () => {
    await ok200('setPageProperties', {
      pageId: page.Mira,
      properties: [{ name: 'alias', type: 'list', value: ['la Viuda Negra'], hidden: true }]
    })
    await ok200('editPage', {
      pageId: page.Aldoria,
      body: { mode: 'append', markdown: 'Dicen que la Viuda Negra ronda el puerto.' }
    })
    const links = await ok200('getPageLinks', { pageId: page.Mira }, ana.cookie)
    expect(links.mentions.map((m: { title: string }) => m.title)).not.toContain('Aldoria')
  })
  it('una campaña que empezó de cero tampoco ve la subpágina nueva que «nace oculta»', async () => {
    const bruno = await signUpTestUser(auth, { name: 'Bruno', email: 'bruno@crisol.test' })
    await join(norte, bruno)
    await ok200('updateCampaign', { campaignId: norte, knowsWorld: false })
    await ok200('setKnowledge', { worldId, campaignId: norte, kind: 'page', targetId: page.Aldoria, known: true })
    const plan = (await ok200('createPage', { worldId, title: 'El plan secreto del rey', parentId: page.Aldoria })).id
    const known = await ok200('getPageKnowledge', { pageId: plan })
    const seen = await call('getPage', { pageId: plan }, bruno.cookie)
    expect(seen.statusCode).toBe(404)
  })

  it('una marca del mundo en una pestaña cuenta', async () => {
    const tab = await ok200('createPageTab', { pageId: page.Aldoria, kind: 'text', name: 'Diario del rey' })
    await ok200('setKnowledge', { worldId, campaignId: null, kind: 'tab', targetId: tab.id, known: false })
    const tabs = await ok200('listPageTabs', { pageId: page.Aldoria }, ana.cookie)
    expect(tabs.tabs.map((t: { name: string }) => t.name)).not.toContain('Diario del rey')
  })

  it('la copia de una campaña de cero también empieza de cero', async () => {
    await ok200('updateCampaign', { campaignId: marca, knowsWorld: false })
    const copia = (
      await ok200('createCampaign', { worldId, name: 'Copia', knowledge: { start: 'campaign', campaignId: marca } })
    ).id
    const campaigns = (await ok200('getPageKnowledge', { pageId: page.Varn })).campaigns
    expect(campaigns.find((c: { campaignId: string }) => c.campaignId === copia).knowsWorld).toBe(false)
  })
})
