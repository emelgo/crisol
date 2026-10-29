import { connect, schema } from '@crisol/db'
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
    expect((await call('listPageChildren', { worldId }, stranger.cookie)).statusCode).toBe(404)
    const mine = (await call('createWorld', { name: 'Suyo' }, stranger.cookie)).json()
    const theirs = (await call('createPage', { worldId: mine.id, title: 'Suya' }, stranger.cookie)).json()
    expect((await call('createPage', { worldId, title: 'X', parentId: theirs.id })).statusCode).toBe(404)
    expect((await call('movePage', { pageId: page.id, parentId: theirs.id })).statusCode).toBe(404)
  })
})
