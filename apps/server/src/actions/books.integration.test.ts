import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { exampleFile } from '@crisol/systems/examples'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'
import { bookKeyOf } from './books.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

/** Un conjuro como los saca la IA de un PDF: su clave, sus datos y lo de la revisión */
const spell = (key: string, name: string, page: number, notes: string[] = []) => ({
  type: 'conjuro',
  key,
  data: {
    name: { es: name },
    nivel: 2,
    escuela: 'evocacion',
    descripcion: { es: `${name}: una lanza de brasas.` }
  },
  review: { page, excerpt: `${name}\nEvocación de nivel 2`, notes }
})

describe('los libros de un sistema y lo pendiente de revisar (ADR-0021)', () => {
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
  const import5e = async (): Promise<string> => (await ok200('importSystem', { file: exampleFile('5e') })).system.id
  const books = async (systemId: string) => ok200('getSystemBooks', { systemId })
  const history = async () => (await ok200('listHistory', {})).entries as { id: string; action: string }[]

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_books'), { max: 4 })
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

  it('la clave de un libro sale de su nombre, sin tildes ni repetir', () => {
    expect(bookKeyOf('Manual del jugador', new Set())).toBe('manual_del_jugador')
    expect(bookKeyOf('Grimorio', new Set(['grimorio', 'grimorio_2']))).toBe('grimorio_3')
    expect(bookKeyOf('2024: Guía', new Set())).toBe('libro_2024_guia')
  })

  it('ver los libros del 5e: cuánto trae cada uno por tipo, sin pendientes ni campañas', async () => {
    const five = await import5e()
    const seen = await books(five)
    expect(seen).toMatchObject({ systemId: five, name: '5e', editable: true })
    expect(seen.books.map((b: { key: string }) => b.key)).toEqual(['srd51', 'srd521'])
    const srd = seen.books[1]
    expect(srd).toMatchObject({ edition: '2024', pending: 0, campaigns: [], version: 1, cover: null })
    expect(srd.count).toBeGreaterThan(1000)
    expect(srd.byType.find((t: { type: string }) => t.type === 'conjuro')).toMatchObject({
      label: 'Conjuro',
      count: 339
    })
    // «En blanco» (de serie) se ve, pero no se cambia
    expect((await books('blank')).editable).toBe(false)
  })

  it('crear, cambiar y borrar un libro, con su versión; el que usa una campaña no se borra; todo se deshace', async () => {
    const five = await import5e()
    const created = await ok200('createBook', {
      systemId: five,
      version: 1,
      name: 'Grimorio',
      description: 'Los conjuros de Eana.',
      edition: '2024',
      origin: 'own',
      requires: ['srd521']
    })
    expect(created).toEqual({ version: 2, key: 'grimorio' })
    // Con la versión de antes, no: lo cambió otro
    expect((await code('createBook', { systemId: five, version: 1, name: 'Otro' })).code).toBe('SYSTEM_CHANGED')
    expect((await code('createBook', { systemId: five, version: 2, key: 'srd51', name: 'X' })).code).toBe('BOOK_EXISTS')
    expect((await code('createBook', { systemId: five, version: 2, name: 'X', requires: ['nada'] })).code).toBe(
      'SYSTEM_INVALID'
    )
    let grimorio = (await books(five)).books.find((b: { key: string }) => b.key === 'grimorio')
    expect(grimorio).toMatchObject({
      name: 'Grimorio',
      description: 'Los conjuros de Eana.',
      license: 'Uso privado',
      requires: ['srd521'],
      count: 0
    })

    const changed = await ok200('updateBook', {
      systemId: five,
      version: 2,
      key: 'grimorio',
      name: 'Grimorio de Eana',
      description: null,
      newVersion: true
    })
    expect(changed.version).toBe(3)
    grimorio = (await books(five)).books.find((b: { key: string }) => b.key === 'grimorio')
    expect(grimorio).toMatchObject({ name: 'Grimorio de Eana', description: null, version: 2 })

    // Una campaña con el 5e (sin elegir libros: todos) lo usa
    const world = await ok200('createWorld', { name: 'Eana' })
    const campaign = await ok200('createCampaign', { worldId: world.id, name: 'La Marca' })
    await ok200('updateCampaign', { campaignId: campaign.id, system: five })
    expect((await code('deleteBook', { systemId: five, version: 3, key: 'grimorio' })).code).toBe('BOOK_IN_USE')
    await ok200('updateCampaign', { campaignId: campaign.id, systemChoices: { sources: ['srd521'] } })
    expect((await books(five)).books.find((b: { key: string }) => b.key === 'srd521').campaigns).toEqual([
      { id: campaign.id, worldId: world.id, name: 'La Marca' }
    ])

    await ok200('proposeContent', {
      systemId: five,
      source: 'grimorio',
      items: [spell('lanza_de_ceniza', 'Lanza de ceniza', 88)]
    })
    expect(await ok200('deleteBook', { systemId: five, version: 3, key: 'grimorio' })).toEqual({
      version: 4,
      deleted: 1
    })
    expect((await books(five)).books.map((b: { key: string }) => b.key)).toEqual(['srd51', 'srd521'])
    const deletion = (await history()).find((e) => e.action === 'deleteBook')
    await ok200('undoOperation', { operationId: deletion?.id })
    expect((await books(five)).books.find((b: { key: string }) => b.key === 'grimorio')).toMatchObject({ pending: 1 })
  })

  it('lo que propone la IA queda pendiente: no se ve hasta aceptarlo; se acepta con otro tipo o se descarta', async () => {
    const five = await import5e()
    await ok200('createBook', { systemId: five, version: 1, name: 'Grimorio', origin: 'pdf' })
    const world = await ok200('createWorld', { name: 'Eana' })
    const campaign = await ok200('createCampaign', { worldId: world.id, name: 'La Marca' })
    await ok200('updateCampaign', { campaignId: campaign.id, system: five })

    const proposed = await ok200('proposeContent', {
      systemId: five,
      source: 'grimorio',
      items: [
        spell('lanza_de_ceniza', 'Lanza de ceniza', 88),
        spell('velo_de_eana', 'Velo de Eana', 141, ['sin tiempo de lanzamiento']),
        spell('bola_de_fuego_eana', 'Bola de fuego', 64)
      ]
    })
    expect(proposed).toMatchObject({
      proposed: ['lanza_de_ceniza', 'velo_de_eana', 'bola_de_fuego_eana'],
      taken: [],
      // Ya está en las reglas de serie con ese nombre
      repeated: ['bola_de_fuego_eana']
    })
    // Una clave de una entrada ya aceptada no se toca
    const taken = await ok200('proposeContent', {
      systemId: five,
      source: 'grimorio',
      items: [{ ...spell('bola_de_fuego_2024', 'Bola de fuego', 64) }]
    })
    expect(taken).toMatchObject({ proposed: [], taken: ['bola_de_fuego_2024'] })

    // No se ve: ni en el compendio de la campaña, ni al buscar en el sistema; sí en el recuento del libro
    const search = async () =>
      (await ok200('searchCampaignContent', { campaignId: campaign.id, query: 'lanza de ceniza' })).items.map(
        (h: { key: string }) => h.key
      )
    expect(await search()).toEqual([])
    expect(
      (await ok200('searchSystemContent', { systemId: five, query: 'velo de eana' })).items.map(
        (h: { key: string }) => h.key
      )
    ).toEqual([])
    expect((await books(five)).books.find((b: { key: string }) => b.key === 'grimorio')).toMatchObject({
      count: 0,
      pending: 3
    })

    const pending = await ok200('listPending', { systemId: five, source: 'grimorio' })
    expect(pending.counts).toEqual([{ type: 'conjuro', label: 'Conjuro', count: 3 }])
    const velo = pending.items.find((i: { key: string }) => i.key === 'velo_de_eana')
    expect(velo).toMatchObject({ name: 'Velo de Eana', page: 141, notes: ['sin tiempo de lanzamiento'], repeats: null })
    expect(velo.excerpt).toContain('Evocación de nivel 2')
    expect(velo.item.ref).toEqual({ pages: { es: 141 } })
    expect(pending.items.find((i: { key: string }) => i.key === 'bola_de_fuego_eana').repeats).toMatchObject({
      key: 'bola_de_fuego_2024',
      source: 'srd521',
      name: 'Bola de fuego'
    })

    expect(
      (await code('settlePending', { systemId: five, accept: ['velo_de_eana'], types: { velo_de_eana: 'nada' } })).code
    ).toBe('BAD_TYPE')
    const settled = await ok200('settlePending', {
      systemId: five,
      accept: ['lanza_de_ceniza', 'velo_de_eana'],
      discard: ['bola_de_fuego_eana'],
      types: { velo_de_eana: 'conjuro' }
    })
    expect(settled).toMatchObject({ accepted: ['lanza_de_ceniza', 'velo_de_eana'], discarded: ['bola_de_fuego_eana'] })
    expect(await search()).toEqual(['lanza_de_ceniza'])
    expect((await books(five)).books.find((b: { key: string }) => b.key === 'grimorio')).toMatchObject({
      count: 2,
      pending: 0
    })
  })

  it('lo que la campaña deja fuera de sus libros no existe para ella', async () => {
    const five = await import5e()
    const world = await ok200('createWorld', { name: 'Eana' })
    const campaign = await ok200('createCampaign', { worldId: world.id, name: 'La Marca' })
    await ok200('updateCampaign', {
      campaignId: campaign.id,
      system: five,
      systemChoices: { sources: ['srd521'], excluded: ['bola_de_fuego_2024'] }
    })
    const keys = async (query: string) =>
      (await ok200('searchCampaignContent', { campaignId: campaign.id, query })).items.map(
        (h: { key: string }) => h.key
      )
    expect(await keys('bola de fuego')).not.toContain('bola_de_fuego_2024')
    expect(await keys('proyectil magico')).toEqual(['proyectil_magico_2024'])
    expect(await ok200('getCampaignContent', { campaignId: campaign.id, keys: ['bola_de_fuego_2024'] })).toMatchObject({
      items: [],
      missing: ['bola_de_fuego_2024']
    })
    // Para el sistema, sigue estando
    expect(
      (await ok200('searchSystemContent', { systemId: five, query: 'bola de fuego' })).items.map(
        (h: { key: string }) => h.key
      )
    ).toContain('bola_de_fuego_2024')
  })

  it('solo el propietario del sistema cambia sus libros y revisa lo pendiente', async () => {
    const five = await import5e()
    const other = await signUpTestUser(auth, { name: 'Bruno', email: 'bruno@crisol.test' })
    expect((await code('createBook', { systemId: five, version: 1, name: 'X' }, other.cookie)).status).toBe(404)
    expect((await code('listPending', { systemId: five, source: 'srd521' }, other.cookie)).status).toBe(404)
  })
})
