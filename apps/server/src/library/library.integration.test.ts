import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { diskStorage, type Storage } from '../files/storage.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY, testDataDir } from '../testing.ts'
import { textPdf } from './fixture.ts'
import { inlineLibrary, type LibraryJobs } from './jobs.ts'

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined

const GUIA = textPdf([
  'Guía de Valdren\nUn libro de prueba.',
  'Las Marcas\nLos vigías encienden hogueras.',
  'Puertoceniza\nLa guardia de la ciudad viste capas grises.\nEl capitán Hesk responde ante el consejo.'
])

describe('la biblioteca (docs/specs/biblioteca.md)', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let storage: Storage
  let library: LibraryJobs
  let owner: { userId: string; cookie: string }
  let organizationId: string
  let worldId: string

  const call = (name: string, payload: object, cookie = owner.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = owner.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const upload = async (place: string, name: string, body: Uint8Array) => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/files?${place}&name=${encodeURIComponent(name)}`,
      payload: Buffer.from(body),
      headers: { origin: BASE_URL, cookie: owner.cookie, 'content-type': 'application/octet-stream' }
    })
    expect(response.statusCode, response.body).toBe(201)
    return response.json().id as string
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_library'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    storage = diskStorage(testDataDir())
    library = inlineLibrary(conn.db, storage)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY },
      storage,
      library
    })
    owner = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Mesa' }).returning()
    if (!org) throw new Error('sin organización')
    organizationId = org.id
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: owner.userId, role: 'owner' })
    worldId = (await ok200('createWorld', { name: 'Valdren' })).id
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('subir un PDF lo lee en segundo plano; se busca con y sin tildes, y abre en su página', async () => {
    const guia = await upload(`worldId=${worldId}`, 'Guía de Valdren.pdf', GUIA)
    // Mientras se lee, pendiente; luego, listo con sus páginas
    await library.idle()
    const { books } = await ok200('listLibrary', { worldId })
    expect(books).toEqual([
      expect.objectContaining({
        fileId: guia,
        name: 'Guía de Valdren.pdf',
        common: false,
        status: 'done',
        pages: 3,
        read: 3
      })
    ])
    for (const query of ['capitan', 'capitán', 'guardias de la ciudad']) {
      const found = await ok200('searchLibrary', { worldId, query })
      expect(found.books).toHaveLength(1)
      expect(found.books[0].pages[0]).toMatchObject({ page: 3, semantic: false })
    }
    expect((await ok200('searchLibrary', { worldId, query: 'capitán' })).books[0].pages[0].excerpt).toContain(
      '**capitán**'
    )
    expect((await ok200('searchLibrary', { worldId, query: 'dragones' })).books).toEqual([])
    // Su texto, para la IA
    const read = await ok200('getBookPages', { fileId: guia, from: 2, to: 3 })
    expect(read).toMatchObject({ name: 'Guía de Valdren.pdf', status: 'done', pages: 3 })
    expect(read.text.map((p: { page: number }) => p.page)).toEqual([2, 3])
    expect((await call('getBookPages', { fileId: guia, from: 1, to: 30 })).json().code).toBe('TOO_MANY_PAGES')
  })

  it('los comunes también; los de otro mundo, no; un PDF roto, fallido, y se puede volver a leer', async () => {
    await upload(`organizationId=${organizationId}`, 'Reglas.pdf', textPdf(['Reglas\nLa guardia patrulla.']))
    const otherWorld = (await ok200('createWorld', { name: 'Otro' })).id
    await upload(`worldId=${otherWorld}`, 'Secreto.pdf', textPdf(['La guardia secreta']))
    const roto = await upload(`worldId=${worldId}`, 'Roto.pdf', new TextEncoder().encode('%PDF-1.7\nnada'))
    await library.idle()
    const { books } = await ok200('listLibrary', { worldId })
    expect(books.map((b: { name: string; common: boolean; status: string }) => [b.name, b.common, b.status])).toEqual([
      ['Roto.pdf', false, 'failed'],
      ['Reglas.pdf', true, 'done']
    ])
    const found = await ok200('searchLibrary', { worldId, query: 'guardia' })
    expect(found.books.map((b: { name: string }) => b.name)).toEqual(['Reglas.pdf'])
    expect(await ok200('readBookAgain', { fileId: roto })).toEqual({ status: 'pending' })
    await library.idle()
    expect((await ok200('listLibrary', { worldId })).books[0].status).toBe('failed')

    // Una jugadora de una campaña del mundo no ve la biblioteca (hasta el módulo 5)
    const campaign = await ok200('createCampaign', { worldId, name: 'La Marca' })
    const ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    const url = (await ok200('getInvitation', { campaignId: campaign.id })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: ana.cookie }
    })
    expect((await call('searchLibrary', { worldId, query: 'guardia' }, ana.cookie)).statusCode).toBe(404)
    expect((await call('getBookPages', { fileId: roto, from: 1, to: 1 }, ana.cookie)).statusCode).toBe(404)
  })

  it('cambiar un PDF lo vuelve a leer; los ya subidos se leen al pedirlos', async () => {
    const guia = await upload(`worldId=${worldId}`, 'Guía.pdf', GUIA)
    await library.idle()
    const replaced = await app.inject({
      method: 'PUT',
      url: `/api/files/${guia}`,
      payload: Buffer.from(textPdf(['Otra edición: dragones'])),
      headers: { origin: BASE_URL, cookie: owner.cookie, 'content-type': 'application/octet-stream' }
    })
    expect(replaced.statusCode).toBe(200)
    await library.idle()
    expect((await ok200('searchLibrary', { worldId, query: 'dragones' })).books).toHaveLength(1)
    expect((await ok200('searchLibrary', { worldId, query: 'capitán' })).books).toEqual([])
    // Lo que no está leído (se subió sin biblioteca): al listar, a la cola
    await conn.sql`delete from file_texts`
    await conn.sql`delete from file_pages`
    expect((await ok200('listLibrary', { worldId })).books[0].status).toBe('pending')
    await library.idle()
    expect((await ok200('listLibrary', { worldId })).books[0]).toMatchObject({ status: 'done', pages: 1 })
  })
})
