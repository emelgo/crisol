import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { LIMITS } from '@crisol/systems'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { foundryZip, inFolder, levelFiles, nedbFile } from '../foundry/testing.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined
const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

const manifest = {
  id: 'mazmorra',
  title: 'Mazmorra',
  version: '1.0',
  packs: [
    { name: 'armas', label: 'Armas', type: 'Item', path: 'packs/armas.db' },
    { name: 'monstruos', label: 'Monstruos', type: 'Actor', path: 'packs/monstruos' },
    { name: 'tablas', label: 'Tablas', type: 'RollTable', path: 'packs/tablas.db' }
  ]
}
const weapons = [
  {
    _id: 'daga000000000001',
    name: 'Daga',
    type: 'weapon',
    system: { description: { value: '<p>Corta</p>' }, weight: 1 }
  },
  { _id: 'maza000000000001', name: 'Maza', type: 'weapon', system: { weight: 4 } }
]
const table = {
  _id: 'tabla00000000001',
  name: 'Botín',
  formula: '1d4',
  results: [
    { _id: 'a', range: [1, 2], text: 'Nada' },
    { _id: 'b', range: [3, 4], text: 'Oro' }
  ]
}

describe('traer un sistema de Foundry', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }
  let zip: string
  let organizationId: string

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

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_foundry'), { max: 4 })
    const monsters = await levelFiles({
      '!actors!trasgo0000000001': { name: 'Trasgo', type: 'npc', system: { hp: 7 }, items: ['cimitarra0000001'] },
      '!actors.items!trasgo0000000001.cimitarra0000001': {
        name: 'Cimitarra',
        type: 'weapon',
        system: { description: { value: '<p>[[/r 1d6]] cortante</p>' } }
      }
    })
    zip = base64(
      foundryZip({
        'mazmorra/system.json': manifest,
        'mazmorra/lang/en.json': { TYPES: { Item: { weapon: 'Weapon' }, Actor: { npc: 'Creature' } } },
        'mazmorra/packs/armas.db': nedbFile(weapons),
        'mazmorra/packs/tablas.db': nedbFile([table]),
        ...inFolder('mazmorra/packs/monstruos', monsters)
      })
    )
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
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org.id, userId: owner.userId, role: 'owner' })
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('lo que trae el zip, sin guardar nada', async () => {
    const read = await ok200('inspectFoundry', { zip })
    expect(read).toEqual({
      kind: 'system',
      id: 'mazmorra',
      title: 'Mazmorra',
      version: '1.0',
      system: null,
      languages: [],
      packs: [
        { name: 'armas', label: 'Armas', type: 'Item', documents: 2, supported: true },
        { name: 'monstruos', label: 'Monstruos', type: 'Actor', documents: 1, supported: true },
        { name: 'tablas', label: 'Tablas', type: 'RollTable', documents: 1, supported: true }
      ]
    })
    expect((await ok200('listSystems', {})).systems.filter((s: { builtIn: boolean }) => !s.builtIn)).toEqual([])
  })

  it('crea un sistema de la cuenta con sus tipos y su contenido, que se busca y se lee', async () => {
    const { system, warnings } = await ok200('importFoundry', { zip, language: 'es' })
    expect(warnings).toEqual([])
    expect(system).toMatchObject({ name: 'Mazmorra', builtIn: false, version: 1, content: 4 })
    expect(Object.keys(system.document.types).sort()).toEqual(['npc', 'tabla', 'weapon'])
    const found = await ok200('searchSystemContent', { systemId: system.id, query: 'daga' })
    expect(found.items.map((i: { name: string }) => i.name)).toEqual(['Daga'])
    const daga = (await ok200('getSystemContent', { systemId: system.id, keys: [found.items[0].key] })).items[0]
    expect(daga.data).toMatchObject({ weight: 1, description: { es: 'Corta' } })
    const tabla = (await ok200('searchSystemContent', { systemId: system.id, type: 'tabla' })).items[0]
    const read = (await ok200('getSystemContent', { systemId: system.id, keys: [tabla.key] })).items[0]
    // La tabla, de verdad: sus filas, que se tiran en una campaña con ese sistema
    expect(read.data.description).toBeUndefined()
    expect(read.table).toEqual({
      formula: '1d4',
      rows: [
        { id: 'a', from: 1, to: 2, text: 'Nada' },
        { id: 'b', from: 3, to: 4, text: 'Oro' }
      ]
    })
    const world = await ok200('createWorld', { name: 'Valdren' })
    const campaign = await ok200('createCampaign', { worldId: world.id, name: 'La Marca', system: system.id })
    const rolled = await ok200('rollContentTable', { campaignId: campaign.id, key: tabla.key })
    expect(rolled.roll.table.name).toBe('Botín')
    expect(rolled.roll.table.results[0].text).toBe(rolled.roll.total <= 2 ? 'Nada' : 'Oro')
  })

  it('solo los paquetes que se piden; uno que no tiene, un error', async () => {
    const { system } = await ok200('importFoundry', { zip, language: 'en', packs: ['armas'] })
    expect(system).toMatchObject({ content: 2 })
    expect(Object.keys(system.document.types)).toEqual(['weapon'])
    expect(await code('importFoundry', { zip, language: 'es', packs: ['nada'] })).toEqual({
      status: 400,
      code: 'FOUNDRY_INVALID'
    })
    expect(await code('importFoundry', { zip: base64(new Uint8Array([1, 2, 3])), language: 'es' })).toEqual({
      status: 400,
      code: 'FOUNDRY_INVALID'
    })
  })

  it('un módulo dentro de uno propio: sus documentos se suman, con la versión que se tenía', async () => {
    const { system } = await ok200('importFoundry', { zip, language: 'es', packs: ['armas'] })
    const module = base64(
      foundryZip({
        'module.json': {
          id: 'extra',
          title: 'Extra',
          packs: [{ name: 'mas', label: 'Más', type: 'Item', path: 'packs/mas.db' }]
        },
        'packs/mas.db': nedbFile([{ _id: 'lanza00000000001', name: 'Lanza', type: 'weapon', system: { weight: 3 } }])
      })
    )
    const into = { systemId: system.id, version: system.version }
    const merged = await ok200('importFoundry', { zip: module, language: 'es', into })
    expect(merged.system).toMatchObject({ id: system.id, name: 'Mazmorra', version: 2, content: 3 })
    expect(merged.system.document.sources.map((s: { key: string }) => s.key)).toEqual(['armas', 'mas'])
    expect(await code('importFoundry', { zip: module, language: 'es', into })).toEqual({
      status: 400,
      code: 'SYSTEM_CHANGED'
    })
  })

  it('si no cabe, FOUNDRY_TOO_BIG y no se guarda nada', async () => {
    const many = Array.from({ length: LIMITS.contentDocuments + 1 }, (_, i) => ({
      _id: `d${i}`,
      name: `D${i}`,
      type: 'x'
    }))
    const big = base64(
      foundryZip({
        'system.json': { id: 'grande', packs: [{ name: 'p', label: 'P', type: 'Item', path: 'packs/p.db' }] },
        'packs/p.db': nedbFile(many)
      })
    )
    expect(await code('importFoundry', { zip: big, language: 'es' })).toEqual({ status: 400, code: 'FOUNDRY_TOO_BIG' })
    expect((await ok200('listSystems', {})).systems.filter((s: { builtIn: boolean }) => !s.builtIn)).toEqual([])
  })

  it('sin sesión, ni se lee; quien no es de la cuenta, ni la ve', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/actions/importFoundry',
      payload: { zip: 'A'.repeat(12 * 1024 * 1024), language: 'es' },
      headers: { origin: BASE_URL }
    })
    expect(response.statusCode).toBe(401)
    const player = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    expect(await code('importFoundry', { zip, language: 'es', organizationId }, player.cookie)).toEqual({
      status: 404,
      code: 'NOT_FOUND'
    })
    expect(await code('inspectFoundry', { zip, organizationId }, player.cookie)).toEqual({
      status: 404,
      code: 'NOT_FOUND'
    })
  })
})
