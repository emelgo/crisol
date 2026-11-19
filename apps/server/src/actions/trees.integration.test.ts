/**
 * Los árboles genealógicos y los organigramas (la pestaña tree; bloque B de los ajustes tras los módulos 8 a 10):
 * crearlos (como pestaña o en una página nueva), cambiarlos enteros con lo que no vale dicho, convertir un nodo suelto
 * en página, sus líneas como relaciones del grafo, copiarlos con su página, deshacer y lo que ve una jugadora (ADR-0017:
 * la pestaña si la ve; los nodos de páginas que conoce y los sueltos; nada de lo demás, ni en el grafo)
 */
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { desc, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

type Node = { id: string; pageId: string | null; name: string; note?: string }

describe('los árboles genealógicos y los organigramas', () => {
  let conn: ReturnType<typeof connect>
  let auth: ReturnType<typeof createTestAuth>
  let app: ReturnType<typeof buildApp>
  let master: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let worldId: string
  let marca: string

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
    return response.json()
  }
  const undo = async (action: string) => {
    const [op] = await conn.db
      .select()
      .from(schema.operations)
      .where(eq(schema.operations.action, action))
      .orderBy(desc(schema.operations.createdAt))
    expect((await ok200('undoOperation', { operationId: op?.id })).status).toBe('undone')
  }
  const newPage = async (title: string, parentId: string | null = null) =>
    (await ok200('createPage', { worldId, title, parentId })).id as string
  const knows = (pageId: string) =>
    ok200('setKnowledge', { worldId, campaignId: marca, kind: 'page', targetId: pageId, known: true })

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_trees'), { max: 4 })
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
    const url = (await ok200('getInvitation', { campaignId: marca })).url as string
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

  it('una pestaña de árbol: nace vacía; se cambia entera y lo que no vale se dice', async () => {
    const varn = await newPage('Casa de Varn')
    const ilsa = await newPage('Ilsa de Varn')
    const tab = await ok200('createPageTab', { pageId: varn, kind: 'tree' })
    expect(tab).toMatchObject({ kind: 'tree', name: 'Árbol' })
    expect(await ok200('getTree', { tabId: tab.id })).toMatchObject({ nodes: [], edges: [] })
    // Uno solo: el segundo, «Árbol 2» (un organigrama es otro árbol)
    expect((await ok200('createPageTab', { pageId: varn, kind: 'tree' })).name).toBe('Árbol 2')

    const saved = await ok200('updateTree', {
      tabId: tab.id,
      nodes: [
        { id: 'mira', name: 'Mira de Varn', note: '1190 – 1247' },
        { id: 'ilsa', pageId: ilsa }
      ],
      edges: [{ from: 'mira', to: 'ilsa', type: 'parent' }]
    })
    // Con página, se lee el título de la página
    expect(saved.nodes).toEqual([
      { id: 'mira', pageId: null, name: 'Mira de Varn', note: '1190 – 1247', icon: null, template: null },
      { id: 'ilsa', pageId: ilsa, name: 'Ilsa de Varn', icon: null, template: null }
    ])
    // Lo que no vale: una línea a un nodo que no está, alguien antepasado de sí mismo, una página de otro mundo o un
    // nodo sin nombre ni página
    await fails('updateTree', { tabId: tab.id, edges: [{ from: 'mira', to: 'nadie', type: 'parent' }] }, 'BAD_TREE')
    await fails(
      'updateTree',
      {
        tabId: tab.id,
        edges: [
          { from: 'mira', to: 'ilsa', type: 'parent' },
          { from: 'ilsa', to: 'mira', type: 'parent' }
        ]
      },
      'BAD_TREE'
    )
    const other = (await ok200('createWorld', { name: 'Otro' })).id
    const lejos = (await ok200('createPage', { worldId: other, title: 'Lejos' })).id
    await fails('updateTree', { tabId: tab.id, nodes: [{ id: 'x', pageId: lejos }] }, 'BAD_TREE')
    await fails('updateTree', { tabId: tab.id, nodes: [{ id: 'x', name: '' }] }, 'BAD_TREE')
    // Nada de eso cambió nada
    expect((await ok200('getTree', { tabId: tab.id })).nodes).toHaveLength(2)
    // Deshacer el cambio lo deja vacío; quitar la pestaña se lleva el árbol y deshacerlo lo devuelve
    await undo('updateTree')
    expect((await ok200('getTree', { tabId: tab.id })).nodes).toEqual([])
    await ok200('deletePageTab', { tabId: tab.id })
    await fails('getTree', { tabId: tab.id }, 'NOT_FOUND')
    await undo('deletePageTab')
    expect((await ok200('getTree', { tabId: tab.id })).tabId).toBe(tab.id)
  })

  it('las relaciones no son fijas: hijastros, adopciones o una libre con su nombre (sin él, no vale)', async () => {
    const varn = await newPage('Casa de Varn')
    const tab = await ok200('createPageTab', { pageId: varn, kind: 'tree' })
    const nodes = [
      { id: 'mira', name: 'Mira' },
      { id: 'ilsa', name: 'Ilsa' }
    ]
    await fails(
      'updateTree',
      { tabId: tab.id, nodes, edges: [{ from: 'mira', to: 'ilsa', type: 'other' }] },
      'BAD_TREE'
    )
    const free = await ok200('updateTree', {
      tabId: tab.id,
      nodes,
      edges: [
        { from: 'mira', to: 'ilsa', type: 'stepparent', label: 'no se guarda' },
        { from: 'ilsa', to: 'mira', type: 'other', label: ' Rival ', beside: true }
      ]
    })
    // El nombre y el lado solo se guardan en las libres
    expect(free.edges).toEqual([
      { from: 'mira', to: 'ilsa', type: 'stepparent' },
      { from: 'ilsa', to: 'mira', type: 'other', label: 'Rival', beside: true }
    ])
  })

  it('crearlo de una vez (como hace la IA): en una página nueva o en una que ya hay', async () => {
    const ilsa = await newPage('Ilsa de Varn')
    const created = await ok200('createTree', {
      worldId,
      name: 'Casa de Varn',
      nodes: [
        { id: 'a', pageId: ilsa },
        { id: 'b', name: 'Doran' }
      ],
      edges: [{ from: 'a', to: 'b', type: 'partner' }]
    })
    expect((await ok200('getPage', { pageId: created.pageId })).title).toBe('Casa de Varn')
    expect((await ok200('listPageTabs', { pageId: created.pageId })).tabs).toMatchObject([
      { kind: 'tree', name: 'Árbol' }
    ])
    const orden = await newPage('La Orden')
    const chart = await ok200('createTree', {
      worldId,
      name: 'Mando',
      pageId: orden,
      nodes: [
        { id: 'o', pageId: orden },
        { id: 'v', name: 'Varn' }
      ],
      edges: [{ from: 'v', to: 'o', type: 'leads' }]
    })
    expect(chart).toMatchObject({ pageId: orden, edges: [{ from: 'v', to: 'o', type: 'leads' }] })
    expect((await ok200('listPageTabs', { pageId: orden })).tabs).toMatchObject([{ kind: 'tree', name: 'Mando' }])
  })

  it('«Crear página» convierte un nodo suelto en una subpágina de la del árbol, y se deshace junto', async () => {
    const varn = await newPage('Casa de Varn')
    const tab = await ok200('createPageTab', { pageId: varn, kind: 'tree' })
    await ok200('updateTree', { tabId: tab.id, nodes: [{ id: 'mira', name: 'Mira de Varn' }] })
    const { pageId, tree } = await ok200('convertTreeNodeToPage', { tabId: tab.id, nodeId: 'mira' })
    expect(tree.nodes[0]).toMatchObject({ id: 'mira', pageId, name: 'Mira de Varn' })
    expect((await ok200('getPage', { pageId })).parentId).toBe(varn)
    await fails('convertTreeNodeToPage', { tabId: tab.id, nodeId: 'mira' }, 'NODE_HAS_PAGE')
    await undo('convertTreeNodeToPage')
    expect((await ok200('getTree', { tabId: tab.id })).nodes[0]).toMatchObject({ pageId: null })
    await fails('getPage', { pageId }, 'NOT_FOUND')
  })

  it('sus líneas entre páginas son relaciones del grafo (kind tree), con el sentido de los campos con papel', async () => {
    const varn = await newPage('Casa de Varn')
    const ilsa = await newPage('Ilsa de Varn')
    const aldren = await newPage('Aldren IV')
    const tab = await ok200('createPageTab', { pageId: varn, kind: 'tree' })
    await ok200('updateTree', {
      tabId: tab.id,
      nodes: [
        { id: 'aldren', pageId: aldren },
        { id: 'ilsa', pageId: ilsa },
        { id: 'mira', name: 'Mira' }
      ],
      edges: [
        { from: 'aldren', to: 'ilsa', type: 'parent' },
        { from: 'mira', to: 'ilsa', type: 'parent' }
      ]
    })
    const relations = await ok200('getRelations', { pageId: ilsa })
    expect(relations.modes).toEqual(['links', 'family'])
    expect(relations.edges).toEqual([
      expect.objectContaining({ source: ilsa, target: aldren, kind: 'tree', role: 'parent', key: 'tree:parent' })
    ])
    const family = await ok200('getRelations', { pageId: ilsa, mode: 'family' })
    expect(family.nodes.find((n: { id: string }) => n.id === aldren)?.generation).toBe(-1)
    const graph = await ok200('getWorldGraph', { worldId })
    expect(graph.relations).toEqual([
      expect.objectContaining({
        key: 'tree:parent',
        kind: 'tree',
        name: 'Padre o madre',
        inverseName: 'Hijos',
        count: 1
      })
    ])
    // Con la página del árbol en la papelera, sus líneas dejan de contar
    await ok200('deletePage', { pageId: varn })
    expect((await ok200('getWorldGraph', { worldId })).edges).toEqual([])
  })

  it('copiar la página copia su árbol', async () => {
    const varn = await newPage('Casa de Varn')
    const ilsa = await newPage('Ilsa de Varn')
    const tab = await ok200('createPageTab', { pageId: varn, kind: 'tree' })
    await ok200('updateTree', { tabId: tab.id, nodes: [{ id: 'ilsa', pageId: ilsa }] })
    const copy = await ok200('copyPage', { pageId: varn })
    const [copied] = (await ok200('listPageTabs', { pageId: copy.id })).tabs
    expect((await ok200('getTree', { tabId: copied.id })).nodes).toMatchObject([{ id: 'ilsa', pageId: ilsa }])
  })

  it('la jugadora: la pestaña si la ve; dentro, los nodos de lo que conoce y los sueltos; nada más, ni en el grafo', async () => {
    const varn = await newPage('Casa de Varn')
    const ilsa = await newPage('Ilsa de Varn')
    const secreta = await newPage('La Hija Secreta')
    const tab = await ok200('createPageTab', { pageId: varn, kind: 'tree' })
    await ok200('updateTree', {
      tabId: tab.id,
      nodes: [
        { id: 'ilsa', pageId: ilsa },
        { id: 'secreta', pageId: secreta },
        { id: 'mira', name: 'Mira de Varn' }
      ],
      edges: [
        { from: 'ilsa', to: 'secreta', type: 'parent' },
        { from: 'mira', to: 'ilsa', type: 'parent' }
      ]
    })
    // Sin conocer la página del árbol, ni la pestaña ni el árbol
    await fails('getTree', { tabId: tab.id }, 'NOT_FOUND', ana.cookie)
    await knows(varn)
    await knows(ilsa)
    const seen = await ok200('getTree', { tabId: tab.id }, ana.cookie)
    expect(seen.nodes.map((node: Node) => node.id)).toEqual(['ilsa', 'mira'])
    expect(seen.edges).toEqual([{ from: 'mira', to: 'ilsa', type: 'parent' }])
    const body = JSON.stringify(seen)
    for (const word of ['Hija Secreta', secreta, 'secreta']) expect(body).not.toContain(word)
    // En el grafo: ni la arista ni el nombre de lo que no conoce
    const graph = JSON.stringify(await ok200('getWorldGraph', { worldId, orphans: true }, ana.cookie))
    for (const word of ['Hija Secreta', secreta]) expect(graph).not.toContain(word)
    expect(JSON.stringify(await ok200('getRelations', { pageId: ilsa }, ana.cookie))).not.toContain(secreta)
    // Con la pestaña oculta, nada (tampoco sus líneas en el grafo)
    await knows(secreta)
    expect(JSON.stringify(await ok200('getWorldGraph', { worldId }, ana.cookie))).toContain('tree:parent')
    await ok200('updatePageTab', { tabId: tab.id, hidden: true })
    await fails('getTree', { tabId: tab.id }, 'NOT_FOUND', ana.cookie)
    expect(JSON.stringify(await ok200('getWorldGraph', { worldId }, ana.cookie))).not.toContain('tree:parent')
    // No escribe
    for (const [name, input] of [
      ['updateTree', { tabId: tab.id, nodes: [] }],
      ['convertTreeNodeToPage', { tabId: tab.id, nodeId: 'mira' }],
      ['createTree', { worldId, name: 'Mío' }]
    ] as const) {
      const response = await call(name, input, ana.cookie)
      expect([403, 404]).toContain(response.statusCode)
    }
  })
})
