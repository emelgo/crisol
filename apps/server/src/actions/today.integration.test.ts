/**
 * El «hoy» de cada campaña (módulos 8 y 10 · campaña, decisiones 1 y 5-10): ponerlo en el calendario principal,
 * avanzarlo días y semanas, el registro (también al deshacer), lo que ve la jugadora (sin las eras solo del máster) y
 * que su calendario no se rompe por debajo
 */
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { desc, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import { createTestAuth, signUpTestUser, TEST_CALENDAR, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

type Event = { kind: string; event?: { type: string; from: { text: string } | null; to: { text: string } | null } }

describe('el «hoy» de cada campaña (8 · campaña)', () => {
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
  const events = async (cookie = master.cookie) =>
    ((await ok200('listLog', { campaignId }, cookie)).entries as Event[]).filter((e) => e.kind === 'event')

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_today'), { max: 4 })
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
    worldId = (await ok200('createWorld', { name: 'Eana' })).id
    campaignId = (await ok200('createCampaign', { worldId, name: 'La Marca' })).id
    ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    const url = (await ok200('getInvitation', { campaignId })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: ana.cookie }
    })
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('sin calendario no hay fecha que poner; sin fecha no se avanza', async () => {
    expect(await ok200('getCampaignToday', { campaignId })).toEqual({
      today: null,
      suggestion: null,
      weekLength: 7,
      zone: 'temperate',
      latitude: 45,
      weather: null,
      sun: null,
      forecast: []
    })
    await fails('setCampaignToday', { campaignId, date: '1250-Siega-18' }, 'NO_CALENDAR')
    await ok200('createCalendar', { worldId, name: 'Eana', from: { definition: TEST_CALENDAR } })
    await fails('setCampaignToday', { campaignId, days: 1 }, 'NO_TODAY')
    await fails('setCampaignToday', { campaignId, date: '1250-Siega' }, 'BAD_DATE')
    await fails('setCampaignToday', { campaignId, date: '1250-Siega-40' }, 'BAD_DATE')
  })

  it('poner, +1 semana y −1 día: la cabecera, el registro y la jugadora (que no lo cambia ni ve lo oculto)', async () => {
    await ok200('createCalendar', { worldId, name: 'Eana', from: { definition: TEST_CALENDAR } })
    const set = await ok200('setCampaignToday', { campaignId, date: '1250-Siega-18' })
    expect(set.today).toMatchObject({ form: '1250-Siega-18', calendar: 'Eana', season: 'Verano' })
    expect(set.today.text).toContain('51 EE')
    const week = await ok200('setCampaignToday', { campaignId, weeks: 1 })
    expect(week.today.form).toBe('1250-Siega-25')
    expect(week.today.day - set.today.day).toBe(7)
    expect((await ok200('setCampaignToday', { campaignId, days: -1 })).today.form).toBe('1250-Siega-24')
    expect((await ok200('setCampaignToday', { campaignId, days: 5 })).today.form).toBe('1250-Brumas-1')

    const logged = await events()
    expect(logged.map((e) => e.event?.to?.text.replace(/,.*/, ''))).toHaveLength(4)
    expect(logged[0]?.event).toMatchObject({ type: 'date', from: null, days: null })
    expect(logged[1]?.event).toMatchObject({ type: 'date', days: 7 })
    // En el registro, lo que ve todo el mundo: sin la era solo del máster
    expect(JSON.stringify(logged)).not.toContain('EE')

    // La jugadora: lo lee (sin la era oculta), lo ve en su registro y no lo cambia
    const seen = await ok200('getCampaignToday', { campaignId }, ana.cookie)
    expect(seen.today.form).toBe('1250-Brumas-1')
    expect(seen.today.text).not.toContain('EE')
    expect(seen.suggestion).toBeNull()
    expect(await events(ana.cookie)).toHaveLength(4)
    await fails('setCampaignToday', { campaignId, days: 1 }, 'FORBIDDEN', ana.cookie)
  })

  it('deshacer devuelve la fecha y lo dice en el registro (que no se deshace)', async () => {
    await ok200('createCalendar', { worldId, name: 'Eana', from: { definition: TEST_CALENDAR } })
    await ok200('setCampaignToday', { campaignId, date: '1250-Siega-18' })
    await ok200('setCampaignToday', { campaignId, weeks: 1 })
    const [op] = await conn.db
      .select()
      .from(schema.operations)
      .where(eq(schema.operations.action, 'setCampaignToday'))
      .orderBy(desc(schema.operations.createdAt))
    expect(op?.details).toMatchObject({ campaign: 'La Marca', days: 7 })
    expect((await ok200('undoOperation', { operationId: op?.id })).status).toBe('undone')
    expect((await ok200('getCampaignToday', { campaignId })).today.form).toBe('1250-Siega-18')
    const logged = await events()
    expect(logged).toHaveLength(3)
    expect(logged[2]?.event).toMatchObject({ type: 'date', undo: true, days: null })
    expect(logged[2]?.event?.to?.text).toContain('18 de Siega')
  })

  it('una campaña sin fecha propone la de otra del mundo; el calendario y sus meses en uso no se quitan', async () => {
    const calendar = await ok200('createCalendar', { worldId, name: 'Eana', from: { definition: TEST_CALENDAR } })
    await ok200('setCampaignToday', { campaignId, date: '1250-Siega-18' })
    const other = (await ok200('createCampaign', { worldId, name: 'Los Páramos' })).id
    const proposed = await ok200('getCampaignToday', { campaignId: other })
    expect(proposed.today).toBeNull()
    expect(proposed.suggestion.form).toBe('1250-Siega-18')

    await fails('deleteCalendar', { calendarId: calendar.id }, 'CALENDAR_IN_USE')
    const months = calendar.definition.months.filter((m: { name: string }) => m.name !== 'Siega')
    await fails(
      'updateCalendar',
      { calendarId: calendar.id, definition: { ...calendar.definition, months } },
      'CALENDAR_MONTH_IN_USE'
    )
  })

  describe('el clima y el sol', () => {
    const today = (cookie = master.cookie, id = campaignId) => ok200('getCampaignToday', { campaignId: id }, cookie)
    const start = async () => {
      await ok200('createCalendar', { worldId, name: 'Eana', from: { definition: TEST_CALENDAR } })
      await ok200('setCampaignToday', { campaignId, date: '1250-Siega-18' })
    }

    it('con semilla: no cambia al recargar; el máster ve la previsión y la jugadora solo hoy y el sol', async () => {
      await start()
      const first = await today()
      expect(first.zone).toBe('temperate')
      expect(first.latitude).toBe(45)
      expect(first.weather).toMatchObject({ form: '1250-Siega-18', manual: false })
      expect(first.forecast).toHaveLength(7)
      expect(first.sun.daylight).toBeGreaterThan(12 * 60)
      expect(await today()).toEqual(first)
      const range = await ok200('getCampaignWeather', { campaignId, days: 8 })
      expect(range.days[0]).toEqual(first.weather)
      expect(range.days.slice(1)).toEqual(first.forecast)

      const seen = await today(ana.cookie)
      expect(seen.weather).toEqual({ ...first.weather, text: seen.weather.text })
      expect(seen.sun).toEqual(first.sun)
      expect(seen.forecast).toEqual([])
      await fails('getCampaignWeather', { campaignId }, 'FORBIDDEN', ana.cookie)
    })

    it('dos campañas en la misma zona y el mismo día ven lo mismo; otra zona, otro clima', async () => {
      await start()
      const other = (await ok200('createCampaign', { worldId, name: 'Los Páramos' })).id
      await ok200('setCampaignToday', { campaignId: other, date: '1250-Siega-18' })
      const week = async (id: string) =>
        ((await ok200('getCampaignWeather', { campaignId: id, days: 14 })).days as object[]).map((d) => ({
          ...d,
          sun: null
        }))
      expect(await week(other)).toEqual(await week(campaignId))
      expect(await ok200('setCampaignClimate', { campaignId: other, zone: 'polar', latitude: 80 })).toEqual({
        zone: 'polar',
        latitude: 80
      })
      expect(await week(other)).not.toEqual(await week(campaignId))
      expect((await today(master.cookie, other)).sun.daylight).toBe(24 * 60)
      await fails('setCampaignClimate', { campaignId, zone: 'polar' }, 'FORBIDDEN', ana.cookie)
    })

    it('a mano: se queda, no cambia mañana, solo el máster lo ve en el registro y se deshace', async () => {
      await start()
      const before = await ok200('getCampaignWeather', { campaignId, days: 2 })
      const storm = { condition: 'thunderstorm', low: 12, high: 19, wind: 'storm', windDirection: 'SW' }
      const changed = await ok200('setDayWeather', { campaignId, weather: storm })
      expect(changed.day).toMatchObject({ ...storm, manual: true, form: '1250-Siega-18' })
      const after = await ok200('getCampaignWeather', { campaignId, days: 2 })
      expect(after.days[0]).toMatchObject({ ...storm, manual: true })
      expect(after.days[1]).toEqual(before.days[1])
      expect((await today(ana.cookie)).weather).toMatchObject({ condition: 'thunderstorm', manual: true })

      const logged = (await events()).map((e) => e.event?.type)
      expect(logged).toEqual(['date', 'weather'])
      expect((await events(ana.cookie)).map((e) => e.event?.type)).toEqual(['date'])

      // Otro día, por su fecha; y quitarlo vuelve al generado
      await ok200('setDayWeather', { campaignId, date: '1250-Siega-19', weather: storm })
      await ok200('setDayWeather', { campaignId, date: '1250-Siega-19', weather: null })
      expect((await ok200('getCampaignWeather', { campaignId, days: 2 })).days[1]).toEqual(before.days[1])

      const [op] = await conn.db
        .select()
        .from(schema.operations)
        .where(eq(schema.operations.action, 'setDayWeather'))
        .orderBy(schema.operations.createdAt)
      expect((await ok200('undoOperation', { operationId: op?.id })).status).toBe('undone')
      expect((await ok200('getCampaignWeather', { campaignId, days: 1 })).days[0]).toEqual(before.days[0])
      await fails('setDayWeather', { campaignId, weather: storm }, 'FORBIDDEN', ana.cookie)
      await fails('setDayWeather', { campaignId, weather: { ...storm, low: 30 } }, 'INVALID_INPUT')
    })
  })
})
