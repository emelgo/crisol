import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { desc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { diskStorage } from '../files/storage.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY, testDataDir } from '../testing.ts'

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('un mapa')])
const PDF = Buffer.from('%PDF-1.4\n%un libro\n')

describe('las pestañas de página y los mapas (ADR-0007)', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }
  let organizationId: string
  let eana: string
  let costa: string
  let page: string

  const call = async (name: string, payload: object, cookie = owner.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const json = async (name: string, payload: object, cookie = owner.cookie) =>
    (await call(name, payload, cookie)).json()
  const upload = async (worldId: string, name: string, body: Buffer) =>
    (
      await app.inject({
        method: 'POST',
        url: `/api/files?worldId=${worldId}&name=${encodeURIComponent(name)}`,
        payload: body,
        headers: { origin: BASE_URL, cookie: owner.cookie, 'content-type': 'application/octet-stream' }
      })
    ).json()
  const lastOperation = async (action: string) => {
    const [op] = await conn.db
      .select()
      .from(schema.operations)
      .where(eq(schema.operations.action, action))
      .orderBy(desc(schema.operations.createdAt))
    return op?.id
  }
  const tabNames = async () => (await json('listPageTabs', { pageId: page })).tabs.map((t: { name: string }) => t.name)

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_maps'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY },
      storage: diskStorage(testDataDir())
    })
    owner = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Fateforge' }).returning()
    organizationId = org?.id ?? ''
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: owner.userId, role: 'owner' })
    eana = (await json('createWorld', { name: 'Eana' })).id
    costa = (await json('createWorld', { name: 'Costa' })).id
    page = (await json('createPage', { worldId: eana, title: 'Eana' })).id
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('pestañas: se añaden al final, se renombran, se ocultan, se recolocan y se quitan', async () => {
    expect(await json('listPageTabs', { pageId: page })).toEqual({ tabs: [] })
    const first = await json('createPageTab', { pageId: page, kind: 'map' })
    expect(first).toMatchObject({ pageId: page, kind: 'map', name: 'Mapa', hidden: false })
    const second = await json('createPageTab', { pageId: page, kind: 'map' })
    expect(second.name).toBe('Mapa 2')
    const third = await json('createPageTab', { pageId: page, kind: 'map', name: 'Ciudad' })
    expect(await tabNames()).toEqual(['Mapa', 'Mapa 2', 'Ciudad'])

    expect(await json('updatePageTab', { tabId: first.id, name: 'Continente', hidden: true })).toMatchObject({
      name: 'Continente',
      hidden: true
    })
    await json('updatePageTab', { tabId: third.id, after: null })
    expect(await tabNames()).toEqual(['Ciudad', 'Continente', 'Mapa 2'])
    await json('updatePageTab', { tabId: third.id, after: second.id })
    expect(await tabNames()).toEqual(['Continente', 'Mapa 2', 'Ciudad'])
    expect(await json('updatePageTab', { tabId: third.id, after: crypto.randomUUID() })).toMatchObject({
      code: 'BAD_TAB_PLACE'
    })

    expect(await json('deletePageTab', { tabId: second.id })).toEqual({ id: second.id })
    expect(await tabNames()).toEqual(['Continente', 'Ciudad'])
  })

  it('mapa: la imagen es un archivo de imagen del mundo (o común); la escala se pone y se quita', async () => {
    const tab = await json('createPageTab', { pageId: page, kind: 'map' })
    const map = await json('getMap', { tabId: tab.id })
    expect(map).toMatchObject({ tabId: tab.id, pageId: page, image: null, scale: null, pins: [] })

    const image = await upload(eana, 'Eana.png', PNG)
    const withImage = await json('updateMap', { mapId: map.id, image: { fileId: image.id, width: 4000, height: 3000 } })
    expect(withImage.image).toEqual({
      fileId: image.id,
      name: 'Eana.png',
      url: `/api/files/${image.id}?v=1`,
      width: 4000,
      height: 3000
    })

    // Ni la de otro mundo ni lo que no es una imagen
    const elsewhere = await upload(costa, 'Costa.png', PNG)
    const book = await upload(eana, 'Libro.pdf', PDF)
    for (const fileId of [elsewhere.id, book.id]) {
      expect(await json('updateMap', { mapId: map.id, image: { fileId, width: 10, height: 10 } })).toMatchObject({
        code: 'BAD_MAP_IMAGE'
      })
    }

    const scaled = await json('updateMap', { mapId: map.id, scale: { length: 200, value: 50, unit: 'leguas' } })
    expect(scaled.scale).toEqual({ length: 200, value: 50, unit: 'leguas' })
    expect((await json('updateMap', { mapId: map.id, scale: null })).scale).toBeNull()

    // La imagen en la papelera: el mapa vuelve a pedir una
    await json('deleteFile', { fileId: image.id })
    expect((await json('getMap', { tabId: tab.id })).image).toBeNull()
  })

  it('pines: con página del mismo mundo, se mueven y cambian, y se quitan; deshacer los devuelve', async () => {
    const tab = await json('createPageTab', { pageId: page, kind: 'map' })
    const map = await json('getMap', { tabId: tab.id })
    const city = await json('createPage', { worldId: eana, title: 'Puerto Ceniza' })
    const foreign = await json('createPage', { worldId: costa, title: 'Faro' })

    const pin = await json('createMapPin', { mapId: map.id, x: 0.25, y: 0.5, pageId: city.id })
    expect(pin).toMatchObject({
      x: 0.25,
      y: 0.5,
      label: null,
      pageId: city.id,
      pageTitle: 'Puerto Ceniza',
      color: 'wine',
      shape: 0,
      variant: 0,
      display: 0,
      hidden: false,
      locked: false
    })
    expect(await json('createMapPin', { mapId: map.id, x: 0.1, y: 0.1, pageId: foreign.id })).toMatchObject({
      code: 'BAD_PIN_PAGE'
    })
    expect((await call('createMapPin', { mapId: map.id, x: 1.5, y: 0.1 })).statusCode).toBe(400)

    const changed = await json('updateMapPin', {
      pinId: pin.id,
      x: 0.3,
      label: 'El puerto',
      color: '#336699',
      shape: 4,
      icon: '⚓'
    })
    expect(changed).toMatchObject({ x: 0.3, y: 0.5, label: 'El puerto', color: '#336699', shape: 4, icon: '⚓' })

    // La página enlazada en la papelera: el pin se queda, sin su título
    await json('deletePage', { pageId: city.id })
    expect((await json('getMap', { tabId: tab.id })).pins[0]).toMatchObject({ pageId: city.id, pageTitle: null })

    await json('deleteMapPin', { pinId: pin.id })
    expect((await json('getMap', { tabId: tab.id })).pins).toEqual([])
    expect((await json('undoOperation', { operationId: await lastOperation('deleteMapPin') })).status).toBe('undone')
    expect((await json('getMap', { tabId: tab.id })).pins).toMatchObject([{ id: pin.id, label: 'El puerto' }])
  })

  it('quitar una pestaña quita su mapa y sus pines; deshacer lo devuelve todo', async () => {
    const tab = await json('createPageTab', { pageId: page, kind: 'map' })
    const map = await json('getMap', { tabId: tab.id })
    await json('createMapPin', { mapId: map.id, x: 0.5, y: 0.5, label: 'Aquí' })
    await json('deletePageTab', { tabId: tab.id })
    expect(await tabNames()).toEqual([])
    expect((await call('getMap', { tabId: tab.id })).statusCode).toBe(404)

    expect((await json('undoOperation', { operationId: await lastOperation('deletePageTab') })).status).toBe('undone')
    expect(await tabNames()).toEqual(['Mapa'])
    expect((await json('getMap', { tabId: tab.id })).pins).toMatchObject([{ label: 'Aquí' }])
  })

  it('sin acceso a la wiki del mundo, ni se ven ni se cambian', async () => {
    const tab = await json('createPageTab', { pageId: page, kind: 'map' })
    const stranger = await signUpTestUser(auth, { name: 'Otra', email: 'otra@crisol.test' })
    expect((await call('listPageTabs', { pageId: page }, stranger.cookie)).statusCode).toBe(404)
    expect((await call('getMap', { tabId: tab.id }, stranger.cookie)).statusCode).toBe(404)
    expect((await call('deletePageTab', { tabId: tab.id }, stranger.cookie)).statusCode).toBe(404)
    expect(organizationId).toBeTruthy()
  })
})
