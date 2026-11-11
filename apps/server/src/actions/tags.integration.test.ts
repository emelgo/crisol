import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { diskStorage } from '../files/storage.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY, testDataDir } from '../testing.ts'

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('un mapa')])

describe('las etiquetas de la cuenta (ADR-0006)', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }
  let organizationId: string
  let eana: string
  let other: string

  const call = async (name: string, payload: object, cookie = owner.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const json = async (name: string, payload: object, cookie = owner.cookie) =>
    (await call(name, payload, cookie)).json()
  const tagged = async (worldId: string, title: string, tags: string[]) => {
    const page = await json('createPage', { worldId, title })
    await json('setPageProperties', { pageId: page.id, properties: [{ name: 'etiquetas', type: 'list', value: tags }] })
    return page.id as string
  }
  const tagsOf = async (pageId: string) =>
    (await json('getPage', { pageId })).properties.find((p: { name: string }) => p.name === 'etiquetas')?.value ?? []
  const catalog = async () =>
    (await json('listAccountTags', {})).tags.map((t: { name: string; pages: number; files: number }) => [
      t.name,
      t.pages,
      t.files
    ])

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_tags'), { max: 4 })
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
    other = (await json('createWorld', { name: 'Costa' })).id
  })

  afterEach(async () => {
    await app.close()
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('el catálogo junta las de las páginas de todos los mundos y las de los archivos, con sus madres', async () => {
    await tagged(eana, 'Puerto Ceniza', ['lugar/ciudad', 'costa'])
    await tagged(other, 'Faro', ['lugar/ciudad'])
    const upload = await app.inject({
      method: 'POST',
      url: `/api/files?organizationId=${organizationId}&name=mapa.png`,
      payload: PNG,
      headers: { origin: BASE_URL, cookie: owner.cookie, 'content-type': 'application/octet-stream' }
    })
    const file = upload.json()
    expect(file.tags).toEqual([])
    expect(await json('setFileTags', { fileId: file.id, tags: ['costa', 'Costa', 'mapa'] })).toEqual({
      id: file.id,
      tags: ['costa', 'mapa']
    })
    expect(await catalog()).toEqual([
      ['costa', 1, 1],
      ['lugar', 2, 0],
      ['lugar/ciudad', 2, 0],
      ['mapa', 0, 1]
    ])
    const city = (await json('listAccountTags', {})).tags.find((t: { name: string }) => t.name === 'lugar/ciudad')
    expect(city.worlds.map((w: { name: string; pages: number }) => [w.name, w.pages]).sort()).toEqual([
      ['Costa', 1],
      ['Eana', 1]
    ])
  })

  it('se crea con color, no se repite y el color se cambia', async () => {
    expect(await json('createTag', { name: 'facción', color: 'wine' })).toMatchObject({
      name: 'facción',
      color: 'wine',
      pages: 0
    })
    expect(await json('createTag', { name: 'Facción' })).toMatchObject({ code: 'TAG_TAKEN' })
    // Una usada sin guardar recibe color: se guarda
    await tagged(eana, 'Maela', ['personaje'])
    expect(await json('updateTag', { tag: 'personaje', color: 'moss' })).toMatchObject({ color: 'moss', pages: 1 })
    expect((await json('updateTag', { tag: 'personaje', color: null })).color).toBeNull()
  })

  it('renombrar cambia páginas, archivos y sus hijas, en una operación que se deshace entera', async () => {
    const port = await tagged(eana, 'Puerto Ceniza', ['lugar/ciudad', 'costa'])
    const lighthouse = await tagged(other, 'Faro', ['lugar'])
    await json('createTag', { name: 'lugar', color: 'sea' })
    expect(await json('updateTag', { tag: 'Lugar', name: 'sitio' })).toMatchObject({ name: 'sitio', color: 'sea' })
    expect(await tagsOf(port)).toEqual(['sitio/ciudad', 'costa'])
    expect(await tagsOf(lighthouse)).toEqual(['sitio'])
    expect((await catalog()).map(([name]: [string]) => name)).toEqual(['costa', 'sitio', 'sitio/ciudad'])
    // Dentro de sí misma, no
    expect(await json('updateTag', { tag: 'sitio', name: 'sitio/otro' })).toMatchObject({ code: 'TAG_CYCLE' })

    const [op] = await conn.db.select().from(schema.operations).where(sqlAction('renameTag'))
    expect((await json('undoOperation', { operationId: op?.id })).status).toBe('undone')
    expect(await tagsOf(port)).toEqual(['lugar/ciudad', 'costa'])
    expect(await tagsOf(lighthouse)).toEqual(['lugar'])
  })

  it('se ordenan a mano entre hermanas y se meten unas en otras (con sus hijas); el orden se deshace', async () => {
    const port = await tagged(eana, 'Puerto Ceniza', ['lugar/ciudad', 'costa'])
    await json('createTag', { name: 'pnj' })
    const names = async () => (await catalog()).map(([name]: [string]) => name)
    expect(await names()).toEqual(['costa', 'lugar', 'lugar/ciudad', 'pnj'])
    // pnj, delante de costa: la primera vez se guardan los puestos de todas las hermanas (también las sin guardar)
    expect(await json('moveTag', { tag: 'pnj', parent: null, before: 'costa' })).toMatchObject({ name: 'pnj' })
    expect(await names()).toEqual(['pnj', 'costa', 'lugar', 'lugar/ciudad'])
    // lugar, detrás de pnj: sus hijas van con ella
    await json('moveTag', { tag: 'lugar', parent: null, after: 'pnj' })
    expect(await names()).toEqual(['pnj', 'lugar', 'lugar/ciudad', 'costa'])
    // costa, dentro de lugar y delante de ciudad: se renombra en lo que la lleva
    expect(await json('moveTag', { tag: 'costa', parent: 'lugar', before: 'lugar/ciudad' })).toMatchObject({
      name: 'lugar/costa'
    })
    expect(await names()).toEqual(['pnj', 'lugar', 'lugar/costa', 'lugar/ciudad'])
    expect(await tagsOf(port)).toEqual(['lugar/ciudad', 'lugar/costa'])
    // Ni dentro de sí misma, ni junto a una que no es su hermana
    expect(await json('moveTag', { tag: 'lugar', parent: 'lugar/ciudad' })).toMatchObject({ code: 'TAG_CYCLE' })
    expect(await json('moveTag', { tag: 'pnj', parent: null, before: 'lugar/ciudad' })).toMatchObject({
      code: 'TAG_NOT_SIBLING'
    })
    // Deshacer el último orden lo devuelve
    const orders = await conn.db.select().from(schema.operations).where(sqlAction('orderTag'))
    const last = orders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]
    expect((await json('undoOperation', { operationId: last?.id })).status).toBe('undone')
    expect(await names()).toEqual(['pnj', 'lugar', 'lugar/ciudad', 'lugar/costa'])
  })

  it('borrar la quita de todo, con sus hijas', async () => {
    const port = await tagged(eana, 'Puerto Ceniza', ['lugar/ciudad', 'costa'])
    expect(await json('deleteTag', { tag: 'lugar' })).toEqual({ name: 'lugar', pages: 1, files: 0 })
    expect(await tagsOf(port)).toEqual(['costa'])
    expect(await json('deleteTag', { tag: 'nada' })).toMatchObject({ code: 'TAG_NOT_FOUND' })
  })

  it('un máster de un mundo las ve pero no las gestiona', async () => {
    const master = await signUpTestUser(auth, { name: 'Máster', email: 'master@crisol.test' })
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: master.userId, role: 'member' })
    await conn.db.insert(schema.worldMembers).values({ worldId: eana, userId: master.userId, role: 'master' })
    await tagged(eana, 'Puerto Ceniza', ['costa'])
    const seen = await json('listAccountTags', { organizationId }, master.cookie)
    expect(seen.tags).toMatchObject([{ name: 'costa', pages: 1, worlds: [] }])
    expect((await call('createTag', { organizationId, name: 'otra' }, master.cookie)).statusCode).toBe(403)
  })
})

function sqlAction(action: string) {
  return eq(schema.operations.action, action)
}
