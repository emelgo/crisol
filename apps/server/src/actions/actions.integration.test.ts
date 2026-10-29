import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser } from '../testing.ts'

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined

describe('POST /api/actions/:name', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }
  let organizationId: string

  const call = (name: string, payload: object, cookie?: string, origin = BASE_URL) =>
    app.inject({
      method: 'POST',
      url: `/api/actions/${name}`,
      payload,
      headers: { origin, ...(cookie ? { cookie } : {}) }
    })

  /** Una organización con su propietario */
  const organizationWithOwner = async (name: string, email: string) => {
    const person = await signUpTestUser(auth, { name, email })
    const [org] = await conn.db.insert(schema.organizations).values({ name }).returning()
    if (!org) throw new Error('sin organización')
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org.id, userId: person.userId, role: 'owner' })
    return { ...person, organizationId: org.id }
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_actions'), { max: 2 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({ checks: { postgres: ok, valkey: ok }, accounts: { auth, db: conn.db, publicUrl: BASE_URL } })
    const created = await organizationWithOwner('Enrique', 'enrique@crisol.test')
    owner = created
    organizationId = created.organizationId
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('sin sesión da 401', async () => {
    const response = await call('listWorlds', {})
    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ code: 'UNAUTHENTICATED' })
  })

  it('una acción que no existe da 404', async () => {
    expect((await call('borrarTodo', {}, owner.cookie)).json()).toEqual({ code: 'UNKNOWN_ACTION' })
  })

  it('el propietario crea un mundo, queda de máster y la operación queda en el historial', async () => {
    const response = await call('createWorld', { name: 'Eana' }, owner.cookie)
    expect(response.statusCode).toBe(200)
    const world = response.json()
    expect(world).toEqual({ id: expect.any(String), organizationId, name: 'Eana', role: 'master', version: 1 })

    const [op] = await conn.db.select().from(schema.operations)
    expect(op).toMatchObject({
      action: 'createWorld',
      details: { name: 'Eana' },
      actorId: owner.userId,
      via: 'ui',
      worldId: world.id
    })
    expect((await call('listWorlds', {}, owner.cookie)).json()).toEqual({ worlds: [world] })
  })

  it('el máster renombra su mundo y la versión sube', async () => {
    const world = (await call('createWorld', { name: 'Eana' }, owner.cookie)).json()
    const response = await call('renameWorld', { worldId: world.id, name: 'Eana (Fateforge)' }, owner.cookie)
    expect(response.json()).toMatchObject({ name: 'Eana (Fateforge)', version: 2 })
    const ops = await conn.db.select().from(schema.operations)
    expect(ops.find((op) => op.action === 'renameWorld')?.details).toEqual({ from: 'Eana', to: 'Eana (Fateforge)' })
  })

  it('un miembro que no es propietario no crea mundos', async () => {
    const member = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: member.userId, role: 'member' })
    const response = await call('createWorld', { name: 'Eana', organizationId }, member.cookie)
    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ code: 'FORBIDDEN' })
  })

  it('sin organizaciones propias, crear un mundo pide decir cuál', async () => {
    const stranger = await signUpTestUser(auth, { name: 'Nadie', email: 'nadie@crisol.test' })
    expect((await call('createWorld', { name: 'Eana' }, stranger.cookie)).json()).toEqual({
      code: 'ORGANIZATION_REQUIRED'
    })
  })

  it('el mundo de otra organización no existe para quien no está en ella', async () => {
    const other = await organizationWithOwner('Otra', 'otra@crisol.test')
    const foreign = (await call('createWorld', { name: 'Ajeno' }, other.cookie)).json()

    const rename = await call('renameWorld', { worldId: foreign.id, name: 'Mío' }, owner.cookie)
    expect(rename.statusCode).toBe(404)
    expect(rename.json()).toEqual({ code: 'NOT_FOUND' })
    expect(
      (await call('createWorld', { name: 'X', organizationId: other.organizationId }, owner.cookie)).statusCode
    ).toBe(404)
    expect((await call('listWorlds', {}, owner.cookie)).json()).toEqual({ worlds: [] })
  })

  it('datos no válidos dan 400 y no escriben nada', async () => {
    const response = await call('createWorld', { name: '   ' }, owner.cookie)
    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ code: 'INVALID_INPUT' })
    expect(await conn.db.select().from(schema.worlds)).toEqual([])
  })

  it('una petición desde otro origen se rechaza aunque traiga la cookie', async () => {
    const response = await call('createWorld', { name: 'Eana' }, owner.cookie, 'https://malo.example')
    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ code: 'BAD_ORIGIN' })
    expect(await conn.db.select().from(schema.worlds)).toEqual([])
  })

  it('la respuesta solo lleva lo que dice el contrato', async () => {
    const world = (await call('createWorld', { name: 'Eana' }, owner.cookie)).json()
    expect(Object.keys(world).sort()).toEqual(['id', 'name', 'organizationId', 'role', 'version'])
  })

  it('GET /api/openapi.json describe las acciones', async () => {
    const doc = (await app.inject({ method: 'GET', url: '/api/openapi.json' })).json()
    expect(Object.keys(doc.paths)).toContain('/api/actions/createWorld')
  })
})
