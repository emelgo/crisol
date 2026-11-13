/**
 * Las capas de los mapas y lo dibujado en ellos (módulo 9, docs/specs/mapas-capas.md): capas en su orden, regiones,
 * rutas y textos que se deshacen, y lo que ve una jugadora (ni las capas del máster, ni lo oculto sin revelar, ni el
 * nombre de lo que lleva a una página que no conoce)
 */
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { desc, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined
const SQUARE = [
  [0.1, 0.1],
  [0.4, 0.1],
  [0.4, 0.4],
  [0.1, 0.4]
]

describe('las capas de los mapas y lo dibujado (módulo 9)', () => {
  let conn: ReturnType<typeof connect>
  let auth: ReturnType<typeof createTestAuth>
  let app: ReturnType<typeof buildApp>
  let master: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let worldId: string
  let marca: string
  let aldoria: string
  let varn: string
  let tabId: string
  let mapId: string

  const call = (name: string, payload: object, cookie = master.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const undo = async (action: string) => {
    const [op] = await conn.db
      .select()
      .from(schema.operations)
      .where(eq(schema.operations.action, action))
      .orderBy(desc(schema.operations.createdAt))
    expect((await ok200('undoOperation', { operationId: op?.id })).status).toBe('undone')
  }
  const map = (cookie = master.cookie) => ok200('getMap', { tabId }, cookie)
  const names = (items: { name?: string; label?: string | null }[]) => items.map((i) => i.name ?? i.label)

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_map_layers'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY }
    })
    master = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Mesa' }).returning()
    if (!org) throw new Error('sin organización')
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org.id, userId: master.userId, role: 'owner' })
    worldId = (await ok200('createWorld', { name: 'Valdren' })).id
    marca = (await ok200('createCampaign', { worldId, name: 'La Marca' })).id
    ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    const url = (await ok200('getInvitation', { campaignId: marca })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: ana.cookie }
    })
    aldoria = (await ok200('createPage', { worldId, title: 'Aldoria' })).id
    varn = (await ok200('createPage', { worldId, title: 'Varn' })).id
    // La Marca conoce Aldoria (y su mapa); Varn, no
    await ok200('setKnowledge', { worldId, campaignId: marca, kind: 'page', targetId: aldoria, known: true })
    tabId = (await ok200('createPageTab', { pageId: aldoria, kind: 'map' })).id
    mapId = (await map()).id
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('un mapa nuevo: sin capas ni nada dibujado, y lo que se anda en un día, lo de serie; se cambia y se deshace', async () => {
    expect(await map()).toMatchObject({ layers: [], elements: [], speeds: { foot: 30, horse: 60, ship: 120 } })
    await ok200('updateMap', { mapId, speeds: { foot: 25, horse: 50, ship: 100 } })
    expect((await map()).speeds).toEqual({ foot: 25, horse: 50, ship: 100 })
    await undo('updateMap')
    expect((await map()).speeds).toEqual({ foot: 30, horse: 60, ship: 120 })
  })

  it('capas: se añaden encima, se renombran, se recolocan y se quitan con lo suyo (deshacer lo devuelve)', async () => {
    const politica = await ok200('createMapLayer', { mapId, name: 'Política' })
    const rutas = await ok200('createMapLayer', { mapId, name: 'Rutas' })
    const fondo = await ok200('createMapLayer', { mapId, name: 'Fondo', after: null })
    expect(names((await map()).layers)).toEqual(['Fondo', 'Política', 'Rutas'])
    await ok200('updateMapLayer', { layerId: fondo.id, after: rutas.id })
    await ok200('updateMapLayer', { layerId: politica.id, name: 'Reinos', hidden: true })
    expect((await map()).layers).toMatchObject([{ name: 'Reinos', hidden: true }, { name: 'Rutas' }, { name: 'Fondo' }])
    // Tras una capa de otro mapa, no
    const other = (await ok200('createPageTab', { pageId: varn, kind: 'map' })).id
    const otherMap = (await ok200('getMap', { tabId: other })).id
    const ajena = await ok200('createMapLayer', { mapId: otherMap, name: 'Ajena' })
    expect((await call('updateMapLayer', { layerId: rutas.id, after: ajena.id })).json()).toMatchObject({
      code: 'BAD_MAP_LAYER'
    })
    // Quitarla se lleva lo suyo; deshacer lo devuelve todo
    await ok200('createMapElement', {
      mapId,
      layerId: rutas.id,
      kind: 'path',
      geometry: { points: SQUARE.slice(0, 2) }
    })
    await ok200('deleteMapLayer', { layerId: rutas.id })
    expect(names((await map()).layers)).toEqual(['Reinos', 'Fondo'])
    expect((await map()).elements).toEqual([])
    await undo('deleteMapLayer')
    expect(names((await map()).layers)).toEqual(['Reinos', 'Rutas', 'Fondo'])
    expect((await map()).elements).toMatchObject([{ kind: 'path', layerId: rutas.id }])
  })

  it('dibujar: sin capas nace «General»; la forma ha de ser la de su clase y sus pines, de este mapa', async () => {
    const region = await ok200('createMapElement', {
      mapId,
      kind: 'region',
      geometry: { pieces: [SQUARE] },
      label: 'Reino de Varn',
      style: { color: 'wine', fill: 'hatch', stroke: 'dashed' }
    })
    const { layers } = await map()
    expect(names(layers)).toEqual(['General'])
    expect(region).toMatchObject({ layerId: layers[0].id, label: 'Reino de Varn', style: { fill: 'hatch' } })
    // Lo siguiente, en la de más arriba
    const top = await ok200('createMapLayer', { mapId, name: 'Rutas' })
    const text = await ok200('createMapElement', { mapId, kind: 'label', geometry: { at: [0.5, 0.9], rotate: 12 } })
    expect(text.layerId).toBe(top.id)
    // Una región con la forma de una ruta, no
    expect(
      (await call('createMapElement', { mapId, kind: 'region', geometry: { points: SQUARE } })).json()
    ).toMatchObject({ code: 'BAD_MAP_GEOMETRY' })
    // Una ruta de un pin de este mapa a otro de otro mapa, tampoco
    const varnPin = await ok200('createMapPin', { mapId, x: 0.1, y: 0.1, label: 'Varn' })
    const other = (await ok200('createPageTab', { pageId: varn, kind: 'map' })).id
    const otherMap = (await ok200('getMap', { tabId: other })).id
    const lejos = await ok200('createMapPin', { mapId: otherMap, x: 0.5, y: 0.5, label: 'Lejos' })
    const path = { points: SQUARE.slice(0, 2), from: varnPin.id, to: lejos.id }
    expect((await call('createMapElement', { mapId, kind: 'path', geometry: path })).json()).toMatchObject({
      code: 'BAD_MAP_GEOMETRY'
    })
    const camino = await ok200('createMapElement', {
      mapId,
      kind: 'path',
      geometry: { ...path, to: null },
      label: 'Camino real'
    })
    expect(camino.geometry).toMatchObject({ from: varnPin.id, to: null })
  })

  it('retocar y quitar lo dibujado: se deshace; su página, del mismo mundo', async () => {
    const region = await ok200('createMapElement', { mapId, kind: 'region', geometry: { pieces: [SQUARE] } })
    const moved = SQUARE.map(([x, y]) => [(x ?? 0) + 0.1, y])
    const changed = await ok200('updateMapElement', {
      elementId: region.id,
      geometry: { pieces: [moved, SQUARE] },
      pageId: varn
    })
    expect(changed).toMatchObject({
      label: null,
      pageId: varn,
      pageTitle: 'Varn',
      geometry: { pieces: [moved, SQUARE] }
    })
    await undo('updateMapElement')
    expect((await map()).elements[0]).toMatchObject({ pageId: null, geometry: { pieces: [SQUARE] } })
    const lejos = (await ok200('createWorld', { name: 'Lejos' })).id
    const ajena = (await ok200('createPage', { worldId: lejos, title: 'Ajena' })).id
    expect((await call('updateMapElement', { elementId: region.id, pageId: ajena })).json()).toMatchObject({
      code: 'BAD_PIN_PAGE'
    })
    await ok200('deleteMapElement', { elementId: region.id })
    expect((await map()).elements).toEqual([])
    await undo('deleteMapElement')
    expect((await map()).elements).toHaveLength(1)
  })

  it('la jugadora: ni las capas del máster, ni lo oculto hasta que se le revela, ni el nombre de lo que no conoce', async () => {
    const politica = await ok200('createMapLayer', { mapId, name: 'Política' })
    const secretos = await ok200('createMapLayer', { mapId, name: 'Secretos', hidden: true })
    const reino = await ok200('createMapElement', {
      mapId,
      layerId: politica.id,
      kind: 'region',
      geometry: { pieces: [SQUARE] },
      label: 'Aldoria'
    })
    const tierras = await ok200('createMapElement', {
      mapId,
      layerId: politica.id,
      kind: 'region',
      geometry: { pieces: [SQUARE] },
      label: 'Tierras sin señor',
      hidden: true
    })
    await ok200('createMapElement', {
      mapId,
      layerId: politica.id,
      kind: 'region',
      geometry: { pieces: [SQUARE] },
      label: 'Ducado',
      pageId: varn
    })
    const guarida = await ok200('createMapElement', {
      mapId,
      layerId: secretos.id,
      kind: 'region',
      geometry: { pieces: [SQUARE] },
      label: 'Guarida'
    })
    const seen = await map(ana.cookie)
    expect(names(seen.layers)).toEqual(['Política'])
    // El ducado lleva a Varn, que no conoce: sin nombre ni enlace
    expect(seen.elements).toEqual([
      expect.objectContaining({ id: reino.id, label: 'Aldoria' }),
      expect.objectContaining({ label: null, pageId: null, pageTitle: null })
    ])
    expect(JSON.stringify(seen)).not.toMatch(/Secretos|Guarida|Tierras|Ducado|Varn/)
    // Revelarle las tierras: ya las ve, y para ella no están ocultas
    await ok200('setKnowledge', { worldId, campaignId: marca, kind: 'element', targetId: tierras.id, known: true })
    expect((await map(ana.cookie)).elements).toContainEqual(
      expect.objectContaining({ id: tierras.id, label: 'Tierras sin señor', hidden: false })
    )
    // Lo revelado en una capa del máster sigue sin llegarle
    await ok200('setKnowledge', { worldId, campaignId: marca, kind: 'element', targetId: guarida.id, known: true })
    expect(JSON.stringify(await map(ana.cookie))).not.toMatch(/Guarida|Secretos/)
    // Ni lo cambia ni lo quita
    expect((await call('createMapLayer', { mapId, name: 'Mía' }, ana.cookie)).statusCode).toBe(404)
    expect((await call('deleteMapElement', { elementId: reino.id }, ana.cookie)).statusCode).toBe(404)
  })

  it('copiar la página copia sus capas y lo dibujado, con las rutas a los pines de la copia', async () => {
    const capa = await ok200('createMapLayer', { mapId, name: 'Rutas', hidden: true })
    const pin = await ok200('createMapPin', { mapId, x: 0.1, y: 0.1, label: 'Varn' })
    await ok200('createMapElement', {
      mapId,
      layerId: capa.id,
      kind: 'path',
      geometry: { points: SQUARE.slice(0, 2), from: pin.id }
    })
    const copy = (await ok200('copyPage', { pageId: aldoria })).id
    const copyTab = (await ok200('listPageTabs', { pageId: copy })).tabs[0].id
    const copied = await ok200('getMap', { tabId: copyTab })
    expect(copied.layers).toMatchObject([{ name: 'Rutas', hidden: true }])
    expect(copied.layers[0].id).not.toBe(capa.id)
    expect(copied.elements[0]).toMatchObject({ layerId: copied.layers[0].id, geometry: { from: copied.pins[0].id } })
    expect(copied.pins[0].id).not.toBe(pin.id)
  })

  it('quitar la pestaña se lleva sus capas; deshacer las devuelve', async () => {
    await ok200('createMapElement', { mapId, kind: 'label', geometry: { at: [0.5, 0.5] }, label: 'Mar de Ceniza' })
    await ok200('deletePageTab', { tabId })
    await undo('deletePageTab')
    expect(await map()).toMatchObject({ layers: [{ name: 'General' }], elements: [{ label: 'Mar de Ceniza' }] })
  })
})
