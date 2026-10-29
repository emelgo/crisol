import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from './app.ts'
import type { Auth } from './auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from './testing.ts'

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined

describe('unirse con el enlace', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let master: { userId: string; cookie: string }
  let campaign: { id: string; worldId: string }
  let secret: string
  let webDir: string

  const request = (method: 'GET' | 'POST', url: string, payload?: object, cookie?: string, ip = '203.0.113.1') =>
    app.inject({
      method,
      url,
      ...(payload ? { payload } : {}),
      headers: { origin: BASE_URL, 'x-forwarded-for': ip, ...(cookie ? { cookie } : {}) }
    })
  const action = (name: string, payload: object, cookie: string) =>
    request('POST', `/api/actions/${name}`, payload, cookie)
  const members = async () => (await conn.db.select().from(schema.campaignMembers)).length

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_join'), { max: 2 })
    webDir = mkdtempSync(join(tmpdir(), 'web-'))
    writeFileSync(
      join(webDir, 'index.html'),
      '<head><meta property="og:description" content="Mundos de rol y mesa virtual" /></head>'
    )
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY },
      webDir
    })
    master = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Fateforge' }).returning()
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org?.id ?? '', userId: master.userId, role: 'owner' })
    const world = (await action('createWorld', { name: 'Eana' }, master.cookie)).json()
    campaign = (await action('createCampaign', { worldId: world.id, name: 'La Marca' }, master.cookie)).json()
    secret = (await action('getInvitation', { campaignId: campaign.id }, master.cookie)).json().url.split('/unirse/')[1]
  })

  afterAll(async () => {
    await conn?.close()
    rmSync(webDir, { recursive: true, force: true })
  })

  it('abrir el enlace enseña la campaña, el mundo y el máster, y no cambia nada', async () => {
    const response = await request('GET', `/api/join/${secret}`)
    expect(response.json()).toEqual({ campaignName: 'La Marca', worldName: 'Eana', masterName: 'Enrique' })
    expect(await members()).toBe(1)
  })

  it('la página de un enlace tiene una vista previa genérica y no se indexa', async () => {
    const page = await request('GET', `/unirse/${secret}`)
    expect(page.body).toContain('Invitación a una campaña de Crisol')
    expect(page.body).not.toContain('La Marca')
    expect(page.headers['x-robots-tag']).toBe('noindex')
  })

  it('un enlace desconocido, cambiado o con las invitaciones cerradas da la misma respuesta', async () => {
    const unknown = (await request('GET', '/api/join/no-existe')).json()
    await action('regenerateInvitation', { campaignId: campaign.id }, master.cookie)
    const replaced = (await request('GET', `/api/join/${secret}`)).json()
    const current = (await action('getInvitation', { campaignId: campaign.id }, master.cookie))
      .json()
      .url.split('/unirse/')[1]
    await action('setInvitationsOpen', { campaignId: campaign.id, open: false }, master.cookie)
    const closed = await request('GET', `/api/join/${current}`)
    expect(closed.statusCode).toBe(404)
    expect([unknown, replaced, closed.json()]).toEqual([
      { code: 'INVALID_LINK' },
      { code: 'INVALID_LINK' },
      { code: 'INVALID_LINK' }
    ])
  })

  it('con sesión, entrar une como jugador y queda en el historial', async () => {
    const player = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
    const response = await request('POST', '/api/join', { secret }, player.cookie)
    expect(response.json()).toEqual({ status: 'joined', campaignId: campaign.id, worldId: campaign.worldId })
    expect((await action('listCampaigns', { worldId: campaign.worldId }, player.cookie)).json().campaigns).toEqual([
      expect.objectContaining({ id: campaign.id, role: 'player' })
    ])
    const op = (await conn.db.select().from(schema.operations)).find((o) => o.action === 'joinCampaign')
    expect(op).toMatchObject({
      actorId: player.userId,
      worldId: campaign.worldId,
      details: { campaign: 'La Marca', world: 'Eana' }
    })
  })

  it('sin sesión, entrar pide sesión', async () => {
    expect((await request('POST', '/api/join', { secret })).statusCode).toBe(401)
  })

  it('quien ya está, y el máster, no entran otra vez', async () => {
    const player = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
    await request('POST', '/api/join', { secret }, player.cookie)
    expect((await request('POST', '/api/join', { secret }, player.cookie)).json()).toMatchObject({ status: 'member' })
    expect((await request('POST', '/api/join', { secret }, master.cookie)).json()).toMatchObject({ status: 'master' })
    expect(await members()).toBe(2)
  })

  it('con las invitaciones cerradas no entra nadie', async () => {
    await action('setInvitationsOpen', { campaignId: campaign.id, open: false }, master.cookie)
    const player = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
    expect((await request('POST', '/api/join', { secret }, player.cookie)).json()).toEqual({ code: 'INVALID_LINK' })
    expect(await members()).toBe(1)
  })

  describe('crear la cuenta con el enlace', () => {
    const person = { name: 'Jugadora', email: 'nueva@crisol.test', password: 'una-clave-larga' }

    it('crea la cuenta, la une a la campaña y deja la sesión abierta', async () => {
      const response = await request('POST', '/api/join/signup', { secret, ...person })
      expect(response.statusCode).toBe(201)
      expect(response.json()).toEqual({ status: 'joined', campaignId: campaign.id, worldId: campaign.worldId })
      const cookie = response.cookies.find((c) => c.name.endsWith('session_token'))
      expect(cookie).toBeDefined()
      const campaigns = await action('listCampaigns', { worldId: campaign.worldId }, `${cookie?.name}=${cookie?.value}`)
      expect(campaigns.json().campaigns).toHaveLength(1)
    })

    it('con un enlace que no vale no crea ninguna cuenta', async () => {
      const response = await request('POST', '/api/join/signup', { secret: 'no-existe', ...person })
      expect(response.json()).toEqual({ code: 'INVALID_LINK' })
      expect((await conn.db.select().from(schema.user)).map((u) => u.email)).not.toContain(person.email)
    })

    it('con un email que ya tiene cuenta lo dice y no une a nadie', async () => {
      await signUpTestUser(auth, { name: 'Otra', email: person.email })
      const response = await request('POST', '/api/join/signup', { secret, ...person })
      expect(response.statusCode).toBe(409)
      expect(response.json()).toEqual({ code: 'EMAIL_TAKEN' })
      expect(await members()).toBe(1)
    })

    it('con datos no válidos no crea nada', async () => {
      const response = await request('POST', '/api/join/signup', { secret, ...person, password: 'corta' })
      expect(response.json()).toMatchObject({ code: 'INVALID_INPUT' })
    })

    it('el registro público sigue cerrado', async () => {
      expect((await request('POST', '/api/auth/sign-up/email', person)).statusCode).toBe(403)
    })
  })

  it('los intentos con enlaces se limitan por IP, sin bloquear a los demás', async () => {
    const statuses = []
    for (let i = 0; i < 31; i++)
      statuses.push((await request('GET', '/api/join/no-existe', undefined, undefined, '198.51.100.9')).statusCode)
    expect(statuses.at(-1)).toBe(429)
    expect((await request('GET', `/api/join/${secret}`, undefined, undefined, '198.51.100.10')).statusCode).toBe(200)
  })
})
