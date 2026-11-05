import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

describe('los personajes de una campaña', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let master: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let bruno: { userId: string; cookie: string }
  let campaignId: string

  const call = (name: string, payload: object, cookie: string) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const fails = async (name: string, payload: object, cookie: string) => {
    const response = await call(name, payload, cookie)
    return { status: response.statusCode, code: response.json().code as string }
  }
  const join = async (cookie: string) => {
    const url = (await ok200('getInvitation', { campaignId })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie }
    })
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_characters'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY }
    })
    master = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Fateforge' }).returning()
    if (!org) throw new Error('sin organización')
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org.id, userId: master.userId, role: 'owner' })
    const world = await ok200('createWorld', { name: 'Eana' })
    campaignId = (await ok200('createCampaign', { worldId: world.id, name: 'La Marca', system: '5e' })).id
    ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    bruno = await signUpTestUser(auth, { name: 'Bruno', email: 'bruno@crisol.test' })
    await join(ana.cookie)
    await join(bruno.cookie)
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('cada jugador ve los suyos; el máster, todos; lo de otro no existe para quien no puede verlo', async () => {
    const thora = (await ok200('createCharacter', { campaignId, name: 'Thora' }, ana.cookie)).character
    expect(thora).toMatchObject({
      name: 'Thora',
      system: '5e',
      status: 'creating',
      owner: { id: ana.userId, name: 'Ana' },
      build: {},
      play: {},
      version: 1
    })
    const lisandro = (await ok200('createCharacter', { campaignId, name: 'Lisandro' }, bruno.cookie)).character
    const unnamed = (await ok200('createCharacter', { campaignId }, ana.cookie)).character
    expect(unnamed.name).toBe('Sin nombre')

    const names = async (cookie: string) =>
      (await ok200('listCharacters', { campaignId }, cookie)).characters.map((c: { name: string }) => c.name)
    expect(await names(master.cookie)).toEqual(['Thora', 'Lisandro', 'Sin nombre'])
    expect(await names(ana.cookie)).toEqual(['Thora', 'Sin nombre'])
    expect(await names(bruno.cookie)).toEqual(['Lisandro'])

    // Bruno no ve a Thora, ni la cambia, ni la borra, ni ve sus versiones
    expect((await fails('getCharacter', { characterId: thora.id }, bruno.cookie)).status).toBe(404)
    expect(
      (await fails('updateCharacter', { characterId: thora.id, version: 1, name: 'X' }, bruno.cookie)).status
    ).toBe(404)
    expect((await fails('deleteCharacter', { characterId: thora.id }, bruno.cookie)).status).toBe(404)
    expect((await fails('listCharacterVersions', { characterId: thora.id }, bruno.cookie)).status).toBe(404)
    // El máster ve a Lisandro entero
    expect((await ok200('getCharacter', { characterId: lisandro.id })).character.name).toBe('Lisandro')

    // Alguien de fuera: ni la lista
    const stranger = await signUpTestUser(auth, { name: 'Carla', email: 'carla@crisol.test' })
    expect((await fails('listCharacters', { campaignId }, stranger.cookie)).status).toBe(404)
    expect((await fails('getCharacter', { characterId: thora.id }, stranger.cookie)).status).toBe(404)
  })

  it('el máster lo hace para otro miembro y cambia su dueño; un jugador, no; quien no está, no lo juega', async () => {
    const forAna = (await ok200('createCharacter', { campaignId, name: 'Fray Ambrós', ownerId: ana.userId })).character
    expect(forAna.owner).toEqual({ id: ana.userId, name: 'Ana' })
    expect((await fails('createCharacter', { campaignId, ownerId: ana.userId }, bruno.cookie)).status).toBe(403)
    const stranger = await signUpTestUser(auth, { name: 'Carla', email: 'carla@crisol.test' })
    expect((await fails('createCharacter', { campaignId, ownerId: stranger.userId }, master.cookie)).code).toBe(
      'NOT_A_MEMBER'
    )
    const moved = await ok200('updateCharacter', { characterId: forAna.id, version: 1, ownerId: bruno.userId })
    expect(moved.character.owner.name).toBe('Bruno')
    // Bruno, ya su dueño, no se lo pasa a otro
    expect(
      (await fails('updateCharacter', { characterId: forAna.id, version: 2, ownerId: ana.userId }, bruno.cookie)).status
    ).toBe(403)
  })

  it('se cambia con la versión que se leyó; al terminarlo y al confirmar un nivel deja versiones, y se restaura', async () => {
    const created = (await ok200('createCharacter', { campaignId, name: 'Thora' }, ana.cookie)).character
    const step = await ok200(
      'updateCharacter',
      { characterId: created.id, version: 1, build: { clase: 'guerrero' } },
      ana.cookie
    )
    expect(step.character).toMatchObject({ version: 2, build: { clase: 'guerrero' } })
    expect(
      (await fails('updateCharacter', { characterId: created.id, version: 1, name: 'Otra' }, ana.cookie)).code
    ).toBe('CHARACTER_CHANGED')
    const done = await ok200('updateCharacter', { characterId: created.id, version: 2, confirm: 'created' }, ana.cookie)
    expect(done.character.status).toBe('ready')
    const later = await ok200(
      'updateCharacter',
      { characterId: created.id, version: 3, name: 'Thora Piedrahonda', build: { clase: 'mago' }, confirm: 'level' },
      ana.cookie
    )
    const { versions } = await ok200('listCharacterVersions', { characterId: created.id }, ana.cookie)
    expect(versions.map((v: { kind: string; name: string }) => [v.kind, v.name])).toEqual([
      ['level', 'Thora Piedrahonda'],
      ['created', 'Thora']
    ])
    const back = await ok200(
      'restoreCharacterVersion',
      { characterId: created.id, versionId: versions[1].id, version: later.character.version },
      ana.cookie
    )
    expect(back.character).toMatchObject({ name: 'Thora', status: 'ready', build: { clase: 'guerrero' } })
    // Restaurar es un cambio más: el máster lo deshace desde el historial
    const history = await ok200('listHistory', {})
    const restored = history.entries.find((e: { action: string }) => e.action === 'restoreCharacterVersion')
    expect(restored.details).toMatchObject({ name: 'Thora Piedrahonda', kind: 'created' })
    expect((await ok200('undoOperation', { operationId: restored.id })).status).toBe('undone')
    expect((await ok200('getCharacter', { characterId: created.id })).character.name).toBe('Thora Piedrahonda')
  })

  it('borrar uno se lleva sus versiones, y deshacerlo lo devuelve entero', async () => {
    const created = (await ok200('createCharacter', { campaignId, name: 'Thora' }, ana.cookie)).character
    await ok200('updateCharacter', { characterId: created.id, version: 1, confirm: 'created' }, ana.cookie)
    await ok200('deleteCharacter', { characterId: created.id }, ana.cookie)
    expect((await fails('getCharacter', { characterId: created.id }, ana.cookie)).status).toBe(404)
    const history = await ok200('listHistory', {})
    const deleted = history.entries.find((e: { action: string }) => e.action === 'deleteCharacter')
    expect((await ok200('undoOperation', { operationId: deleted.id })).status).toBe('undone')
    expect((await ok200('getCharacter', { characterId: created.id }, ana.cookie)).character.status).toBe('ready')
    expect((await ok200('listCharacterVersions', { characterId: created.id }, ana.cookie)).versions).toHaveLength(1)
  })

  it('una campaña sin sistema no tiene personajes', async () => {
    const world = (await ok200('listWorlds', {})).worlds[0]
    const none = await ok200('createCampaign', { worldId: world.id, name: 'Sin reglas' })
    expect((await fails('createCharacter', { campaignId: none.id }, master.cookie)).code).toBe('NO_SYSTEM')
  })
})
