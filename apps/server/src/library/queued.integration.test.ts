import { randomBytes } from 'node:crypto'
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import { diskStorage } from '../files/storage.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY, testDataDir } from '../testing.ts'
import type { Embedder } from './embedder.ts'
import { textPdf } from './fixture.ts'
import { type LibraryJobs, queuedLibrary } from './jobs.ts'

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined
const VALKEY = process.env.TEST_VALKEY_URL ?? 'redis://127.0.0.1:63790'
const embedder: Embedder = {
  async embed(texts) {
    return texts.map(() => {
      const v = new Array(384).fill(0)
      v[0] = 1
      return v
    })
  },
  async close() {}
}

describe('la cola de la biblioteca en BullMQ (docs/specs/biblioteca.md)', () => {
  let conn: ReturnType<typeof connect>
  let app: FastifyInstance
  let library: LibraryJobs

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_library_queue'), { max: 4 })
    await resetDatabase(conn.sql)
  })

  afterAll(async () => {
    await library?.close()
    await app?.close()
    await conn?.close()
  })

  it('leer un PDF y, después, sus trozos con sus vectores; lo de la wiki que se guarda, también', async () => {
    const storage = diskStorage(testDataDir())
    // Su propio espacio de colas: no se mezcla con nada
    library = queuedLibrary({
      db: conn.db,
      storage,
      embedder,
      valkeyUrl: VALKEY,
      prefix: `prueba-${randomBytes(4).toString('hex')}`
    })
    const auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY },
      storage,
      library,
      embedder
    })
    const owner = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Mesa' }).returning()
    if (!org) throw new Error('sin organización')
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org.id, userId: owner.userId, role: 'owner' })
    const call = (name: string, payload: object) =>
      app.inject({
        method: 'POST',
        url: `/api/actions/${name}`,
        payload,
        headers: { origin: BASE_URL, cookie: owner.cookie }
      })
    const worldId = (await call('createWorld', { name: 'Valdren' })).json().id
    const uploaded = await app.inject({
      method: 'POST',
      url: `/api/files?worldId=${worldId}&name=Guia.pdf`,
      payload: Buffer.from(textPdf(['Los vigilantes patrullan de noche las murallas de la ciudad.'])),
      headers: { origin: BASE_URL, cookie: owner.cookie, 'content-type': 'application/octet-stream' }
    })
    expect(uploaded.statusCode).toBe(201)
    await call('createPages', {
      worldId,
      parentId: null,
      pages: [
        { key: 'h', title: 'Hesk', markdown: 'El capitán Hesk dirige la guardia de Puertoceniza desde hace años.' }
      ]
    })
    await library.idle()
    const { books } = (await call('listLibrary', { worldId })).json()
    expect(books[0]).toMatchObject({ status: 'done', pages: 1 })
    const chunks = await conn.sql<{ source: string; ready: boolean }[]>`
      select source, embedding is not null as ready from search_chunks order by source`
    expect(chunks.map((c) => [c.source, c.ready])).toEqual([
      ['book', true],
      ['page', true]
    ])
  }, 60_000)
})
