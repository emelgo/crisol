import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { diskStorage } from '../files/storage.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY, testDataDir } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 un retrato')])

describe('tokens de acceso personales (ADR-0033)', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }
  let organizationId: string

  const call = (name: string, payload: object, headers: Record<string, string>) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers })
  const web = (name: string, payload: object, cookie = owner.cookie) =>
    call(name, payload, { origin: BASE_URL, cookie })
  /** Un guion: sin origen ni cookie, con el token en la cabecera */
  const script = (name: string, payload: object, secret: string) =>
    call(name, payload, { authorization: `Bearer ${secret}` })
  const created = async (name = 'Carga del 5e', days = 30) => {
    const response = await web('createApiToken', { name, days })
    expect(response.statusCode, response.body).toBe(200)
    return response.json() as { token: { id: string; prefix: string; expiresAt: string }; secret: string }
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_api_tokens'), { max: 4 })
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
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Mesa' }).returning()
    if (!org) throw new Error('sin organización')
    organizationId = org.id
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: owner.userId, role: 'owner' })
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('se crea desde la web, se ve una sola vez y solo se guarda su huella', async () => {
    const { token, secret } = await created()
    expect(secret).toMatch(/^crisol_pat_[A-Za-z0-9_-]{43}$/)
    expect(secret.startsWith(token.prefix)).toBe(true)
    const days = (new Date(token.expiresAt).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(29.9)
    expect(days).toBeLessThanOrEqual(30)

    const listed = (await web('listApiTokens', {})).json()
    expect(listed.tokens).toEqual([expect.objectContaining({ id: token.id, name: 'Carga del 5e', lastUsedAt: null })])
    expect(JSON.stringify(listed)).not.toContain(secret)
    const [row] = await conn.db.select().from(schema.apiTokens)
    expect(row?.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(row)).not.toContain(secret)
  })

  it('un guion llama a las acciones con los permisos de la cuenta, y queda en el historial con su token', async () => {
    const { secret } = await created()
    const response = await script('createWorld', { name: 'Eana' }, secret)
    expect(response.statusCode, response.body).toBe(200)
    const [operation] = await conn.db
      .select()
      .from(schema.operations)
      .where(eq(schema.operations.action, 'createWorld'))
    expect(operation).toMatchObject({ actorId: owner.userId, via: 'ai', tool: 'token «Carga del 5e»' })
    // Su último uso
    const listed = (await web('listApiTokens', {})).json()
    expect(listed.tokens[0].lastUsedAt).not.toBeNull()
    // Lo que la cuenta no puede, tampoco con el token
    const stranger = await signUpTestUser(auth, { name: 'Pepe', email: 'pepe@crisol.test' })
    const other = (await web('createApiToken', { name: 'Pepe', days: 7 }, stranger.cookie)).json()
    const world = response.json() as { id: string }
    expect((await script('renameWorld', { worldId: world.id, name: 'Otra' }, other.secret)).statusCode).toBe(404)
  })

  it('también en las acciones grandes y en las subidas de archivos', async () => {
    const { secret } = await created()
    const system = (await script('createSystem', { name: 'Mazmorra' }, secret)).json()
    const images = await script(
      'putSystemImages',
      {
        systemId: system.id,
        images: [{ path: 'tokens/trasgo.webp', data: WEBP.toString('base64'), license: 'unknown', credit: null }]
      },
      secret
    )
    expect(images.statusCode, images.body).toBe(200)
    const upload = await app.inject({
      method: 'POST',
      url: `/api/files?organizationId=${organizationId}&name=portada.webp`,
      payload: WEBP,
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/octet-stream' }
    })
    expect(upload.statusCode, upload.body).toBe(201)
  })

  it('con un token no se ven, crean ni quitan tokens, ni se toca la IA', async () => {
    const { token, secret } = await created()
    for (const [name, input] of [
      ['listApiTokens', {}],
      ['createApiToken', { name: 'Otro', days: 365 }],
      ['deleteApiToken', { tokenId: token.id }],
      ['setAiMode', { mode: 'copilot' }]
    ] as const)
      expect((await script(name, input, secret)).statusCode, name).toBe(403)
  })

  it('un token quitado, caducado o inventado no vale, aunque venga con la cookie', async () => {
    const { token, secret } = await created()
    const withCookie = (s: string) =>
      call('listWorlds', {}, { origin: BASE_URL, cookie: owner.cookie, authorization: `Bearer ${s}` })
    expect((await withCookie(`${secret}x`)).statusCode).toBe(401)
    await conn.db
      .update(schema.apiTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.apiTokens.id, token.id))
    expect((await script('listWorlds', {}, secret)).statusCode).toBe(401)

    const fresh = await created('Otro', 7)
    expect((await script('listWorlds', {}, fresh.secret)).statusCode).toBe(200)
    const left = (await web('deleteApiToken', { tokenId: fresh.token.id })).json()
    expect(left.tokens.map((t: { id: string }) => t.id)).toEqual([token.id])
    expect((await script('listWorlds', {}, fresh.secret)).statusCode).toBe(401)
  })

  it('cada cuenta solo ve y quita los suyos, y como mucho tiene 20', async () => {
    const { token } = await created()
    const stranger = await signUpTestUser(auth, { name: 'Pepe', email: 'pepe@crisol.test' })
    expect((await web('listApiTokens', {}, stranger.cookie)).json().tokens).toEqual([])
    expect((await web('deleteApiToken', { tokenId: token.id }, stranger.cookie)).statusCode).toBe(404)
    for (let i = 1; i < 20; i++) await created(`T${i}`)
    const refused = await web('createApiToken', { name: 'Uno más', days: 7 })
    expect(refused.statusCode).toBe(400)
    expect(refused.json().code).toBe('TOO_MANY_TOKENS')
  })

  it('el nombre no puede estar vacío y la caducidad es una de las fijas', async () => {
    expect((await web('createApiToken', { name: '  ', days: 30 })).statusCode).toBe(400)
    expect((await web('createApiToken', { name: 'Sin fin', days: 10_000 })).statusCode).toBe(400)
  })
})
