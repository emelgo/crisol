/**
 * El sonido de un zip de Foundry (docs/specs/sonido-foundry.md), con un zip de prueba propio hecho aquí: las listas de
 * un paquete de listas, las de dentro de una aventura y las que enlaza una escena, con sus pistas (del zip ya subidas,
 * YouTube y direcciones); los sonidos de las escenas; lo que no viene en el zip, en el informe; y reimportar sin
 * duplicar
 */
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { diskStorage } from '../files/storage.ts'
import { foundryZip, nedbFile } from '../foundry/testing.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY, testDataDir } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined
const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')
const WAV = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVEfmt '), Buffer.alloc(32)])

const manifest = {
  id: 'fragua',
  title: 'La fragua',
  version: '1.0',
  packs: [
    { name: 'musica', label: 'Música', type: 'Playlist', path: 'packs/musica.db' },
    { name: 'escenas', label: 'Escenas', type: 'Scene', path: 'packs/escenas.db' },
    { name: 'aventuras', label: 'Aventuras', type: 'Adventure', path: 'packs/aventuras.db' }
  ]
}

/** Una lista de música con una pista del zip, una de YouTube, una dirección, una de serie y una que falta */
const music = {
  _id: 'musica0000000001',
  name: 'Fragua',
  mode: 1,
  channel: 'music',
  fade: 1500,
  sorting: 'm',
  sounds: [
    { _id: 'p1', name: 'Yunque', path: 'modules/fragua/audio/yunque.ogg', volume: 0.6, repeat: true, sort: 1 },
    { _id: 'p2', name: 'Vídeo', path: 'https://youtu.be/abcdefghijk', sort: 2 },
    { _id: 'p3', name: 'Lluvia', path: 'https://example.com/lluvia.mp3', sort: 3 },
    { _id: 'p4', name: 'Tambores', path: 'sounds/drums.wav', sort: 4 },
    { _id: 'p5', name: 'Perdida', path: 'modules/fragua/audio/perdida.ogg', sort: 5 }
  ]
}
const board = {
  _id: 'botonera00000001',
  name: 'Golpes',
  mode: -1,
  sounds: [{ _id: 'b1', name: 'Martillo', path: 'modules/fragua/audio/martillo.ogg' }]
}
/** La escena suelta: dos sonidos (uno del zip y otro de serie) y la lista de botonera enlazada */
const forge = {
  _id: 'escena0000000001',
  name: 'Herrería',
  width: 1000,
  height: 800,
  padding: 0,
  grid: { type: 1, size: 100, distance: 5 },
  playlist: 'botonera00000001',
  sounds: [
    {
      _id: 's1',
      x: 300,
      y: 200,
      radius: 20,
      path: 'modules/fragua/audio/yunque.ogg',
      volume: 0.8,
      walls: false,
      easing: true,
      darkness: { min: 0, max: 1 }
    },
    { _id: 's2', x: 600, y: 600, radius: 10, path: 'sounds/fire.ogg' }
  ]
}
const adventure = {
  _id: 'aventura00000001',
  name: 'La forja',
  journal: [],
  actors: [],
  scenes: [],
  playlists: [
    {
      _id: 'ambiente00000001',
      name: 'Ambiente',
      mode: 0,
      channel: 'environment',
      sounds: [{ _id: 'a1', name: 'Viento', path: 'modules/fragua/audio/viento.ogg' }]
    }
  ],
  folders: []
}

describe('el sonido de un zip de Foundry', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }
  let worldId: string
  const zip = base64(
    foundryZip({
      'fragua/module.json': manifest,
      'fragua/packs/musica.db': nedbFile([music, board]),
      'fragua/packs/escenas.db': nedbFile([forge]),
      'fragua/packs/aventuras.db': nedbFile([adventure])
    })
  )

  const call = (name: string, payload: object, cookie = owner.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object) => {
    const response = await call(name, payload)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const upload = async (name: string) =>
    (
      await app.inject({
        method: 'POST',
        url: `/api/files?worldId=${worldId}&name=${encodeURIComponent(name)}`,
        payload: WAV,
        headers: { origin: BASE_URL, cookie: owner.cookie, 'content-type': 'application/octet-stream' }
      })
    ).json().id as string

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_sound_foundry'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    await app?.close()
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY },
      storage: diskStorage(testDataDir())
    })
    owner = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Fateforge' }).returning()
    if (!org) throw new Error('sin organización')
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org.id, userId: owner.userId, role: 'owner' })
    worldId = (await ok200('createWorld', { name: 'Valdren' })).id
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('lista sus listas y los audios del zip con quién los usa', async () => {
    const read = await ok200('inspectFoundryScenes', { worldId, zip })
    expect(read.playlists).toEqual([
      {
        pack: 'musica',
        id: 'musica0000000001',
        name: 'Fragua',
        adventure: null,
        kind: 'ambient',
        mode: 'random',
        tracks: 5,
        existing: null
      },
      {
        pack: 'musica',
        id: 'botonera00000001',
        name: 'Golpes',
        adventure: null,
        kind: 'effects',
        mode: 'soundboard',
        tracks: 1,
        existing: null
      },
      {
        pack: 'aventuras',
        id: 'ambiente00000001',
        name: 'Ambiente',
        adventure: 'aventura00000001',
        kind: 'ambient',
        mode: 'sequential',
        tracks: 1,
        existing: null
      }
    ])
    const audio = Object.fromEntries(read.audio.map((a: { path: string; usedBy: string[] }) => [a.path, a.usedBy]))
    expect(audio).toEqual({
      'modules/fragua/audio/yunque.ogg': ['escenas/escena0000000001', 'musica/musica0000000001'],
      'modules/fragua/audio/perdida.ogg': ['musica/musica0000000001'],
      'modules/fragua/audio/martillo.ogg': ['escenas/escena0000000001', 'musica/botonera00000001'],
      'modules/fragua/audio/viento.ogg': ['aventuras/ambiente00000001', 'aventuras/aventura00000001']
    })
    expect(read.audio.every((a: { fileId: string | null }) => a.fileId === null)).toBe(true)
  })

  it('trae las listas con sus pistas y los sonidos de la escena; lo que no viene, al informe; reimportar no duplica', async () => {
    const yunque = await upload('yunque.ogg')
    const martillo = await upload('martillo.ogg')
    const viento = await upload('viento.ogg')
    const audio = [
      { path: 'modules/fragua/audio/yunque.ogg', fileId: yunque, duration: 42 },
      { path: 'modules/fragua/audio/martillo.ogg', fileId: martillo, duration: 2 },
      { path: 'modules/fragua/audio/viento.ogg', fileId: viento, duration: 60 },
      { path: 'https://example.com/lluvia.mp3', duration: 90 }
    ]
    const input = {
      worldId,
      zip,
      parentId: null,
      scenes: [{ pack: 'escenas', id: 'escena0000000001' }],
      adventures: [{ pack: 'aventuras', id: 'aventura00000001' }],
      playlists: [{ pack: 'musica', id: 'musica0000000001' }],
      audio
    }
    const imported = await ok200('importFoundryScenes', input)
    // La de música (elegida), la botonera (la enlaza la escena) y la de la aventura
    expect(
      imported.playlists
        .map((p: { name: string; tracks: number; updated: boolean }) => [p.name, p.tracks, p.updated])
        .sort()
    ).toEqual([
      ['Ambiente', 1, false],
      ['Fragua', 3, false],
      ['Golpes', 1, false]
    ])
    expect(imported.missingAudio).toEqual(
      expect.arrayContaining([
        { name: 'Fragua · Tambores', path: 'sounds/drums.wav', reason: 'core' },
        { name: 'Fragua · Perdida', path: 'modules/fragua/audio/perdida.ogg', reason: 'not-in-zip' },
        { name: 'Herrería · fire.ogg', path: 'sounds/fire.ogg', reason: 'core' }
      ])
    )
    expect(imported.missingAudio).toHaveLength(3)
    const { playlists } = await ok200('listSoundPlaylists', { worldId })
    const fragua = playlists.find((p: { name: string }) => p.name === 'Fragua')
    expect(fragua).toMatchObject({ kind: 'ambient', mode: 'random', fade: 1.5 })
    expect(fragua.tracks).toEqual([
      expect.objectContaining({
        name: 'Yunque',
        duration: 42,
        volume: 0.6,
        loop: true,
        source: { type: 'file', fileId: yunque, url: `/api/files/${yunque}` }
      }),
      expect.objectContaining({ name: 'Vídeo', duration: 300, source: { type: 'youtube', videoId: 'abcdefghijk' } }),
      expect.objectContaining({
        name: 'Lluvia',
        duration: 90,
        source: { type: 'url', url: 'https://example.com/lluvia.mp3' }
      })
    ])
    // La escena, con su sonido del zip (radio en casillas, amortiguado por los muros)
    const [scene] = imported.scenes
    const vision = await ok200('getSceneVision', { sceneId: scene.sceneId })
    expect(vision.sounds).toEqual([
      expect.objectContaining({
        x: 300,
        y: 200,
        radius: 4,
        volume: 0.8,
        walls: 'muffle',
        easing: true,
        darkOnly: false,
        source: { type: 'file', fileId: yunque, url: `/api/files/${yunque}` }
      })
    ])
    // Los audios ya subidos los dice la próxima vez (no se vuelven a subir)
    const again = await ok200('inspectFoundryScenes', { worldId, zip })
    expect(again.audio.find((a: { path: string }) => a.path === 'modules/fragua/audio/yunque.ogg').fileId).toBe(yunque)
    expect(again.playlists[0].existing).toMatchObject({ name: 'Fragua' })
    // Reimportar: en su sitio, sin duplicar
    const second = await ok200('importFoundryScenes', input)
    expect(second.playlists.every((p: { updated: boolean }) => p.updated)).toBe(true)
    expect((await ok200('listSoundPlaylists', { worldId })).playlists).toHaveLength(3)
    expect((await ok200('getSceneVision', { sceneId: second.scenes[0].sceneId })).sounds).toHaveLength(1)
    expect(second.scenes[0].sceneId).toBe(scene.sceneId)
  })

  it('una lista sola, sin escenas; un audio de otro mundo no vale', async () => {
    const imported = await ok200('importFoundryScenes', {
      worldId,
      zip,
      parentId: null,
      playlists: [{ pack: 'musica', id: 'botonera00000001' }]
    })
    expect(imported.scenes).toEqual([])
    expect(imported.playlists).toHaveLength(1)
    expect(imported.missingAudio).toEqual([
      { name: 'Golpes · Martillo', path: 'modules/fragua/audio/martillo.ogg', reason: 'not-in-zip' }
    ])
    const other = (await ok200('createWorld', { name: 'Otro' })).id
    const stranger = (
      await app.inject({
        method: 'POST',
        url: `/api/files?worldId=${other}&name=x.ogg`,
        payload: WAV,
        headers: { origin: BASE_URL, cookie: owner.cookie, 'content-type': 'application/octet-stream' }
      })
    ).json().id
    const response = await call('importFoundryScenes', {
      worldId,
      zip,
      parentId: null,
      playlists: [{ pack: 'musica', id: 'botonera00000001' }],
      audio: [{ path: 'modules/fragua/audio/martillo.ogg', fileId: stranger }]
    })
    expect(response.statusCode).toBe(404)
  })
})
