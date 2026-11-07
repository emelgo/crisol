import type { TableServerMessage } from '@crisol/contracts'
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
      const timer = setTimeout(() => reject(new Error('No llegó ningún mensaje')), 2000)
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
    quiet: async () => {
      await new Promise((resolve) => setTimeout(resolve, 150))
      return queued.length === 0
    }
  }
}

describe('las fichas de la mesa (docs/specs/fichas.md)', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let master: { userId: string; cookie: string }
  let worldId: string
  let campaignId: string
  let sceneId: string
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

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_tokens'), { max: 4 })
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
    if (!org) throw new Error('sin organización')
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org.id, userId: master.userId, role: 'owner' })
    worldId = (await ok200('createWorld', { name: 'Valdren' })).id
    systemId = (await ok200('importSystem', { file: exampleFile('5e') })).system.id
    campaignId = (await ok200('createCampaign', { worldId, name: 'La Marca', system: systemId })).id
    const pageId = (await ok200('createPage', { worldId, title: 'Cripta de Varn' })).id
    const tab = await ok200('createPageTab', { pageId, kind: 'scene' })
    sceneId = (await ok200('getScene', { tabId: tab.id })).id
    await ok200('updateScene', { sceneId, grid: { size: 100, offsetX: 0, offsetY: 0 } })
  })

  afterEach(async () => {
    for (const ws of sockets.splice(0)) ws.terminate()
    await app.close()
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('pone criaturas del compendio en juego y en el mapa, con su rótulo y su vida', async () => {
    const placed = await ok200('placeTokens', {
      campaignId,
      sceneId,
      tokens: [{ content: { key: GOBLIN, count: 3 }, column: 2, row: 1 }]
    })
    expect(placed.tokens).toHaveLength(3)
    expect(placed.tokens.map((t: { label: string }) => t.label)).toEqual(['G1', 'G2', 'G3'])
    // En fila desde la casilla (2, 1): su centro y los de al lado
    expect(placed.tokens.map((t: { x: number; y: number }) => [t.x, t.y])).toEqual([
      [250, 150],
      [350, 150],
      [450, 150]
    ])
    expect(placed.tokens[0]).toMatchObject({ faction: 'hostile', actor: { kind: 'creature', name: 'Goblin 1' } })
    expect(placed.tokens[0].actor.life.max).toBeGreaterThan(0)
    // Están en juego de verdad
    expect((await ok200('listInPlay', { campaignId })).creatures).toHaveLength(3)
  })

  it('un personaje y una criatura ya en juego; ponerlos otra vez los mueve, no los repite', async () => {
    const thora = (await ok200('createCharacter', { campaignId, name: 'Thora Piedra' })).character
    const goblin = (await ok200('putInPlay', { campaignId, key: GOBLIN, count: 1 })).creatures[0]
    const first = await ok200('placeTokens', {
      campaignId,
      sceneId,
      tokens: [
        { characterId: thora.id, x: 50, y: 50 },
        { creatureId: goblin.id, x: 150, y: 50 }
      ]
    })
    expect(first.tokens.map((t: { label: string; faction: string }) => [t.label, t.faction])).toEqual([
      ['Thora', 'group'],
      ['G1', 'hostile']
    ])
    const again = await ok200('placeTokens', {
      campaignId,
      sceneId,
      tokens: [{ characterId: thora.id, x: 250, y: 250 }]
    })
    expect(again.tokens[0]).toMatchObject({ id: first.tokens[0].id, x: 250, y: 250 })
    expect((await ok200('getCampaignTable', { campaignId })).tokens).toHaveLength(0)
    await ok200('openScene', { campaignId, sceneId })
    expect((await ok200('getCampaignTable', { campaignId })).tokens).toHaveLength(2)
  })

  it('mover varias es una operación que se deshace; quitarlas no las saca de juego', async () => {
    const placed = (
      await ok200('placeTokens', { campaignId, sceneId, tokens: [{ content: { key: GOBLIN, count: 2 }, x: 0, y: 0 }] })
    ).tokens
    const moved = await ok200('moveTokens', {
      campaignId,
      moves: [
        { tokenId: placed[0].id, column: 5, row: 5 },
        { tokenId: placed[1].id, x: 999, y: 10 }
      ]
    })
    expect(moved.tokens.map((t: { x: number }) => t.x).sort()).toEqual([550, 999])
    const history = await ok200('listHistory', { worldId })
    const last = history.operations?.[0] ?? history.entries?.[0]
    await ok200('undoOperation', { operationId: last.id })
    await ok200('openScene', { campaignId, sceneId })
    const back = (await ok200('getCampaignTable', { campaignId })).tokens
    expect(back.map((t: { x: number }) => t.x)).toEqual([placed[0].x, placed[1].x])
    await ok200('removeTokens', { campaignId, tokenIds: [placed[0].id] })
    expect((await ok200('getCampaignTable', { campaignId })).tokens).toHaveLength(1)
    expect((await ok200('listInPlay', { campaignId })).creatures).toHaveLength(2)
  })

  it('el daño y los estados de la criatura llegan a su ficha; la pantalla ve «Herida», sin PG ni las ocultas', async () => {
    await ok200('openScene', { campaignId, sceneId })
    await ok200('presentScene', { campaignId })
    const placed = (
      await ok200('placeTokens', { campaignId, sceneId, tokens: [{ content: { key: GOBLIN, count: 2 }, x: 0, y: 0 }] })
    ).tokens
    await ok200('updateToken', { tokenId: placed[1].id, hidden: true })
    const screen = await join('screen')
    const first = await screen.next('screen')
    expect(first.screen.tokens.map((t) => t.id)).toEqual([placed[0].id])
    expect(first.screen.tokens[0]).toMatchObject({ name: 'Goblin 1', state: 'unhurt', label: 'G1' })
    expect(JSON.stringify(first)).not.toMatch(/"life"|"stats"|"max"/)

    const creature = placed[0].actor
    await ok200('playCreature', { creatureId: creature.id, version: creature.version, damage: 2 })
    const hurt = await screen.next('screen')
    expect(hurt.screen.tokens[0]?.state).toBe('hurt')
    const fresh = (await ok200('getInPlay', { creatureId: creature.id })).creature
    await ok200('playCreature', {
      creatureId: creature.id,
      version: fresh.version,
      condition: { add: { name: 'Derribado', rounds: 2 } }
    })
    const prone = await screen.next('screen')
    expect(prone.screen.tokens[0]?.conditions).toEqual([{ name: 'Derribado' }])
    const table = await ok200('getCampaignTable', { campaignId })
    expect(table.tokens[0].actor.conditions[0]).toMatchObject({ name: 'Derribado', rounds: 2 })
  })

  it('el arrastre en vivo llega a la pantalla solo de las fichas que ve', async () => {
    await ok200('openScene', { campaignId, sceneId })
    await ok200('presentScene', { campaignId })
    const placed = (
      await ok200('placeTokens', { campaignId, sceneId, tokens: [{ content: { key: GOBLIN, count: 2 }, x: 0, y: 0 }] })
    ).tokens
    await ok200('updateToken', { tokenId: placed[1].id, hidden: true })
    const mesa = await join('master')
    await mesa.next('master')
    const screen = await join('screen')
    await screen.next('screen')
    mesa.ws.send(
      JSON.stringify({
        type: 'drag',
        moves: [
          { tokenId: placed[0].id, x: 10, y: 20 },
          { tokenId: placed[1].id, x: 30, y: 40 }
        ]
      })
    )
    expect(await screen.next('drag')).toEqual({ type: 'drag', moves: [{ tokenId: placed[0].id, x: 10, y: 20 }] })
    // Solo la oculta: a la pantalla no le llega nada
    mesa.ws.send(JSON.stringify({ type: 'drag', moves: [{ tokenId: placed[1].id, x: 1, y: 1 }] }))
    expect(await screen.quiet()).toBe(true)
  })

  it('un encuentro del mundo se pone en juego y en el mapa con su formación; lo que no hay se salta', async () => {
    const encounter = await ok200('saveEncounter', {
      worldId,
      systemId,
      name: 'Emboscada',
      members: [
        {
          key: GOBLIN,
          unique: false,
          at: [
            { dx: 0, dy: 0 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: 1 }
          ]
        },
        { key: 'no_existe', unique: false, at: [{ dx: 3, dy: 3 }] }
      ]
    })
    expect((await ok200('listEncounters', { worldId })).encounters.map((e: { name: string }) => e.name)).toEqual([
      'Emboscada'
    ])
    const placed = await ok200('placeEncounter', { campaignId, sceneId, encounterId: encounter.id, column: 1, row: 1 })
    expect(placed.skipped).toEqual(['no_existe'])
    expect(placed.tokens.map((t: { x: number; y: number }) => [t.x, t.y])).toEqual([
      [150, 150],
      [250, 150],
      [150, 250]
    ])
  })

  it('quitar las genéricas de juego quita sus fichas, y deshacerlo las devuelve', async () => {
    await ok200('openScene', { campaignId, sceneId })
    await ok200('placeTokens', { campaignId, sceneId, tokens: [{ content: { key: GOBLIN, count: 2 }, x: 0, y: 0 }] })
    const ids = (await ok200('listInPlay', { campaignId })).creatures.map((c: { id: string }) => c.id)
    await ok200('removeFromPlay', { campaignId, creatureIds: ids })
    expect((await ok200('getCampaignTable', { campaignId })).tokens).toHaveLength(0)
    const history = await ok200('listHistory', { worldId })
    const last = history.operations?.[0] ?? history.entries?.[0]
    await ok200('undoOperation', { operationId: last.id })
    expect((await ok200('getCampaignTable', { campaignId })).tokens).toHaveLength(2)
  })

  it('un jugador no pone, ni mueve, ni ve fichas', async () => {
    const ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    const url = (await ok200('getInvitation', { campaignId })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: ana.cookie }
    })
    const placed = (
      await ok200('placeTokens', { campaignId, sceneId, tokens: [{ content: { key: GOBLIN }, x: 0, y: 0 }] })
    ).tokens
    expect(
      (
        await call(
          'placeTokens',
          { campaignId, sceneId, tokens: [{ content: { key: GOBLIN }, x: 0, y: 0 }] },
          ana.cookie
        )
      ).statusCode
    ).toBe(403)
    expect(
      (await call('moveTokens', { campaignId, moves: [{ tokenId: placed[0].id, x: 1, y: 1 }] }, ana.cookie)).statusCode
    ).toBe(403)
    expect((await call('updateToken', { tokenId: placed[0].id, hidden: true }, ana.cookie)).statusCode).toBe(403)
    expect((await call('listEncounters', { worldId }, ana.cookie)).statusCode).toBe(404)
  })
})
