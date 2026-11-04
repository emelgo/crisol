import { systemFull } from '@crisol/contracts'
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { fronteras } from '@crisol/systems/fixtures'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'
import { MAX_SYSTEMS } from './systems.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

describe('los sistemas de reglas', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }

  const call = (name: string, payload: object, cookie = owner.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = owner.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const code = async (name: string, payload: object, cookie = owner.cookie) => {
    const response = await call(name, payload, cookie)
    return { status: response.statusCode, code: response.json().code as string }
  }
  const organization = async (userId: string, name: string) => {
    const [org] = await conn.db.insert(schema.organizations).values({ name }).returning()
    if (!org) throw new Error('sin organización')
    await conn.db.insert(schema.organizationMembers).values({ organizationId: org.id, userId, role: 'owner' })
    return org.id
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_systems'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY }
    })
    owner = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    await organization(owner.userId, 'Fateforge')
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('los de serie: «En blanco», entero y de solo lectura', async () => {
    const { systems } = await ok200('listSystems', {})
    expect(systems).toEqual([
      expect.objectContaining({
        id: 'blank',
        name: 'En blanco',
        builtIn: true,
        version: 1,
        basedOn: null,
        campaigns: []
      })
    ])
    const blank = await ok200('getSystem', { systemId: 'blank' })
    expect(systemFull.safeParse(blank).success).toBe(true)
    expect(blank.document).toMatchObject({ id: 'blank', dice: { default: '1d20', critical: 'd20' } })
    expect((await code('getSystem', { systemId: 'nada' })).status).toBe(404)
    expect((await code('getSystem', { systemId: crypto.randomUUID() })).status).toBe(404)
  })

  it('crear uno copiando «En blanco», cambiarlo con su versión y copiar el propio', async () => {
    const created = await ok200('createSystem', { name: 'Fronteras' })
    expect(created).toMatchObject({
      name: 'Fronteras',
      builtIn: false,
      version: 1,
      basedOn: { id: 'blank', name: 'En blanco', version: 1 }
    })
    expect(created.document.id).toBe(created.id)

    const { system, warnings } = await ok200('updateSystem', { systemId: created.id, version: 1, document: fronteras })
    expect(warnings).toEqual([])
    expect(system).toMatchObject({ id: created.id, version: 2, release: '7' })
    expect(system.types.map((t: { key: string }) => t.key)).toEqual(['personaje', 'objeto', 'movimiento'])
    expect(system.rolls).toEqual([{ key: 'atributo', label: 'Atributo' }])
    // Su id es el suyo, aunque el documento diga otro
    expect(system.document.id).toBe(created.id)

    const renamed = await ok200('updateSystem', { systemId: created.id, version: 2, name: 'Fronteras del norte' })
    expect(renamed.system).toMatchObject({ name: 'Fronteras del norte', version: 3 })

    const copy = await ok200('createSystem', { name: 'Fronteras de Eana', from: created.id })
    expect(copy.basedOn).toEqual({ id: created.id, name: 'Fronteras del norte', version: 3 })
    expect(copy.document.types).toEqual(system.document.types)
    const list = (await ok200('listSystems', {})).systems.map((s: { name: string }) => s.name)
    expect(list).toEqual(['En blanco', 'Fronteras del norte', 'Fronteras de Eana'])
  })

  it('no se pisa lo que cambió otro, ni se guarda lo que tiene errores; los avisos vuelven', async () => {
    const created = await ok200('createSystem', { name: 'Fronteras' })
    await ok200('updateSystem', { systemId: created.id, version: 1, document: fronteras })
    expect(await code('updateSystem', { systemId: created.id, version: 1, name: 'Otro' })).toEqual({
      status: 400,
      code: 'SYSTEM_CHANGED'
    })
    const broken = structuredClone(fronteras)
    Object.assign(broken.types.personaje?.fields.defensa as object, { formula: '7 + @vigr' })
    expect(await code('updateSystem', { systemId: created.id, version: 2, document: broken })).toEqual({
      status: 400,
      code: 'SYSTEM_INVALID'
    })
    const unknown = structuredClone(fronteras) as typeof fronteras & Record<string, unknown>
    unknown.icono = 'brujula'
    const { warnings, system } = await ok200('updateSystem', { systemId: created.id, version: 2, document: unknown })
    expect(warnings).toEqual([expect.objectContaining({ path: 'icono', severity: 'warning' })])
    // Lo desconocido se conserva
    expect(system.document.icono).toBe('brujula')
    expect(await code('updateSystem', { systemId: created.id, version: 3 })).toEqual({
      status: 400,
      code: 'NOTHING_TO_CHANGE'
    })
  })

  it('deshacer un cambio y borrar (también se deshace)', async () => {
    const created = await ok200('createSystem', { name: 'Fronteras' })
    await ok200('updateSystem', { systemId: created.id, version: 1, document: fronteras })
    const history = async () => (await ok200('listHistory', {})).entries as { id: string; action: string }[]
    const change = (await history()).find((e) => e.action === 'updateSystem')
    expect((await ok200('undoOperation', { operationId: change?.id })).status).toBe('undone')
    expect((await ok200('getSystem', { systemId: created.id })).types).toEqual([
      expect.objectContaining({ key: 'personaje', fields: 0 })
    ])

    expect(await ok200('deleteSystem', { systemId: created.id })).toEqual({ id: created.id, name: 'Fronteras' })
    expect((await code('getSystem', { systemId: created.id })).status).toBe(404)
    expect((await ok200('listSystems', {})).systems).toHaveLength(1)
    const deletion = (await history()).find((e) => e.action === 'deleteSystem')
    await ok200('undoOperation', { operationId: deletion?.id })
    expect((await ok200('getSystem', { systemId: created.id })).name).toBe('Fronteras')
  })

  it('los de serie no se cambian ni se borran; uno de otra cuenta, ni se ve', async () => {
    expect((await code('updateSystem', { systemId: crypto.randomUUID(), version: 1, name: 'x' })).status).toBe(404)
    expect((await code('deleteSystem', { systemId: crypto.randomUUID() })).status).toBe(404)
    const created = await ok200('createSystem', { name: 'Fronteras' })
    const other = await signUpTestUser(auth, { name: 'Otra', email: 'otra@crisol.test' })
    await organization(other.userId, 'Otra cuenta')
    expect((await code('getSystem', { systemId: created.id }, other.cookie)).status).toBe(404)
    expect((await code('createSystem', { name: 'Copia', from: created.id }, other.cookie)).status).toBe(404)
    // Ni se dice que existe
    expect((await code('updateSystem', { systemId: created.id, version: 1, name: 'Mío' }, other.cookie)).status).toBe(
      404
    )
    expect((await code('deleteSystem', { systemId: created.id }, other.cookie)).status).toBe(404)
    expect((await ok200('listSystems', {}, other.cookie)).systems.map((s: { id: string }) => s.id)).toEqual(['blank'])
  })

  it(`como mucho ${MAX_SYSTEMS} por cuenta`, async () => {
    for (let i = 0; i < MAX_SYSTEMS; i++) await ok200('createSystem', { name: `S${i}` })
    expect(await code('createSystem', { name: 'Uno más' })).toEqual({ status: 400, code: 'TOO_MANY_SYSTEMS' })
  })
})
