/**
 * Los viajes de una campaña (módulos 8 y 10 · campaña, decisiones 3, 17 y 18): planear con la distancia escrita o una
 * ruta medida en el mapa (sus velocidades), el ritmo y el descanso; hacerlo avanza el «hoy» y la zona en una sola
 * operación, con el clima de cada día en el registro; deshacer lo devuelve
 */
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { desc, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import { diskStorage } from '../files/storage.ts'
import { createTestAuth, signUpTestUser, TEST_CALENDAR, TEST_SEAL_KEY, testDataDir } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

describe('los viajes de una campaña (8 · campaña)', () => {
  let conn: ReturnType<typeof connect>
  let auth: ReturnType<typeof createTestAuth>
  let app: ReturnType<typeof buildApp>
  let master: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let worldId: string
  let campaignId: string

  const call = (name: string, payload: object, cookie = master.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const fails = async (name: string, payload: object, code: string, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.json().code, response.body).toBe(code)
  }
  /** Un mapa de 1000 × 500 px con 100 px = 30 km y una ruta de 300 px (90 km) */
  const routeMap = async () => {
    const pageId = (await ok200('createPage', { worldId, title: 'Valdren' })).id
    const tabId = (await ok200('createPageTab', { pageId, kind: 'map' })).id
    const mapId = (await ok200('getMap', { tabId })).id
    const file = (
      await app.inject({
        method: 'POST',
        url: `/api/files?worldId=${worldId}&name=Valdren.png`,
        payload: PNG,
        headers: { origin: BASE_URL, cookie: master.cookie, 'content-type': 'application/octet-stream' }
      })
    ).json()
    await ok200('updateMap', {
      mapId,
      image: { fileId: file.id, width: 1000, height: 500 },
      scale: { length: 100, value: 30, unit: 'km' },
      speeds: { foot: 24, horse: 45, ship: 60 }
    })
    const points = [
      [0.1, 0.5],
      [0.4, 0.5]
    ]
    const route = await ok200('createMapElement', { mapId, kind: 'path', label: 'Camino real', geometry: { points } })
    return { tabId, routeId: route.id as string }
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_travel'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY },
      storage: diskStorage(testDataDir())
    })
    master = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Mesa' }).returning()
    if (!org) throw new Error('sin organización')
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org.id, userId: master.userId, role: 'owner' })
    worldId = (await ok200('createWorld', { name: 'Valdren' })).id
    campaignId = (await ok200('createCampaign', { worldId, name: 'La Marca' })).id
    ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    const url = (await ok200('getInvitation', { campaignId })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: ana.cookie }
    })
    await ok200('createCalendar', { worldId, name: 'Eana', from: { definition: TEST_CALENDAR } })
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('planear con la distancia escrita: ritmo, descanso y, sin fecha, sin llegada ni clima', async () => {
    const plan = await ok200('planTravel', { campaignId, distance: 120, unit: 'km', pace: 'slow', restDays: 2 })
    expect(plan).toMatchObject({
      distance: 120,
      unit: 'km',
      route: null,
      medium: 'foot',
      speed: 24,
      travelDays: 7.46,
      days: 10,
      from: null,
      arrival: null,
      weather: []
    })
    await fails('travel', { campaignId, distance: 120 }, 'NO_TODAY')
    await fails('planTravel', { campaignId, distance: 120 }, 'FORBIDDEN', ana.cookie)
    await fails('planTravel', { campaignId, distance: 100_000, medium: 'foot' }, 'TRAVEL_TOO_LONG')
  })

  it('una ruta del mapa, a caballo y rápido: avanza el «hoy» y la zona en una operación, con el clima de cada día', async () => {
    const { tabId, routeId } = await routeMap()
    await ok200('setCampaignToday', { campaignId, date: '1250-Siega-18' })
    const plan = await ok200('planTravel', { campaignId, tabId, elementId: routeId, medium: 'horse', pace: 'fast' })
    // 90 km a 45 al día, rápido (×1,33): 1,5 días, que son 2
    expect(plan).toMatchObject({ distance: 90, unit: 'km', route: 'Camino real', speed: 45, travelDays: 1.5, days: 2 })
    expect(plan.arrival.form).toBe('1250-Siega-20')
    expect(plan.weather.map((d: { form: string }) => d.form)).toEqual(['1250-Siega-19', '1250-Siega-20'])
    const expected = (await ok200('getCampaignWeather', { campaignId, days: 3 })).days.slice(1)
    expect(plan.weather).toEqual(expected)

    const done = await ok200('travel', {
      campaignId,
      tabId,
      elementId: routeId,
      medium: 'horse',
      pace: 'fast',
      zone: 'coast'
    })
    expect(done.today.form).toBe('1250-Siega-20')
    const today = await ok200('getCampaignToday', { campaignId })
    expect(today).toMatchObject({ zone: 'coast', today: { form: '1250-Siega-20' } })

    const ops = await conn.db.select().from(schema.operations).where(eq(schema.operations.action, 'travel'))
    expect(ops).toHaveLength(1)
    expect(ops[0]?.details).toMatchObject({ days: 2, medium: 'horse', route: 'Camino real', zone: 'coast' })

    // En el registro, que ve también la jugadora: el resumen con el clima de cada día
    const entries = (await ok200('listLog', { campaignId }, ana.cookie)).entries as Array<{
      kind: string
      event?: { type: string; days: number; route: string; weather: Array<{ date: { text: string } }> }
    }>
    const travelled = entries.find((e) => e.event?.type === 'travel')?.event
    expect(travelled).toMatchObject({ days: 2, route: 'Camino real' })
    expect(travelled?.weather).toHaveLength(2)

    // Deshacer devuelve el «hoy» y la zona, y lo dice en el registro
    const [op] = await conn.db
      .select()
      .from(schema.operations)
      .where(eq(schema.operations.action, 'travel'))
      .orderBy(desc(schema.operations.createdAt))
    expect((await ok200('undoOperation', { operationId: op?.id })).status).toBe('undone')
    expect(await ok200('getCampaignToday', { campaignId })).toMatchObject({
      zone: 'temperate',
      today: { form: '1250-Siega-18' }
    })
    const last = (await ok200('listLog', { campaignId })).entries.at(-1)
    expect(last.event).toMatchObject({ type: 'date', undo: true })
  })

  it('un mapa de otro mundo no vale; sin escala, no se mide', async () => {
    const { tabId } = await routeMap()
    await ok200('updateMap', { mapId: (await ok200('getMap', { tabId })).id, scale: null })
    await fails(
      'planTravel',
      {
        campaignId,
        tabId,
        points: [
          [0, 0],
          [1, 1]
        ]
      },
      'NO_MAP_SCALE'
    )
    const otherWorld = (await ok200('createWorld', { name: 'Otro' })).id
    const other = (await ok200('createCampaign', { worldId: otherWorld, name: 'Fuera' })).id
    await fails(
      'planTravel',
      {
        campaignId: other,
        tabId,
        points: [
          [0, 0],
          [1, 1]
        ]
      },
      'NOT_FOUND'
    )
  })
})
