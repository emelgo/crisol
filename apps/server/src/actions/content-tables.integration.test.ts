import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { exampleFile } from '@crisol/systems/examples'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

/** Dos tablas del mundo: la de encuentros, sin reemplazo, y una de sus filas lleva a la de tesoros */
const encuentros = {
  type: 'tabla',
  key: 'encuentros',
  data: { name: { es: 'Encuentros en el camino' } },
  table: {
    formula: '1d2',
    replacement: false,
    rows: [
      { id: 'bandidos', from: 1, to: 1, text: 'Bandidos' },
      { id: 'cofre', from: 2, to: 2, text: 'Un cofre abandonado', key: 'tesoros' }
    ]
  }
}
const tesoros = {
  type: 'tabla',
  key: 'tesoros',
  data: { name: { es: 'Tesoros' } },
  table: { rows: [{ id: 'oro', from: 1, to: 1, text: '[[/r 2d6]] monedas de oro' }] }
}

describe('las tablas del compendio (docs/specs/tablas-compendio.md)', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let master: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let worldId: string
  let campaignId: string
  let five: string

  const call = (name: string, payload: object, cookie = master.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const code = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    return { status: response.statusCode, code: response.json().code as string }
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_content_tables'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY }
    })
    master = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Mesa' }).returning()
    if (!org) throw new Error('sin organización')
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org.id, userId: master.userId, role: 'owner' })
    worldId = (await ok200('createWorld', { name: 'Valdren' })).id
    five = (await ok200('importSystem', { file: exampleFile('5e') })).system.id
    campaignId = (await ok200('createCampaign', { worldId, name: 'La Marca', system: five })).id
    ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    const url = (await ok200('getInvitation', { campaignId })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: ana.cookie }
    })
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('una tabla del mundo en un sistema que no declara «Tabla»: sale en el compendio y se lee con sus filas', async () => {
    const saved = await ok200('putWorldContent', { worldId, systemId: five, items: [encuentros, tesoros] })
    expect(saved.warnings).toEqual([])
    const compendium = await ok200('getCampaignCompendium', { campaignId })
    expect(compendium.world.types).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'tabla', label: 'Tabla', count: 2 })])
    )
    const [read] = (await ok200('getCampaignContent', { campaignId, keys: ['encuentros'] })).items
    expect(read).toMatchObject({ type: 'tabla', table: encuentros.table, drawn: [] })
  })

  it('sin reemplazo no repite hasta reiniciarla, y la fila que lleva a otra tabla la tira también', async () => {
    await ok200('putWorldContent', { worldId, systemId: five, items: [encuentros, tesoros] })
    const roll = () => ok200('rollContentTable', { campaignId, key: 'encuentros', visibility: 'hidden' })
    const first = await roll()
    const second = await roll()
    expect(new Set([first.row, second.row])).toEqual(new Set([0, 1]))
    expect(second.drawn.sort()).toEqual(['bandidos', 'cofre'])
    expect(first.roll).toMatchObject({ label: 'Encuentros en el camino', visibility: 'hidden' })
    // El cofre lleva a los tesoros: su tirada, con lo que salió en ella
    const cofre = [first, second].find((r) => r.row === 1)
    expect(cofre.roll.table).toEqual({
      name: 'Encuentros en el camino',
      results: [
        { text: 'Un cofre abandonado', page: null, content: 'tesoros' },
        { text: 'Tesoros: [[/r 2d6]] monedas de oro', page: null }
      ]
    })
    expect(await code('rollContentTable', { campaignId, key: 'encuentros' })).toEqual({
      status: 400,
      code: 'TABLE_EMPTY'
    })
    const [read] = (await ok200('getCampaignContent', { campaignId, keys: ['encuentros'] })).items
    expect(read.drawn.sort()).toEqual(['bandidos', 'cofre'])

    // La jugadora no la reinicia (ni ve las del mundo, hasta el módulo 5); el máster, sí
    expect((await call('resetContentTable', { campaignId, key: 'encuentros' }, ana.cookie)).statusCode).toBe(404)
    expect((await call('rollContentTable', { campaignId, key: 'encuentros' }, ana.cookie)).statusCode).toBe(404)
    await ok200('resetContentTable', { campaignId, key: 'encuentros' })
    expect((await roll()).drawn).toHaveLength(1)
    // Las que repiten no apuntan nada
    expect((await ok200('rollContentTable', { campaignId, key: 'tesoros' })).drawn).toEqual([])
  })

  it('solo una tabla lleva filas, y solo una tabla se tira así; sus rangos con huecos, un aviso', async () => {
    const espada = { type: 'arma', key: 'espada_de_valdren', data: { name: { es: 'Espada' }, dano: '1d8' } }
    expect(
      await code('putWorldContent', { worldId, systemId: five, items: [{ ...espada, table: tesoros.table }] })
    ).toEqual({ status: 400, code: 'SYSTEM_INVALID' })
    await ok200('putWorldContent', { worldId, systemId: five, items: [espada] })
    expect(await code('rollContentTable', { campaignId, key: 'espada_de_valdren' })).toEqual({
      status: 400,
      code: 'NOT_A_TABLE'
    })
    const gap = { ...tesoros, table: { formula: '1d4', rows: [{ id: 'a', from: 1, to: 2, text: 'Poco' }] } }
    const saved = await ok200('putWorldContent', { worldId, systemId: five, items: [gap] })
    expect(saved.warnings.map((w: { message: string }) => w.message)).toEqual([
      'Con 1d4 puede salir 4, y la última fila acaba en 2'
    ])
  })
})
