import type { RealtimeMessage } from '@crisol/contracts'
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'
import { CLOSE_SESSION_ENDED } from './routes.ts'

const BASE_URL = 'https://crisol.test'
type WebSocket = Awaited<ReturnType<FastifyInstance['injectWS']>>
const ok = async () => undefined

/** Los mensajes de una conexión, en orden; next() espera al siguiente. El saludo del principio se prueba aparte */
function inbox(ws: WebSocket) {
  const queued: RealtimeMessage[] = []
  let waiting: ((message: RealtimeMessage) => void) | null = null
  ws.on('message', (data: Buffer) => {
    const message = JSON.parse(String(data)) as RealtimeMessage
    if (message.type === 'hello') return
    if (waiting) waiting(message)
    else queued.push(message)
  })
  return {
    next: () =>
      new Promise<RealtimeMessage>((resolve, reject) => {
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
      })
  }
}

describe('el canal en tiempo real', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }
  let organizationId: string
  const sockets: WebSocket[] = []

  const call = async (name: string, payload: object, cookie: string) => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/actions/${name}`,
      payload,
      headers: { origin: BASE_URL, cookie }
    })
    return { status: response.statusCode, body: response.json() }
  }
  const open = async (cookie?: string, origin = BASE_URL) => {
    const ws = await app.injectWS('/api/realtime', { headers: { origin, ...(cookie ? { cookie } : {}) } })
    sockets.push(ws)
    return ws
  }
  /** Eana con La Marca (y las campañas que se pidan), con una jugadora dentro de todas */
  const worldWithPlayer = async (...extra: string[]) => {
    const world = (await call('createWorld', { name: 'Eana' }, owner.cookie)).body
    const campaigns = []
    for (const name of ['La Marca', ...extra]) {
      campaigns.push((await call('createCampaign', { worldId: world.id, name }, owner.cookie)).body)
    }
    const player = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: player.userId, role: 'member' })
    await conn.db
      .insert(schema.campaignMembers)
      .values(campaigns.map((c) => ({ campaignId: c.id, userId: player.userId, role: 'player' as const })))
    return { world, campaign: campaigns[0], campaigns, player }
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_realtime'), { max: 2 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY },
      realtimeTimers: { sessionCheckMs: 50 }
    })
    await app.ready()
    owner = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Fateforge' }).returning()
    organizationId = org?.id ?? ''
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: owner.userId, role: 'owner' })
  })

  afterEach(async () => {
    for (const ws of sockets.splice(0)) ws.terminate()
    await app.close()
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('al conectar saluda con la versión de la web que sirve (sin web, ninguna)', async () => {
    // Se escucha desde antes de abrir, como el navegador: el saludo sale nada más conectar
    const hello = new Promise<RealtimeMessage>((resolve) => {
      void app
        .injectWS(
          '/api/realtime',
          { headers: { origin: BASE_URL, cookie: owner.cookie } },
          { onInit: (ws) => ws.once('message', (data: Buffer) => resolve(JSON.parse(String(data)))) }
        )
        .then((ws) => sockets.push(ws))
    })
    expect(await hello).toEqual({ type: 'hello', build: null })
  })

  it('sin sesión se cierra al momento diciendo que acabó la sesión; desde otra web, ni se abre', async () => {
    const anonymous = await open()
    const closed = new Promise<number>((resolve) => anonymous.once('close', (code: number) => resolve(code)))
    const received: string[] = []
    anonymous.on('message', (data: Buffer) => received.push(String(data)))
    expect(await closed).toBe(CLOSE_SESSION_ENDED)
    expect(received).toEqual([])
    await expect(open(owner.cookie, 'https://malo.example')).rejects.toThrow('403')
  })

  it('el canal no escucha: quien le manda algo grande se corta', async () => {
    const ws = await open(owner.cookie)
    const closed = new Promise<number>((resolve) => ws.once('close', (code: number) => resolve(code)))
    ws.send(Buffer.alloc(2048))
    expect(await closed).toBe(1009)
  })

  it('a la jugadora no le llega la campaña nueva en la que no está, pero sí lo del mundo en el que juega', async () => {
    const { world, player } = await worldWithPlayer()
    const master = inbox(await open(owner.cookie))
    const playerInbox = inbox(await open(player.cookie))

    const created = await call('createCampaign', { worldId: world.id, name: 'La Campaña B' }, owner.cookie)
    expect(await master.next()).toEqual({ type: 'changed', what: 'campaigns', worldId: world.id })
    await call('renameWorld', { worldId: world.id, name: 'Eana (Fateforge)' }, owner.cookie)
    // Lo primero que le llega es el mundo renombrado: de la campaña B, nada
    const first = await playerInbox.next()
    expect(first).toEqual({ type: 'changed', what: 'worlds' })
    expect(JSON.stringify(first)).not.toContain(created.body.id)
  })

  it('lo de la wiki, a la jugadora solo si lo ve (ADR-0017): el aviso del texto, de lo que ve; lo que sabe, sin decir qué', async () => {
    const { world, campaign, player } = await worldWithPlayer()
    const create = async (title: string) =>
      (await call('createPage', { worldId: world.id, title, parentId: null }, owner.cookie)).body.id as string
    const known = await create('Aldoria')
    const hidden = await create('El plan del rey')
    const playerInbox = inbox(await open(player.cookie))
    await call(
      'setKnowledge',
      { worldId: world.id, campaignId: campaign.id, kind: 'page', targetId: known, known: true },
      owner.cookie
    )
    expect(await playerInbox.next()).toEqual({
      type: 'changed',
      what: 'knowledge',
      worldId: world.id,
      campaignId: campaign.id
    })
    const edit = (pageId: string, text: string) =>
      call('editPage', { pageId, body: { mode: 'append', markdown: text } }, owner.cookie)
    await edit(hidden, 'Invadir el norte')
    await edit(known, 'Un reino antiguo')
    const received: RealtimeMessage[] = []
    for (;;) {
      const message = await playerInbox.next()
      received.push(message)
      if (message.type === 'changed' && message.what === 'pageContent') break
    }
    expect(received.at(-1)).toEqual({ type: 'changed', what: 'pageContent', worldId: world.id, pageId: known })
    const all = JSON.stringify(received)
    expect(all).not.toContain(hidden)
    expect(all).not.toContain('plan')
    expect(all).not.toContain('Invadir')
  })

  it('al revelar, el aviso solo le llega a quien le aparece, con el título de la sección del secreto (revelar)', async () => {
    const { world, campaign, player } = await worldWithPlayer()
    const other = await signUpTestUser(auth, { name: 'Otro', email: 'otro@crisol.test' })
    await conn.db
      .insert(schema.campaignMembers)
      .values({ campaignId: campaign.id, userId: other.userId, role: 'player' })
    const [lia] = await conn.db
      .insert(schema.characters)
      .values({ campaignId: campaign.id, ownerId: player.userId, name: 'Lía', system: 'blank', build: {}, play: {} })
      .returning()
    const created = (
      await call(
        'createPages',
        {
          worldId: world.id,
          parentId: null,
          pages: [
            { key: 'a', title: 'Aldoria', markdown: '## El pacto de Varn\n\n> [!secreto]\n> Varn vendió el paso.' }
          ]
        },
        owner.cookie
      )
    ).body
    const aldoria = created.pages[0].id as string
    const secret = (await conn.db.select().from(schema.documents)).find(
      (d) => d.pageId === aldoria && d.kind === 'secret'
    )
    const playerInbox = inbox(await open(player.cookie))
    const otherInbox = inbox(await open(other.cookie))
    await call(
      'reveal',
      { worldId: world.id, kind: 'secret', targetId: secret?.id, characters: [lia?.id], alsoPage: true },
      owner.cookie
    )
    const got: RealtimeMessage[] = []
    for (;;) {
      const message = await playerInbox.next()
      got.push(message)
      if (message.type === 'revealed') break
    }
    expect(got.at(-1)).toEqual({
      type: 'revealed',
      worldId: world.id,
      campaignId: campaign.id,
      kind: 'secret',
      pageId: aldoria,
      title: 'El pacto de Varn'
    })
    // Al otro, solo que lo que sabe la campaña cambió (sin qué)
    expect(await otherInbox.next()).toEqual({
      type: 'changed',
      what: 'knowledge',
      worldId: world.id,
      campaignId: campaign.id
    })
    await expect(otherInbox.next()).rejects.toThrow('No llegó ningún mensaje')
  })

  it('el enlace solo le llega al máster', async () => {
    const { world, campaign, player } = await worldWithPlayer()
    const master = inbox(await open(owner.cookie))
    const playerInbox = inbox(await open(player.cookie))
    await call('regenerateInvitation', { campaignId: campaign.id }, owner.cookie)
    expect(await master.next()).toEqual({ type: 'changed', what: 'invitation', campaignId: campaign.id })
    await call('renameWorld', { worldId: world.id, name: 'Otro' }, owner.cookie)
    expect(await playerInbox.next()).toEqual({ type: 'changed', what: 'worlds' })
  })

  it('el máster recibe el aviso de que alguien ha entrado con el enlace', async () => {
    const world = (await call('createWorld', { name: 'Eana' }, owner.cookie)).body
    const campaign = (await call('createCampaign', { worldId: world.id, name: 'La Marca' }, owner.cookie)).body
    const url = (await call('getInvitation', { campaignId: campaign.id }, owner.cookie)).body.url as string
    const master = inbox(await open(owner.cookie))

    const player = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
    const joined = await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: player.cookie }
    })
    expect(joined.statusCode).toBe(200)
    expect(await master.next()).toEqual({
      type: 'joined',
      worldId: world.id,
      campaignId: campaign.id,
      campaign: 'La Marca',
      member: { userId: player.userId, name: 'Jugadora' }
    })
    expect(await master.next()).toEqual({ type: 'changed', what: 'members', campaignId: campaign.id })
  })

  it('al expulsarla, a la jugadora le llega el aviso y nada más de esa campaña; tampoco puede leerla', async () => {
    const { world, campaign, player } = await worldWithPlayer('El Norte')
    const playerInbox = inbox(await open(player.cookie))

    await call('removeMember', { campaignId: campaign.id, userId: player.userId }, owner.cookie)
    expect(await playerInbox.next()).toEqual({ type: 'revoked', worldId: world.id, campaignId: campaign.id })
    await call('renameCampaign', { campaignId: campaign.id, name: 'La Marca del Este' }, owner.cookie)
    // Sigue en El Norte: lo del mundo le llega, lo de La Marca ya no
    await call('renameWorld', { worldId: world.id, name: 'Eana (Fateforge)' }, owner.cookie)
    expect(await playerInbox.next()).toEqual({ type: 'changed', what: 'worlds' })
    expect((await call('listMembers', { campaignId: campaign.id }, player.cookie)).status).toBe(404)
  })

  it('si el máster deshace su entrada, a la jugadora le llega el aviso al momento', async () => {
    const world = (await call('createWorld', { name: 'Eana' }, owner.cookie)).body
    const campaign = (await call('createCampaign', { worldId: world.id, name: 'La Marca' }, owner.cookie)).body
    const url = (await call('getInvitation', { campaignId: campaign.id }, owner.cookie)).body.url as string
    const player = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: player.cookie }
    })
    const playerInbox = inbox(await open(player.cookie))
    const history = (await call('listHistory', { worldId: world.id }, owner.cookie)).body
    const joined = history.entries.find((e: { action: string }) => e.action === 'joinCampaign')
    await call('undoOperation', { operationId: joined.id }, owner.cookie)
    expect(await playerInbox.next()).toEqual({ type: 'revoked', worldId: world.id, campaignId: campaign.id })
  })

  it('al dejar la campaña, el aviso llega a sus otras pestañas', async () => {
    const { world, campaign, player } = await worldWithPlayer()
    const tab = inbox(await open(player.cookie))
    expect((await call('leaveCampaign', { campaignId: campaign.id }, player.cookie)).status).toBe(200)
    expect(await tab.next()).toEqual({ type: 'revoked', worldId: world.id, campaignId: campaign.id })
  })

  it('si la sesión se cierra, el canal también', async () => {
    const ws = await open(owner.cookie)
    const closed = new Promise<number>((resolve) => ws.on('close', (code) => resolve(code)))
    await conn.db.delete(schema.session)
    expect(await closed).toBe(CLOSE_SESSION_ENDED)
  })
})
