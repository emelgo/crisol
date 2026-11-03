import { connect, schema, trashRepo } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { MAX_PAGE_DEPTH } from '@crisol/domain'
import { and, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined

describe('la wiki: páginas y árbol', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }
  let organizationId: string
  let worldId: string

  const call = (name: string, payload: object, cookie = owner.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const create = async (title: string, more: object = {}) => {
    const response = await call('createPage', { worldId, title, ...more })
    expect(response.statusCode, response.body).toBe(200)
    return response.json() as { id: string; title: string; parentId: string | null; version: number }
  }
  const titles = async (parentId: string | null = null) =>
    ((await call('listPageChildren', { worldId, parentId })).json().pages as { title: string }[]).map((p) => p.title)
  const historyOf = async () =>
    (await call('listHistory', { worldId })).json().entries as Array<{
      id: string
      action: string
      details: Record<string, unknown>
    }>

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_pages'), { max: 2 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY }
    })
    owner = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Fateforge' }).returning()
    if (!org) throw new Error('sin organización')
    organizationId = org.id
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: owner.userId, role: 'owner' })
    worldId = (await call('createWorld', { name: 'Eana' })).json().id
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('la portada del mundo (como en Everlore): se crea una vez, la primera del árbol, y no se borra ni se mete en otra', async () => {
    const home = async () => (await call('getWorldHome', { worldId })).json()
    const other = await create('Lugares')
    expect(await home()).toEqual({ pageId: null, chosen: false })
    const { pageId } = (await call('ensureWorldHome', { worldId })).json()
    // Con el nombre del mundo, delante de las que ya había; y no se repite
    expect(await titles()).toEqual(['Eana', 'Lugares'])
    expect((await call('ensureWorldHome', { worldId })).json()).toEqual({ pageId })
    expect(await home()).toEqual({ pageId, chosen: true })
    // Dos a la vez en un mundo sin portada (abierto en dos pestañas): una sola
    const otherWorld = (await call('createWorld', { name: 'Otro' })).json().id
    const both = await Promise.all(
      [1, 2].map(async () => (await call('ensureWorldHome', { worldId: otherWorld })).json())
    )
    expect(both[0].pageId).toBe(both[1].pageId)
    expect((await call('deletePage', { pageId })).json()).toMatchObject({ code: 'HOME_PAGE' })
    expect((await call('movePage', { pageId, parentId: other.id })).json()).toMatchObject({ code: 'HOME_PAGE' })
    // Las demás, sí
    expect((await call('movePage', { pageId: other.id, parentId: pageId })).statusCode).toBe(200)
  })

  it('las subpáginas se ordenan por título, de la A a la Z o al revés, en una sola operación', async () => {
    const places = await create('Lugares')
    for (const title of ['Costa Gris', 'Árbol Viejo', 'Bosque', 'puerto']) await create(title, { parentId: places.id })
    expect((await call('sortPageChildren', { worldId, parentId: places.id, order: 'asc' })).json()).toEqual({
      sorted: 4
    })
    expect(await titles(places.id)).toEqual(['Árbol Viejo', 'Bosque', 'Costa Gris', 'puerto'])
    await call('sortPageChildren', { worldId, parentId: places.id, order: 'desc' })
    expect(await titles(places.id)).toEqual(['puerto', 'Costa Gris', 'Bosque', 'Árbol Viejo'])
    expect((await historyOf()).filter((e) => e.action === 'sortPageChildren')).toHaveLength(2)
    // Una en la papelera al ordenar: al volver, va detrás de las demás y sin compartir sitio con ninguna
    const bosque = (await call('listPageChildren', { worldId, parentId: places.id }))
      .json()
      .pages.find((p: { title: string }) => p.title === 'Bosque')
    await call('deletePage', { pageId: bosque.id })
    await call('sortPageChildren', { worldId, parentId: places.id, order: 'asc' })
    await call('restorePage', { pageId: bosque.id })
    expect(await titles(places.id)).toEqual(['Árbol Viejo', 'Costa Gris', 'puerto', 'Bosque'])
    const positions = await conn.sql`select position from pages where parent_id = ${places.id}`
    expect(new Set(positions.map((row) => row.position)).size).toBe(4)
  })

  it('el panel de la página: se guarda en su orden, se comprueba y queda en el historial', async () => {
    const page = await create('Puerto Ceniza')
    expect((await call('getPage', { pageId: page.id })).json().panel).toEqual([])
    const blocks = [
      { id: 'amenaza1', type: 'meter', title: 'Amenaza', style: 'bar', value: 3, max: 5, color: 'wine' },
      { id: 'notas001', type: 'text', title: 'Clima', text: 'Niebla por la mañana' },
      { id: 'estado01', type: 'rating', title: 'Moral', value: 3.5, max: 5 }
    ]
    expect((await call('setPagePanel', { pageId: page.id, blocks })).json().panel).toEqual(blocks)
    expect((await call('getPage', { pageId: page.id })).json().panel).toEqual(blocks)
    expect((await historyOf()).find((e) => e.action === 'setPagePanel')).toMatchObject({
      details: { title: 'Puerto Ceniza' }
    })
    // Un valor por encima de su máximo, o dos bloques con el mismo id, no
    const over = [{ ...blocks[0], value: 9 }]
    expect((await call('setPagePanel', { pageId: page.id, blocks: over })).json()).toMatchObject({ code: 'BAD_PANEL' })
    const twice = [blocks[1], blocks[1]]
    expect((await call('setPagePanel', { pageId: page.id, blocks: twice })).json()).toMatchObject({ code: 'BAD_PANEL' })
  })

  it('el máster crea páginas y subpáginas; salen en su orden y quedan en el historial', async () => {
    const places = await create('Lugares')
    await create('Personajes')
    const coast = await create('Costa Gris', { parentId: places.id })
    expect(coast).toMatchObject({ parentId: places.id, version: 1 })
    expect(await titles()).toEqual(['Lugares', 'Personajes'])
    expect(await titles(places.id)).toEqual(['Costa Gris'])
    const listed = (await call('listPageChildren', { worldId, parentId: null })).json().pages
    expect(listed[0]).toEqual({
      id: places.id,
      worldId,
      parentId: null,
      title: 'Lugares',
      icon: null,
      hasChildren: true,
      version: 1
    })
    expect(
      (await historyOf()).find((e) => e.action === 'createPage' && e.details.title === 'Costa Gris')
    ).toMatchObject({ details: { title: 'Costa Gris', parent: 'Lugares' } })
  })

  it('una página abierta trae su ruta desde el primer nivel', async () => {
    const places = await create('Lugares')
    const coast = await create('Costa Gris', { parentId: places.id })
    const port = await create('Puerto Ceniza', { parentId: coast.id })
    const opened = (await call('getPage', { pageId: port.id })).json()
    expect(opened).toMatchObject({ title: 'Puerto Ceniza', locked: false, hasChildren: false })
    expect(opened.path.map((p: { title: string }) => p.title)).toEqual(['Lugares', 'Costa Gris', 'Puerto Ceniza'])
  })

  it('crear delante o detrás de una hermana la pone ahí', async () => {
    const b = await create('B')
    await create('A', { before: b.id })
    await create('C', { after: b.id })
    await create('B y medio', { after: b.id })
    expect(await titles()).toEqual(['A', 'B', 'B y medio', 'C'])
  })

  it('la hoja: se activa con sus ajustes, se cambia y se quita; quien lee recuerda su vista', async () => {
    const page = (await call('createPage', { worldId, title: 'El Dragón Rojo' })).json()
    expect(page.sheet).toBeNull()
    const sheet = { paper: 'a4', theme: 'pergamino', numbers: true, firstNumber: 3, footer: true }
    expect((await call('updatePage', { pageId: page.id, sheet })).json()).toMatchObject({ sheet })
    await call('updatePage', { pageId: page.id, sheet: { ...sheet, theme: 'neutro' } })
    await call('updatePage', { pageId: page.id, sheet: null })
    const { entries } = (await call('listHistory', { worldId })).json()
    expect(entries.slice(0, 3).map((e: { details: { sheet?: string } }) => e.details.sheet)).toEqual([
      'off',
      'changed',
      'on'
    ])
    expect((await call('updatePage', { pageId: page.id, sheet: { ...sheet, paper: 'a3' } })).statusCode).toBe(400)
    const simple = (await call('setPageView', { worldId, pageId: page.id, view: 'simple' })).json()
    expect(simple.simplePages).toEqual([page.id])
    expect((await call('setPageView', { worldId, pageId: page.id, view: 'sheet' })).json().simplePages).toEqual([])
  })

  it('renombrar sube la versión y apunta el cambio', async () => {
    const page = await create('Puerto')
    const renamed = (await call('updatePage', { pageId: page.id, title: 'Puerto Ceniza' })).json()
    expect(renamed).toMatchObject({ title: 'Puerto Ceniza', version: 2 })
    expect((await historyOf()).find((e) => e.action === 'updatePage')?.details).toEqual({
      from: 'Puerto',
      to: 'Puerto Ceniza'
    })
  })

  it('mover a otra rama y reordenar entre hermanas', async () => {
    const places = await create('Lugares')
    const people = await create('Personajes')
    const maela = await create('Maela Varn', { parentId: places.id })
    const oren = await create('Oren Tus', { parentId: people.id })

    const moved = await call('movePage', { pageId: maela.id, parentId: people.id, before: oren.id })
    expect(moved.json()).toMatchObject({
      parentId: people.id,
      path: [{ title: 'Personajes' }, { title: 'Maela Varn' }]
    })
    expect(await titles(people.id)).toEqual(['Maela Varn', 'Oren Tus'])
    expect(await titles(places.id)).toEqual([])

    await call('movePage', { pageId: maela.id, parentId: people.id, after: oren.id })
    expect(await titles(people.id)).toEqual(['Oren Tus', 'Maela Varn'])
    await call('movePage', { pageId: places.id, parentId: null })
    expect(await titles()).toEqual(['Personajes', 'Lugares'])
  })

  it('una página nunca va dentro de sí misma ni de sus subpáginas', async () => {
    const places = await create('Lugares')
    const coast = await create('Costa Gris', { parentId: places.id })
    const port = await create('Puerto Ceniza', { parentId: coast.id })
    expect((await call('movePage', { pageId: places.id, parentId: places.id })).json()).toEqual({ code: 'CYCLE' })
    expect((await call('movePage', { pageId: places.id, parentId: port.id })).json()).toEqual({ code: 'CYCLE' })
    expect(await titles(places.id)).toEqual(['Costa Gris'])
  })

  it('la vecina tiene que ser hermana, y no la propia página', async () => {
    const places = await create('Lugares')
    const people = await create('Personajes')
    const coast = await create('Costa Gris', { parentId: places.id })
    expect((await call('createPage', { worldId, title: 'X', before: coast.id })).json()).toEqual({
      code: 'BAD_PLACEMENT'
    })
    expect((await call('movePage', { pageId: people.id, parentId: null, after: people.id })).json()).toEqual({
      code: 'BAD_PLACEMENT'
    })
    expect((await call('createPage', { worldId, title: 'X', before: coast.id, after: coast.id })).statusCode).toBe(400)
  })

  it('hasta 32 niveles', async () => {
    let parentId: string | null = null
    for (let level = 0; level < MAX_PAGE_DEPTH; level++)
      parentId = (await create(`Nivel ${level + 1}`, { parentId })).id
    expect((await call('createPage', { worldId, title: 'Uno más', parentId })).json()).toEqual({ code: 'TOO_DEEP' })
    const top = await create('Otra rama')
    const deepest = (await call('listPageTree', { worldId, levels: 1 })).json().pages[0]
    expect((await call('movePage', { pageId: deepest.id, parentId: top.id })).json()).toEqual({ code: 'TOO_DEEP' })
  })

  it('el árbol de una rama, en orden de lectura y hasta los niveles pedidos', async () => {
    const places = await create('Lugares')
    const coast = await create('Costa Gris', { parentId: places.id })
    await create('Puerto Ceniza', { parentId: coast.id })
    await create('Velaria', { parentId: coast.id })
    await create('Montes de Hierro', { parentId: places.id })
    await create('Personajes')

    const tree = (await call('listPageTree', { worldId, levels: 2 })).json().pages
    expect(tree.map((p: { title: string; level: number }) => [p.title, p.level])).toEqual([
      ['Lugares', 1],
      ['Costa Gris', 2],
      ['Montes de Hierro', 2],
      ['Personajes', 1]
    ])
    expect(tree[1]).toMatchObject({ parentId: places.id, hasChildren: true })
    const branch = (await call('listPageTree', { worldId, parentId: coast.id, levels: 3 })).json().pages
    expect(branch.map((p: { title: string }) => p.title)).toEqual(['Puerto Ceniza', 'Velaria'])
  })

  it('lo último de la wiki: la cambiada más tarde, primero, con las de encima; sin las de la papelera', async () => {
    const places = await create('Lugares')
    const coast = await create('Costa Gris', { parentId: places.id })
    const gone = await create('Borrador')
    await call('updatePage', { pageId: coast.id, title: 'Costa Brava' })
    await call('deletePage', { pageId: gone.id })

    const recent = (await call('listRecentPages', { worldId })).json().pages
    expect(recent[0]).toMatchObject({ id: coast.id, title: 'Costa Brava', path: [{ id: places.id, title: 'Lugares' }] })
    expect(recent.map((p: { title: string }) => p.title).sort()).toEqual(['Costa Brava', 'Lugares'])
    expect((await call('listRecentPages', { worldId, limit: 1 })).json().pages).toHaveLength(1)
  })

  it('deshacer un movimiento la devuelve a su sitio; crear con subpáginas debajo no se deshace', async () => {
    const places = await create('Lugares')
    const people = await create('Personajes')
    const maela = await create('Maela Varn', { parentId: places.id })
    await call('movePage', { pageId: maela.id, parentId: people.id })
    const move = (await historyOf()).find((e) => e.action === 'movePage')
    expect((await call('undoOperation', { operationId: move?.id })).json().status).toBe('undone')
    expect(await titles(places.id)).toEqual(['Maela Varn'])

    const createdPlaces = (await historyOf()).find((e) => e.action === 'createPage' && e.details.title === 'Lugares')
    const result = (await call('undoOperation', { operationId: createdPlaces?.id })).json()
    expect(result).toMatchObject({ status: 'conflict', by: { action: 'createPage', details: { title: 'Maela Varn' } } })
    expect(await titles()).toEqual(['Lugares', 'Personajes'])
  })

  it('el propietario la ve aunque no administre el mundo', async () => {
    const page = await create('Lugares')
    await conn.db
      .delete(schema.worldMembers)
      .where(and(eq(schema.worldMembers.worldId, worldId), eq(schema.worldMembers.userId, owner.userId)))
    expect((await call('getPage', { pageId: page.id })).statusCode).toBe(200)
    expect((await call('createPage', { worldId, title: 'Personajes' })).statusCode).toBe(200)
  })

  it('un jugador no ve la wiki del mundo en el que juega: para él no existe', async () => {
    const page = await create('Lugares')
    const campaign = (await call('createCampaign', { worldId, name: 'La Marca' })).json()
    const player = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: player.userId, role: 'member' })
    await conn.db
      .insert(schema.campaignMembers)
      .values({ campaignId: campaign.id, userId: player.userId, role: 'player' })

    for (const [name, payload] of [
      ['listPageChildren', { worldId }],
      ['listPageTree', { worldId }],
      ['listRecentPages', { worldId }],
      ['getPage', { pageId: page.id }],
      ['createPage', { worldId, title: 'Mía' }],
      ['updatePage', { pageId: page.id, title: 'Mía' }],
      ['movePage', { pageId: page.id, parentId: null }]
    ] as const) {
      const response = await call(name, payload, player.cookie)
      expect(response.statusCode, name).toBe(404)
      expect(response.body, name).not.toContain('Lugares')
    }
  })

  it('la wiki de otra organización no existe', async () => {
    const page = await create('Lugares')
    const stranger = await signUpTestUser(auth, { name: 'Otra', email: 'otra@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Otra' }).returning()
    if (!org) throw new Error('sin organización')
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org.id, userId: stranger.userId, role: 'owner' })
    expect((await call('getPage', { pageId: page.id }, stranger.cookie)).statusCode).toBe(404)
    expect((await call('getPage', { pageId: crypto.randomUUID() })).statusCode).toBe(404)
    expect((await call('listPageChildren', { worldId }, stranger.cookie)).statusCode).toBe(404)
    const mine = (await call('createWorld', { name: 'Suyo' }, stranger.cookie)).json()
    const theirs = (await call('createPage', { worldId: mine.id, title: 'Suya' }, stranger.cookie)).json()
    expect((await call('createPage', { worldId, title: 'X', parentId: theirs.id })).statusCode).toBe(404)
    expect((await call('movePage', { pageId: page.id, parentId: theirs.id })).statusCode).toBe(404)
  })

  describe('propiedades, icono y etiquetas', () => {
    it('el icono es un emoji y se quita con null; el historial dice qué cambió', async () => {
      const page = await create('Puerto Ceniza')
      expect((await call('updatePage', { pageId: page.id, icon: '⚓' })).json()).toMatchObject({
        icon: '⚓',
        version: 2
      })
      expect((await call('updatePage', { pageId: page.id, icon: '🏴‍☠️' })).json().icon).toBe('🏴‍☠️')
      expect((await call('updatePage', { pageId: page.id, icon: 'x' })).statusCode).toBe(400)
      expect((await call('updatePage', { pageId: page.id, icon: null })).json().icon).toBeNull()
      expect((await call('updatePage', { pageId: page.id })).statusCode).toBe(400)
      expect((await historyOf()).find((e) => e.action === 'updatePage')?.details).toEqual({
        title: 'Puerto Ceniza',
        icon: null
      })
    })

    it('las propiedades se guardan con su tipo y en su orden, y deshacer las devuelve', async () => {
      const coast = await create('Costa Gris')
      const page = await create('Puerto Ceniza')
      const properties = [
        { name: 'Región', type: 'pages', value: [coast.id] },
        { name: 'Población', type: 'number', value: 4200 },
        { name: 'Libre', type: 'boolean', value: true },
        { name: 'alias', type: 'list', value: ['El Puerto', 'La Ceniza'] },
        { name: 'etiquetas', type: 'list', value: ['lugar/ciudad', 'costa'] },
        { name: 'resumen', type: 'text', value: 'La última ciudad libre de la Costa Gris' }
      ]
      const saved = (await call('setPageProperties', { pageId: page.id, properties })).json()
      expect(saved.properties).toEqual(properties)
      expect((await call('getPage', { pageId: page.id })).json().properties).toEqual(properties)
      const entry = (await historyOf()).find((e) => e.action === 'setPageProperties')
      expect(entry?.details).toMatchObject({ title: 'Puerto Ceniza' })
      expect(((entry?.details.changed ?? []) as string[]).sort()).toEqual(
        ['región', 'población', 'libre', 'alias', 'etiquetas', 'resumen'].sort()
      )

      await call('setPageProperties', { pageId: page.id, properties: properties.slice(1, 2) })
      const last = (await historyOf()).find((e) => e.action === 'setPageProperties')
      expect((await call('undoOperation', { operationId: last?.id })).json().status).toBe('undone')
      expect((await call('getPage', { pageId: page.id })).json().properties).toEqual(properties)
    })

    it('no se repite un nombre, las reservadas tienen su tipo y las etiquetas, su forma', async () => {
      const page = await create('Puerto Ceniza')
      const set = async (properties: object[]) =>
        (await call('setPageProperties', { pageId: page.id, properties })).json()
      expect(
        await set([
          { name: 'Región', type: 'text', value: 'a' },
          { name: 'región', type: 'text', value: 'b' }
        ])
      ).toEqual({ code: 'DUPLICATE_PROPERTY' })
      expect(await set([{ name: 'alias', type: 'text', value: 'El Puerto' }])).toEqual({
        code: 'RESERVED_PROPERTY_TYPE'
      })
      expect(await set([{ name: 'etiquetas', type: 'list', value: ['lugar /ciudad'] }])).toEqual({ code: 'BAD_TAG' })
      expect((await call('getPage', { pageId: page.id })).json().properties).toEqual([])
    })

    it('una propiedad de páginas solo enlaza páginas de la misma wiki, fuera de la papelera', async () => {
      const page = await create('Puerto Ceniza')
      const property = (id: string) => [{ name: 'Región', type: 'pages', value: [id] }]
      const unknown = crypto.randomUUID()
      expect((await call('setPageProperties', { pageId: page.id, properties: property(unknown) })).json()).toEqual({
        code: 'BAD_PROPERTY'
      })
      const other = (await call('createWorld', { name: 'Otro' })).json()
      const foreign = (await call('createPage', { worldId: other.id, title: 'De otro mundo' })).json()
      expect((await call('setPageProperties', { pageId: page.id, properties: property(foreign.id) })).json()).toEqual({
        code: 'BAD_PROPERTY'
      })
    })

    it('las etiquetas, con cuántas páginas tiene cada una', async () => {
      const tag = async (title: string, tags: string[]) => {
        const page = await create(title)
        await call('setPageProperties', {
          pageId: page.id,
          properties: [{ name: 'etiquetas', type: 'list', value: tags }]
        })
      }
      await tag('Puerto Ceniza', ['lugar/ciudad', 'costa'])
      await tag('Velaria', ['lugar/ciudad'])
      await tag('Montes de Hierro', ['Lugar/Montaña'])
      await create('Sin etiquetas')
      expect((await call('listTags', { worldId })).json().tags).toEqual([
        { tag: 'costa', depth: 0, count: 1 },
        { tag: 'lugar', depth: 0, count: 3 },
        { tag: 'lugar/ciudad', depth: 1, count: 2 },
        { tag: 'lugar/montaña', depth: 1, count: 1 }
      ])
    })
  })

  describe('papelera', () => {
    const trash = async () =>
      (await call('listTrash', { worldId })).json().items as Array<{ kind: string; name: string; subpages?: number }>

    it('borrar se lleva la rama entera en una operación; sale una vez en la papelera y vuelve entera', async () => {
      const places = await create('Lugares')
      const coast = await create('Costa Gris', { parentId: places.id })
      await create('Puerto Ceniza', { parentId: coast.id })
      await create('Personajes')
      expect((await call('deletePage', { pageId: places.id })).json()).toEqual({ subpages: 2 })
      expect(await titles()).toEqual(['Personajes'])
      expect((await call('getPage', { pageId: coast.id })).statusCode).toBe(404)
      expect(await trash()).toEqual([expect.objectContaining({ kind: 'page', name: 'Lugares', subpages: 2 })])
      expect((await historyOf())[0]).toMatchObject({ action: 'deletePage', details: { title: 'Lugares' } })

      expect((await call('restorePage', { pageId: places.id })).json()).toEqual({ id: places.id, name: 'Lugares' })
      expect(await titles()).toEqual(['Lugares', 'Personajes'])
      expect(await titles(coast.id)).toEqual(['Puerto Ceniza'])
      expect(await trash()).toEqual([])
    })

    it('deshacer el borrado devuelve la rama', async () => {
      const places = await create('Lugares')
      await create('Costa Gris', { parentId: places.id })
      await call('deletePage', { pageId: places.id })
      const deleted = (await historyOf())[0]
      expect((await call('undoOperation', { operationId: deleted?.id })).json().status).toBe('undone')
      expect(await titles(places.id)).toEqual(['Costa Gris'])
    })

    it('una subpágina borrada antes no vuelve con su madre; y no se restaura mientras la madre esté en la papelera', async () => {
      const places = await create('Lugares')
      const coast = await create('Costa Gris', { parentId: places.id })
      await create('Montes de Hierro', { parentId: places.id })
      await call('deletePage', { pageId: coast.id })
      await call('deletePage', { pageId: places.id })
      expect((await trash()).map((item) => [item.name, item.subpages])).toEqual([
        ['Lugares', 1],
        ['Costa Gris', 0]
      ])
      expect((await call('restorePage', { pageId: coast.id })).json()).toEqual({ code: 'PARENT_IN_TRASH' })
      await call('restorePage', { pageId: places.id })
      expect(await titles(places.id)).toEqual(['Montes de Hierro'])
      expect((await call('restorePage', { pageId: coast.id })).statusCode).toBe(200)
      expect(await titles(places.id)).toEqual(['Costa Gris', 'Montes de Hierro'])
    })

    it('a los 30 días se purga, con sus subpáginas', async () => {
      const places = await create('Lugares')
      await create('Costa Gris', { parentId: places.id })
      await call('deletePage', { pageId: places.id })
      const result = await trashRepo.purge(conn.db, new Date(Date.now() + 31 * 24 * 60 * 60 * 1000))
      expect(result).toMatchObject({ pages: 2 })
      expect(await conn.db.select().from(schema.pages)).toEqual([])
    })

    it('un jugador no borra ni restaura páginas', async () => {
      const page = await create('Lugares')
      const campaign = (await call('createCampaign', { worldId, name: 'La Marca' })).json()
      const player = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
      await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: player.userId, role: 'member' })
      await conn.db
        .insert(schema.campaignMembers)
        .values({ campaignId: campaign.id, userId: player.userId, role: 'player' })
      expect((await call('deletePage', { pageId: page.id }, player.cookie)).statusCode).toBe(404)
      await call('deletePage', { pageId: page.id })
      expect((await call('restorePage', { pageId: page.id }, player.cookie)).statusCode).toBe(404)
      expect((await call('listTrash', { worldId }, player.cookie)).statusCode).toBe(403)
    })
  })

  describe('pestañas y marcadores', () => {
    it('se guardan por cuenta, con los títulos de ahora, y no van al historial', async () => {
      const port = await create('Puerto Ceniza')
      const maela = await create('Maela Varn')
      const before = (await historyOf()).length
      const tabs = await call('setWikiTabs', {
        worldId,
        tabs: [
          { pageId: port.id, pinned: true },
          { pageId: maela.id, pinned: false },
          { pageId: maela.id, pinned: true },
          { pageId: crypto.randomUUID(), pinned: false }
        ]
      })
      expect(tabs.json().tabs).toEqual([
        { pageId: port.id, title: 'Puerto Ceniza', pinned: true },
        { pageId: maela.id, title: 'Maela Varn', pinned: false }
      ])
      await call('setBookmarks', { worldId, bookmarks: [{ name: 'Sesión 5', pages: [maela.id, port.id] }] })
      await call('updatePage', { pageId: maela.id, title: 'Maela Varn, la contrabandista' })
      expect((await call('getWikiPreferences', { worldId })).json()).toEqual({
        tabs: [
          { pageId: port.id, title: 'Puerto Ceniza', pinned: true },
          { pageId: maela.id, title: 'Maela Varn, la contrabandista', pinned: false }
        ],
        bookmarks: [
          {
            name: 'Sesión 5',
            pages: [
              { id: maela.id, title: 'Maela Varn, la contrabandista' },
              { id: port.id, title: 'Puerto Ceniza' }
            ]
          }
        ],
        simplePages: []
      })
      // Solo el renombrado
      expect((await historyOf()).length).toBe(before + 1)
    })

    it('lo que está en la papelera no sale, y vuelve si se restaura', async () => {
      const port = await create('Puerto Ceniza')
      await call('setWikiTabs', { worldId, tabs: [{ pageId: port.id, pinned: false }] })
      await call('deletePage', { pageId: port.id })
      expect((await call('getWikiPreferences', { worldId })).json().tabs).toEqual([])
      await call('restorePage', { pageId: port.id })
      expect((await call('getWikiPreferences', { worldId })).json().tabs).toHaveLength(1)
    })

    it('las de otra cuenta son suyas, y quien no ve la wiki no tiene', async () => {
      const port = await create('Puerto Ceniza')
      await call('setWikiTabs', { worldId, tabs: [{ pageId: port.id, pinned: false }] })
      const other = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
      await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: other.userId, role: 'member' })
      expect((await call('getWikiPreferences', { worldId }, other.cookie)).statusCode).toBe(404)
      await conn.db.insert(schema.worldMembers).values({ worldId, userId: other.userId, role: 'master' })
      expect((await call('getWikiPreferences', { worldId }, other.cookie)).json()).toEqual({
        tabs: [],
        bookmarks: [],
        simplePages: []
      })
    })
  })
})
