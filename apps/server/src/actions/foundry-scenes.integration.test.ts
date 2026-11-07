import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { contentKeyOf } from '@crisol/systems/foundry'
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { foundryZip, inFolder, levelFiles, nedbFile } from '../foundry/testing.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined
const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

/** Un módulo de aventura escrito a mano: un bestiario, un paquete de escenas (LevelDB) y una aventura (NeDB) */
const manifest = {
  id: 'cripta',
  title: 'La cripta de Varn',
  version: '1.0',
  packs: [
    { name: 'bestias', label: 'Bestias', type: 'Actor', path: 'packs/bestias' },
    { name: 'escenas', label: 'Escenas', type: 'Scene', path: 'packs/escenas' },
    { name: 'aventuras', label: 'Aventuras', type: 'Adventure', path: 'packs/aventuras.db' }
  ]
}

/** La escena «Cripta» de la v14, como la guarda LevelDB: cada cosa de dentro, su entrada */
const cryptEntries = {
  '!scenes!cripta0000000001': {
    name: 'Cripta',
    width: 1000,
    height: 800,
    padding: 0.25,
    shiftX: 0,
    shiftY: 0,
    grid: { type: 1, size: 100, distance: 5, units: 'ft', color: '#000000', alpha: 0.3 },
    initial: { x: 800, y: 600, scale: 1 },
    thumb: 'modules/cripta/thumbs/cripta.webp',
    tokenVision: true,
    environment: { darknessLevel: 0.6, globalLight: { enabled: false } },
    levels: ['planta0000000001'],
    walls: ['muro000000000001', 'muro000000000002', 'muro000000000003'],
    lights: ['luz0000000000001'],
    tokens: ['ficha00000000001', 'ficha00000000002'],
    notes: [],
    regions: [],
    _stats: { coreVersion: '14.369' }
  },
  '!scenes.levels!cripta0000000001.planta0000000001': {
    name: 'Planta baja',
    background: { src: 'modules/cripta/maps/cripta.webp' }
  },
  '!scenes.walls!cripta0000000001.muro000000000001': { c: [400, 300, 900, 300], sight: 20, light: 20, move: 20 },
  '!scenes.walls!cripta0000000001.muro000000000002': { c: [900, 300, 900, 700], door: 2, ds: 0 },
  '!scenes.walls!cripta0000000001.muro000000000003': { c: [400, 700, 900, 700], door: 1, ds: 2 },
  '!scenes.lights!cripta0000000001.luz0000000000001': { x: 500, y: 400, config: { bright: 10, dim: 20 } },
  '!scenes.tokens!cripta0000000001.ficha00000000001': {
    name: 'Lobo',
    actorId: 'lobo000000000001',
    actorLink: false,
    x: 500,
    y: 400,
    width: 1,
    height: 1,
    hidden: true,
    disposition: -1,
    delta: 'delta00000000001'
  },
  '!scenes.tokens.delta!cripta0000000001.ficha00000000001.delta00000000001': { system: { hp: { value: 3 } } },
  '!scenes.tokens!cripta0000000001.ficha00000000002': {
    name: 'Sombra',
    actorId: 'sombra0000000001',
    x: 700,
    y: 400,
    disposition: -1
  }
}

/** La aventura: su diario, sus actores (uno sale del bestiario; otro es un personaje) y su escena con una nota */
const adventure = {
  _id: 'aventura00000001',
  name: 'La cripta de Varn',
  img: 'modules/cripta/portada.webp',
  caption: '<p>Para personajes de nivel 1</p>',
  description: '<p>Una cripta <strong>olvidada</strong>.</p>',
  journal: [
    {
      _id: 'diario0000000001',
      name: 'Diario de Varn',
      pages: [{ _id: 'p1', name: 'Intro', type: 'text', text: { content: '<p>Varn bajó a la cripta.</p>' } }]
    }
  ],
  actors: [
    {
      _id: 'lobogris00000001',
      name: 'Lobo gris',
      type: 'npc',
      _stats: { compendiumSource: 'Compendium.cripta.bestias.Actor.lobo000000000001' }
    },
    { _id: 'heroina000000001', name: 'Heroína', type: 'character' }
  ],
  scenes: [
    {
      _id: 'sala000000000001',
      name: 'Sala',
      width: 600,
      height: 400,
      padding: 0,
      grid: { type: 0, size: 50 },
      background: { src: 'modules/cripta/maps/sala.webp', offsetX: 0, offsetY: 0 },
      walls: [{ _id: 'w', c: [0, 0, 600, 0] }],
      tokens: [
        { _id: 't1', name: 'Lobo gris', actorId: 'lobogris00000001', actorLink: true, x: 100, y: 100 },
        { _id: 't2', name: 'Heroína', actorId: 'heroina000000001', actorLink: true, x: 200, y: 100, disposition: 1 }
      ],
      notes: [{ _id: 'n', x: 300, y: 200, text: 'El diario', entryId: 'diario0000000001' }],
      _stats: { coreVersion: '13.351' }
    }
  ],
  folders: []
}

describe('traer las escenas de un zip de Foundry', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }
  let zip: string

  const call = (name: string, payload: object, cookie = owner.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = owner.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_foundry_scenes'), { max: 4 })
    const beasts = await levelFiles({ '!actors!lobo000000000001': { name: 'Lobo', type: 'npc', system: { hp: 11 } } })
    zip = base64(
      foundryZip({
        'cripta/module.json': manifest,
        ...inFolder('cripta/packs/bestias', beasts),
        ...inFolder('cripta/packs/escenas', await levelFiles(cryptEntries)),
        'cripta/packs/aventuras.db': nedbFile([adventure])
      })
    )
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

  /** El bestiario como sistema (el módulo 4), un mundo y una campaña con él */
  async function setup() {
    const { system } = await ok200('importFoundry', { zip, language: 'es', packs: ['bestias'] })
    const world = await ok200('createWorld', { name: 'Valdren' })
    const campaign = await ok200('createCampaign', { worldId: world.id, name: 'La Marca', system: system.id })
    return { systemId: system.id as string, worldId: world.id as string, campaignId: campaign.id as string }
  }

  it('lista sus escenas y aventuras con su miniatura y lo que traen, sin guardar nada', async () => {
    const { worldId } = await setup()
    const read = await ok200('inspectFoundryScenes', { worldId, zip })
    expect(read.module).toEqual({ id: 'cripta', title: 'La cripta de Varn', version: '1.0' })
    expect(read.scenes).toEqual([
      {
        pack: 'escenas',
        id: 'cripta0000000001',
        name: 'Cripta',
        adventure: null,
        thumb: 'modules/cripta/thumbs/cripta.webp',
        background: 'modules/cripta/maps/cripta.webp',
        width: 1000,
        height: 800,
        grid: 'square',
        walls: 1,
        doors: 2,
        lights: 1,
        tokens: 2,
        notes: 0,
        existing: null
      },
      expect.objectContaining({
        pack: 'aventuras',
        id: 'sala000000000001',
        adventure: 'aventura00000001',
        grid: 'none'
      })
    ])
    expect(read.adventures).toEqual([
      {
        pack: 'aventuras',
        id: 'aventura00000001',
        name: 'La cripta de Varn',
        img: 'modules/cripta/portada.webp',
        scenes: 1,
        journals: 1,
        actors: 2,
        existing: null
      }
    ])
    expect((await ok200('listScenes', { worldId })).scenes).toEqual([])
  })

  it('cada escena, una página con su pestaña «Escena», sus muros, puertas y luces, y sus criaturas preparadas', async () => {
    const { worldId, campaignId } = await setup()
    const home = (await ok200('createPage', { worldId, title: 'Lugares' })).id
    const imported = await ok200('importFoundryScenes', {
      worldId,
      zip,
      parentId: home,
      scenes: [{ pack: 'escenas', id: 'cripta0000000001' }],
      adventures: [{ pack: 'aventuras', id: 'aventura00000001' }]
    })
    expect(imported.scenes).toEqual([
      expect.objectContaining({
        id: 'cripta0000000001',
        name: 'Cripta',
        background: 'modules/cripta/maps/cripta.webp',
        width: 1000,
        height: 800,
        updated: false,
        prepared: 1,
        missing: [{ name: 'Sombra', reason: 'not-found' }]
      }),
      expect.objectContaining({
        id: 'sala000000000001',
        prepared: 1,
        missing: [{ name: 'Heroína', reason: 'character' }]
      })
    ])
    expect(imported.pages).toEqual([
      expect.objectContaining({ title: 'La cripta de Varn', kind: 'adventure', updated: false }),
      expect.objectContaining({ title: 'Diario de Varn', kind: 'journal', updated: false })
    ])

    // El árbol: bajo «Lugares», la aventura (con su diario y su escena) y la cripta
    const tree = (await ok200('listPageTree', { worldId, levels: 4 })).pages as Array<{
      title: string
      level: number
    }>
    expect(tree.map((p) => [p.title, p.level])).toEqual([
      ['Lugares', 1],
      ['La cripta de Varn', 2],
      ['Diario de Varn', 3],
      ['Sala', 3],
      ['Cripta', 2]
    ])
    const adventurePage = imported.pages[0].pageId
    const intro = await ok200('readPage', { pageId: adventurePage })
    expect(intro.markdown).toContain('Una cripta **olvidada**.')
    const diary = await ok200('readPage', { pageId: imported.pages[1].pageId })
    expect(diary.markdown).toContain('Varn bajó a la cripta.')

    // La escena: su rejilla sin el margen, su vista inicial, sus muros y puertas, su luz y su oscuridad
    const [crypt, hall] = imported.scenes
    const scene = await ok200('getScene', { sceneId: crypt.sceneId })
    expect(scene).toMatchObject({
      name: 'Escena',
      pageTitle: 'Cripta',
      image: null,
      grid: { type: 'square', size: 100, offsetX: 0, offsetY: 0, distance: 5, units: 'pies', opacity: 0.3 },
      initialView: { x: 500, y: 400, scale: 1 },
      prepared: [{ key: contentKeyOf('Lobo', 'bestias/lobo000000000001'), name: 'Lobo', unique: false, hidden: true }],
      pins: 0
    })
    const vision = await ok200('getSceneVision', { sceneId: crypt.sceneId })
    expect(vision).toMatchObject({ darkness: 0.6, automaticVision: true })
    // Se guardan en una operación (a la vez): en cualquier orden
    expect(
      vision.walls
        .map((w: { a: object; b: object; door: string | null; locked: boolean }) => [w.a, w.b, w.door, w.locked])
        .sort((x: unknown[], y: unknown[]) => String(x[2]).localeCompare(String(y[2])))
    ).toEqual([
      [{ x: 100, y: 500 }, { x: 600, y: 500 }, 'door', true],
      [{ x: 100, y: 100 }, { x: 600, y: 100 }, null, false],
      [{ x: 600, y: 100 }, { x: 600, y: 500 }, 'secret', false]
    ])
    expect(vision.lights).toEqual([expect.objectContaining({ x: 200, y: 200, bright: 10, dim: 20 })])
    const sala = await ok200('getScene', { sceneId: hall.sceneId })
    expect(sala).toMatchObject({ pageTitle: 'Sala', grid: { type: 'none' }, pins: 1 })

    // Al abrirla la campaña, su criatura preparada sale en juego y en el mapa (oculta, como venía)
    const table = await ok200('openScene', { campaignId, sceneId: crypt.sceneId })
    expect(table.tokens).toEqual([
      expect.objectContaining({ x: 250, y: 250, size: 1, hidden: true, faction: 'hostile', label: 'L1' })
    ])
    expect(table.tokens[0].actor).toMatchObject({ kind: 'creature', name: 'Lobo 1' })
    // Abrirla otra vez no las repite
    await ok200('openScene', { campaignId, sceneId: hall.sceneId })
    const again = await ok200('openScene', { campaignId, sceneId: crypt.sceneId })
    expect(again.tokens).toHaveLength(1)
    // La sala: el lobo, la única, y la nota del diario como pin del máster
    const inHall = await ok200('openScene', { campaignId, sceneId: hall.sceneId })
    expect(inHall.tokens).toEqual([expect.objectContaining({ x: 125, y: 125, hidden: false, label: 'Lobo' })])
    const marks = await conn.db.select().from(schema.sceneMarks).where(eq(schema.sceneMarks.sceneId, hall.sceneId))
    expect(marks).toEqual([
      expect.objectContaining({
        kind: 'pin',
        hidden: true,
        data: expect.objectContaining({ x: 300, y: 200, label: 'El diario', pageId: imported.pages[1].pageId })
      })
    ])
  })

  it('reimportar el mismo zip no duplica: cambia lo que ya estaba en su sitio', async () => {
    const { worldId } = await setup()
    const input = {
      worldId,
      zip,
      parentId: null,
      scenes: [{ pack: 'escenas', id: 'cripta0000000001' }],
      adventures: [{ pack: 'aventuras', id: 'aventura00000001' }]
    }
    const first = await ok200('importFoundryScenes', input)
    // Se quita un muro a mano: al reimportar vuelve a estar como en el zip
    const before = await ok200('getSceneVision', { sceneId: first.scenes[0].sceneId })
    await ok200('changeWalls', { sceneId: first.scenes[0].sceneId, walls: { remove: [before.walls[0].id] } })
    const read = await ok200('inspectFoundryScenes', { worldId, zip })
    expect(read.scenes[0].existing).toEqual({
      sceneId: first.scenes[0].sceneId,
      pageId: first.scenes[0].pageId,
      pageTitle: 'Cripta'
    })
    expect(read.adventures[0].existing).toMatchObject({ pageId: first.pages[0].pageId })
    const second = await ok200('importFoundryScenes', input)
    expect(second.scenes.map((s: { sceneId: string; updated: boolean }) => [s.sceneId, s.updated])).toEqual(
      first.scenes.map((s: { sceneId: string }) => [s.sceneId, true])
    )
    expect(second.pages.map((p: { pageId: string; updated: boolean }) => [p.pageId, p.updated])).toEqual(
      first.pages.map((p: { pageId: string }) => [p.pageId, true])
    )
    expect((await ok200('listScenes', { worldId })).scenes).toHaveLength(2)
    expect((await ok200('getSceneVision', { sceneId: first.scenes[0].sceneId })).walls).toHaveLength(3)
    // Si la página se manda a la papelera, se trae otra vez
    await ok200('deletePage', { pageId: first.scenes[0].pageId })
    const third = await ok200('importFoundryScenes', { ...input, adventures: [] })
    expect(third.scenes[0]).toMatchObject({ updated: false })
    expect(third.scenes[0].sceneId).not.toBe(first.scenes[0].sceneId)
  })

  it('sin escenas ni aventuras, o lo que no trae, un error; quien no lleva el mundo, nada', async () => {
    const { worldId } = await setup()
    const empty = base64(foundryZip({ 'nada/module.json': { id: 'nada', title: 'Nada', packs: [] } }))
    const response = await call('inspectFoundryScenes', { worldId, zip: empty })
    expect([response.statusCode, response.json().code]).toEqual([400, 'FOUNDRY_INVALID'])
    const missing = await call('importFoundryScenes', {
      worldId,
      zip,
      parentId: null,
      scenes: [{ pack: 'escenas', id: 'otra' }]
    })
    expect([missing.statusCode, missing.json().code]).toEqual([400, 'FOUNDRY_INVALID'])
    const stranger = await signUpTestUser(auth, { name: 'Otra', email: 'otra@crisol.test' })
    const denied = await call('inspectFoundryScenes', { worldId, zip }, stranger.cookie)
    expect([403, 404]).toContain(denied.statusCode)
  })
})
