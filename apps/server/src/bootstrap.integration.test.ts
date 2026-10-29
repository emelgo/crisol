import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from './app.ts'
import { allowSignup } from './auth/signup-gate.ts'
import { BootstrapError, issueBootstrap } from './bootstrap.ts'
import { hashSecret } from './secrets.ts'
import { createTestAuth, TEST_SEAL_KEY } from './testing.ts'

const BASE_URL = 'https://crisol.test'
const DAY = 24 * 60 * 60 * 1000
const ok = async () => undefined
const owner = { name: 'Enrique', email: 'enrique@crisol.test', password: 'una-clave-larga' }

describe('arranque del propietario', () => {
  let conn: ReturnType<typeof connect>
  let app: FastifyInstance

  const newApp = () => {
    const auth = createTestAuth(conn.db, BASE_URL)
    return buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY }
    })
  }
  const post = (url: string, payload: object, cookie?: string) =>
    app.inject({ method: 'POST', url, payload, headers: { origin: BASE_URL, ...(cookie ? { cookie } : {}) } })
  const sessionCookie = (response: Awaited<ReturnType<typeof post>>) => {
    const cookie = response.cookies.find((c) => c.name.endsWith('better-auth.session_token'))
    if (!cookie) throw new Error('Sin cookie de sesión')
    return cookie
  }
  const users = async () => (await conn.db.select().from(schema.user)).length

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_auth'), { max: 2 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    app = newApp()
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('crea la organización y un enlace del que solo se guarda el hash', async () => {
    const { secret, organizationId } = await issueBootstrap(conn.db, { organizationName: 'Crisol de Enrique' })
    const [token] = await conn.db.select().from(schema.bootstrapTokens)
    expect(token?.organizationId).toBe(organizationId)
    expect(token?.tokenHash).toBe(hashSecret(secret))
    expect(JSON.stringify(token)).not.toContain(secret)
  })

  it('el enlace dice a qué organización da entrada', async () => {
    const { secret } = await issueBootstrap(conn.db, { organizationName: 'Crisol de Enrique' })
    const response = await app.inject({ method: 'GET', url: `/api/bootstrap/${secret}` })
    expect(response.json()).toEqual({ organizationName: 'Crisol de Enrique' })
  })

  it('con el enlace se crea la cuenta, queda como propietario y con sesión segura', async () => {
    const { secret, organizationId } = await issueBootstrap(conn.db, { organizationName: 'Crisol de Enrique' })
    const response = await post('/api/bootstrap', { secret, ...owner })
    expect(response.statusCode).toBe(201)

    const cookie = sessionCookie(response)
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax' })
    const [member] = await conn.db.select().from(schema.organizationMembers)
    expect(member).toMatchObject({ organizationId, role: 'owner' })

    const session = await app.inject({
      method: 'GET',
      url: '/api/auth/get-session',
      headers: { cookie: `${cookie.name}=${cookie.value}` }
    })
    expect(session.json().user).toMatchObject({ name: owner.name, email: owner.email })
  })

  it('el enlace no sirve dos veces', async () => {
    const { secret } = await issueBootstrap(conn.db, { organizationName: 'Crisol de Enrique' })
    await post('/api/bootstrap', { secret, ...owner })
    const again = await post('/api/bootstrap', { secret, ...owner, email: 'otra@crisol.test' })
    expect(again.statusCode).toBe(400)
    expect(again.json()).toMatchObject({ code: 'INVALID_LINK' })
    expect(await users()).toBe(1)
  })

  it('un enlace caducado no sirve', async () => {
    const { secret } = await issueBootstrap(conn.db, {
      organizationName: 'Crisol de Enrique',
      now: new Date(Date.now() - 2 * DAY)
    })
    const response = await post('/api/bootstrap', { secret, ...owner })
    expect(response.json()).toMatchObject({ code: 'INVALID_LINK' })
    const peek = await app.inject({ method: 'GET', url: `/api/bootstrap/${secret}` })
    expect(peek.statusCode).toBe(404)
  })

  it('con datos no válidos no gasta el enlace', async () => {
    const { secret } = await issueBootstrap(conn.db, { organizationName: 'Crisol de Enrique' })
    const response = await post('/api/bootstrap', { secret, ...owner, password: 'corta' })
    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ code: 'INVALID_INPUT' })
    expect((await post('/api/bootstrap', { secret, ...owner })).statusCode).toBe(201)
  })

  it('con un email que ya tiene cuenta lo dice y no gasta el enlace', async () => {
    const auth = createTestAuth(conn.db, BASE_URL)
    await allowSignup(() => auth.api.signUpEmail({ body: owner }))
    const { secret } = await issueBootstrap(conn.db, { organizationName: 'Crisol de Enrique' })
    const response = await post('/api/bootstrap', { secret, ...owner })
    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({ code: 'EMAIL_TAKEN' })
    expect((await app.inject({ method: 'GET', url: `/api/bootstrap/${secret}` })).statusCode).toBe(200)
  })

  it('sin organización ni nombre no hay arranque', async () => {
    await expect(issueBootstrap(conn.db, {})).rejects.toEqual(new BootstrapError('ORGANIZATION_NAME_REQUIRED'))
  })

  it('el registro público de Better Auth está cerrado', async () => {
    const response = await post('/api/auth/sign-up/email', owner)
    expect(response.statusCode).toBe(403)
    expect(await users()).toBe(0)
  })

  it('no da otro arranque si ya hay propietario', async () => {
    const { secret } = await issueBootstrap(conn.db, { organizationName: 'Crisol de Enrique' })
    await post('/api/bootstrap', { secret, ...owner })
    await expect(issueBootstrap(conn.db, { organizationName: 'Otra' })).rejects.toEqual(
      new BootstrapError('OWNER_EXISTS')
    )
  })

  it('repetir el arranque sin propietario anula el enlace anterior y reutiliza la organización', async () => {
    const first = await issueBootstrap(conn.db, { organizationName: 'Crisol de Enrique' })
    const second = await issueBootstrap(conn.db, {})
    expect(second.organizationId).toBe(first.organizationId)
    expect((await post('/api/bootstrap', { secret: first.secret, ...owner })).statusCode).toBe(400)
    expect((await post('/api/bootstrap', { secret: second.secret, ...owner })).statusCode).toBe(201)
  })

  it('la sesión sobrevive a un reinicio del servidor', async () => {
    const { secret } = await issueBootstrap(conn.db, { organizationName: 'Crisol de Enrique' })
    const cookie = sessionCookie(await post('/api/bootstrap', { secret, ...owner }))
    app = newApp()
    const session = await app.inject({
      method: 'GET',
      url: '/api/auth/get-session',
      headers: { cookie: `${cookie.name}=${cookie.value}` }
    })
    expect(session.json().user.email).toBe(owner.email)
  })

  it('los formularios urlencoded llegan a Better Auth (OAuth canjea los códigos así)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/oauth2/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'grant_type=authorization_code&code=no-vale'
    })
    expect(response.statusCode).not.toBe(415)
    expect(response.json()).toMatchObject({ error: expect.any(String) })
  })

  it('el propietario entra con su contraseña y los intentos fallidos se limitan', async () => {
    const { secret } = await issueBootstrap(conn.db, { organizationName: 'Crisol de Enrique' })
    await post('/api/bootstrap', { secret, ...owner })
    const signIn = (password: string) => post('/api/auth/sign-in/email', { email: owner.email, password })

    expect((await signIn(owner.password)).statusCode).toBe(200)
    const failures = []
    for (let i = 0; i < 5; i++) failures.push((await signIn('no-es-la-clave')).statusCode)
    expect(failures.slice(0, 4).every((status) => status === 401)).toBe(true)
    expect(failures.at(-1)).toBe(429)
  })

  it('los intentos fallidos se cuentan por IP: uno que falla no bloquea a los demás', async () => {
    const { secret } = await issueBootstrap(conn.db, { organizationName: 'Crisol de Enrique' })
    await post('/api/bootstrap', { secret, ...owner })
    const signInFrom = (ip: string, password: string) =>
      app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email: owner.email, password },
        headers: { origin: BASE_URL, 'x-forwarded-for': ip }
      })
    for (let i = 0; i < 5; i++) await signInFrom('203.0.113.7', 'no-es-la-clave')
    expect((await signInFrom('203.0.113.7', owner.password)).statusCode).toBe(429)
    expect((await signInFrom('198.51.100.20', owner.password)).statusCode).toBe(200)
  })

  it('al propietario se le guarda con su usuario de Better Auth', async () => {
    const { secret } = await issueBootstrap(conn.db, { organizationName: 'Crisol de Enrique' })
    await post('/api/bootstrap', { secret, ...owner })
    const [account] = await conn.db.select().from(schema.user).where(eq(schema.user.email, owner.email))
    const [token] = await conn.db.select().from(schema.bootstrapTokens)
    expect(token?.usedBy).toBe(account?.id)
  })
})
