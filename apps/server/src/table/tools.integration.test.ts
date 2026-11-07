/**
 * Las herramientas de la mesa en el servidor (docs/specs/herramientas-mesa.md): medir, las plantillas y sus fichas de
 * dentro, lo dejado en el mapa con su historial, los widgets, las instantáneas con deshacer, la medida y el láser en
 * vivo, lo que llega a la pantalla (ni lo del máster ni lo que cae en la niebla), que un jugador no puede nada y las
 * herramientas de la IA
 */
import type { ScreenView, TableServerMessage } from '@crisol/contracts'
import { connect, loadMemberships, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { actorFrom } from '@crisol/domain'
import { exampleFile } from '@crisol/systems/examples'
import { FogGrid } from '@crisol/tabletop'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { ActionEnv } from '../actions/context.ts'
import { implementationsByName } from '../actions/implementations.ts'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { callAsAi } from '../mcp/approvals.ts'
import { MCP_TOOLS, routeCall } from '../mcp/tools.ts'
import { createRealtime } from '../realtime/hub.ts'
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
    /** La siguiente pantalla que cumple algo (las de antes se saltan) */
    async screenWhere(test: (screen: ScreenView) => boolean): Promise<ScreenView> {
      for (;;) {
        const message = await one()
        if (message.type === 'screen' && test(message.screen)) return message.screen
      }
    },
    quiet: async () => {
      await new Promise((resolve) => setTimeout(resolve, 200))
      return queued.length === 0
    },
    drain: () => queued.splice(0)
  }
}

/**
 * La cripta (casillas de 100 px y 5 pies): la sala A (x 0–400, y 0–300) y la B (x 400–800), con una puerta cerrada
 * entre las dos (y 120–180). El grupo (Lía, en la A) ve la A y no la B
 */
const walls = [
  { a: { x: 0, y: 0 }, b: { x: 800, y: 0 } },
  { a: { x: 0, y: 0 }, b: { x: 0, y: 300 } },
  { a: { x: 800, y: 0 }, b: { x: 800, y: 300 } },
  { a: { x: 0, y: 300 }, b: { x: 800, y: 300 } },
  { a: { x: 400, y: 0 }, b: { x: 400, y: 120 } },
  { a: { x: 400, y: 120 }, b: { x: 400, y: 180 }, door: 'door' },
  { a: { x: 400, y: 180 }, b: { x: 400, y: 300 } }
]

describe('las herramientas de la mesa (docs/specs/herramientas-mesa.md)', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let master: { userId: string; cookie: string }
  let player: { userId: string; cookie: string }
  let worldId: string
  let campaignId: string
  let pageId: string
  let sceneId: string
  let lia: { id: string }
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
  const place = async (tokens: object[]) => (await ok200('placeTokens', { campaignId, sceneId, tokens })).tokens
  /** Deshace la última operación de esa acción */
  const undoLast = async (action: string) => {
    const { entries } = await ok200('listHistory', { worldId })
    const last = entries.find((e: { action: string; undoneBy: string | null }) => e.action === action && !e.undoneBy)
    expect(last, action).toBeDefined()
    return ok200('undoOperation', { operationId: last.id })
  }
  const table = () => ok200('getCampaignTable', { campaignId })

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_table_tools'), { max: 4 })
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
    worldId = (await ok200('createWorld', { name: 'Valdren' })).id
    const systemId = (await ok200('importSystem', { file: exampleFile('5e') })).system.id
    campaignId = (await ok200('createCampaign', { worldId, name: 'La Marca', system: systemId })).id
    pageId = (await ok200('createPage', { worldId, title: 'Cripta de Varn' })).id
    const tab = await ok200('createPageTab', { pageId, kind: 'scene' })
    sceneId = (await ok200('getScene', { tabId: tab.id })).id
    await ok200('updateScene', { sceneId, grid: { size: 100, offsetX: 0, offsetY: 0, distance: 5 } })
    await ok200('changeWalls', { sceneId, walls: { add: walls } })
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

  it('medir entre dos casillas con las tres reglas de diagonales, y en hexagonal', async () => {
    const measure = (points: object[]) => ok200('measureDistance', { campaignId, points })
    // Cuatro a la derecha y tres abajo: tres diagonales y una recta
    const path = [
      { column: 0, row: 0 },
      { column: 4, row: 3 }
    ]
    expect(await measure(path)).toMatchObject({ sceneId, cells: 4, distance: 20, units: 'pies', text: '20 pies' })
    await ok200('updateScene', { sceneId, grid: { diagonals: 'alternate' } })
    expect(await measure(path)).toMatchObject({ cells: 5, text: '25 pies' })
    await ok200('updateScene', { sceneId, grid: { diagonals: 'euclidean' } })
    expect(await measure(path)).toMatchObject({ cells: 5, distance: 25 })
    // Un camino con un punto de paso, en píxeles
    await ok200('updateScene', { sceneId, grid: { diagonals: 'equal' } })
    const walk = await measure([
      { x: 50, y: 50 },
      { column: 2, row: 0 },
      { column: 2, row: 2 }
    ])
    expect(walk).toMatchObject({ cells: 4, segments: [2, 2] })
    await ok200('updateScene', { sceneId, grid: { type: 'hex-rows' } })
    expect(
      await measure([
        { column: 0, row: 0 },
        { column: 3, row: -1 }
      ])
    ).toMatchObject({ cells: 3, text: '15 pies' })
  })

  it('una plantilla dice qué fichas quedan dentro; moverla las cambia y se deshace', async () => {
    const [own, near, far] = await place([
      { characterId: lia.id, column: 1, row: 1 },
      { content: { key: GOBLIN, count: 1 }, column: 3, row: 1 },
      { content: { key: GOBLIN, count: 1 }, column: 6, row: 1 }
    ])
    // Una bola de fuego de 10 pies de radio desde la casilla (3, 1)
    const placed = await ok200('placeTemplate', {
      campaignId,
      shape: 'circle',
      from: { column: 3, row: 1 },
      size: 10,
      damageType: 'fire'
    })
    expect(placed.template).toMatchObject({ kind: 'template', shape: 'circle', a: { x: 350, y: 150 }, hidden: false })
    expect(placed.tokens.map((t: { tokenId: string }) => t.tokenId).sort()).toEqual([own.id, near.id].sort())
    expect(placed.tokens.find((t: { tokenId: string }) => t.tokenId === near.id)).toMatchObject({
      kind: 'creature',
      actorId: near.actor.id,
      name: 'Goblin 1'
    })
    // Un cono de 15 pies hacia el este desde (4, 1): solo el de la casilla (6, 1)
    const cone = await ok200('placeTemplate', {
      campaignId,
      shape: 'cone',
      from: { column: 4, row: 1 },
      size: 15,
      toward: { column: 6, row: 1 }
    })
    expect(cone.tokens.map((t: { tokenId: string }) => t.tokenId)).toEqual([far.id])
    expect(cone.template.angle).toBeCloseTo(53.13)
    // Moverla una casilla a la derecha: ahora caen el de (3, 1) y el de (6, 1)
    const templateId = placed.template.id
    const moved = await ok200('changeMarks', { campaignId, update: [{ id: templateId, move: { dx: 100, dy: 0 } }] })
    expect(moved.marks[0].tokenIds.sort()).toEqual([near.id, far.id].sort())
    expect((await ok200('getTemplateTokens', { campaignId, templateId })).tokens).toHaveLength(2)
    // La mesa del máster las trae con sus fichas de dentro
    const mesa = await table()
    expect(mesa.marks.find((m: { id: string }) => m.id === templateId).tokenIds).toHaveLength(2)
    await undoLast('changeMarks')
    expect(
      (await ok200('getTemplateTokens', { campaignId, templateId })).tokens
        .map((t: { tokenId: string }) => t.tokenId)
        .sort()
    ).toEqual([own.id, near.id].sort())
    // Quitarla
    await ok200('changeMarks', { campaignId, remove: [templateId, cone.template.id] })
    expect((await table()).marks).toEqual([])
    expect((await call('getTemplateTokens', { campaignId, templateId })).statusCode).toBe(404)
  })

  it('dibujos, textos, sellos y pines: con historial; la goma (quitar y poner) se deshace de una vez', async () => {
    const added = await ok200('changeMarks', {
      campaignId,
      add: [
        {
          kind: 'drawing',
          tool: 'pen',
          points: [
            { x: 100, y: 100 },
            { x: 300, y: 100 }
          ],
          color: '#ff0000',
          width: 4,
          opacity: 1
        },
        { kind: 'text', x: 150, y: 200, text: 'Trampa', color: '#ffffff', size: 24 },
        { kind: 'stamp', x: 250, y: 250, icon: 'skull', size: 100, color: '#000000' },
        { kind: 'pin', x: 50, y: 50, pageId, label: 'Altar', icon: 'treasure' }
      ]
    })
    expect(added.marks.map((m: { kind: string }) => m.kind)).toEqual(['drawing', 'text', 'stamp', 'pin'])
    // Los pines son del máster salvo que se diga
    expect(added.marks.find((m: { kind: string }) => m.kind === 'pin').hidden).toBe(true)
    const stroke = added.marks[0]
    // La goma parte el trazo: quita uno y pone sus dos trozos
    const piece = (points: object[]) => ({
      kind: 'drawing',
      tool: 'pen',
      points,
      color: '#ff0000',
      width: 4,
      opacity: 1
    })
    const erased = await ok200('changeMarks', {
      campaignId,
      remove: [stroke.id],
      add: [
        piece([
          { x: 100, y: 100 },
          { x: 180, y: 100 }
        ]),
        piece([
          { x: 220, y: 100 },
          { x: 300, y: 100 }
        ])
      ]
    })
    expect(erased.removed).toEqual([stroke.id])
    expect((await table()).marks.filter((m: { kind: string }) => m.kind === 'drawing')).toHaveLength(2)
    await undoLast('changeMarks')
    const drawings = (await table()).marks.filter((m: { kind: string }) => m.kind === 'drawing')
    expect(drawings.map((m: { id: string }) => m.id)).toEqual([stroke.id])
    // Cambiar a trozos: lo que no vale no se guarda
    const recolored = await ok200('changeMarks', { campaignId, update: [{ id: stroke.id, set: { color: '#00ff00' } }] })
    expect(recolored.marks[0]).toMatchObject({ color: '#00ff00', width: 4 })
    const bad = await call('changeMarks', { campaignId, update: [{ id: stroke.id, set: { color: 'verde' } }] })
    expect([bad.statusCode, bad.json().code]).toEqual([400, 'BAD_MARK'])
    // Un sello sin icono ni imagen, una imagen que no es del mundo, o un pin a una página de otro mundo, no
    const noIcon = await call('changeMarks', {
      campaignId,
      add: [{ kind: 'stamp', x: 0, y: 0, icon: null, size: 50, color: '#000000' }]
    })
    expect(noIcon.json().code).toBe('BAD_MARK')
    const stranger = await call('changeMarks', {
      campaignId,
      add: [{ kind: 'image', x: 0, y: 0, width: 100, height: 100, rotation: 0, fileId: crypto.randomUUID() }]
    })
    expect(stranger.json().code).toBe('BAD_MARK_IMAGE')
    const otherWorld = (await ok200('createWorld', { name: 'Otro' })).id
    const otherPage = (await ok200('createPage', { worldId: otherWorld, title: 'Ajena' })).id
    const foreign = await call('changeMarks', {
      campaignId,
      add: [{ kind: 'pin', x: 0, y: 0, pageId: otherPage, label: '', icon: 'pin' }]
    })
    expect(foreign.json().code).toBe('BAD_MARK_PAGE')
    // Una marca de otra escena no se toca
    const tab = await ok200('createPageTab', { pageId, kind: 'scene' })
    const other = (await ok200('getScene', { tabId: tab.id })).id
    const elsewhere = await call('changeMarks', { campaignId, sceneId: other, remove: [stroke.id] })
    expect(elsewhere.json().code).toBe('NOT_IN_SCENE')
  })

  it('la pantalla: ni lo del máster, ni lo que cae en la niebla (del dibujo, solo el trozo que ve); el pin sin su página', async () => {
    await place([{ characterId: lia.id, x: 200, y: 150 }])
    const screen = await join('screen')
    await screen.next('screen')
    const { marks } = await ok200('changeMarks', {
      campaignId,
      add: [
        {
          kind: 'drawing',
          tool: 'polygon',
          // De la sala A a la B, que el grupo no ve
          points: [
            { x: 100, y: 60 },
            { x: 700, y: 60 }
          ],
          color: '#ff0000',
          width: 4,
          opacity: 1,
          fill: '#330000'
        },
        { kind: 'text', x: 600, y: 150, text: 'En la B', color: '#ffffff', size: 24 },
        { kind: 'text', x: 150, y: 150, text: 'Secreto', color: '#ffffff', size: 24, hidden: true },
        { kind: 'template', shape: 'circle', a: { x: 200, y: 200 }, b: { x: 300, y: 200 }, color: '#e0b04a' },
        { kind: 'template', shape: 'circle', a: { x: 600, y: 200 }, b: { x: 700, y: 200 }, color: '#e0b04a' },
        { kind: 'pin', x: 300, y: 250, pageId, label: 'Altar', icon: 'treasure', hidden: false }
      ]
    })
    const [stroke, inB, secret, templateA, templateB, pin] = marks
    const seen = await screen.screenWhere((s) => (s.marks ?? []).length > 0)
    const ids = (seen.marks ?? []).map((m) => m.id)
    expect(ids.sort()).toEqual([stroke.id, templateA.id, pin.id].sort())
    const drawing = seen.marks?.find((m) => m.id === stroke.id)
    if (drawing?.kind !== 'drawing') throw new Error('falta el dibujo')
    // Solo el trozo de la sala A, y sin relleno
    const xs = drawing.strokes.flat().map((p) => p.x)
    expect(Math.max(...xs)).toBeLessThan(420)
    expect(drawing.fill).toBeNull()
    const text = JSON.stringify(seen)
    expect(text).not.toContain(inB.id)
    expect(text).not.toContain(secret.id)
    expect(text).not.toContain(templateB.id)
    expect(text).not.toContain('Secreto')
    expect(text).not.toContain(pageId)
    // Abierta la puerta, la B se ve: llega lo que había en ella
    const doorId = (await ok200('getSceneVision', { sceneId })).walls.find((w: { door: string | null }) => w.door).id
    await ok200('setDoor', { campaignId, wallId: doorId, open: true })
    const opened = await screen.screenWhere((s) => (s.marks ?? []).some((m) => m.id === inB.id))
    expect((opened.marks ?? []).map((m) => m.id)).toContain(templateB.id)
    expect((opened.marks ?? []).map((m) => m.id)).not.toContain(secret.id)
  })

  it('widgets: contador con límites, reloj de progreso y temporizador; el ojo cerrado no llega a la pantalla', async () => {
    const screen = await join('screen')
    await screen.next('screen')
    const counter = await ok200('createWidget', { campaignId, kind: 'counter', label: 'Suerte', min: 0, max: 3 })
    expect(counter).toMatchObject({ kind: 'counter', value: 0, min: 0, max: 3, shown: true, sort: 0 })
    expect((await ok200('updateWidget', { widgetId: counter.id, step: 5 })).value).toBe(3)
    expect((await ok200('updateWidget', { widgetId: counter.id, step: -10 })).value).toBe(0)
    const bad = await call('updateWidget', { widgetId: counter.id, min: 5 })
    expect(bad.json().code).toBe('BAD_LIMITS')
    const clock = await ok200('createWidget', {
      campaignId,
      kind: 'clock',
      label: 'Alarma',
      segments: 6,
      showCount: true
    })
    expect(clock).toMatchObject({ segments: 6, value: 0, sort: 1, showCount: true })
    expect((await ok200('updateWidget', { widgetId: clock.id, step: 2 })).value).toBe(2)
    expect((await ok200('updateWidget', { widgetId: clock.id, value: 9 })).value).toBe(6)
    // Menos segmentos: el valor no se pasa
    expect((await ok200('updateWidget', { widgetId: clock.id, segments: 4 })).value).toBe(4)
    const timer = await ok200('createWidget', {
      campaignId,
      kind: 'timer',
      label: 'Ritual',
      duration: 60,
      shown: false
    })
    expect(timer).toMatchObject({ value: 60, duration: 60, running: null })
    const started = await ok200('updateWidget', { widgetId: timer.id, timer: 'start' })
    expect(started.running).toMatchObject({ remaining: 60 })
    expect(Math.abs(started.running.since - Date.now())).toBeLessThan(5000)
    const paused = await ok200('updateWidget', { widgetId: timer.id, timer: 'pause' })
    expect(paused.running).toBeNull()
    expect(paused.value).toBeLessThanOrEqual(60)
    expect((await ok200('updateWidget', { widgetId: timer.id, duration: 120 })).value).toBe(120)
    expect((await ok200('listWidgets', { campaignId })).widgets.map((w: { label: string }) => w.label)).toEqual([
      'Suerte',
      'Alarma',
      'Ritual'
    ])
    // La pantalla ve los de ojo abierto, sin su versión ni su orden
    const seen = await screen.screenWhere((s) => (s.widgets ?? []).length === 2)
    expect((seen.widgets ?? []).map((w) => w.label)).toEqual(['Suerte', 'Alarma'])
    expect(JSON.stringify(seen)).not.toContain('Ritual')
    expect(seen.widgets?.[0]).not.toHaveProperty('version')
    // Siguen ahí al cambiar de escena; a oscuras, no llegan
    const tab = await ok200('createPageTab', { pageId, kind: 'scene' })
    await ok200('presentScene', { campaignId, sceneId: (await ok200('getScene', { tabId: tab.id })).id })
    expect((await screen.screenWhere((s) => s.scene?.id !== sceneId)).widgets).toHaveLength(2)
    await ok200('hideScreen', { campaignId, hidden: true })
    expect((await screen.screenWhere((s) => s.hidden)).widgets).toEqual([])
    // Borrar se deshace
    await ok200('deleteWidget', { widgetId: counter.id })
    expect((await table()).widgets).toHaveLength(2)
    await undoLast('deleteWidget')
    expect((await table()).widgets.map((w: { id: string }) => w.id)).toContain(counter.id)
  })

  it('instantáneas: guardar, cambiar y volver (con deshacer); las fichas de quien ya no está se saltan', async () => {
    const [own, goblin] = await place([
      { characterId: lia.id, column: 1, row: 1 },
      { content: { key: GOBLIN, count: 1 }, column: 2, row: 1 }
    ])
    await ok200('changeMarks', {
      campaignId,
      add: [{ kind: 'text', x: 150, y: 250, text: 'Aquí', color: '#ffffff', size: 24 }]
    })
    await ok200('changeFog', { campaignId, mode: 'reveal', shape: 'area', column: 4, row: 0, columns: 4, rows: 3 })
    const doorId = (await ok200('getSceneVision', { sceneId })).walls.find((w: { door: string | null }) => w.door).id
    const thumbnail = 'data:image/webp;base64,UklGRg=='
    const saved = await ok200('saveSnapshot', { campaignId, name: 'Antes del combate', thumbnail })
    expect(saved).toMatchObject({ sceneId, name: 'Antes del combate', thumbnail, tokens: 2, marks: 1 })
    // Todo cambia: la ficha se mueve, el texto se va, la puerta se abre, la niebla se reinicia, otra criatura entra
    await ok200('moveTokens', { campaignId, moves: [{ tokenId: own.id, column: 3, row: 2 }] })
    await ok200('changeMarks', { campaignId, remove: [(await table()).marks[0].id] })
    await ok200('setDoor', { campaignId, wallId: doorId, open: true })
    await ok200('resetFog', { campaignId })
    await place([{ content: { key: GOBLIN, count: 1 }, column: 5, row: 1 }])
    // El goblin de la instantánea sale de juego: su ficha no puede volver
    await ok200('removeFromPlay', { campaignId, creatureIds: [goblin.actor.id] })
    const back = await ok200('restoreSnapshot', { campaignId, snapshotId: saved.id })
    expect(back).toMatchObject({ sceneId, tokens: 1, marks: 1, fog: 1, skipped: [goblin.label] })
    const after = await table()
    expect(after.tokens.map((t: { actor: { id: string }; x: number; y: number }) => [t.actor.id, t.x, t.y])).toEqual([
      [lia.id, 150, 150]
    ])
    expect(after.marks.map((m: { text: string }) => m.text)).toEqual(['Aquí'])
    expect(after.vision.doors[doorId]).toBe(false)
    // Deshacer la vuelta lo devuelve todo como estaba
    await undoLast('restoreSnapshot')
    const undone = await table()
    expect(undone.tokens).toHaveLength(2)
    expect(undone.tokens.find((t: { actor: { id: string } }) => t.actor.id === lia.id)).toMatchObject({
      x: 350,
      y: 250
    })
    expect(undone.marks).toEqual([])
    expect(undone.vision.doors[doorId]).toBe(true)
    expect((await ok200('listSnapshots', { campaignId })).snapshots.map((s: { id: string }) => s.id)).toEqual([
      saved.id
    ])
    await ok200('deleteSnapshot', { snapshotId: saved.id })
    expect((await ok200('listSnapshots', { campaignId })).snapshots).toEqual([])
    // Una miniatura que no es una imagen no vale
    const bad = await call('saveSnapshot', { campaignId, name: 'x', thumbnail: 'javascript:alert(1)' })
    expect(bad.statusCode).toBe(400)
  })

  it('deshacer avisa a la mesa: la pantalla se pone al día (niebla, puerta, marcas, widgets, muros, luces y escena)', async () => {
    await place([{ characterId: lia.id, x: 200, y: 150 }])
    const screen = await join('screen')
    await screen.next('screen')
    const mesa = await join('master')
    await mesa.next('master')
    const sees = (s: ScreenView, x: number, y: number) =>
      FogGrid.decode(new Uint8Array(Buffer.from(s.fog?.visible ?? '', 'base64'))).hasPoint({ x, y })
    // La niebla a mano
    await ok200('changeFog', { campaignId, mode: 'reveal', shape: 'area', column: 4, row: 0, columns: 4, rows: 3 })
    await screen.screenWhere((s) => sees(s, 600, 150))
    await undoLast('revealFog')
    await screen.screenWhere((s) => !sees(s, 600, 150))
    // Una puerta
    const doorId = (await ok200('getSceneVision', { sceneId })).walls.find((w: { door: string | null }) => w.door).id
    await ok200('setDoor', { campaignId, wallId: doorId, open: true })
    await screen.screenWhere((s) => sees(s, 600, 150))
    await undoLast('openDoor')
    await screen.screenWhere((s) => !sees(s, 600, 150))
    // Lo dejado en el mapa
    await ok200('changeMarks', {
      campaignId,
      add: [{ kind: 'text', x: 150, y: 250, text: 'Aquí', color: '#ffffff', size: 24 }]
    })
    await screen.screenWhere((s) => (s.marks ?? []).length === 1)
    await undoLast('changeMarks')
    await screen.screenWhere((s) => (s.marks ?? []).length === 0)
    // Un widget
    await ok200('createWidget', { campaignId, kind: 'counter', label: 'Suerte' })
    await screen.screenWhere((s) => (s.widgets ?? []).length === 1)
    await undoLast('createWidget')
    await screen.screenWhere((s) => (s.widgets ?? []).length === 0)
    // Un muro (de la escena: a todas las campañas que la tienen)
    await ok200('changeWalls', { sceneId, walls: { add: [{ a: { x: 300, y: 0 }, b: { x: 300, y: 300 } }] } })
    await screen.screenWhere((s) => !sees(s, 350, 150))
    await undoLast('changeWalls')
    await screen.screenWhere((s) => sees(s, 350, 150))
    // La escena a oscuras, y una luz
    await ok200('updateSceneVision', { sceneId, darkness: 1 })
    await screen.screenWhere((s) => s.fog?.darkness === 1)
    await ok200('changeWalls', { sceneId, lights: { add: [{ x: 100, y: 100, bright: 10, dim: 20 }] } })
    await screen.screenWhere((s) => (s.lights ?? []).length === 1)
    await undoLast('changeWalls')
    await screen.screenWhere((s) => (s.lights ?? []).length === 0)
    await undoLast('updateSceneVision')
    await screen.screenWhere((s) => s.fog?.darkness === 0)
    // Una instantánea: la mesa del máster se refresca
    await ok200('saveSnapshot', { campaignId, name: 'Antes' })
    mesa.drain()
    await undoLast('saveSnapshot')
    await mesa.next('master')
  })

  it('la medida en curso y el láser van en vivo: a la pantalla, solo con el interruptor y en lo que ve el grupo', async () => {
    await place([{ characterId: lia.id, x: 200, y: 150 }])
    const mesa = await join('master')
    await mesa.next('master')
    const other = await join('master')
    await other.next('master')
    const screen = await join('screen')
    await screen.next('screen')
    const inA = {
      shape: 'line',
      points: [
        { x: 100, y: 100 },
        { x: 300, y: 100 }
      ]
    }
    // Sin «la tele ve lo que mides»: la otra pestaña del máster la ve; la pantalla, no
    mesa.ws.send(JSON.stringify({ type: 'measure', measure: inA }))
    expect(await other.next('measure')).toEqual({ type: 'measure', measure: inA })
    expect(await screen.quiet()).toBe(true)
    expect((await ok200('setMeasureOnScreen', { campaignId, on: true })).measureOnScreen).toBe(true)
    expect((await mesa.next('master')).table.measureOnScreen).toBe(true)
    await screen.next('screen')
    mesa.ws.send(JSON.stringify({ type: 'measure', measure: inA }))
    expect(await screen.next('measure')).toEqual({ type: 'measure', measure: inA })
    // Si se mete en lo que el grupo no ve, la pantalla deja de verla
    const intoB = { shape: 'line', points: [inA.points[0], { x: 600, y: 150 }] }
    mesa.ws.send(JSON.stringify({ type: 'measure', measure: intoB }))
    expect(await screen.next('measure')).toEqual({ type: 'measure', measure: null })
    mesa.ws.send(JSON.stringify({ type: 'measure', measure: inA }))
    await screen.next('measure')
    // Apagar el interruptor se la quita
    await ok200('setMeasureOnScreen', { campaignId, on: false })
    expect(await screen.next('measure')).toEqual({ type: 'measure', measure: null })
    // El láser: a la pantalla, solo sus puntos en lo que ve el grupo
    screen.drain()
    mesa.ws.send(
      JSON.stringify({
        type: 'laser',
        points: [
          { x: 200, y: 150 },
          { x: 600, y: 150 }
        ]
      })
    )
    expect((await other.next('laser')).points).toHaveLength(2)
    expect(await screen.next('laser')).toEqual({ type: 'laser', points: [{ x: 200, y: 150 }] })
    mesa.ws.send(JSON.stringify({ type: 'laser', points: [{ x: 600, y: 150 }] }))
    expect(await screen.quiet()).toBe(true)
    // La pantalla no manda nada en vivo
    screen.ws.send(JSON.stringify({ type: 'laser', points: [{ x: 1, y: 1 }] }))
    expect(await screen.next('error')).toEqual({ type: 'error', code: 'BAD_MESSAGE' })
  })

  it('un jugador no puede nada de esto', async () => {
    const counter = await ok200('createWidget', { campaignId, kind: 'counter', label: 'Suerte' })
    const snapshot = await ok200('saveSnapshot', { campaignId, name: 'Antes' })
    const template = (
      await ok200('placeTemplate', { campaignId, shape: 'circle', from: { column: 1, row: 1 }, size: 5 })
    ).template
    const tries: Array<[string, object]> = [
      ['listMarks', { campaignId }],
      ['changeMarks', { campaignId, remove: [template.id] }],
      ['placeTemplate', { campaignId, shape: 'circle', from: { column: 1, row: 1 }, size: 5 }],
      ['getTemplateTokens', { campaignId, templateId: template.id }],
      [
        'measureDistance',
        {
          campaignId,
          points: [
            { column: 0, row: 0 },
            { column: 1, row: 1 }
          ]
        }
      ],
      ['setMeasureOnScreen', { campaignId, on: true }],
      ['listWidgets', { campaignId }],
      ['createWidget', { campaignId, kind: 'clock', label: 'x' }],
      ['updateWidget', { widgetId: counter.id, step: 1 }],
      ['deleteWidget', { widgetId: counter.id }],
      ['listSnapshots', { campaignId }],
      ['saveSnapshot', { campaignId, name: 'x' }],
      ['restoreSnapshot', { campaignId, snapshotId: snapshot.id }],
      ['deleteSnapshot', { snapshotId: snapshot.id }]
    ]
    for (const [name, payload] of tries) {
      const response = await call(name, payload, player.cookie)
      expect([403, 404], `${name}: ${response.body}`).toContain(response.statusCode)
    }
    // Nada cambió
    expect((await ok200('listWidgets', { campaignId })).widgets[0].value).toBe(0)
    expect((await table()).marks).toHaveLength(1)
  })

  it('las herramientas de la IA: medir, plantillas y sus fichas, widgets e instantáneas (volver espera la aprobación)', async () => {
    const env: ActionEnv = {
      db: conn.db,
      publicUrl: BASE_URL,
      sealKey: TEST_SEAL_KEY,
      realtime: createRealtime(async (userId) => actorFrom(userId, await loadMemberships(conn.db, userId))),
      actions: implementationsByName
    }
    const ai = async (tool: string, args: Record<string, unknown>) => {
      const found = MCP_TOOLS[tool]
      if (!found) throw new Error(`falta ${tool}`)
      const result = await callAsAi(env, { userId: master.userId, tool, ...routeCall(found, args), waitMs: 50 })
      return { ...result, text: result.content.map((c) => c.text).join('\n') }
    }
    // Lía, detrás de donde sale el cono
    const [, goblin] = await place([
      { characterId: lia.id, column: 0, row: 2 },
      { content: { key: GOBLIN, count: 1 }, column: 2, row: 1 }
    ])
    const measured = await ai('medir', {
      campaignId,
      points: [
        { column: 1, row: 1 },
        { column: 4, row: 1 }
      ]
    })
    expect(measured.structuredContent).toMatchObject({ cells: 3, text: '15 pies' })
    const cone = await ai('poner_plantilla', {
      campaignId,
      shape: 'cone',
      from: { column: 1, row: 1 },
      size: 15,
      direction: 0
    })
    expect(cone.isError).toBeUndefined()
    const placed = cone.structuredContent as { template: { id: string }; tokens: Array<{ actorId: string }> }
    expect(placed.tokens.map((t) => t.actorId)).toEqual([goblin.actor.id])
    const inside = await ai('fichas_en_plantilla', { campaignId, templateId: placed.template.id })
    expect((inside.structuredContent as { tokens: unknown[] }).tokens).toHaveLength(1)
    expect((await ai('ver_marcas', { campaignId })).structuredContent).toMatchObject({ sceneId })
    expect((await ai('cambiar_marcas', { campaignId, remove: [placed.template.id] })).isError).toBeUndefined()
    const widget = await ai('crear_widget', { campaignId, kind: 'clock', label: 'La ira del dragón', segments: 8 })
    const widgetId = (widget.structuredContent as { id: string }).id
    expect((await ai('cambiar_widget', { widgetId, step: 3 })).structuredContent).toMatchObject({ value: 3 })
    expect((await ai('ver_widgets', { campaignId })).structuredContent).toMatchObject({
      widgets: [{ label: 'La ira del dragón', value: 3 }]
    })
    const snapshot = await ai('guardar_instantanea', { campaignId, name: 'Antes' })
    const snapshotId = (snapshot.structuredContent as { id: string }).id
    expect((await ai('ver_instantaneas', { campaignId })).structuredContent).toMatchObject({
      snapshots: [{ id: snapshotId, tokens: 2 }]
    })
    // Volver cambia lo que ven los jugadores: espera la aprobación del máster (en el modo por defecto)
    expect((await ai('volver_a_instantanea', { campaignId, snapshotId })).text).toMatch(/^PENDING_APPROVAL/)
    // Lo hecho por la IA queda en el historial con su herramienta
    const { entries } = await ok200('listHistory', { worldId })
    expect(entries.find((e: { action: string }) => e.action === 'placeTemplate')).toMatchObject({
      via: 'ai',
      tool: 'poner_plantilla'
    })
    expect((await ai('borrar_widget', { widgetId })).text).toMatch(/^PENDING_APPROVAL/)
  })
})
