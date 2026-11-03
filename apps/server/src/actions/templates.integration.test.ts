import { TEMPLATE_ICONS as CONTRACT_ICONS, pageTemplate } from '@crisol/contracts'
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { BUILT_IN_TEMPLATES, TEMPLATE_ICONS } from '@crisol/domain'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

describe('las plantillas de serie', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }

  const call = (name: string, payload: object, cookie = owner.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_templates'), { max: 4 })
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
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org.id, userId: owner.userId, role: 'owner' })
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('cada una cumple el contrato de la API, también su panel, y los iconos son los mismos', () => {
    expect([...CONTRACT_ICONS]).toEqual([...TEMPLATE_ICONS])
    for (const template of BUILT_IN_TEMPLATES) expect(pageTemplate.safeParse(template).success, template.id).toBe(true)
  })

  it('se ven las seis, y una entera por su id', async () => {
    const list = await call('listTemplates', {})
    expect(list.statusCode, list.body).toBe(200)
    expect(list.json().templates.map((t: { id: string }) => t.id)).toEqual([
      'pnj',
      'lugar',
      'faccion',
      'objeto',
      'mision',
      'sesion'
    ])
    const pnj = await call('getTemplate', { templateId: 'pnj' })
    expect(pnj.statusCode).toBe(200)
    expect(pnj.json()).toMatchObject({ id: 'pnj', name: 'PNJ', builtIn: true, line: ['pnj'] })
    expect((await call('getTemplate', { templateId: 'frente' })).statusCode).toBe(404)
  })

  it('sin cuenta no se ven', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/actions/listTemplates',
      payload: {},
      headers: { origin: BASE_URL }
    })
    expect(response.statusCode).toBe(401)
  })
})
