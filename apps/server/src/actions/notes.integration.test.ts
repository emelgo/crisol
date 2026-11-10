import { connect, loadMemberships, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { actorFrom } from '@crisol/domain'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { diskStorage } from '../files/storage.ts'
import { callAsAi } from '../mcp/approvals.ts'
import { MCP_TOOLS, routeCall } from '../mcp/tools.ts'
import { createRealtime } from '../realtime/hub.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY, testDataDir } from '../testing.ts'
import type { ActionEnv } from './context.ts'
import { implementationsByName } from './implementations.ts'
import { linkTitles } from './notes.ts'

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined

describe('los enlaces de una nota', () => {
  it('cada nombre una vez, sin incrustar ni el compendio, sin sección ni texto', () => {
    expect(
      linkTitles('[[Aldric Varn]] y [[aldric varn|él]], ![[mapa.png]], [[@espada]], [[Puerto#Muelles]] y [[ Ceniza ]]')
    ).toEqual(['Aldric Varn', 'Puerto', 'Ceniza'])
  })
})

describe('las notas del jugador (docs/specs/notas-jugador.md)', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let bruno: { userId: string; cookie: string }
  let worldId: string
  let campaignId: string
  let aldric: string

  const call = async (name: string, payload: object, cookie = owner.cookie) => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/actions/${name}`,
      payload,
      headers: { origin: BASE_URL, cookie }
    })
    return { status: response.statusCode, body: response.json() }
  }
  const ok200 = async (name: string, payload: object, cookie = owner.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    return response.body
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_notes'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY },
      storage: diskStorage(testDataDir())
    })
    await app.ready()
    owner = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Fateforge' }).returning()
    const organizationId = org?.id ?? ''
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: owner.userId, role: 'owner' })
    worldId = (await ok200('createWorld', { name: 'Valdren' })).id
    campaignId = (await ok200('createCampaign', { worldId, name: 'La Marca' })).id
    aldric = (await ok200('createPage', { worldId, title: 'Aldric Varn', parentId: null })).id
    await ok200('createPage', { worldId, title: 'El Traidor', parentId: null })
    await ok200('setKnowledge', { worldId, campaignId, kind: 'page', targetId: aldric, known: true })
    const join = async (name: string) => {
      const user = await signUpTestUser(auth, { name, email: `${name.toLowerCase()}@crisol.test` })
      await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: user.userId, role: 'member' })
      await conn.db.insert(schema.campaignMembers).values({ campaignId, userId: user.userId, role: 'player' })
      return user
    }
    ana = await join('Ana')
    bruno = await join('Bruno')
  })

  afterEach(async () => {
    await app.close()
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('crear, con subnotas, editar con su versión, borrar (con sus subnotas) y restaurar', async () => {
    const top = (await ok200('createPlayerNote', { campaignId, title: 'Sospechas' }, ana.cookie)).note
    expect(top).toMatchObject({ title: 'Sospechas', markdown: '', parentId: null, editable: true, version: 1 })
    const child = (await ok200('createPlayerNote', { campaignId, title: 'El posadero', parentId: top.id }, ana.cookie))
      .note
    await ok200('createPlayerNote', { campaignId, title: 'Nombres' }, ana.cookie)
    const list = async (extra: object = {}) =>
      (await ok200('listPlayerNotes', { campaignId, ...extra }, ana.cookie)).notes.map(
        (n: { title: string }) => n.title
      )
    expect(await list()).toEqual(['Sospechas', 'El posadero', 'Nombres'])

    const edited = (
      await ok200('updatePlayerNote', { id: top.id, version: 1, markdown: 'No me fío de nadie' }, ana.cookie)
    ).note
    expect(edited).toMatchObject({ markdown: 'No me fío de nadie', version: 2 })
    // Con una versión vieja, no
    const stale = await call('updatePlayerNote', { id: top.id, version: 1, title: 'Otra' }, ana.cookie)
    expect(stale).toMatchObject({ status: 400, body: { code: 'NOTE_CHANGED' } })
    // Escribir seguido es una sola versión
    await ok200('updatePlayerNote', { id: top.id, version: 2, markdown: 'No me fío de nadie. Ni de Bram' }, ana.cookie)
    const versions = (await ok200('listPlayerNoteVersions', { id: top.id }, ana.cookie)).versions
    expect(versions.map((v: { markdown: string }) => v.markdown)).toEqual(['No me fío de nadie. Ni de Bram', ''])
    // No se mete dentro de sí misma
    const cycle = await call('updatePlayerNote', { id: top.id, version: 3, parentId: child.id }, ana.cookie)
    expect(cycle).toMatchObject({ status: 400, body: { code: 'NOTE_CYCLE' } })

    await ok200('deletePlayerNote', { id: top.id }, ana.cookie)
    expect(await list()).toEqual(['Nombres'])
    expect(await list({ trash: true })).toEqual(['Sospechas', 'El posadero'])
    expect((await call('getPlayerNote', { id: child.id }, ana.cookie)).status).toBe(404)
    const restored = (await ok200('restorePlayerNote', { id: top.id }, ana.cookie)).note
    expect(restored).toMatchObject({ title: 'Sospechas', deletedAt: null })
    expect(await list()).toEqual(['Sospechas', 'El posadero', 'Nombres'])
  })

  it('otro jugador no la ve ni sabe que existe; el máster la lee y no la escribe', async () => {
    const note = (await ok200('createPlayerNote', { campaignId, title: 'Bruno miente', markdown: 'Lo vi' }, ana.cookie))
      .note
    // Bruno: «no existe», con cada acción
    for (const [name, payload] of [
      ['getPlayerNote', { id: note.id }],
      ['updatePlayerNote', { id: note.id, version: 1, title: 'x' }],
      ['deletePlayerNote', { id: note.id }],
      ['listPlayerNoteVersions', { id: note.id }],
      ['listPlayerNotes', { campaignId, userId: ana.userId }],
      ['createPlayerNote', { campaignId, title: 'Mía', parentId: note.id }]
    ] as const) {
      const response = await call(name, payload, bruno.cookie)
      expect(response.status, name).toBe(404)
      expect(JSON.stringify(response.body)).not.toContain('Bruno miente')
    }
    // Sus propias notas, vacías
    expect((await ok200('listPlayerNotes', { campaignId }, bruno.cookie)).notes).toEqual([])

    // El máster (del mundo) las lee
    expect(
      (await ok200('listPlayerNotes', { campaignId, userId: ana.userId })).notes.map((n: { title: string }) => n.title)
    ).toEqual(['Bruno miente'])
    expect((await ok200('getPlayerNote', { id: note.id })).note).toMatchObject({ markdown: 'Lo vi', editable: false })
    // Y no las escribe
    expect((await call('updatePlayerNote', { id: note.id, version: 1, title: 'x' })).status).toBe(403)
    expect((await call('deletePlayerNote', { id: note.id })).status).toBe(403)

    // Si deja la campaña, siguen ahí para el máster; ella ya no las ve
    await ok200('leaveCampaign', { campaignId }, ana.cookie)
    expect((await ok200('getPlayerNote', { id: note.id })).note.title).toBe('Bruno miente')
    expect((await call('getPlayerNote', { id: note.id }, ana.cookie)).status).toBe(404)
  })

  it('los enlaces llevan solo a las páginas que conoce su campaña', async () => {
    const note = (
      await ok200(
        'createPlayerNote',
        { campaignId, title: 'PNJ', markdown: 'Hablé con [[Aldric Varn]]. ¿Será [[El Traidor]]? [[Nadie]]' },
        ana.cookie
      )
    ).note
    expect(note.links).toEqual([
      { title: 'Aldric Varn', pageId: aldric },
      { title: 'El Traidor', pageId: null },
      { title: 'Nadie', pageId: null }
    ])
    // El máster la lee igual: con lo que conoce la campaña
    expect((await ok200('getPlayerNote', { id: note.id })).note.links).toEqual(note.links)
  })

  it('el MCP: la IA del jugador lee y escribe sus notas; la del máster las lee y no las escribe', async () => {
    const env: ActionEnv = {
      db: conn.db,
      publicUrl: BASE_URL,
      sealKey: TEST_SEAL_KEY,
      realtime: createRealtime(async (userId) => actorFrom(userId, await loadMemberships(conn.db, userId))),
      actions: implementationsByName
    }
    const ai = async (userId: string, tool: string, args: Record<string, unknown>) => {
      const found = MCP_TOOLS[tool]
      if (!found) throw new Error(`falta ${tool}`)
      const result = await callAsAi(env, { userId, tool, ...routeCall(found, args), waitMs: 50 })
      return { ...result, text: result.content.map((c) => c.text).join('\n') }
    }
    // En copiloto (el modo de siempre), escribir se hace sin esperar
    const written = await ai(ana.userId, 'escribir_nota', { campaignId, title: 'Pistas', markdown: 'Una llave' })
    expect(written.isError ?? false, written.text).toBe(false)
    const id = (written.structuredContent as { note: { id: string } }).note.id
    const changed = await ai(ana.userId, 'escribir_nota', { id, version: 1, markdown: 'Una llave de bronce' })
    expect(changed.isError ?? false, changed.text).toBe(false)
    const listed = await ai(ana.userId, 'ver_notas', { campaignId })
    expect(listed.text).toContain('Pistas')

    // La del máster: las lee
    const read = await ai(owner.userId, 'leer_nota', { id })
    expect(read.text).toContain('Una llave de bronce')
    expect((await ai(owner.userId, 'ver_notas', { campaignId, userId: ana.userId })).text).toContain('Pistas')
    // Y no las escribe
    const refused = await ai(owner.userId, 'escribir_nota', { id, version: 2, markdown: 'Nada' })
    expect(refused.isError).toBe(true)
    // Ni la de otro jugador las ve
    const other = await ai(bruno.userId, 'leer_nota', { id })
    expect(other.isError).toBe(true)
    expect(other.text).not.toContain('llave')
  })
})
