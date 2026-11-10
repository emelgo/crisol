/**
 * Los sonidos del mapa en el servidor (docs/specs/sonido-mapa.md): ponerlos, moverlos y quitarlos (lo del mundo, con
 * su historial), encenderlos y apagarlos en cada campaña, lo que llega a la vista de jugadores (con los muros que
 * paran el sonido y sin los de las puertas abiertas), la oscuridad, el audio que el jugador puede oír y el MCP
 */
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { diskStorage } from '../files/storage.ts'
import { MCP_TOOLS, routeCall } from '../mcp/tools.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY, testDataDir } from '../testing.ts'
import { encodeWebp } from './tile-crop.ts'

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined
const WAV = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVEfmt '), Buffer.alloc(32)])

describe('los sonidos del mapa (docs/specs/sonido-mapa.md)', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let master: { userId: string; cookie: string }
  let player: { userId: string; cookie: string }
  let worldId: string
  let campaignId: string
  let sceneId: string
  let fileId: string

  const call = (name: string, payload: object, cookie = master.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const upload = async (name: string, body: Buffer) =>
    (
      await app.inject({
        method: 'POST',
        url: `/api/files?worldId=${worldId}&name=${encodeURIComponent(name)}`,
        payload: body,
        headers: { origin: BASE_URL, cookie: master.cookie, 'content-type': 'application/octet-stream' }
      })
    ).json()
  const screen = async () => (await ok200('viewAsParty', { campaignId, sceneId })).screen

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_scene_sounds'), { max: 4 })
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
    master = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Mesa' }).returning()
    const organizationId = org?.id ?? ''
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: master.userId, role: 'owner' })
    worldId = (await ok200('createWorld', { name: 'Valdren' })).id
    campaignId = (await ok200('createCampaign', { worldId, name: 'La Marca' })).id
    const pageId = (await ok200('createPage', { worldId, title: 'Fragua' })).id
    const tab = await ok200('createPageTab', { pageId, kind: 'scene' })
    sceneId = (await ok200('getScene', { tabId: tab.id })).id
    const version = crypto.randomUUID()
    const tile = await encodeWebp({ data: new Uint8ClampedArray(512 * 400 * 4).fill(255), width: 512, height: 400 })
    await app.inject({
      method: 'PUT',
      url: `/api/scenes/${sceneId}/tiles/${version}/0/0/0`,
      payload: Buffer.from(tile),
      headers: { origin: BASE_URL, cookie: master.cookie, 'content-type': 'image/webp' }
    })
    await ok200('setSceneImage', { sceneId, width: 512, height: 400, tiles: { version, size: 512, levels: 1 } })
    await ok200('updateScene', { sceneId, grid: { size: 100, offsetX: 0, offsetY: 0, distance: 5 } })
    await ok200('openScene', { campaignId, sceneId })
    await ok200('presentScene', { campaignId })
    fileId = (await upload('Fragua.wav', WAV)).id
    player = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: player.userId, role: 'member' })
    await conn.db.insert(schema.campaignMembers).values({ campaignId, userId: player.userId, role: 'player' })
  })

  afterEach(async () => {
    await app.close()
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('pone, mueve y quita un sonido; llega a la vista de jugadores con su radio en píxeles', async () => {
    const placed = await ok200('placeSceneSound', {
      sceneId,
      unit: 'cell',
      x: 1.5,
      y: 1.5,
      name: 'Fragua',
      source: { type: 'file', fileId },
      radius: 3,
      walls: 'muffle'
    })
    const [sound] = placed.sounds
    expect(sound).toMatchObject({
      name: 'Fragua',
      x: 150,
      y: 150,
      radius: 3,
      volume: 1,
      easing: true,
      walls: 'muffle',
      darkOnly: false,
      source: { type: 'file', fileId, url: `/api/files/${fileId}` }
    })
    expect((await screen()).sounds).toEqual([
      {
        id: sound.id,
        x: 150,
        y: 150,
        radius: 300,
        volume: 1,
        easing: true,
        walls: 'muffle',
        url: `/api/files/${fileId}`
      }
    ])
    const moved = await ok200('changeSceneSound', { id: sound.id, x: 200, y: 100, volume: 0.5, easing: false })
    expect(moved.sounds[0]).toMatchObject({ x: 200, y: 100, volume: 0.5, easing: false })
    // Lo ve también quien prepara, con la campaña: encendido
    const vision = await ok200('getSceneVision', { sceneId, campaignId })
    expect(vision.sounds[0]).toMatchObject({ id: sound.id, enabled: true })
    const removed = await ok200('removeSceneSound', { id: sound.id })
    expect(removed.sounds).toEqual([])
    expect((await screen()).sounds).toEqual([])
    // Se deshace desde el historial
    const history = await ok200('listHistory', {})
    const last = history.entries.find((o: { action: string }) => o.action === 'removeSceneSound')
    await ok200('undoOperation', { operationId: last.id })
    expect((await ok200('getSceneVision', { sceneId })).sounds.map((s: { id: string }) => s.id)).toEqual([sound.id])
  })

  it('se enciende y se apaga en cada campaña; solo a oscuras suena con la escena a oscuras', async () => {
    const other = (await ok200('createCampaign', { worldId, name: 'Otra' })).id
    const { sounds } = await ok200('placeSceneSound', { sceneId, x: 100, y: 100, source: { type: 'file', fileId } })
    const id = sounds[0].id
    const off = await ok200('changeSceneSound', { id, campaignId, enabled: false })
    expect(off.sounds[0].enabled).toBe(false)
    expect((await screen()).sounds).toEqual([])
    // En la otra campaña sigue encendido
    expect((await ok200('getSceneVision', { sceneId, campaignId: other })).sounds[0].enabled).toBe(true)
    await ok200('changeSceneSound', { id, campaignId, enabled: true })
    expect((await screen()).sounds).toHaveLength(1)
    await ok200('changeSceneSound', { id, darkOnly: true })
    expect((await screen()).sounds).toEqual([])
    await ok200('updateSceneVision', { sceneId, darkness: 0.8 })
    expect((await screen()).sounds).toHaveLength(1)
    // campaignId sin enabled no vale
    expect((await call('changeSceneSound', { id, campaignId })).statusCode).toBe(400)
  })

  it('llegan los muros que paran el sonido cerca de él, sin las puertas abiertas ni los que no lo paran', async () => {
    const vision = await ok200('changeWalls', {
      sceneId,
      walls: {
        add: [
          { a: { x: 300, y: 0 }, b: { x: 300, y: 400 }, door: 'door' },
          { a: { x: 0, y: 300 }, b: { x: 512, y: 300 }, kind: 'object' },
          { a: { x: 0, y: 50 }, b: { x: 250, y: 50 }, kind: 'low' },
          { a: { x: 2000, y: 0 }, b: { x: 2000, y: 400 } }
        ]
      }
    })
    const door = vision.walls.find((w: { door: string | null }) => w.door).id
    await ok200('placeSceneSound', { sceneId, x: 100, y: 100, radius: 4, source: { type: 'file', fileId } })
    const near = (await screen()).soundWalls
    expect(near).toHaveLength(2)
    expect(near).toEqual(
      expect.arrayContaining([
        { a: { x: 300, y: 0 }, b: { x: 300, y: 400 }, limited: false, pass: null },
        { a: { x: 0, y: 50 }, b: { x: 250, y: 50 }, limited: true, pass: null }
      ])
    )
    await ok200('setDoor', { campaignId, wallId: door, open: true })
    expect((await screen()).soundWalls).toEqual([
      { a: { x: 0, y: 50 }, b: { x: 250, y: 50 }, limited: true, pass: null }
    ])
  })

  it('una pista de las listas suena en el mapa; una de YouTube, un archivo que no es audio o de otro mundo, no', async () => {
    const { playlist } = await ok200('createSoundPlaylist', {
      worldId,
      name: 'Ambiente',
      kind: 'ambient',
      mode: 'sequential',
      tracks: [
        { name: 'Lluvia', source: { type: 'file', fileId }, duration: 30 },
        { name: 'Vídeo', source: { type: 'youtube', url: 'https://youtu.be/abcdefghijk' }, duration: 30 }
      ]
    })
    const [rain, video] = playlist.tracks
    const placed = await ok200('placeSceneSound', {
      sceneId,
      x: 50,
      y: 50,
      source: { type: 'track', trackId: rain.id }
    })
    expect(placed.sounds[0].source).toEqual({
      type: 'track',
      trackId: rain.id,
      playlistId: playlist.id,
      name: 'Lluvia',
      url: `/api/files/${fileId}`
    })
    expect((await screen()).sounds[0].url).toBe(`/api/files/${fileId}`)
    const bad = await call('placeSceneSound', { sceneId, x: 0, y: 0, source: { type: 'track', trackId: video.id } })
    expect(bad.json().code).toBe('NOT_AUDIO')
    const image = (await upload('Mapa.png', Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'))).id
    const notAudio = await call('placeSceneSound', { sceneId, x: 0, y: 0, source: { type: 'file', fileId: image } })
    expect(notAudio.json().code).toBe('NOT_AUDIO')
    const youtube = await call('placeSceneSound', {
      sceneId,
      x: 0,
      y: 0,
      source: { type: 'url', url: 'https://www.youtube.com/watch?v=abcdefghijk' }
    })
    expect(youtube.json().code).toBe('NOT_AUDIO')
    // Sin pista se pone, pero no suena
    await ok200('placeSceneSound', { sceneId, x: 300, y: 300 })
    expect((await screen()).sounds).toHaveLength(1)
  })

  it('el jugador oye el audio del mapa de la escena que enseña su campaña, y no prepara ni enciende nada', async () => {
    const audio = () => app.inject({ method: 'GET', url: `/api/files/${fileId}`, headers: { cookie: player.cookie } })
    expect((await audio()).statusCode).toBe(404)
    const { sounds } = await ok200('placeSceneSound', { sceneId, x: 100, y: 100, source: { type: 'file', fileId } })
    expect((await audio()).statusCode).toBe(200)
    await ok200('hideScreen', { campaignId, hidden: false })
    const id = sounds[0].id
    // No lo encuentra (o no le deja): no es quien prepara ni lleva la mesa
    const refused = async (name: string, payload: object) =>
      expect([403, 404]).toContain((await call(name, payload, player.cookie)).statusCode)
    await refused('placeSceneSound', { sceneId, x: 0, y: 0 })
    await refused('changeSceneSound', { id, volume: 0.2 })
    await refused('changeSceneSound', { id, campaignId, enabled: false })
    await refused('removeSceneSound', { id })
    expect((await ok200('getSceneVision', { sceneId })).sounds).toHaveLength(1)
  })

  it('el MCP: poner_sonido_escena, cambiar_sonido_escena y quitar_sonido_escena', () => {
    const id = crypto.randomUUID()
    const route = (name: string, input: Record<string, unknown>) => {
      const tool = MCP_TOOLS[name]
      if (!tool) throw new Error(`falta ${name}`)
      const routed = routeCall(tool, input)
      return [routed.impl.action.name, routed.impl.action.kind]
    }
    expect(route('poner_sonido_escena', { sceneId: id, x: 1, y: 1 })).toEqual(['placeSceneSound', 'write'])
    expect(route('cambiar_sonido_escena', { id, campaignId: id, enabled: false })).toEqual([
      'changeSceneSound',
      'write'
    ])
    expect(route('quitar_sonido_escena', { id })).toEqual(['removeSceneSound', 'write'])
  })
})
