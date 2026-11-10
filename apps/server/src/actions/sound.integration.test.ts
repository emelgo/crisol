import type { SoundView, TableServerMessage } from '@crisol/contracts'
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
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Un WAV mínimo: lo reconoce como audio */
const WAV = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVEfmt '), Buffer.alloc(32)])

/** Los mensajes de sonido de una conexión; next() espera al siguiente */
function soundInbox(ws: WebSocket) {
  const queued: Array<Extract<TableServerMessage, { type: 'sound' | 'time' }>> = []
  let waiting: (() => void) | null = null
  ws.on('message', (data: Buffer) => {
    const message = JSON.parse(String(data)) as TableServerMessage
    if (message.type !== 'sound' && message.type !== 'time') return
    queued.push(message)
    waiting?.()
  })
  return {
    next: async () => {
      const deadline = Date.now() + 3000
      while (queued.length === 0) {
        if (Date.now() > deadline) throw new Error('No llegó nada')
        await new Promise<void>((resolve) => {
          waiting = resolve
          setTimeout(resolve, 50)
        })
      }
      return queued.shift() as Extract<TableServerMessage, { type: 'sound' | 'time' }>
    }
  }
}

describe('el sonido: listas del mundo y lo que suena en cada campaña', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }
  let player: { userId: string; cookie: string }
  let worldId: string
  let campaignId: string
  const sockets: WebSocket[] = []

  const build = async () => {
    const built = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY },
      storage: diskStorage(testDataDir())
    })
    await built.ready()
    return built
  }
  const call = async (name: string, payload: object, cookie = owner.cookie) => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/actions/${name}`,
      payload,
      headers: { origin: BASE_URL, cookie }
    })
    return { status: response.statusCode, body: response.json() }
  }
  const upload = async (name: string, body: Buffer) =>
    (
      await app.inject({
        method: 'POST',
        url: `/api/files?worldId=${worldId}&name=${encodeURIComponent(name)}`,
        payload: body,
        headers: { origin: BASE_URL, cookie: owner.cookie, 'content-type': 'application/octet-stream' }
      })
    ).json()
  const join = async (view: 'master' | 'screen' | 'player', cookie = owner.cookie) => {
    const ws = await app.injectWS('/api/table', { headers: { origin: BASE_URL, cookie } })
    sockets.push(ws)
    const box = soundInbox(ws)
    ws.send(JSON.stringify({ type: 'join', campaignId, view }))
    return { ws, ...box }
  }
  const tavern = async (durations: number[], extra: object = {}) =>
    (
      await call('createSoundPlaylist', {
        worldId,
        name: 'Taberna',
        kind: 'ambient',
        mode: 'sequential',
        tracks: durations.map((duration, i) => ({
          name: `Pista ${i + 1}`,
          source: { type: 'youtube', url: `https://youtu.be/abcdefghij${i}` },
          duration
        })),
        ...extra
      })
    ).body.playlist

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_sound'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = await build()
    owner = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Fateforge' }).returning()
    const organizationId = org?.id ?? ''
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: owner.userId, role: 'owner' })
    worldId = (await call('createWorld', { name: 'Valdren' })).body.id
    campaignId = (await call('createCampaign', { worldId, name: 'La Marca' })).body.id
    player = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: player.userId, role: 'member' })
    await conn.db.insert(schema.campaignMembers).values({ campaignId, userId: player.userId, role: 'player' })
  })

  afterEach(async () => {
    for (const ws of sockets.splice(0)) ws.terminate()
    await app.close()
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('crea, cambia y borra listas con archivos de audio y YouTube; rechaza lo que no vale', async () => {
    const audio = await upload('Lluvia.wav', WAV)
    const image = await upload('Mapa.png', Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'))
    const created = await call('createSoundPlaylist', {
      worldId,
      name: 'Tormenta',
      kind: 'effects',
      mode: 'soundboard',
      tracks: [
        { name: 'Lluvia', source: { type: 'file', fileId: audio.id }, duration: 12.5, loop: true },
        { name: 'Trueno', source: { type: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, duration: 4 }
      ]
    })
    expect(created.status).toBe(200)
    const playlist = created.body.playlist
    expect(playlist.tracks.map((t: { source: unknown }) => t.source)).toEqual([
      { type: 'file', fileId: audio.id, url: `/api/files/${audio.id}` },
      { type: 'youtube', videoId: 'dQw4w9WgXcQ' }
    ])

    const bad = await call('createSoundPlaylist', {
      worldId,
      name: 'Mal',
      kind: 'ambient',
      tracks: [{ name: 'Vimeo', source: { type: 'youtube', url: 'https://vimeo.com/123' }, duration: 3 }]
    })
    expect(bad).toMatchObject({ status: 400, body: { code: 'BAD_YOUTUBE' } })
    const notAudio = await call('createSoundPlaylist', {
      worldId,
      name: 'Mal',
      kind: 'ambient',
      tracks: [{ name: 'Mapa', source: { type: 'file', fileId: image.id }, duration: 3 }]
    })
    expect(notAudio).toMatchObject({ status: 400, body: { code: 'NOT_AUDIO' } })

    // Cambiar: la que sigue conserva su id; la que falta se va
    const [rain] = playlist.tracks
    const updated = await call('updateSoundPlaylist', {
      id: playlist.id,
      name: 'Tormenta fuerte',
      tracks: [{ id: rain.id, name: 'Lluvia', source: { type: 'file', fileId: audio.id }, duration: 12.5, loop: true }]
    })
    expect(updated.body.playlist).toMatchObject({ name: 'Tormenta fuerte', tracks: [{ id: rain.id }] })
    const listed = await call('listSoundPlaylists', { campaignId })
    expect(listed.body.playlists.map((p: { name: string }) => p.name)).toEqual(['Tormenta fuerte'])
    // El jugador no las prepara ni las ve
    expect((await call('listSoundPlaylists', { campaignId }, player.cookie)).status).toBe(403)
    expect((await call('deleteSoundPlaylist', { id: playlist.id }, player.cookie)).status).toBe(404)
    expect((await call('deleteSoundPlaylist', { id: playlist.id })).status).toBe(200)
    expect((await call('listSoundPlaylists', { worldId })).body.playlists).toEqual([])
  })

  it('lanzar, pausar, seguir y parar llega a la sala con la hora del servidor; solo el máster', async () => {
    const list = await tavern([60, 30])
    const master = await join('master')
    const own = await join('player', player.cookie)

    // Un jugador no puede, aunque llame a la API
    expect((await call('playSound', { campaignId, playlistId: list.id }, player.cookie)).status).toBe(403)
    expect((await call('stopSound', { campaignId }, player.cookie)).status).toBe(403)

    const before = Date.now()
    const played = await call('playSound', { campaignId, playlistId: list.id })
    expect(played.status).toBe(200)
    const voice = (played.body as SoundView).voices[0]
    expect(voice).toMatchObject({ trackId: list.tracks[0].id, duration: 60, offset: 0, kind: 'ambient' })
    expect(voice?.startedAt).toBeGreaterThanOrEqual(before)
    const heard = await own.next()
    expect(heard).toMatchObject({ type: 'sound', sound: { voices: [{ trackId: list.tracks[0].id }] } })
    expect(heard.serverNow).toBeGreaterThanOrEqual(voice?.startedAt ?? 0)
    await master.next()

    const paused = (await call('pauseSound', { campaignId, paused: true })).body as SoundView
    expect(paused.paused).toBe(true)
    expect(paused.pausedAt).toBeGreaterThanOrEqual(voice?.startedAt ?? 0)
    expect(await own.next()).toMatchObject({ sound: { paused: true } })
    await sleep(120)
    const resumed = (await call('pauseSound', { campaignId, paused: false })).body as SoundView
    // Se corre lo que duró la pausa: sigue por donde iba
    expect(resumed.voices[0]?.startedAt).toBeGreaterThanOrEqual((voice?.startedAt ?? 0) + 100)
    await own.next()

    // Quien entra tarde lo encuentra sonando por donde va
    const late = await join('screen')
    expect(await late.next()).toMatchObject({ sound: { voices: [{ trackId: list.tracks[0].id }], paused: false } })

    const stopped = (await call('stopSound', { campaignId })).body as SoundView
    expect(stopped.voices).toEqual([])
    expect(await own.next()).toMatchObject({ sound: { voices: [] } })
  })

  it('la hora del servidor responde a «time» a cualquiera que mire', async () => {
    const own = await join('player', player.cookie)
    await sleep(100)
    own.ws.send(JSON.stringify({ type: 'time', t: 123 }))
    const answer = await own.next()
    expect(answer).toMatchObject({ type: 'time', t: 123 })
    expect(Math.abs((answer.type === 'time' ? answer.serverNow : 0) - Date.now())).toBeLessThan(1000)
  })

  it('un efecto suena una vez por encima del ambiente; una botonera se lanza por pistas', async () => {
    const list = await tavern([60])
    const board = (
      await call('createSoundPlaylist', {
        worldId,
        name: 'Efectos',
        kind: 'effects',
        mode: 'soundboard',
        tracks: [{ name: 'Puerta', source: { type: 'youtube', url: 'dQw4w9WgXcQ' }, duration: 0.2 }]
      })
    ).body.playlist
    await call('playSound', { campaignId, playlistId: list.id })
    expect((await call('playSound', { campaignId, playlistId: board.id })).body.code).toBe('SOUNDBOARD_NEEDS_TRACK')
    const both = (await call('playSound', { campaignId, trackId: board.tracks[0].id })).body as SoundView
    expect(both.voices.map((v) => v.kind)).toEqual(['ambient', 'effects'])
    expect(both.voices[1]?.effectId).toBeTruthy()
    await sleep(400)
    const after = (await call('getSound', { campaignId })).body as SoundView
    expect(after.voices.map((v) => v.kind)).toEqual(['ambient'])
  })

  it('el servidor pasa de pista sin nadie conectado, y sigue tras reiniciar', async () => {
    const list = await tavern([0.3, 0.3, 30])
    await call('playSound', { campaignId, playlistId: list.id })
    await sleep(450)
    // Nadie mira: el reloj del servidor la pasó solo (lo guardado ya va por la segunda)
    const [row] = await conn.sql<{ sound: { lists: Array<{ index: number }> } }[]>`
      select sound from campaign_tables where campaign_id = ${campaignId}`
    expect(row?.sound.lists[0]?.index).toBe(1)

    // Se para el servidor y arranca otro más tarde: retoma la cuenta (la segunda ya acabó)
    await app.close()
    await sleep(300)
    app = await build()
    await sleep(100)
    const [after] = await conn.sql<{ sound: { lists: Array<{ index: number; startedAt: number }> } }[]>`
      select sound from campaign_tables where campaign_id = ${campaignId}`
    expect(after?.sound.lists[0]?.index).toBe(2)
    const view = (await call('getSound', { campaignId })).body as SoundView
    expect(view.voices[0]?.trackId).toBe(list.tracks[2].id)
  })

  it('el jugador oye los archivos de lo que suena en su campaña, y no los demás', async () => {
    const audio = await upload('Lluvia.wav', WAV)
    const other = await upload('Otra.wav', WAV)
    const list = (
      await call('createSoundPlaylist', {
        worldId,
        name: 'Lluvia',
        kind: 'ambient',
        tracks: [{ name: 'Lluvia', source: { type: 'file', fileId: audio.id }, duration: 30 }]
      })
    ).body.playlist
    const get = async (id: string) =>
      (await app.inject({ method: 'GET', url: `/api/files/${id}`, headers: { cookie: player.cookie } })).statusCode
    expect(await get(audio.id)).toBe(404)
    await call('playSound', { campaignId, playlistId: list.id })
    expect(await get(audio.id)).toBe(200)
    expect(await get(other.id)).toBe(404)
    await call('stopSound', { campaignId })
    expect(await get(audio.id)).toBe(404)
  })

  it('pasar de pista y el volumen; borrar una lista que suena la para', async () => {
    const list = await tavern([60, 30])
    await call('playSound', { campaignId, playlistId: list.id })
    const next = (await call('nextTrack', { campaignId })).body as SoundView
    expect(next.voices[0]?.trackId).toBe(list.tracks[1].id)
    expect(next.lists[0]).toMatchObject({ index: 1, count: 2, name: 'Taberna' })
    expect(((await call('setSoundVolume', { campaignId, volume: 0.3 })).body as SoundView).volume).toBe(0.3)
    await call('deleteSoundPlaylist', { id: list.id })
    expect(((await call('getSound', { campaignId })).body as SoundView).voices).toEqual([])
  })
})
