/**
 * Los jugadores mueven sus fichas (docs/specs/mover-jugadores.md): lo suyo y lo asignado sí, lo ajeno no; ni muros ni
 * puertas cerradas; la pausa, el bloqueo y el turno; las puertas que ve su grupo; pasar su turno; el arrastre en vivo
 */
import type { ScreenView, TableServerMessage } from '@crisol/contracts'
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { exampleFile } from '@crisol/systems/examples'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined
const GOBLIN = 'guerrero_goblin_2014'
type WebSocket = Awaited<ReturnType<FastifyInstance['injectWS']>>

/** Los mensajes de una conexión; next() espera al siguiente del tipo que se pida (los demás se saltan) */
function inbox(ws: WebSocket) {
  const queued: TableServerMessage[] = []
  const waiters: Array<(m: TableServerMessage) => void> = []
  ws.on('message', (data: Buffer) => {
    const message = JSON.parse(String(data)) as TableServerMessage
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
    async next<T extends TableServerMessage['type']>(type: T): Promise<Extract<TableServerMessage, { type: T }>> {
      for (;;) {
        const message = await one()
        if (message.type === type) return message as Extract<TableServerMessage, { type: T }>
      }
    },
    /** Que no llegue ningún mensaje de ese tipo en un rato */
    async none(type: TableServerMessage['type']) {
      await new Promise((resolve) => setTimeout(resolve, 200))
      return !queued.some((m) => m.type === type)
    }
  }
}

/**
 * La cripta (casillas de 100 px): la sala A (x 0–400, y 0–300) y la B (x 400–800), con una puerta entre las dos (y
 * 120–180); debajo, un pasillo (y 300–400) tras una puerta secreta en la pared de la B (x 560–640)
 */
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

describe('los jugadores mueven sus fichas (docs/specs/mover-jugadores.md)', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let master: { userId: string; cookie: string }
  let player: { userId: string; cookie: string }
  let campaignId: string
  let sceneId: string
  let doorId: string
  let secretId: string
  /** La ficha de su personaje (en la sala A), la del personaje del máster y la de un goblin */
  let own: { id: string }
  let other: { id: string }
  let goblin: { id: string; actor: { id: string } }
  const sockets: WebSocket[] = []

  const call = (name: string, payload: object, cookie = master.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  /** Lo que contesta la API: el estado y, si falla, su código */
  const outcome = async (name: string, payload: object, cookie = player.cookie) => {
    const response = await call(name, payload, cookie)
    return response.statusCode === 200 ? 200 : `${response.statusCode} ${response.json().code}`
  }
  const move = (tokenId: string, x: number, y: number, cookie = player.cookie) =>
    outcome('moveTokens', { campaignId, moves: [{ tokenId, x, y }] }, cookie)
  const join = async (view: 'master' | 'player', cookie: string) => {
    const ws = await app.injectWS('/api/table', { headers: { origin: BASE_URL, cookie } })
    sockets.push(ws)
    const box = inbox(ws)
    ws.send(JSON.stringify({ type: 'join', campaignId, view }))
    return { ws, ...box }
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_move_players'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY }
    })
    await app.ready()
    master = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Mesa' }).returning()
    const organizationId = org?.id ?? ''
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: master.userId, role: 'owner' })
    const worldId = (await ok200('createWorld', { name: 'Valdren' })).id
    const systemId = (await ok200('importSystem', { file: exampleFile('5e') })).system.id
    campaignId = (await ok200('createCampaign', { worldId, name: 'La Marca', system: systemId })).id
    const pageId = (await ok200('createPage', { worldId, title: 'Cripta de Varn' })).id
    const tab = await ok200('createPageTab', { pageId, kind: 'scene' })
    sceneId = (await ok200('getScene', { tabId: tab.id })).id
    await ok200('updateScene', { sceneId, grid: { size: 100, offsetX: 0, offsetY: 0, distance: 5 } })
    const vision = await ok200('changeWalls', { sceneId, walls: { add: walls } })
    doorId = vision.walls.find((w: { door: string | null }) => w.door === 'door').id
    secretId = vision.walls.find((w: { door: string | null }) => w.door === 'secret').id
    await ok200('updateSceneVision', { sceneId, automaticVision: true })
    await ok200('openScene', { campaignId, sceneId })
    await ok200('presentScene', { campaignId })
    // Presentar una escena nueva pausa la partida (docs/specs/sala.md)
    await ok200('setTableControls', { campaignId, paused: false })
    player = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: player.userId, role: 'member' })
    await conn.db.insert(schema.campaignMembers).values({ campaignId, userId: player.userId, role: 'player' })
    const mine = (await ok200('createCharacter', { campaignId, name: 'Lía' }, player.cookie)).character
    const npc = (await ok200('createCharacter', { campaignId, name: 'Bram' })).character
    const placed = (
      await ok200('placeTokens', {
        campaignId,
        sceneId,
        tokens: [
          { characterId: mine.id, x: 350, y: 150 },
          { characterId: npc.id, x: 150, y: 150 },
          { content: { key: GOBLIN, count: 1 }, x: 250, y: 250 }
        ]
      })
    ).tokens
    ;[own, other, goblin] = placed
  })

  afterEach(async () => {
    for (const ws of sockets.splice(0)) ws.terminate()
    await app.close()
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('mueve lo suyo y no lo ajeno; el máster, todo', async () => {
    expect(await move(own.id, 250, 150)).toBe(200)
    expect(await move(other.id, 150, 50)).toBe('403 FORBIDDEN')
    expect(await move(goblin.id, 150, 250)).toBe('403 FORBIDDEN')
    // Varias a la vez: si una es ajena, ninguna
    expect(
      await outcome('moveTokens', {
        campaignId,
        moves: [
          { tokenId: own.id, x: 150, y: 50 },
          { tokenId: other.id, x: 50, y: 50 }
        ]
      })
    ).toBe('403 FORBIDDEN')
    const table = await ok200('getCampaignTable', { campaignId })
    expect(table.tokens.find((t: { id: string }) => t.id === own.id)).toMatchObject({ x: 250, y: 150 })
    // El máster, a través de muros y todo
    expect(await move(goblin.id, 650, 350, master.cookie)).toBe(200)
  })

  it('no cruza muros ni puertas cerradas (tampoco la secreta) ni sale del mapa; con la puerta abierta, sí', async () => {
    expect(await move(own.id, 350, 350)).toBe('400 WALL')
    expect(await move(own.id, 550, 150)).toBe('400 WALL')
    expect(await move(own.id, -50, 150)).toBe('400 OUT_OF_MAP')
    await ok200('setDoor', { campaignId, wallId: doorId, open: true })
    expect(await move(own.id, 550, 150)).toBe(200)
    expect(await move(own.id, 600, 250)).toBe(200)
    expect(await move(own.id, 600, 350)).toBe('400 WALL')
    await ok200('setDoor', { campaignId, wallId: secretId, open: true })
    expect(await move(own.id, 600, 350)).toBe(200)
  })

  it('con pausa o bloqueado, no mueve; con «en su turno», solo quien lleva al activo (sin combate, libre)', async () => {
    await ok200('setTableControls', { campaignId, paused: true })
    expect(await move(own.id, 250, 150)).toBe('400 PAUSED')
    // El máster sí
    expect(await move(own.id, 300, 150, master.cookie)).toBe(200)
    await ok200('setTableControls', { campaignId, paused: false, movement: 'locked' })
    expect(await move(own.id, 250, 150)).toBe('400 LOCKED')
    await ok200('setTableControls', { campaignId, movement: 'turn' })
    expect(await move(own.id, 250, 150)).toBe(200)
    const combat = await ok200('startCombat', { campaignId, tokenIds: [own.id, goblin.id] })
    const mine = combat.combatants.find((c: { tokenId: string }) => c.tokenId === own.id)
    const theirs = combat.combatants.find((c: { tokenId: string }) => c.tokenId === goblin.id)
    await ok200('setInitiative', {
      campaignId,
      values: [
        { combatantId: theirs.id, initiative: 20 },
        { combatantId: mine.id, initiative: 10 }
      ]
    })
    // Antes del primer turno, nadie
    expect(await move(own.id, 200, 150)).toBe('400 NOT_YOUR_TURN')
    await ok200('nextTurn', { campaignId })
    expect(await move(own.id, 200, 150)).toBe('400 NOT_YOUR_TURN')
    await ok200('nextTurn', { campaignId })
    expect(await move(own.id, 200, 150)).toBe(200)
  })

  it('el máster le asigna una criatura y la mueve como la suya; quitársela; un jugador no asigna', async () => {
    expect(await outcome('assignToken', { campaignId, creatureId: goblin.actor.id, userIds: [player.userId] })).toBe(
      '403 FORBIDDEN'
    )
    expect(
      await outcome('assignToken', { campaignId, creatureId: goblin.actor.id, userIds: [master.userId] }, master.cookie)
    ).toBe('400 NOT_A_PLAYER')
    expect(await ok200('assignToken', { campaignId, creatureId: goblin.actor.id, userIds: [player.userId] })).toEqual({
      creatureId: goblin.actor.id,
      controllers: [player.userId]
    })
    expect(await move(goblin.id, 150, 250)).toBe(200)
    // La vista del grupo dice quién mueve cada ficha
    const view = await ok200('viewAsParty', { campaignId, sceneId })
    const tokens = (view.screen as ScreenView).tokens
    expect(tokens.find((t) => t.id === goblin.id)?.controllers).toEqual([player.userId])
    expect(tokens.find((t) => t.id === own.id)?.controllers).toEqual([player.userId])
    expect(tokens.find((t) => t.id === other.id)?.controllers).toEqual([master.userId])
    await ok200('assignToken', { campaignId, creatureId: goblin.actor.id, userIds: [] })
    expect(await move(goblin.id, 250, 250)).toBe('403 FORBIDDEN')
  })

  it('abre y cierra la puerta que ve su grupo, no la secreta ni la de llave; con pausa, no', async () => {
    const view = await ok200('viewAsParty', { campaignId, sceneId })
    expect((view.screen as ScreenView).doors).toEqual([
      { id: doorId, a: { x: 400, y: 120 }, b: { x: 400, y: 180 }, open: false, locked: false }
    ])
    expect(JSON.stringify(view.screen)).not.toContain(secretId)
    expect(await outcome('setDoor', { campaignId, wallId: doorId, open: true })).toBe(200)
    expect(await outcome('setDoor', { campaignId, wallId: doorId, open: false })).toBe(200)
    expect(await outcome('setDoor', { campaignId, wallId: secretId, open: true })).toBe('403 FORBIDDEN')
    await ok200('setTableControls', { campaignId, paused: true })
    expect(await outcome('setDoor', { campaignId, wallId: doorId, open: true })).toBe('400 PAUSED')
    await ok200('setTableControls', { campaignId, paused: false })
    await ok200('changeWalls', { sceneId, walls: { update: [{ id: doorId, locked: true }] } })
    expect(await outcome('setDoor', { campaignId, wallId: doorId, open: true })).toBe('403 FORBIDDEN')
  })

  it('pasa turno solo en el suyo (o el de su ficha asignada)', async () => {
    expect(await outcome('nextTurn', { campaignId })).toBe('400 NOT_YOUR_TURN')
    const combat = await ok200('startCombat', { campaignId, tokenIds: [own.id, goblin.id, other.id] })
    const at = (tokenId: string) => combat.combatants.find((c: { tokenId: string }) => c.tokenId === tokenId).id
    await ok200('setInitiative', {
      campaignId,
      values: [
        { combatantId: at(other.id), initiative: 30 },
        { combatantId: at(own.id), initiative: 20 },
        { combatantId: at(goblin.id), initiative: 10 }
      ]
    })
    await ok200('nextTurn', { campaignId })
    expect(await outcome('nextTurn', { campaignId })).toBe('400 NOT_YOUR_TURN')
    await ok200('nextTurn', { campaignId })
    const passed = await ok200('nextTurn', { campaignId }, player.cookie)
    expect(passed.started).toBeNull()
    expect(passed.combat.combatants.find((c: { active: boolean }) => c.active).tokenId).toBe(goblin.id)
    // Lo de las criaturas no le llega
    expect(passed.combat.combatants.find((c: { tokenId: string }) => c.tokenId === goblin.id).life).toBeNull()
    expect(await outcome('nextTurn', { campaignId })).toBe('400 NOT_YOUR_TURN')
    await ok200('assignToken', { campaignId, creatureId: goblin.actor.id, userIds: [player.userId] })
    expect(await outcome('nextTurn', { campaignId })).toBe(200)
  })

  it('el arrastre en vivo de un jugador: el de lo suyo llega a los demás con quién arrastra; el de lo ajeno, no', async () => {
    const watching = await join('master', master.cookie)
    await watching.next('master')
    const mesa = await join('player', player.cookie)
    await mesa.next('screen')
    mesa.ws.send(JSON.stringify({ type: 'drag', moves: [{ tokenId: other.id, x: 100, y: 100 }] }))
    expect(await watching.none('drag')).toBe(true)
    mesa.ws.send(JSON.stringify({ type: 'drag', moves: [{ tokenId: own.id, x: 300, y: 150 }] }))
    expect(await watching.next('drag')).toEqual({
      type: 'drag',
      moves: [{ tokenId: own.id, x: 300, y: 150 }],
      by: player.userId
    })
    // Lo demás que va en vivo sigue siendo solo del máster
    mesa.ws.send(JSON.stringify({ type: 'laser', points: [{ x: 1, y: 1 }] }))
    expect(await mesa.next('error')).toEqual({ type: 'error', code: 'BAD_MESSAGE' })
  })
})
