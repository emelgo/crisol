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
const PUERTO = [
  '---',
  'etiquetas:',
  '  - lugar/ciudad',
  'Población: 12000',
  '---',
  '# Puerto Ceniza',
  '',
  'La última ciudad libre.',
  '',
  '> [!secreto]',
  '> La Hermandad quemó el faro.'
].join('\n')

describe('duplicar una página con todo lo suyo (copyPage, ADR-0024)', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }
  let eana: string

  const call = async (name: string, payload: object) =>
    app.inject({
      method: 'POST',
      url: `/api/actions/${name}`,
      payload,
      headers: { origin: BASE_URL, cookie: owner.cookie }
    })
  const json = async (name: string, payload: object) => (await call(name, payload)).json()
  const lastOperation = async (action: string) => {
    const [op] = await conn.db
      .select()
      .from(schema.operations)
      .where(eq(schema.operations.action, action))
      .orderBy(desc(schema.operations.createdAt))
    return op?.id
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_copy_page'), { max: 4 })
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
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org?.id ?? '', userId: owner.userId, role: 'owner' })
    eana = (await json('createWorld', { name: 'Eana' })).id
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('copia la fila, el texto con sus secretos y las pestañas; va detrás de la original y se deshace de una vez', async () => {
    const { pages } = await json('createPages', {
      worldId: eana,
      parentId: null,
      pages: [
        { key: 'puerto', title: 'Puerto Ceniza', markdown: PUERTO },
        { key: 'faro', title: 'El Faro', markdown: 'Un faro.' },
        { key: 'luego', title: 'Luego', markdown: 'Otra.' }
      ]
    })
    const [puerto, faro] = pages as { id: string }[]
    const image = (
      await app.inject({
        method: 'POST',
        url: `/api/files?worldId=${eana}&name=puerto.png`,
        payload: PNG,
        headers: { origin: BASE_URL, cookie: owner.cookie, 'content-type': 'application/octet-stream' }
      })
    ).json()
    await json('updatePage', { pageId: puerto?.id, cover: { fileId: image.id, x: 30, y: 60 }, icon: '⚓' })
    // Pestañas: texto, un mapa con un pin a otra página, dos tablas (una lleva a la otra) y una escena con un muro
    await json('createPageTab', { pageId: puerto?.id, kind: 'text', name: 'Notas' })
    const mapTab = await json('createPageTab', { pageId: puerto?.id, kind: 'map', name: 'Costa' })
    const map = await json('getMap', { tabId: mapTab.id })
    await json('updateMap', { mapId: map.id, image: { fileId: image.id, width: 400, height: 300 } })
    await json('createMapPin', { mapId: map.id, x: 0.2, y: 0.4, label: 'Faro', pageId: faro?.id })
    const encounters = await json('createPageTab', { pageId: puerto?.id, kind: 'table', name: 'Encuentros' })
    const weather = await json('createPageTab', { pageId: puerto?.id, kind: 'table', name: 'Tiempo' })
    const { table } = await json('getRandomTable', { tabId: encounters.id })
    await json('updateRandomTable', {
      tabId: encounters.id,
      version: table.version,
      formula: '1d2',
      rows: [
        { id: 'a', from: 1, to: 1, text: 'Contrabandistas', page: faro?.id },
        { id: 'b', from: 2, to: 2, text: 'Tormenta', table: weather.id }
      ]
    })
    const sceneTab = await json('createPageTab', { pageId: puerto?.id, kind: 'scene', name: 'Muelle' })
    const scene = await json('getScene', { tabId: sceneTab.id })
    await json('changeWalls', { sceneId: scene.id, walls: { add: [{ a: { x: 0, y: 0 }, b: { x: 100, y: 0 } }] } })

    const copy = await json('copyPage', { pageId: puerto?.id })
    expect(copy).toMatchObject({
      title: 'Puerto Ceniza (copia)',
      icon: '⚓',
      cover: { fileId: image.id, x: 30, y: 60 }
    })
    // Justo detrás de la original, entre ella y la siguiente
    const roots = (await json('listPageChildren', { worldId: eana, parentId: null })).pages.map(
      (p: { title: string }) => p.title
    )
    expect(roots.indexOf('Puerto Ceniza (copia)')).toBe(roots.indexOf('Puerto Ceniza') + 1)
    // El texto, igual, con su secreto (que es suyo: se lee) y sus propiedades
    const original = (await json('readPage', { pageId: puerto?.id })).markdown as string
    const copied = (await json('readPage', { pageId: copy.id })).markdown as string
    expect(copied).toContain('La Hermandad quemó el faro.')
    expect(copied).toContain('lugar/ciudad')
    expect(copied.replace('Puerto Ceniza (copia)', 'Puerto Ceniza')).toBe(original)
    // Las pestañas, en su orden y con lo suyo
    const tabs = (await json('listPageTabs', { pageId: copy.id })).tabs as { id: string; name: string; kind: string }[]
    expect(tabs.map((t) => t.name)).toEqual(['Notas', 'Costa', 'Encuentros', 'Tiempo', 'Muelle'])
    const copiedMap = await json('getMap', { tabId: tabs[1]?.id })
    expect(copiedMap.image).toMatchObject({ fileId: image.id, width: 400, height: 300 })
    expect(copiedMap.pins).toMatchObject([{ label: 'Faro', pageId: faro?.id, x: 0.2, y: 0.4 }])
    const copiedTable = (await json('getRandomTable', { tabId: tabs[2]?.id })).table
    expect(copiedTable.rows).toMatchObject([
      { text: 'Contrabandistas', page: faro?.id },
      { text: 'Tormenta', table: tabs[3]?.id }
    ])
    const copiedScene = await json('getScene', { tabId: tabs[4]?.id })
    expect(copiedScene.id).not.toBe(scene.id)
    const vision = await json('getSceneVision', { sceneId: copiedScene.id })
    expect(vision.walls).toHaveLength(1)
    // Una sola operación, que se deshace de una vez (y la original sigue como estaba)
    const operation = await lastOperation('copyPage')
    expect((await json('listHistory', { worldId: eana })).entries[0]).toMatchObject({
      action: 'copyPage',
      details: { title: 'Puerto Ceniza', copy: 'Puerto Ceniza (copia)' }
    })
    expect((await json('undoOperation', { operationId: operation })).status).toBe('undone')
    expect((await call('getPage', { pageId: copy.id })).statusCode).toBe(404)
    expect((await json('listPageTabs', { pageId: puerto?.id })).tabs).toHaveLength(5)
    expect((await json('readPage', { pageId: puerto?.id })).markdown).toBe(original)
  })

  it('con título, el que se da; sin permiso para escribir, no', async () => {
    const { id } = await json('createPage', { worldId: eana, title: 'Varn' })
    expect(await json('copyPage', { pageId: id, title: 'Varn el Joven' })).toMatchObject({ title: 'Varn el Joven' })
    const stranger = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    const denied = await app.inject({
      method: 'POST',
      url: '/api/actions/copyPage',
      payload: { pageId: id },
      headers: { origin: BASE_URL, cookie: stranger.cookie }
    })
    expect(denied.statusCode).toBe(404)
  })
})
