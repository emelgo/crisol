import { connect, schema, trashRepo } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined

describe('las versiones de una página', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }
  let organizationId: string
  let worldId: string

  const call = (name: string, payload: object, cookie = owner.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object) => {
    const response = await call(name, payload)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const read = async (pageId: string) => (await ok200('readPage', { pageId })).markdown as string

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_versions'), { max: 4 })
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
    await app?.close()
    await conn?.close()
  })

  it('cada cambio deja una versión: la lista, verla con sus secretos y restaurarla, que también se deshace', async () => {
    const { pages } = await ok200('createPages', {
      worldId,
      parentId: null,
      pages: [{ key: 'p', title: 'Puerto Ceniza', markdown: 'Uno.\n\n> [!secreto]\n> El faro.' }]
    })
    const pageId = pages[0].id
    await ok200('editPage', { pageId, body: { mode: 'append', markdown: 'Dos.' } })
    const { versions } = await ok200('listPageVersions', { pageId })
    expect(versions).toHaveLength(2)
    expect(versions[0]).toMatchObject({ by: { name: 'Enrique' }, via: 'ui', current: true })
    expect(versions[1].current).toBe(false)

    const first = await ok200('getPageVersion', { pageId, versionId: versions[1].id })
    expect(JSON.stringify(first.blocks)).toContain('Uno.')
    expect(JSON.stringify(first.blocks)).toContain('El faro.')
    expect(JSON.stringify(first.blocks)).not.toContain('Dos.')

    expect(await ok200('restorePageVersion', { pageId, versionId: versions[1].id })).toEqual({ restored: true })
    expect(await read(pageId)).toBe('Uno.\n\n> [!secreto]\n> El faro.\n')
    expect((await ok200('listPageVersions', { pageId })).versions).toHaveLength(3)
    const entries = (await ok200('listHistory', { worldId })).entries as { id: string; action: string }[]
    expect(entries[0]?.action).toBe('restoreVersion')
    expect((await ok200('undoOperation', { operationId: entries[0]?.id })).status).toBe('undone')
    expect(await read(pageId)).toBe('Uno.\n\n> [!secreto]\n> El faro.\n\nDos.\n')
  })

  it('se purgan a los 90 días, salvo las 40 últimas de cada página y la de ahora', async () => {
    const { pages } = await ok200('createPages', {
      worldId,
      parentId: null,
      pages: [{ key: 'p', title: 'P', markdown: 'Cero.' }]
    })
    const pageId = pages[0].id
    for (let i = 1; i <= 42; i++) await ok200('editPage', { pageId, body: { mode: 'append', markdown: `Línea ${i}.` } })
    expect((await ok200('listPageVersions', { pageId })).versions).toHaveLength(43)
    // Dentro de 100 días: el historial ya se fue, y con él lo que las nombraba
    const later = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000)
    const result = await trashRepo.purge(conn.db, later)
    expect(result.versions).toBe(3)
    const left = (await ok200('listPageVersions', { pageId })).versions
    expect(left).toHaveLength(40)
    expect(left[0].current).toBe(true)
    // Los estados que ya no usa ninguna versión, también
    const orphans =
      await conn.sql`select count(*)::int as n from snapshots s where not exists (select 1 from version_documents d where d.snapshot_id = s.id)`
    expect(orphans[0]?.n).toBe(0)
    expect(await read(pageId)).toContain('Línea 42.')
  })

  it('quien no es máster no ve ni restaura versiones', async () => {
    const { pages } = await ok200('createPages', {
      worldId,
      parentId: null,
      pages: [{ key: 'p', title: 'P', markdown: 'Uno.' }]
    })
    const player = await signUpTestUser(auth, { name: 'Lía', email: 'lia@crisol.test' })
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: player.userId, role: 'member' })
    const versions = (await ok200('listPageVersions', { pageId: pages[0].id })).versions
    for (const [name, payload] of [
      ['listPageVersions', { pageId: pages[0].id }],
      ['getPageVersion', { pageId: pages[0].id, versionId: versions[0].id }],
      ['restorePageVersion', { pageId: pages[0].id, versionId: versions[0].id }]
    ] as const) {
      expect((await call(name, payload, player.cookie)).statusCode, name).toBe(404)
    }
  })
})
