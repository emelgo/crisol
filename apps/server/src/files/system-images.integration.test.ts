import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY, testDataDir } from '../testing.ts'
import { diskStorage, type Storage } from './storage.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 un retrato')])
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')

describe('las imágenes de un sistema (docs/specs/imagenes.md)', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let storage: Storage
  let owner: { userId: string; cookie: string }

  const call = (name: string, payload: object, cookie = owner.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = owner.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const image = (systemId: string, path: string, cookie = owner.cookie) =>
    app.inject({
      method: 'GET',
      url: `/api/system-images/${systemId}?path=${encodeURIComponent(path)}`,
      headers: { cookie }
    })

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_system_images'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    storage = diskStorage(testDataDir())
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY },
      storage
    })
    owner = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Mesa' }).returning()
    if (!org) throw new Error('sin organización')
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org.id, userId: owner.userId, role: 'owner' })
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('subir por su ruta (solo imágenes), servirlas a quien lee el sistema o juega con él, y a nadie más', async () => {
    const system = await ok200('createSystem', { name: 'Mazmorra' })
    const path = 'systems/mazmorra/tokens/trasgo.webp'
    const saved = await ok200('putSystemImages', {
      systemId: system.id,
      images: [
        { path, data: WEBP.toString('base64'), license: 'foundry-only', credit: 'Fichas de Alguien.' },
        { path: 'systems/mazmorra/x.txt', data: Buffer.from('hola').toString('base64'), license: 'mit', credit: null }
      ]
    })
    expect(saved).toEqual({ saved: 1, skipped: ['systems/mazmorra/x.txt'] })
    const mine = await image(system.id, path)
    expect(mine.statusCode).toBe(200)
    expect(mine.headers['content-type']).toBe('image/webp')
    expect(mine.rawPayload.equals(WEBP)).toBe(true)
    expect((await image(system.id, 'systems/mazmorra/no.webp')).statusCode).toBe(404)

    // Una jugadora de una campaña con ese sistema, sí; otra cuenta, no
    const world = await ok200('createWorld', { name: 'Valdren' })
    const campaign = await ok200('createCampaign', { worldId: world.id, name: 'La Marca', system: system.id })
    const ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    const url = (await ok200('getInvitation', { campaignId: campaign.id })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: ana.cookie }
    })
    expect((await image(system.id, path, ana.cookie)).statusCode).toBe(200)
    const stranger = await signUpTestUser(auth, { name: 'Bruno', email: 'bruno@crisol.test' })
    expect((await image(system.id, path, stranger.cookie)).statusCode).toBe(404)
    // Ni la jugadora sube
    expect(
      (
        await call(
          'putSystemImages',
          { systemId: system.id, images: [{ path, data: WEBP.toString('base64'), license: 'mit', credit: null }] },
          ana.cookie
        )
      ).statusCode
    ).toBe(404)

    // Volver a subirla la cambia (y sus bytes de antes se van); un SVG, sin poder ejecutar nada
    await ok200('putSystemImages', {
      systemId: system.id,
      images: [
        { path, data: WEBP.toString('base64'), license: 'foundry-only', credit: null },
        { path: 'systems/mazmorra/icons/a.svg', data: SVG.toString('base64'), license: 'cc-by', credit: null }
      ]
    })
    expect((await storage.keys()).length).toBe(2)
    const svg = await image(system.id, 'systems/mazmorra/icons/a.svg')
    expect(svg.headers['content-security-policy']).toContain('sandbox')
  })

  it('listarlas por carpeta, quitarlas por su ruta (con sus bytes) y una portada de libro que es una de ellas', async () => {
    const system = await ok200('createSystem', { name: 'Mazmorra' })
    const put = (path: string) => ({ path, data: WEBP.toString('base64'), license: 'unknown', credit: 'Alguien' })
    await ok200('putSystemImages', {
      systemId: system.id,
      images: [put('bestiary/tokens/aboleth.webp'), put('bestiary/tokens/trasgo.webp'), put('covers/phb.webp')]
    })
    const tokens = await ok200('listSystemImages', { systemId: system.id, prefix: 'bestiary/tokens/' })
    expect(tokens.total).toBe(2)
    expect(tokens.images.map((i: { path: string }) => i.path)).toEqual([
      'bestiary/tokens/aboleth.webp',
      'bestiary/tokens/trasgo.webp'
    ])
    expect(tokens.images[0]).toMatchObject({ mime: 'image/webp', license: 'unknown', credit: 'Alguien' })
    expect((await ok200('listSystemImages', { systemId: system.id, limit: 1, offset: 2 })).images).toHaveLength(1)
    // Un % en el prefijo no es un comodín
    expect((await ok200('listSystemImages', { systemId: system.id, prefix: '%' })).total).toBe(0)

    const before = (await storage.keys()).length
    const removed = await ok200('deleteSystemImages', {
      systemId: system.id,
      paths: ['bestiary/tokens/aboleth.webp', 'no/esta.webp']
    })
    expect(removed).toEqual({ deleted: ['bestiary/tokens/aboleth.webp'], missing: ['no/esta.webp'] })
    expect((await storage.keys()).length).toBe(before - 1)
    expect((await image(system.id, 'bestiary/tokens/aboleth.webp')).statusCode).toBe(404)

    // La portada de un libro, una imagen del sistema por su ruta (o de los comunes, pero no las dos)
    const book = await ok200('createBook', {
      systemId: system.id,
      version: system.version,
      name: 'Manual del jugador',
      cover: { image: 'covers/phb.webp', x: 50, y: 50 }
    })
    const books = await ok200('getSystemBooks', { systemId: system.id })
    expect(books.books.find((b: { key: string }) => b.key === book.key).cover).toEqual({
      image: 'covers/phb.webp',
      x: 50,
      y: 50
    })
    const both = await call('updateBook', {
      systemId: system.id,
      version: book.version,
      key: book.key,
      cover: { image: 'covers/phb.webp', fileId: crypto.randomUUID(), x: 50, y: 50 }
    })
    expect(both.statusCode).toBe(400)
  })
})
