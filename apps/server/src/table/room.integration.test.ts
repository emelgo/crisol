import { TABLE_CLOSE_KICKED, type TableServerMessage } from '@crisol/contracts'
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { diskStorage } from '../files/storage.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY, testDataDir } from '../testing.ts'

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined
type WebSocket = Awaited<ReturnType<FastifyInstance['injectWS']>>

/** Los mensajes de una conexión, en orden; next() espera al siguiente */
function inbox(ws: WebSocket) {
  const queued: TableServerMessage[] = []
  let waiting: ((message: TableServerMessage) => void) | null = null
  ws.on('message', (data: Buffer) => {
    const message = JSON.parse(String(data)) as TableServerMessage
    if (waiting) waiting(message)
    else queued.push(message)
  })
  return {
    next: () =>
      new Promise<TableServerMessage>((resolve, reject) => {
        const first = queued.shift()
        if (first) return resolve(first)
        const timer = setTimeout(() => {
          waiting = null
          reject(new Error('No llegó ningún mensaje'))
        }, 2000)
        waiting = (message) => {
          clearTimeout(timer)
          waiting = null
          resolve(message)
        }
      }),
    /** Que no llegue nada en un rato */
    quiet: async () => {
      await new Promise((resolve) => setTimeout(resolve, 150))
      return queued.length === 0
    }
  }
}

describe('la sala: pausa, modo de movimiento y echar de la Mesa', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }
  let player: { userId: string; cookie: string }
  let campaignId: string
  let otherCampaignId: string
  const sockets: WebSocket[] = []

  const call = async (name: string, payload: object, cookie = owner.cookie) => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/actions/${name}`,
      payload,
      headers: { origin: BASE_URL, cookie }
    })
    return { status: response.statusCode, body: response.json() }
  }
  const join = async (view: 'master' | 'screen' | 'player', cookie = owner.cookie, campaign = campaignId) => {
    const ws = await app.injectWS('/api/table', { headers: { origin: BASE_URL, cookie } })
    sockets.push(ws)
    const closed = new Promise<number>((resolve) => ws.on('close', (code: number) => resolve(code)))
    const box = inbox(ws)
    ws.send(JSON.stringify({ type: 'join', campaignId: campaign, view }))
    return { ws, closed, ...box }
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_room'), { max: 4 })
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
    const worldId = (await call('createWorld', { name: 'Valdren' })).body.id
    campaignId = (await call('createCampaign', { worldId, name: 'La Marca' })).body.id
    otherCampaignId = (await call('createCampaign', { worldId, name: 'La Otra' })).body.id
    player = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: player.userId, role: 'member' })
    for (const id of [campaignId, otherCampaignId])
      await conn.db.insert(schema.campaignMembers).values({ campaignId: id, userId: player.userId, role: 'player' })
  })

  afterEach(async () => {
    for (const ws of sockets.splice(0)) ws.terminate()
    await app.close()
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('el máster pausa y cambia el modo; llega al momento a todos y se guarda; un jugador no puede', async () => {
    const master = await join('master')
    expect(await master.next()).toMatchObject({ type: 'master', table: { paused: false, movement: 'free' } })
    const own = await join('player', player.cookie)
    expect(await own.next()).toMatchObject({ type: 'screen', screen: { paused: false, movement: 'free' } })

    expect((await call('setTableControls', { campaignId, paused: true }, player.cookie)).status).toBe(403)
    const set = await call('setTableControls', { campaignId, paused: true, movement: 'turn' })
    expect(set).toEqual({ status: 200, body: { paused: true, movement: 'turn' } })
    expect(await master.next()).toMatchObject({ type: 'master', table: { paused: true, movement: 'turn' } })
    expect(await own.next()).toMatchObject({ type: 'screen', screen: { paused: true, movement: 'turn' } })

    // Solo lo que se pasa cambia, y quien entra después lo encuentra así
    expect((await call('setTableControls', { campaignId, movement: 'locked' })).body).toEqual({
      paused: true,
      movement: 'locked'
    })
    const late = await join('screen')
    expect(await late.next()).toMatchObject({ type: 'screen', screen: { paused: true, movement: 'locked' } })
    // La otra campaña, sin tocar
    expect((await call('setTableControls', { campaignId: otherCampaignId })).body).toEqual({
      paused: false,
      movement: 'free'
    })
  })

  it('echar cierra su Mesa al momento y no le deja volver hasta que el máster le deja', async () => {
    const own = await join('player', player.cookie)
    await own.next()
    const elsewhere = await join('player', player.cookie, otherCampaignId)
    await elsewhere.next()

    expect((await call('kickFromTable', { campaignId, userId: player.userId }, player.cookie)).status).toBe(403)
    expect((await call('kickFromTable', { campaignId, userId: owner.userId })).status).toBe(400)
    expect((await call('kickFromTable', { campaignId, userId: player.userId })).body).toEqual({ ok: true })
    expect(await own.next()).toEqual({ type: 'error', code: 'KICKED' })
    expect(await own.closed).toBe(TABLE_CLOSE_KICKED)
    // En la otra campaña sigue
    expect(await elsewhere.quiet()).toBe(true)

    const again = await join('player', player.cookie)
    expect(await again.next()).toEqual({ type: 'error', code: 'KICKED' })
    expect(await again.closed).toBe(TABLE_CLOSE_KICKED)
    // Echarla dos veces no la apunta dos veces
    expect((await call('kickFromTable', { campaignId, userId: player.userId })).status).toBe(200)
    const kicked = await conn.db.select().from(schema.campaignTables)
    expect(kicked.find((t) => t.campaignId === campaignId)?.kicked).toEqual([player.userId])

    expect((await call('allowBackToTable', { campaignId, userId: player.userId })).body).toEqual({ ok: true })
    const back = await join('player', player.cookie)
    expect(await back.next()).toMatchObject({ type: 'screen' })
    // Sigue siendo de la campaña todo el tiempo
    expect((await call('listMembers', { campaignId }, player.cookie)).status).toBe(200)
  })
})
