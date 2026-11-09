/**
 * La visión de la mesa en el servidor (docs/specs/vision.md): lo que ve el grupo con muros, puertas (la secreta), luces
 * y sentidos; lo explorado que se queda; la niebla a mano; las teselas de la pantalla (enteras y recortadas); el
 * arrastre que no ve; lo que trae el mapa; que un jugador no puede nada; y que a la pantalla no le llega nada más
 */
import type { ScreenView, TableServerMessage } from '@crisol/contracts'
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { exampleFile } from '@crisol/systems/examples'
import { FogGrid } from '@crisol/tabletop'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { diskStorage } from '../files/storage.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY, testDataDir } from '../testing.ts'
import { decodeWebp, encodeWebp } from './tile-crop.ts'

const BASE_URL = 'https://crisol.test'

const ok = async () => undefined
const GOBLIN = 'guerrero_goblin_2014'
type WebSocket = Awaited<ReturnType<FastifyInstance['injectWS']>>

/** Los mensajes de una conexión; next() espera al siguiente del tipo que se pida (los demás se saltan) */
function inbox(ws: WebSocket) {
  const all: TableServerMessage[] = []
  const queued: TableServerMessage[] = []
  const waiters: Array<(m: TableServerMessage) => void> = []
  ws.on('message', (data: Buffer) => {
    const message = JSON.parse(String(data)) as TableServerMessage
    all.push(message)
    const waiter = waiters.shift()
    if (waiter) waiter(message)
    else queued.push(message)
  })
  const one = () =>
    new Promise<TableServerMessage>((resolve, reject) => {
      const first = queued.shift()
      if (first) return resolve(first)
      const timer = setTimeout(() => reject(new Error('No llegó ningún mensaje')), 3000)
      waiters.push((m) => {
        clearTimeout(timer)
        resolve(m)
      })
    })
  return {
    all,
    async next<T extends TableServerMessage['type']>(type: T): Promise<Extract<TableServerMessage, { type: T }>> {
      for (;;) {
        const message = await one()
        if (message.type === type) return message as Extract<TableServerMessage, { type: T }>
      }
    },
    quiet: async () => {
      await new Promise((resolve) => setTimeout(resolve, 200))
      return queued.length === 0
    }
  }
}

const mask = (b64: string) => FogGrid.decode(new Uint8Array(Buffer.from(b64, 'base64')))
/** Qué parte de las celdas de un rectángulo está encendida (0–1) */
function share(grid: FogGrid, x: number, y: number, width: number, height: number) {
  let on = 0
  let all = 0
  for (let py = y + 5; py < y + height; py += 10)
    for (let px = x + 5; px < x + width; px += 10) {
      all += 1
      if (grid.hasPoint({ x: px, y: py })) on += 1
    }
  return on / all
}

/**
 * La cripta (800 × 400 px, casillas de 100 px y 5 pies): la sala A (x 0–400, y 0–300) y la B (x 400–800), con una
 * puerta entre las dos (y 120–180); debajo, un pasillo (y 300–400) tras una puerta secreta en la pared de la B (x
 * 560–640)
 */
const ROOM_A = [40, 40, 320, 220] as const
const ROOM_B = [440, 40, 320, 220] as const
const CORRIDOR = [40, 320, 720, 60] as const
const walls = [
  { a: { x: 0, y: 0 }, b: { x: 800, y: 0 } },
  { a: { x: 0, y: 0 }, b: { x: 0, y: 400 } },
  { a: { x: 800, y: 0 }, b: { x: 800, y: 400 } },
  { a: { x: 0, y: 400 }, b: { x: 800, y: 400 } },
  { a: { x: 400, y: 0 }, b: { x: 400, y: 120 } },
  { a: { x: 400, y: 120 }, b: { x: 400, y: 180 }, door: 'door' },
  { a: { x: 400, y: 180 }, b: { x: 400, y: 300 } },
  { a: { x: 0, y: 300 }, b: { x: 560, y: 300 } },
  { a: { x: 560, y: 300 }, b: { x: 640, y: 300 }, door: 'secret' },
  { a: { x: 640, y: 300 }, b: { x: 800, y: 300 } }
]

describe('la visión de la mesa (docs/specs/vision.md)', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let master: { userId: string; cookie: string }
  let player: { userId: string; cookie: string }
  let worldId: string
  let campaignId: string
  let pageId: string
  let sceneId: string
  let version: string
  let doorId: string
  let secretId: string
  let lia: { id: string; version: number }
  let systemId: string
  const sockets: WebSocket[] = []

  const call = (name: string, payload: object, cookie = master.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const join = async (view: 'master' | 'screen') => {
    const ws = await app.injectWS('/api/table', { headers: { origin: BASE_URL, cookie: master.cookie } })
    sockets.push(ws)
    const box = inbox(ws)
    ws.send(JSON.stringify({ type: 'join', campaignId, view }))
    return { ws, ...box }
  }
  const putTile = (at: string, body: Uint8Array, scene = sceneId, v = version) =>
    app.inject({
      method: 'PUT',
      url: `/api/scenes/${scene}/tiles/${v}/${at}`,
      payload: Buffer.from(body),
      headers: { origin: BASE_URL, cookie: master.cookie, 'content-type': 'image/webp' }
    })
  const screenTile = (at: string, cookie = master.cookie) =>
    app.inject({
      method: 'GET',
      url: `/api/campaigns/${campaignId}/screen/tiles/${version}/${at}`,
      headers: { cookie }
    })
  /** Lo que recibiría la pantalla ahora, con la escena presentada */
  const party = async (): Promise<{
    screen: ScreenView
    visible: FogGrid
    explored: FogGrid
    secretDoors: Array<{ id: string; open: boolean }>
    notSeen: Array<{ id: string; hidden: boolean }>
    visibleCount: number
  }> => {
    const view = await ok200('viewAsParty', { campaignId, sceneId })
    const fog = view.screen.fog
    return { ...view, visible: mask(fog.visible), explored: mask(fog.explored) }
  }
  const place = async (tokens: object[]) => (await ok200('placeTokens', { campaignId, sceneId, tokens })).tokens
  const white = (width: number, height: number) =>
    encodeWebp({ data: new Uint8ClampedArray(width * height * 4).fill(255), width, height })

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_vision'), { max: 4 })
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
    systemId = (await ok200('importSystem', { file: exampleFile('5e') })).system.id
    campaignId = (await ok200('createCampaign', { worldId, name: 'La Marca', system: systemId })).id
    pageId = (await ok200('createPage', { worldId, title: 'Cripta de Varn' })).id
    const tab = await ok200('createPageTab', { pageId, kind: 'scene' })
    sceneId = (await ok200('getScene', { tabId: tab.id })).id
    version = crypto.randomUUID()
    expect((await putTile('0/0/0', await white(512, 400))).statusCode).toBe(204)
    expect((await putTile('0/1/0', await white(288, 400))).statusCode).toBe(204)
    await ok200('setSceneImage', { sceneId, width: 800, height: 400, tiles: { version, size: 512, levels: 1 } })
    await ok200('updateScene', { sceneId, grid: { size: 100, offsetX: 0, offsetY: 0, distance: 5 } })
    const vision = await ok200('changeWalls', { sceneId, walls: { add: walls } })
    doorId = vision.walls.find((w: { door: string | null }) => w.door === 'door').id
    secretId = vision.walls.find((w: { door: string | null }) => w.door === 'secret').id
    await ok200('updateSceneVision', { sceneId, automaticVision: true })
    await ok200('openScene', { campaignId, sceneId })
    await ok200('presentScene', { campaignId })
    lia = (await ok200('createCharacter', { campaignId, name: 'Lía' })).character
    player = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
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

  it('con muros: la pantalla ve la sala del grupo y nada más, sin muros ni puertas; solo las teselas que toca', async () => {
    const [own, near, far] = await place([
      { characterId: lia.id, x: 200, y: 150 },
      { content: { key: GOBLIN, count: 1 }, x: 300, y: 150 },
      { content: { key: GOBLIN, count: 1 }, x: 600, y: 150 }
    ])
    const screen = await join('screen')
    const first = (await screen.next('screen')).screen
    expect(first.tokens.map((t) => t.id).sort()).toEqual([own.id, near.id].sort())
    const visible = mask(first.fog?.visible ?? '')
    expect(share(visible, ...ROOM_A)).toBe(1)
    expect(share(visible, ...ROOM_B)).toBe(0)
    expect(share(visible, ...CORRIDOR)).toBe(0)
    const text = JSON.stringify(first)
    expect(text).not.toContain(far.id)
    expect(text).not.toContain(doorId)
    expect(text).not.toContain(secretId)
    expect(text).not.toMatch(/"walls"|"doors"|secret/)
    // La tesela de la sala A sí (entera: es el ajuste por defecto; del borde, sin guardarse en el navegador); la de
    // la B, no
    const tile = await screenTile('0/0/0')
    expect(tile.statusCode).toBe(200)
    expect(tile.headers['cache-control']).toBe('private, no-store')
    expect((await screenTile('0/1/0')).statusCode).toBe(404)
    // El máster sabe lo que el grupo no ve
    const table = await ok200('getCampaignTable', { campaignId })
    expect(table.vision).toMatchObject({ sceneId, automaticVision: true, tileFit: 'whole', notSeen: [far.id] })
    expect(table.vision.doors).toEqual({ [doorId]: false, [secretId]: false })
  })

  it('una puerta abierta deja ver la sala de al lado; cerrada otra vez, lo visto queda explorado', async () => {
    const [, far] = await place([
      { characterId: lia.id, x: 200, y: 150 },
      { content: { key: GOBLIN, count: 1 }, x: 600, y: 150 }
    ])
    await ok200('setDoor', { campaignId, wallId: doorId, open: true })
    let view = await party()
    expect(share(view.visible, ...ROOM_B)).toBeGreaterThan(0.3)
    expect(view.screen.tokens.map((t) => t.id)).toContain(far.id)
    expect((await screenTile('0/1/0')).statusCode).toBe(200)
    await ok200('setDoor', { campaignId, wallId: doorId, open: false })
    view = await party()
    expect(share(view.visible, ...ROOM_B)).toBe(0)
    expect(share(view.explored, ...ROOM_B)).toBeGreaterThan(0.3)
    expect(view.screen.tokens.map((t) => t.id)).not.toContain(far.id)
    // Lo explorado sigue dejando cargar su tesela
    expect((await screenTile('0/1/0')).statusCode).toBe(200)
    // Otra campaña en la misma cripta empieza con su niebla y sus puertas
    const other = (await ok200('createCampaign', { worldId, name: 'Otra' })).id
    const otherView = await ok200('viewAsParty', { campaignId: other, sceneId })
    expect(share(mask(otherView.screen.fog.explored), ...ROOM_B)).toBe(0)
  })

  it('una puerta secreta cerrada no se ve ni se sabe; abierta se ve el hueco, nunca que era secreta', async () => {
    await place([{ characterId: lia.id, x: 600, y: 150 }])
    let view = await party()
    expect(share(view.visible, ...ROOM_B)).toBe(1)
    expect(share(view.visible, 560, 320, 80, 60)).toBe(0)
    expect(view.secretDoors).toEqual([{ id: secretId, open: false }])
    expect(JSON.stringify(view.screen)).not.toContain(secretId)
    await ok200('setDoor', { campaignId, wallId: secretId, open: true })
    view = await party()
    expect(share(view.visible, 580, 320, 40, 60)).toBe(1)
    expect(JSON.stringify(view.screen)).not.toMatch(new RegExp(`${secretId}|secret`))
    // Abrirla queda en el historial y se deshace
    const history = await ok200('listHistory', { worldId })
    const last = history.operations?.[0] ?? history.entries?.[0]
    await ok200('undoOperation', { operationId: last.id })
    expect((await party()).secretDoors).toEqual([{ id: secretId, open: false }])
  })

  it('fugas: la puerta secreta abierta en una campaña no se ve en otra de la misma escena (aunque su estado vaya igual)', async () => {
    await place([{ characterId: lia.id, x: 600, y: 150 }])
    await ok200('setDoor', { campaignId, wallId: secretId, open: true })
    expect(share((await party()).visible, 580, 320, 40, 60)).toBe(1)
    const other = (await ok200('createCampaign', { worldId, name: 'Otra', system: systemId })).id
    const mia = (await ok200('createCharacter', { campaignId: other, name: 'Mía' })).character
    await ok200('placeTokens', { campaignId: other, sceneId, tokens: [{ characterId: mia.id, x: 600, y: 150 }] })
    // Su estado en la escena, en la misma versión que el de la primera, con la secreta cerrada
    await ok200('setDoor', { campaignId: other, wallId: secretId, open: false })
    const view = await ok200('viewAsParty', { campaignId: other, sceneId })
    expect(share(mask(view.screen.fog.visible), ...ROOM_B)).toBe(1)
    expect(share(mask(view.screen.fog.visible), 580, 320, 40, 60)).toBe(0)
  })

  it('fugas: abrir la secreta, deshacerlo y abrir otra puerta no deja ver lo de la secreta (mirando o no entre medias)', async () => {
    await place([{ characterId: lia.id, x: 600, y: 150 }])
    const undoLast = async () => {
      const history = await ok200('listHistory', { worldId })
      await ok200('undoOperation', { operationId: history.entries[0].id })
    }
    for (const lookBetween of [true, false]) {
      await ok200('setDoor', { campaignId, wallId: secretId, open: true })
      expect(share((await party()).visible, 580, 320, 40, 60)).toBe(1)
      await undoLast()
      if (lookBetween) expect(share((await party()).visible, 580, 320, 40, 60)).toBe(0)
      await ok200('setDoor', { campaignId, wallId: doorId, open: true })
      const view = await party()
      expect(share(view.visible, 580, 320, 40, 60)).toBe(0)
      expect(share(view.visible, ...ROOM_A)).toBeGreaterThan(0.3)
      // Se cierra para la vuelta siguiente (y se deshace para que el estado vuelva a su versión)
      await undoLast()
      await ok200('resetFog', { campaignId })
    }
  })

  it('poner un muro, deshacerlo y poner otro: la vista es la del muro nuevo (mirando o no entre medias)', async () => {
    await place([{ characterId: lia.id, x: 200, y: 150 }])
    const undoLast = async () => {
      const history = await ok200('listHistory', { worldId })
      await ok200('undoOperation', { operationId: history.entries[0].id })
    }
    for (const lookBetween of [true, false]) {
      await ok200('changeWalls', { sceneId, walls: { add: [{ a: { x: 300, y: 0 }, b: { x: 300, y: 300 } }] } })
      expect((await party()).visible.hasPoint({ x: 350, y: 150 })).toBe(false)
      await undoLast()
      if (lookBetween) expect((await party()).visible.hasPoint({ x: 350, y: 150 })).toBe(true)
      await ok200('changeWalls', { sceneId, walls: { add: [{ a: { x: 100, y: 0 }, b: { x: 100, y: 300 } }] } })
      const view = await party()
      expect(view.visible.hasPoint({ x: 350, y: 150 })).toBe(true)
      expect(view.visible.hasPoint({ x: 50, y: 150 })).toBe(false)
      await undoLast()
    }
  })

  it('de noche solo la huella; una luz alumbra su sala, recortada; las apagadas y las que no ve el grupo no llegan', async () => {
    await place([{ characterId: lia.id, x: 200, y: 150 }])
    await ok200('updateSceneVision', { sceneId, darkness: 1 })
    let view = await party()
    expect(share(view.visible, ...ROOM_A)).toBeLessThan(0.2)
    expect(view.visible.hasPoint({ x: 200, y: 150 })).toBe(true)
    expect(view.screen.tokens).toHaveLength(1)
    const lights = await ok200('changeWalls', {
      sceneId,
      lights: {
        add: [
          { x: 100, y: 100, bright: 10, dim: 20 },
          { x: 600, y: 150, bright: 10, dim: 20 },
          { x: 300, y: 200, bright: 10, dim: 20, enabled: false }
        ]
      }
    })
    // Las tres se pusieron a la vez: se reconocen por su sitio
    const at = (x: number) => lights.lights.find((l: { x: number }) => l.x === x).id
    const [inA, inB, off] = [at(100), at(600), at(300)]
    view = await party()
    expect(share(view.visible, ...ROOM_A)).toBe(1)
    expect(share(view.visible, ...ROOM_B)).toBe(0)
    expect(view.screen.lights?.map((l) => l.id)).toEqual([inA])
    const lit = mask(view.screen.lights?.[0]?.cells ?? '')
    expect(share(lit, ...ROOM_B)).toBe(0)
    expect(view.screen.lights?.[0]?.origin).toEqual({ x: 100, y: 100 })
    const text = JSON.stringify(view.screen)
    expect(text).not.toContain(inB)
    expect(text).not.toContain(off)
  })

  it('con visión en la oscuridad (de su hoja) ve de noche hasta su alcance', async () => {
    const character = (await ok200('getCharacter', { characterId: lia.id })).character
    await ok200('updateCharacter', {
      characterId: lia.id,
      version: character.version,
      build: { ...character.build, values: { sentidos: ['Visión en la oscuridad 10 pies'] } }
    })
    await place([{ characterId: lia.id, x: 200, y: 150 }])
    await ok200('updateSceneVision', { sceneId, darkness: 1 })
    const view = await party()
    // 10 pies son dos casillas: 200 px
    expect(view.visible.hasPoint({ x: 350, y: 150 })).toBe(true)
    expect(view.visible.hasPoint({ x: 200, y: 280 })).toBe(true)
    // Pero no a través de la pared
    expect(view.visible.hasPoint({ x: 450, y: 150 })).toBe(false)
  })

  it('lo explorado crece por el camino de la ficha y se queda', async () => {
    await ok200('updateSceneVision', { sceneId, darkness: 1 })
    const [own] = await place([{ characterId: lia.id, x: 100, y: 350 }])
    await ok200('moveTokens', { campaignId, moves: [{ tokenId: own.id, x: 700, y: 350 }] })
    const view = await party()
    expect(view.visible.hasPoint({ x: 400, y: 350 })).toBe(false)
    expect(view.visible.hasPoint({ x: 700, y: 350 })).toBe(true)
    // Cada casilla del pasillo recorrido, explorada
    for (const x of [100, 200, 300, 400, 500, 600, 700]) expect(view.explored.hasPoint({ x, y: 350 })).toBe(true)
    // Se guarda: otra app (otro proceso) la lee igual
    await app.close()
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY },
      storage: diskStorage(testDataDir())
    })
    await app.ready()
    expect((await party()).explored.hasPoint({ x: 400, y: 350 })).toBe(true)
  })

  it('fugas: una ficha que salta a través de un muro no explora lo de detrás (su camino se corta en el muro)', async () => {
    const [own] = await place([{ characterId: lia.id, x: 200, y: 150 }])
    // De la sala A al pasillo en línea recta: cruza la pared de la B y la secreta cerrada
    await ok200('moveTokens', { campaignId, moves: [{ tokenId: own.id, x: 700, y: 350 }] })
    const view = await party()
    expect(view.visible.hasPoint({ x: 700, y: 350 })).toBe(true)
    expect(share(view.explored, ...ROOM_A)).toBe(1)
    expect(share(view.explored, ...ROOM_B)).toBe(0)
  })

  it('destapar y tapar a mano (lo tapado manda), deshacer, y reiniciar la niebla', async () => {
    await place([{ characterId: lia.id, x: 200, y: 150 }])
    await ok200('changeFog', { campaignId, mode: 'reveal', shape: 'area', column: 4, row: 0, columns: 4, rows: 3 })
    let view = await party()
    expect(share(view.visible, ...ROOM_B)).toBe(1)
    await ok200('changeFog', { campaignId, mode: 'cover', shape: 'rectangle', x: 0, y: 0, width: 400, height: 300 })
    view = await party()
    expect(share(view.visible, ...ROOM_A)).toBe(0)
    expect(share(view.explored, ...ROOM_A)).toBe(0)
    // Las fichas del grupo se ven siempre
    expect(view.screen.tokens).toHaveLength(1)
    const history = await ok200('listHistory', { worldId })
    const last = history.operations?.[0] ?? history.entries?.[0]
    await ok200('undoOperation', { operationId: last.id })
    view = await party()
    expect(share(view.visible, ...ROOM_A)).toBe(1)
    expect(share(view.explored, ...ROOM_A)).toBe(1)
    expect((await ok200('resetFog', { campaignId })).removed).toBe(1)
    view = await party()
    expect(share(view.visible, ...ROOM_B)).toBe(0)
    expect(share(view.explored, ...ROOM_B)).toBe(0)
    expect(share(view.visible, ...ROOM_A)).toBe(1)
  })

  it('fugas: lo destapado a mano no pasa a explorado (deshacer el destapar lo vuelve a tapar)', async () => {
    await place([{ characterId: lia.id, x: 200, y: 150 }])
    await ok200('changeFog', { campaignId, mode: 'reveal', shape: 'area', column: 4, row: 0, columns: 4, rows: 3 })
    expect(share((await party()).visible, ...ROOM_B)).toBe(1)
    const history = await ok200('listHistory', { worldId })
    await ok200('undoOperation', { operationId: history.entries[0].id })
    const view = await party()
    expect(share(view.visible, ...ROOM_B)).toBe(0)
    expect(share(view.explored, ...ROOM_B)).toBe(0)
    expect(share(view.explored, ...ROOM_A)).toBe(1)
    expect((await screenTile('0/1/0')).statusCode).toBe(404)
  })

  it('quitar la pestaña «Escena» y deshacerlo la devuelve entera: fichas, marcas, instantáneas, teselas y lo explorado', async () => {
    const [own] = await place([{ characterId: lia.id, x: 200, y: 150 }])
    expect(share((await party()).explored, ...ROOM_A)).toBe(1)
    await ok200('changeMarks', {
      campaignId,
      sceneId,
      add: [{ kind: 'text', x: 150, y: 250, text: 'Aquí', color: '#ffffff', size: 24 }]
    })
    const snapshot = await ok200('saveSnapshot', { campaignId, sceneId, name: 'Antes' })
    const { tabId } = await ok200('getScene', { sceneId })
    await ok200('deletePageTab', { tabId })
    const history = await ok200('listHistory', { worldId })
    await ok200('undoOperation', { operationId: history.entries[0].id })
    const view = await party()
    expect(view.screen.tokens.map((t) => t.id)).toEqual([own.id])
    expect(view.screen.marks?.map((m) => m.kind)).toEqual(['text'])
    expect((await ok200('listSnapshots', { campaignId, sceneId })).snapshots.map((s: { id: string }) => s.id)).toEqual([
      snapshot.id
    ])
    const tile = await app.inject({
      method: 'GET',
      url: `/api/scenes/${sceneId}/tiles/${version}/0/0/0`,
      headers: { cookie: master.cookie }
    })
    expect(tile.statusCode).toBe(200)
    const explored = await conn.db.select().from(schema.sceneExplored)
    expect(explored.map((e) => e.sceneId)).toEqual([sceneId])
  })

  it('recortadas: la tesela del borde llega transparente fuera de lo explorado y sin guardarse en el navegador', async () => {
    await place([{ characterId: lia.id, x: 200, y: 150 }])
    await ok200('setTileFit', { campaignId, tileFit: 'cropped' })
    const tile = await screenTile('0/0/0')
    expect(tile.statusCode).toBe(200)
    expect(tile.headers['content-type']).toBe('image/webp')
    expect(tile.headers['cache-control']).toBe('private, no-store')
    const image = await decodeWebp(new Uint8Array(tile.rawPayload))
    const alpha = (x: number, y: number) => image.data[(y * image.width + x) * 4 + 3]
    expect(alpha(200, 150)).toBe(255)
    expect(alpha(470, 150)).toBe(0)
    expect(alpha(200, 380)).toBe(0)
    expect((await screenTile('0/1/0')).statusCode).toBe(404)
    // Enteras otra vez: la misma, tal cual, y tampoco se guarda (al volver a «recortadas» no puede salir entera)
    await ok200('setTileFit', { campaignId, tileFit: 'whole' })
    const whole = await screenTile('0/0/0')
    expect(whole.statusCode).toBe(200)
    expect(whole.headers['cache-control']).toBe('private, no-store')
    // Con todo explorado, entera y para siempre (su versión va en la ruta)
    await ok200('changeFog', { campaignId, mode: 'reveal', shape: 'rectangle', x: 0, y: 0, width: 800, height: 400 })
    expect((await screenTile('0/0/0')).headers['cache-control']).toContain('immutable')
  })

  it('el arrastre de una ficha que el grupo no ve, o que se mete en lo que no ve, no llega a la pantalla', async () => {
    const [, near, far] = await place([
      { characterId: lia.id, x: 200, y: 150 },
      { content: { key: GOBLIN, count: 1 }, x: 300, y: 150 },
      { content: { key: GOBLIN, count: 1 }, x: 600, y: 150 }
    ])
    const mesa = await join('master')
    await mesa.next('master')
    const screen = await join('screen')
    await screen.next('screen')
    mesa.ws.send(JSON.stringify({ type: 'drag', moves: [{ tokenId: far.id, x: 610, y: 150 }] }))
    expect(await screen.quiet()).toBe(true)
    mesa.ws.send(JSON.stringify({ type: 'drag', moves: [{ tokenId: near.id, x: 320, y: 160 }] }))
    expect(await screen.next('drag')).toEqual({ type: 'drag', moves: [{ tokenId: near.id, x: 320, y: 160 }] })
    mesa.ws.send(JSON.stringify({ type: 'drag', moves: [{ tokenId: near.id, x: 600, y: 160 }] }))
    expect(await screen.quiet()).toBe(true)
  })

  it('sin muros (sin visión automática) se ve todo, como Foundry sin visión de fichas; lo tapado a mano, no', async () => {
    const tab = await ok200('createPageTab', { pageId, kind: 'scene' })
    const plain = (await ok200('getScene', { tabId: tab.id })).id
    await ok200('openScene', { campaignId, sceneId: plain })
    await ok200('presentScene', { campaignId })
    const placed = (
      await ok200('placeTokens', {
        campaignId,
        sceneId: plain,
        tokens: [
          { characterId: lia.id, x: 250, y: 250 },
          { content: { key: GOBLIN, count: 1 }, x: 650, y: 250 }
        ]
      })
    ).tokens
    const screen = await join('screen')
    const first = (await screen.next('screen')).screen
    expect(first.tokens.map((t) => t.id).sort()).toEqual(placed.map((t: { id: string }) => t.id).sort())
    const view = await ok200('viewAsParty', { campaignId })
    expect(view).toMatchObject({ sceneId: plain, automaticVision: false })
    // Tapar la casilla del goblin lo esconde (la ficha del grupo se sigue viendo)
    await ok200('changeFog', { campaignId, mode: 'cover', shape: 'cells', cells: [{ column: 6, row: 2 }] })
    const after = await ok200('viewAsParty', { campaignId })
    expect(after.screen.tokens.map((t: { id: string }) => t.id)).toEqual([placed[0].id])
  })

  it('lo que trae el mapa se pone en juego: muros unidos, objetos, puertas, ventanas y luces horneadas apagadas', async () => {
    const tab = await ok200('createPageTab', { pageId, kind: 'scene' })
    const mapScene = (await ok200('getScene', { tabId: tab.id })).id
    const v = crypto.randomUUID()
    expect((await putTile('0/0/0', await white(64, 64), mapScene, v)).statusCode).toBe(204)
    const imported = {
      source: 'uvtt',
      walls: [
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 200, y: 0 },
          { x: 300, y: 0 }
        ]
      ],
      objects: [
        [
          { x: 50, y: 50 },
          { x: 80, y: 50 }
        ]
      ],
      portals: [
        { a: { x: 0, y: 100 }, b: { x: 0, y: 200 }, closed: true, window: false },
        { a: { x: 300, y: 100 }, b: { x: 300, y: 200 }, closed: true, window: true }
      ],
      lights: [{ x: 150, y: 150, range: 400, intensity: 2, color: '#ffcc88', shadows: true }],
      ambientLight: null,
      bakedLighting: true
    }
    const image = { sceneId: mapScene, width: 400, height: 300, tiles: { version: v, size: 512, levels: 1 }, imported }
    await ok200('setSceneImage', image)
    const vision = await ok200('getSceneVision', { sceneId: mapScene })
    expect(vision).toMatchObject({ automaticVision: true, darkness: 0 })
    const kinds = vision.walls.map((w: { kind: string; door: string | null }) => `${w.kind}:${w.door}`)
    expect(kinds.sort()).toEqual(['object:null', 'wall:door', 'wall:null', 'window:null'])
    // Los tres tramos seguidos de la pared, uno solo
    expect(vision.walls.find((w: { kind: string; door: string | null }) => w.kind === 'wall' && !w.door)).toMatchObject(
      {
        a: { x: 0, y: 0 },
        b: { x: 300, y: 0 }
      }
    )
    // 400 px son cuatro casillas: 20 pies
    expect(vision.lights).toEqual([expect.objectContaining({ enabled: false, dim: 20, intensity: 1 })])
    // Con muros ya puestos no se pisan; a mano, con replace
    await ok200('setSceneImage', image)
    expect((await ok200('getSceneVision', { sceneId: mapScene })).walls).toHaveLength(4)
    expect((await call('placeImportedWalls', { sceneId: mapScene })).json().code).toBe('WALLS_EXIST')
    expect((await ok200('placeImportedWalls', { sceneId: mapScene, replace: true })).walls).toHaveLength(4)
  })

  it('cambiar muros en casillas, y uno que no es de la escena no se toca', async () => {
    const changed = await ok200('changeWalls', {
      sceneId,
      unit: 'cell',
      walls: { add: [{ a: { x: 1, y: 1 }, b: { x: 3, y: 1 }, kind: 'window' }], update: [{ id: doorId, locked: true }] }
    })
    expect(changed.walls.find((w: { kind: string }) => w.kind === 'window')).toMatchObject({
      a: { x: 100, y: 100 },
      b: { x: 300, y: 100 },
      sight: 'none',
      move: 'full'
    })
    expect(changed.walls.find((w: { id: string }) => w.id === doorId)).toMatchObject({ locked: true, door: 'door' })
    const response = await call('changeWalls', { sceneId, walls: { remove: [crypto.randomUUID()] } })
    expect(response.json().code).toBe('NOT_IN_SCENE')
  })

  it('un jugador no puede nada de esto', async () => {
    const tries: Array<[string, object]> = [
      ['getSceneVision', { sceneId }],
      ['getSceneVision', { sceneId, campaignId }],
      ['changeWalls', { sceneId, walls: { remove: [doorId] } }],
      ['updateSceneVision', { sceneId, darkness: 1 }],
      ['placeImportedWalls', { sceneId }],
      ['setDoor', { campaignId, wallId: doorId, open: true }],
      ['changeFog', { campaignId, mode: 'reveal', shape: 'area', column: 0, row: 0, columns: 8, rows: 4 }],
      ['resetFog', { campaignId }],
      ['setTileFit', { campaignId, tileFit: 'cropped' }],
      ['viewAsParty', { campaignId }]
    ]
    for (const [name, payload] of tries) {
      const response = await call(name, payload, player.cookie)
      expect([403, 404], `${name}: ${response.body}`).toContain(response.statusCode)
    }
    expect((await screenTile('0/0/0', player.cookie)).statusCode).toBe(404)
    // Nada cambió
    expect((await ok200('getSceneVision', { sceneId, campaignId })).doors[doorId]).toBe(false)
  })

  it('fugas: a la pantalla no le llega ni un muro, ni la puerta secreta, ni una luz apagada, ni lo que no ve', async () => {
    const off = (
      await ok200('changeWalls', { sceneId, lights: { add: [{ x: 200, y: 100, dim: 20, enabled: false }] } })
    ).lights[0].id
    const allWalls = (await ok200('getSceneVision', { sceneId })).walls.map((w: { id: string }) => w.id)
    const screen = await join('screen')
    await screen.next('screen')
    const [own, , far] = await place([
      { characterId: lia.id, x: 600, y: 150 },
      { content: { key: GOBLIN, count: 1 }, x: 650, y: 150 },
      { content: { key: GOBLIN, count: 1 }, x: 200, y: 150 }
    ])
    // Oculta desde que se pone, en la sala que ve el grupo
    const [hidden] = (
      await ok200('placeTokens', {
        campaignId,
        sceneId,
        hidden: true,
        tokens: [{ content: { key: GOBLIN, count: 1 }, x: 700, y: 200 }]
      })
    ).tokens
    await ok200('setDoor', { campaignId, wallId: secretId, open: true })
    await ok200('setDoor', { campaignId, wallId: secretId, open: false })
    await ok200('moveTokens', { campaignId, moves: [{ tokenId: own.id, x: 700, y: 100 }] })
    await ok200('updateSceneVision', { sceneId, darkness: 0.5 })
    await screen.quiet()
    const text = JSON.stringify(screen.all)
    for (const id of [...allWalls, off, hidden.id, far.id]) expect(text).not.toContain(id)
    expect(text).not.toMatch(/secret|"walls"|"doors"|"locked"|"life"|"stats"/)
    // Ni lo que no ha visto del mapa: recortada, la sala A sale transparente
    await ok200('setTileFit', { campaignId, tileFit: 'cropped' })
    const tile = await screenTile('0/0/0')
    expect(tile.statusCode).toBe(200)
    const image = await decodeWebp(new Uint8Array(tile.rawPayload))
    expect(image.data[(150 * image.width + 200) * 4 + 3]).toBe(0)
    expect(image.data[(150 * image.width + 480) * 4 + 3]).toBe(255)
  })
})

/** Llama a una acción como el máster y espera que vaya bien */
const caller = (app: FastifyInstance, cookie: string) => async (name: string, payload: object) => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/actions/${name}`,
    payload,
    headers: { origin: BASE_URL, cookie }
  })
  expect(response.statusCode, response.body).toBe(200)
  return response.json()
}

// Se mide sola (CRISOL_RENDIMIENTO=1, su paso en la CI y `pnpm --filter @crisol/server test:rendimiento`): con las
// demás pruebas a la vez, lo que se mide es la carga de la máquina
describe.skipIf(!process.env.CRISOL_RENDIMIENTO)(
  'rendimiento de la vista del grupo en el servidor (ADR-0018 § 5)',
  () => {
    let conn: ReturnType<typeof connect>
    let app: FastifyInstance
    let ok200: ReturnType<typeof caller>
    let campaignId: string
    let sceneId: string
    const sockets: WebSocket[] = []

    /** Mide `times` veces lo que tarda `work` hasta que la pantalla recibe la vista; devuelve el p50 y el p95 */
    const measure = async (screen: ReturnType<typeof inbox>, times: number, work: (i: number) => Promise<unknown>) => {
      const all: number[] = []
      for (let i = 0; i < times; i++) {
        const start = performance.now()
        await work(i)
        await screen.next('screen')
        all.push(performance.now() - start)
      }
      all.sort((a, b) => a - b)
      return { p50: all[Math.floor(all.length / 2)] ?? 0, p95: all[Math.ceil(all.length * 0.95) - 1] ?? 0 }
    }
    const watch = async () => {
      const ws = await app.injectWS('/api/table', { headers: { origin: BASE_URL, cookie: master.cookie } })
      sockets.push(ws)
      const screen = inbox(ws)
      ws.send(JSON.stringify({ type: 'join', campaignId, view: 'screen' }))
      await screen.next('screen')
      return screen
    }
    let master: { userId: string; cookie: string }

    beforeAll(async () => {
      conn = connect(await freshTestDatabase('crisol_test_vision_scale'), { max: 4 })
      await resetDatabase(conn.sql)
      const auth = createTestAuth(conn.db, BASE_URL)
      app = buildApp({
        checks: { postgres: ok, valkey: ok },
        accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY },
        storage: diskStorage(testDataDir())
      })
      await app.ready()
      master = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
      const [org] = await conn.db.insert(schema.organizations).values({ name: 'Mesa' }).returning()
      await conn.db
        .insert(schema.organizationMembers)
        .values({ organizationId: org?.id ?? '', userId: master.userId, role: 'owner' })
      ok200 = caller(app, master.cookie)
      const worldId = (await ok200('createWorld', { name: 'Valdren' })).id
      const systemId = (await ok200('importSystem', { file: exampleFile('5e') })).system.id
      campaignId = (await ok200('createCampaign', { worldId, name: 'La Marca', system: systemId })).id
      const pageId = (await ok200('createPage', { worldId, title: 'Mazmorra' })).id
      const tab = await ok200('createPageTab', { pageId, kind: 'scene' })
      sceneId = (await ok200('getScene', { tabId: tab.id })).id
      const version = crypto.randomUUID()
      const tile = await app.inject({
        method: 'PUT',
        url: `/api/scenes/${sceneId}/tiles/${version}/0/0/0`,
        payload: Buffer.from(await encodeWebp({ data: new Uint8ClampedArray(16 * 16 * 4), width: 16, height: 16 })),
        headers: { origin: BASE_URL, cookie: master.cookie, 'content-type': 'image/webp' }
      })
      expect(tile.statusCode).toBe(204)
      await ok200('setSceneImage', { sceneId, width: 4800, height: 4800, tiles: { version, size: 512, levels: 4 } })
      await ok200('updateScene', { sceneId, grid: { size: 100, offsetX: 0, offsetY: 0, distance: 5 } })
      // Una mazmorra de 12 × 12 salas de 400 px con las paredes en tramos de 50 px y una puerta en cada pared interior
      // (abiertas las de y 200–250, 1000–1050…: por esas filas se cruza la mazmorra de lado a lado)
      const walls: object[] = []
      for (let line = 0; line <= 12; line++)
        for (let k = 0; k < 96; k++) {
          const door = line > 0 && line < 12 && k % 8 === 4
          walls.push({
            a: { x: k * 50, y: line * 400 },
            b: { x: (k + 1) * 50, y: line * 400 },
            ...(door ? { door: 'door', open: k % 16 === 4 } : {})
          })
          walls.push({
            a: { x: line * 400, y: k * 50 },
            b: { x: line * 400, y: (k + 1) * 50 },
            ...(door ? { door: 'door', open: k % 16 === 4 } : {})
          })
        }
      const lights = Array.from({ length: 20 }, (_, i) => ({
        x: (i % 6) * 800 + 200,
        y: Math.floor(i / 6) * 1200 + 200,
        bright: 7.5,
        dim: 15
      }))
      const scene = await ok200('changeWalls', { sceneId, walls: { add: walls }, lights: { add: lights } })
      expect(scene.walls.length).toBeGreaterThanOrEqual(2496)
      await ok200('updateSceneVision', { sceneId, darkness: 0.8, automaticVision: true })
      await ok200('openScene', { campaignId, sceneId })
      await ok200('presentScene', { campaignId })
    }, 180_000)

    afterAll(async () => {
      for (const ws of sockets.splice(0)) ws.terminate()
      await app?.close()
      await conn?.close()
    })

    it('soltar una ficha con 2.500 tramos, 20 luces y seis del grupo: p95 < 100 ms hasta que la pantalla la recibe', async () => {
      const tokens = []
      for (let i = 0; i < 6; i++) {
        const character = (await ok200('createCharacter', { campaignId, name: `PJ ${i}` })).character
        tokens.push({ characterId: character.id, x: 1650 + i * 130, y: 2050 + (i % 2) * 120 })
      }
      const placed = (await ok200('placeTokens', { campaignId, sceneId, tokens })).tokens
      const screen = await watch()
      const { p50, p95 } = await measure(screen, 30, (i) => {
        // Cada una, una casilla a la derecha y, a la vuelta siguiente, otra vez a su sitio
        const k = i % 6
        const x = 1650 + k * 130 + (Math.floor(i / 6) % 2 === 0 ? 100 : 0)
        return ok200('moveTokens', { campaignId, moves: [{ tokenId: placed[k].id, x, y: 2050 + (k % 2) * 120 }] })
      })
      console.info(`vista del grupo al soltar: p50 ${p50.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms`)
      expect(p95).toBeLessThan(100)
      await ok200('removeTokens', { campaignId, tokenIds: placed.map((t: { id: string }) => t.id) })
    }, 180_000)

    it('seis fichas que recorren 30 casillas a la vez (por las puertas abiertas): p95 < 100 ms', async () => {
      // Una por cada fila de puertas abiertas: de un lado a otro de la mazmorra sin chocar con nada
      const rows = [225, 1025, 1825, 2625, 3425, 4225]
      const tokens = []
      for (const [i, y] of rows.entries()) {
        const character = (await ok200('createCharacter', { campaignId, name: `Viajero ${i}` })).character
        tokens.push({ characterId: character.id, x: 150, y })
      }
      const placed = (await ok200('placeTokens', { campaignId, sceneId, tokens })).tokens
      const screen = await watch()
      const { p50, p95 } = await measure(screen, 20, (i) =>
        ok200('moveTokens', {
          campaignId,
          moves: placed.map((t: { id: string }, k: number) => ({
            tokenId: t.id,
            x: i % 2 === 0 ? 3150 : 150,
            y: rows[k]
          }))
        })
      )
      console.info(`vista del grupo tras recorrer 30 casillas: p50 ${p50.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms`)
      expect(p95).toBeLessThan(100)
    }, 180_000)
  }
)
