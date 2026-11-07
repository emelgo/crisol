import type { TableServerMessage } from '@crisol/contracts'
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

/** Una tesela de mentira: al servidor le basta su cabecera de WebP */
const TILE = Buffer.concat([Buffer.from('RIFF'), Buffer.from([20, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(16)])
/** Un PNG de 3000×2000: su cabecera, que es lo que se lee */
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]),
  Buffer.from('IHDR'),
  Buffer.from([0, 0, 0x0b, 0xb8, 0, 0, 0x07, 0xd0, 8, 6, 0, 0, 0])
])

/** Los mensajes de una conexión, en orden; next() espera al siguiente */
function inbox(ws: WebSocket) {
  const queued: TableServerMessage[] = []
  let waiting: ((message: TableServerMessage) => void) | null = null
  ws.on('message', (data: Buffer) => {
    const message = JSON.parse(String(data)) as TableServerMessage
    if (waiting) waiting(message)
    else queued.push(message)
  })
  return {
    next: () =>
      new Promise<TableServerMessage>((resolve, reject) => {
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
      }),
    /** Que no llegue nada en un rato */
    quiet: async () => {
      await new Promise((resolve) => setTimeout(resolve, 150))
      return queued.length === 0
    }
  }
}

describe('la mesa: escenas, teselas y la sala', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }
  let player: { userId: string; cookie: string }
  let worldId: string
  let campaignId: string
  let pageId: string
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
  const putTile = (sceneId: string, version: string, at: string, body = TILE, cookie = owner.cookie) =>
    app.inject({
      method: 'PUT',
      url: `/api/scenes/${sceneId}/tiles/${version}/${at}`,
      payload: body,
      headers: { origin: BASE_URL, cookie, 'content-type': 'image/webp' }
    })
  const getTile = (url: string, cookie = owner.cookie) => app.inject({ method: 'GET', url, headers: { cookie } })
  const join = async (view: 'master' | 'screen', cookie = owner.cookie, campaign = campaignId) => {
    const ws = await app.injectWS('/api/table', { headers: { origin: BASE_URL, cookie } })
    sockets.push(ws)
    const box = inbox(ws)
    ws.send(JSON.stringify({ type: 'join', campaignId: campaign, view }))
    return { ws, ...box }
  }
  /** Una escena en la página, con sus teselas subidas y puestas */
  const sceneWithImage = async () => {
    const tab = (await call('createPageTab', { pageId, kind: 'scene' })).body
    const scene = (await call('getScene', { tabId: tab.id })).body
    const version = crypto.randomUUID()
    expect((await putTile(scene.id, version, '0/0/0')).statusCode).toBe(204)
    const placed = await call('setSceneImage', {
      sceneId: scene.id,
      width: 900,
      height: 600,
      tiles: { version, size: 512, levels: 1 }
    })
    expect(placed.status).toBe(200)
    return { tab, scene: placed.body, version }
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_table'), { max: 4 })
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
    worldId = (await call('createWorld', { name: 'Valdren' })).body.id
    campaignId = (await call('createCampaign', { worldId, name: 'La Marca' })).body.id
    pageId = (await call('createPage', { worldId, title: 'Cripta de Varn' })).body.id
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

  it('una pestaña «Escena» nace con su escena: sin imagen, con la rejilla de 5 pies', async () => {
    const tab = (await call('createPageTab', { pageId, kind: 'scene' })).body
    expect(tab).toMatchObject({ kind: 'scene', name: 'Escena' })
    const scene = (await call('getScene', { tabId: tab.id })).body
    expect(scene).toMatchObject({ tabId: tab.id, pageTitle: 'Cripta de Varn', name: 'Escena', image: null })
    expect(scene.grid).toMatchObject({ type: 'square', distance: 5, units: 'pies', diagonals: 'equal' })
    expect((await call('listScenes', { worldId })).body.scenes.map((s: { id: string }) => s.id)).toEqual([scene.id])
    // La rejilla se cambia por partes, y va al historial
    const changed = await call('updateScene', { sceneId: scene.id, grid: { size: 140, offsetX: 12 } })
    expect(changed.body.grid).toMatchObject({ size: 140, offsetX: 12, distance: 5 })
  })

  it('las teselas: solo WebP, solo quien lleva la wiki; la imagen no se pone sin ellas', async () => {
    const tab = (await call('createPageTab', { pageId, kind: 'scene' })).body
    const scene = (await call('getScene', { tabId: tab.id })).body
    const version = crypto.randomUUID()
    const missing = await call('setSceneImage', {
      sceneId: scene.id,
      width: 900,
      height: 600,
      tiles: { version, size: 512, levels: 1 }
    })
    expect(missing.body.code).toBe('TILES_MISSING')
    expect((await putTile(scene.id, version, '0/0/0', Buffer.from('no es una imagen'))).statusCode).toBe(415)
    expect((await putTile(scene.id, version, '0/0/0', TILE, player.cookie)).statusCode).toBe(404)
    expect((await putTile(scene.id, version, '0/0/0')).statusCode).toBe(204)
    const placed = await call('setSceneImage', {
      sceneId: scene.id,
      width: 900,
      height: 600,
      tiles: { version, size: 512, levels: 1 }
    })
    expect(placed.body.image).toMatchObject({ width: 900, height: 600, tiles: { version, levels: 1 } })
    const tile = await getTile(`/api/scenes/${scene.id}/tiles/${version}/0/0/0`)
    expect(tile.statusCode).toBe(200)
    expect(tile.headers['content-type']).toBe('image/webp')
    expect(tile.rawPayload.equals(TILE)).toBe(true)
    // Un jugador no la recibe, ni la escena
    expect((await getTile(`/api/scenes/${scene.id}/tiles/${version}/0/0/0`, player.cookie)).statusCode).toBe(404)
    expect((await call('getScene', { sceneId: scene.id }, player.cookie)).status).toBe(404)
  })

  it('con un archivo del mundo, sus medidas salen de la cabecera y queda sin trocear', async () => {
    const tab = (await call('createPageTab', { pageId, kind: 'scene' })).body
    const scene = (await call('getScene', { tabId: tab.id })).body
    const file = await app.inject({
      method: 'POST',
      url: `/api/files?worldId=${worldId}&name=cripta.png`,
      payload: PNG,
      headers: { origin: BASE_URL, cookie: owner.cookie, 'content-type': 'application/octet-stream' }
    })
    const placed = await call('setSceneImage', { sceneId: scene.id, fileId: file.json().id })
    expect(placed.body.image).toEqual({ width: 3000, height: 2000, tiles: null, fileId: file.json().id })
  })

  it('la IA dibuja una escena en SVG: archivo del mundo, sus medidas y sus muros; nada que ejecute código', async () => {
    const tab = (await call('createPageTab', { pageId, kind: 'scene' })).body
    const scene = (await call('getScene', { tabId: tab.id })).body
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="2000"><defs><filter id="roca">' +
      '<feTurbulence baseFrequency="0.02"/></filter></defs><rect width="3000" height="2000" filter="url(#roca)"/></svg>'
    const drawn = await call('drawScene', {
      sceneId: scene.id,
      svg,
      walls: [
        [
          { x: 100, y: 100 },
          { x: 900, y: 100 }
        ]
      ],
      portals: [{ a: { x: 400, y: 100 }, b: { x: 500, y: 100 }, closed: true, window: false }]
    })
    expect(drawn.status).toBe(200)
    expect(drawn.body.image).toMatchObject({ width: 3000, height: 2000, tiles: null })
    expect(drawn.body.hasImported).toBe(true)
    const files = (await call('listFiles', { worldId })).body
    const file = (files.files ?? files).find((f: { id: string }) => f.id === drawn.body.image.fileId)
    expect(file).toMatchObject({ name: 'Cripta de Varn · Escena.svg' })
    const bad = await call('drawScene', { sceneId: scene.id, svg: svg.replace('<defs>', '<script>x()</script><defs>') })
    expect(bad.body.code).toBe('BAD_SVG')
    expect((await call('drawScene', { sceneId: scene.id, svg }, player.cookie)).status).toBe(404)
  })

  it('el máster abre y presenta; la pantalla lo recibe sin la página y sigue su encuadre', async () => {
    const { scene, version } = await sceneWithImage()
    const master = await join('master')
    expect(await master.next()).toMatchObject({ type: 'master', table: { open: null, presented: null } })
    const screen = await join('screen')
    expect(await screen.next()).toMatchObject({ type: 'screen', screen: { scene: null, campaignName: 'La Marca' } })

    // Abrir no la presenta
    await call('openScene', { campaignId, sceneId: scene.id })
    expect(await master.next()).toMatchObject({ type: 'master', table: { open: { id: scene.id } } })
    expect(await screen.next()).toMatchObject({ type: 'screen', screen: { scene: null } })

    await call('presentScene', { campaignId })
    expect(await master.next()).toMatchObject({ type: 'master', table: { presented: { id: scene.id } } })
    const shown = await screen.next()
    expect(shown).toMatchObject({ type: 'screen', screen: { scene: { id: scene.id, image: { tiles: { version } } } } })
    // Ni su página, ni su nombre, ni lo de la wiki
    const text = JSON.stringify(shown)
    expect(text).not.toContain('Cripta de Varn')
    expect(text).not.toContain(pageId)

    // Siguiendo al máster: su encuadre llega a la pantalla, no al revés
    master.ws.send(JSON.stringify({ type: 'viewport', view: { x: 450, y: 300, scale: 1.5 } }))
    expect(await screen.next()).toEqual({ type: 'viewport', view: { x: 450, y: 300, scale: 1.5 } })
    screen.ws.send(JSON.stringify({ type: 'viewport', view: { x: 0, y: 0, scale: 1 } }))
    expect(await screen.next()).toEqual({ type: 'error', code: 'BAD_MESSAGE' })

    // Fija: el encuadre del máster ya no se reenvía
    await call('setScreenCamera', { campaignId, camera: { mode: 'fixed', view: { x: 100, y: 100, scale: 1 } } })
    await master.next()
    expect(await screen.next()).toMatchObject({ screen: { camera: { mode: 'fixed' } } })
    master.ws.send(JSON.stringify({ type: 'viewport', view: { x: 1, y: 1, scale: 1 } }))
    expect(await screen.quiet()).toBe(true)

    // Oculta: a oscuras, sin escena
    await call('hideScreen', { campaignId, hidden: true })
    await master.next()
    expect(await screen.next()).toMatchObject({ screen: { hidden: true, scene: null } })
  })

  it('una pantalla que entra (o se recarga) empieza en el último encuadre del máster', async () => {
    const { scene } = await sceneWithImage()
    await call('presentScene', { campaignId, sceneId: scene.id })
    const master = await join('master')
    await master.next()
    master.ws.send(JSON.stringify({ type: 'viewport', view: { x: 10, y: 20, scale: 2 } }))
    await new Promise((resolve) => setTimeout(resolve, 50))
    const screen = await join('screen')
    expect(await screen.next()).toMatchObject({ type: 'screen', screen: { scene: { id: scene.id } } })
    expect(await screen.next()).toEqual({ type: 'viewport', view: { x: 10, y: 20, scale: 2 } })
  })

  it('cambiar la rejilla de una escena presentada refresca las salas', async () => {
    const { scene } = await sceneWithImage()
    await call('presentScene', { campaignId, sceneId: scene.id })
    const screen = await join('screen')
    await screen.next()
    await call('updateScene', { sceneId: scene.id, grid: { type: 'hex-rows' } })
    expect(await screen.next()).toMatchObject({ screen: { scene: { grid: { type: 'hex-rows' } } } })
  })

  it('la pantalla solo carga las teselas de la escena presentada, sin ocultar y en su versión', async () => {
    const { scene, version } = await sceneWithImage()
    const url = (v = version) => `/api/campaigns/${campaignId}/screen/tiles/${v}/0/0/0`
    expect((await getTile(url())).statusCode).toBe(404)
    await call('presentScene', { campaignId, sceneId: scene.id })
    // Sin muros, «sin visión automática»: nada hasta que se destapa a mano (docs/specs/vision.md)
    expect((await getTile(url())).statusCode).toBe(404)
    await call('changeFog', { campaignId, mode: 'reveal', shape: 'rectangle', x: 0, y: 0, width: 100, height: 100 })
    expect((await getTile(url())).statusCode).toBe(200)
    expect((await getTile(url(crypto.randomUUID()))).statusCode).toBe(404)
    expect((await getTile(url(), player.cookie)).statusCode).toBe(404)
    await call('hideScreen', { campaignId, hidden: true })
    expect((await getTile(url())).statusCode).toBe(404)
  })

  it('un jugador no entra en la mesa ni la mueve, ni alguien de otra campaña', async () => {
    const { scene } = await sceneWithImage()
    const intruder = await join('screen', player.cookie)
    expect(await intruder.next()).toEqual({ type: 'error', code: 'FORBIDDEN' })
    expect((await call('getCampaignTable', { campaignId }, player.cookie)).status).toBe(403)
    expect((await call('presentScene', { campaignId, sceneId: scene.id }, player.cookie)).status).toBe(403)
    // Una escena de otro mundo no se abre en esta campaña
    const other = (await call('createWorld', { name: 'Otro' })).body.id
    const otherPage = (await call('createPage', { worldId: other, title: 'Lejos' })).body.id
    const otherTab = (await call('createPageTab', { pageId: otherPage, kind: 'scene' })).body
    const otherScene = (await call('getScene', { tabId: otherTab.id })).body
    expect((await call('openScene', { campaignId, sceneId: otherScene.id })).status).toBe(404)
  })

  it('las pestañas «Escena» no le llegan a un jugador aunque conozca la página', async () => {
    await call('createPageTab', { pageId, kind: 'scene' })
    await call('createPageTab', { pageId, kind: 'text' })
    await call('setKnowledge', { worldId, campaignId, kind: 'page', targetId: pageId, known: true })
    const tabs = (await call('listPageTabs', { pageId, campaignId }, player.cookie)).body
    expect(tabs.tabs?.map((t: { kind: string }) => t.kind)).toEqual(['text'])
  })

  it('quitar la pestaña quita su escena y el estado de cada campaña; deshacer lo devuelve', async () => {
    const { tab, scene } = await sceneWithImage()
    await call('openScene', { campaignId, sceneId: scene.id })
    const removed = await call('deletePageTab', { tabId: tab.id })
    expect(removed.status).toBe(200)
    expect((await call('getScene', { sceneId: scene.id })).status).toBe(404)
    const history = (await call('listHistory', { worldId })).body
    const last = history.operations?.[0] ?? history.entries?.[0]
    expect((await call('undoOperation', { operationId: last.id })).status).toBe(200)
    expect((await call('getScene', { sceneId: scene.id })).body.image).toMatchObject({ width: 900 })
  })
})
