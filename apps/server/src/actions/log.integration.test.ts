import type { RealtimeMessage } from '@crisol/contracts'
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { exampleFile } from '@crisol/systems/examples'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { diskStorage } from '../files/storage.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY, testDataDir } from '../testing.ts'

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined
type WebSocket = Awaited<ReturnType<FastifyInstance['injectWS']>>

/** Lo que le llega a una cuenta por el canal general */
function listen(ws: WebSocket) {
  const got: RealtimeMessage[] = []
  ws.on('message', (data: Buffer) => got.push(JSON.parse(String(data)) as RealtimeMessage))
  return {
    logged: () =>
      got.flatMap((m) => (m.type === 'logged' ? [m.entry.kind === 'message' ? m.entry.text : m.entry.kind] : []))
  }
}

describe('el registro de la partida: mensajes, susurros y tiradas', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let bruno: { userId: string; cookie: string }
  let carla: { userId: string; cookie: string }
  let campaignId: string
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
  const texts = async (cookie: string) =>
    (
      (await call('listLog', { campaignId }, cookie)).body.entries as Array<{
        kind: string
        text?: string
        roll?: { formula: string }
      }>
    ).map((e) => (e.kind === 'message' ? e.text : e.kind === 'roll' ? `🎲 ${e.roll?.formula}` : e.kind))
  const general = async (cookie: string) => {
    const ws = await app.injectWS('/api/realtime', { headers: { origin: BASE_URL, cookie } })
    sockets.push(ws)
    return listen(ws)
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_log'), { max: 4 })
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
    const five = (await call('importSystem', { file: exampleFile('5e') })).body.system.id
    campaignId = (await call('createCampaign', { worldId, name: 'La Marca', system: five })).body.id
    const join = async (name: string) => {
      const user = await signUpTestUser(auth, { name, email: `${name.toLowerCase()}@crisol.test` })
      await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: user.userId, role: 'member' })
      await conn.db.insert(schema.campaignMembers).values({ campaignId, userId: user.userId, role: 'player' })
      return user
    }
    ana = await join('Ana')
    bruno = await join('Bruno')
    carla = await join('Carla')
  })

  afterEach(async () => {
    for (const ws of sockets.splice(0)) ws.terminate()
    await app.close()
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('a cada uno le llega solo lo suyo: un susurro entre jugadoras lo ve el máster y no una tercera', async () => {
    const [master, a, b, c] = await Promise.all([
      general(owner.cookie),
      general(ana.cookie),
      general(bruno.cookie),
      general(carla.cookie)
    ])
    await call('createCharacter', { campaignId, name: 'Sela' }, ana.cookie)
    const said = await call('sendMessage', { campaignId, text: '¿Quién anda ahí?', style: 'ic' }, ana.cookie)
    expect(said.status).toBe(200)
    expect(said.body.entry).toMatchObject({
      speaker: { kind: 'character', name: 'Sela' },
      by: { name: 'Ana' },
      whisper: null
    })
    await call('sendMessage', { campaignId, text: 'Bruno, no te fíes', whisper: [bruno.userId] }, ana.cookie)
    await call('sendMessage', { campaignId, text: 'Notas un frío', whisper: [ana.userId] })
    await call('sendMessage', { campaignId, text: 'Máster, robo la bolsa', whisper: ['master'] }, carla.cookie)
    await call('rollDice', { campaignId, formula: '1d20+3 # Sigilo' }, bruno.cookie)

    expect(await texts(owner.cookie)).toEqual([
      '¿Quién anda ahí?',
      'Bruno, no te fíes',
      'Notas un frío',
      'Máster, robo la bolsa',
      '🎲 1d20+3'
    ])
    expect(await texts(ana.cookie)).toEqual(['¿Quién anda ahí?', 'Bruno, no te fíes', 'Notas un frío', '🎲 1d20+3'])
    expect(await texts(bruno.cookie)).toEqual(['¿Quién anda ahí?', 'Bruno, no te fíes', '🎲 1d20+3'])
    expect(await texts(carla.cookie)).toEqual(['¿Quién anda ahí?', 'Máster, robo la bolsa', '🎲 1d20+3'])

    // Por tiempo real, lo mismo: lo que no ve no viaja a su navegador
    await expect.poll(() => c.logged()).toEqual(['¿Quién anda ahí?', 'Máster, robo la bolsa'])
    await expect.poll(() => b.logged()).toEqual(['¿Quién anda ahí?', 'Bruno, no te fíes'])
    await expect.poll(() => a.logged()).toEqual(['¿Quién anda ahí?', 'Bruno, no te fíes', 'Notas un frío'])
    await expect
      .poll(() => new Set(master.logged()))
      .toEqual(new Set(['¿Quién anda ahí?', 'Bruno, no te fíes', 'Notas un frío', 'Máster, robo la bolsa']))
    // El susurro, con los nombres de sus destinatarios
    const whisper = (await call('listLog', { campaignId })).body.entries[1]
    expect(whisper.whisper).toEqual([{ id: bruno.userId, name: 'Bruno' }])
  })

  it('quién habla y a quién se susurra lo comprueba el servidor', async () => {
    const theirs = (await call('createCharacter', { campaignId, name: 'Bram' }, bruno.cookie)).body.character.id
    expect(
      (await call('sendMessage', { campaignId, text: 'Soy Bram', style: 'ic', characterId: theirs }, ana.cookie)).status
    ).toBe(403)
    const stranger = await signUpTestUser(auth, { name: 'Otro', email: 'otro@crisol.test' })
    expect(
      (await call('sendMessage', { campaignId, text: 'Hola', whisper: [stranger.userId] }, ana.cookie)).status
    ).toBe(400)
    expect((await call('sendMessage', { campaignId, text: 'Hola' }, stranger.cookie)).status).toBe(404)
    // El máster habla como el personaje de otro si quiere
    expect(
      (await call('sendMessage', { campaignId, text: 'Bram asiente', style: 'emote', characterId: theirs })).body.entry
        .speaker
    ).toMatchObject({ kind: 'character', name: 'Bram' })
  })

  it('borrar: lo suyo el autor; cualquiera el máster; queda «borrado»', async () => {
    const own = (await call('sendMessage', { campaignId, text: 'Ups' }, ana.cookie)).body.entry.id
    const other = (await call('sendMessage', { campaignId, text: 'De Bruno' }, bruno.cookie)).body.entry.id
    expect((await call('deleteMessage', { campaignId, id: other }, ana.cookie)).status).toBe(403)
    expect((await call('deleteMessage', { campaignId, id: own }, ana.cookie)).status).toBe(200)
    expect((await call('deleteMessage', { campaignId, id: other })).status).toBe(200)
    const entries = (await call('listLog', { campaignId }, carla.cookie)).body.entries
    expect(entries.map((e: { deleted: boolean; text: string }) => [e.deleted, e.text])).toEqual([
      [true, ''],
      [true, '']
    ])
  })

  it('por páginas, mezclando mensajes y tiradas, hasta el principio', async () => {
    for (let i = 0; i < 30; i++) await call('sendMessage', { campaignId, text: `m${i}` })
    for (let i = 0; i < 30; i++) await call('rollDice', { campaignId, formula: '1d4' })
    const first = (await call('listLog', { campaignId })).body
    expect(first.entries).toHaveLength(50)
    expect(first.next).not.toBeNull()
    const second = (await call('listLog', { campaignId, before: first.next })).body
    expect(second.entries).toHaveLength(10)
    expect(second.next).toBeNull()
    expect(second.entries[0]).toMatchObject({ kind: 'message', text: 'm0' })
  })
})
