/**
 * Los calendarios de un mundo (módulo 8, docs/specs/calendarios.md): crearlos (en blanco, como el nuestro, copia o
 * con su definición), uno principal, ordenarlos, cambiarlos sin reescribir fechas, borrarlos y deshacerlo; describir y
 * convertir fechas; y lo que ve una jugadora (sin las eras solo del máster, ADR-0017)
 */
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { desc, eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'
import { DATE_SOURCES, eventDates, pageDates } from './calendar-dates.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

/** El de Eana, como lo escribiría la IA de una vez (sin ids; los meses de las fechas, por su nombre) */
const fest = (name: string) => ({ name, days: 7, festival: true })
const month = (name: string) => ({ name, days: 28 })
const EANA = {
  yearSuffix: 'RC',
  weekdays: ['Herrero', 'Hacedor', 'Muerte', 'Frostelle', 'Flora', 'Eternidad', 'Melancolía'],
  months: [
    fest('Alba Triste'),
    month('Cierzo'),
    month('Escarcha'),
    month('Deshielo'),
    fest('Carnaval'),
    month('Siembra'),
    month('Florida'),
    month('Pastos'),
    fest('Semana del Yunque'),
    month('Siega'),
    month('Trilla'),
    month('Vendimia'),
    fest('Semana de las Hermanas'),
    month('Hojarasca'),
    month('Brumas'),
    month('Nochelarga')
  ],
  seasons: [
    { name: 'Invierno', startDay: 1, endDay: 91 },
    { name: 'Primavera', startDay: 92, endDay: 182 },
    { name: 'Verano', startDay: 183, endDay: 273 },
    { name: 'Otoño', startDay: 274, endDay: 364 }
  ],
  moons: [
    { name: 'Melancolía', cycleDays: 28, offsetDays: -1.25, color: '#4f7fd1' },
    { name: 'Eternidad', cycleDays: 91, offsetDays: 48.1875, color: '#b07a3a' }
  ],
  eras: [
    { name: 'Era de los Viajeros', start: '-12000', end: '-8001' },
    { name: 'Era de la Renovación', start: '-8000', end: '-5001' },
    { name: 'Era de los Reyes Predestinados', start: '-5000', end: '-981' },
    { name: 'Era de los Nuevos Reinos', start: '-980', end: '-1' },
    { name: 'Era del Eclipse', abbreviation: 'EE', start: '1300-Siega-1', hidden: true },
    { name: 'Era de la República', abbreviation: 'ER', start: '0' }
  ]
}

describe('los calendarios de un mundo (módulo 8)', () => {
  let conn: ReturnType<typeof connect>
  let auth: ReturnType<typeof createTestAuth>
  let app: ReturnType<typeof buildApp>
  let master: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let worldId: string

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
  const list = async (cookie = master.cookie) =>
    (await ok200('listCalendars', { worldId }, cookie)).calendars as Array<{
      id: string
      name: string
      primary: boolean
      version: number
      definition: {
        months: Array<{ id: string; name: string }>
        eras: Array<{ name: string }>
        correspondence?: unknown
      }
    }>
  const eana = () => ok200('createCalendar', { worldId, name: 'Eana', from: { definition: EANA } })

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_calendars'), { max: 4 })
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
    const marca = (await ok200('createCampaign', { worldId, name: 'La Marca' })).id
    ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    const url = (await ok200('getInvitation', { campaignId: marca })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: ana.cookie }
    })
  })

  afterEach(() => {
    DATE_SOURCES.splice(0, DATE_SOURCES.length, pageDates, eventDates)
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('crear: el primero nace principal; en blanco, como el nuestro y copia de otro, cada uno al final', async () => {
    const blank = await ok200('createCalendar', { worldId, name: 'En blanco' })
    expect(blank).toMatchObject({ name: 'En blanco', primary: true })
    expect(blank.definition.months).toHaveLength(12)
    const gregorian = await ok200('createCalendar', { worldId, name: 'Gregoriano', from: 'gregorian' })
    expect(gregorian.primary).toBe(false)
    expect(gregorian.definition.leapRules).toEqual([{ monthId: 'feb', days: 1, every: 4, unless: 100, but: 400 }])
    const copy = await ok200('createCalendar', { worldId, name: 'Copia', from: { copyOf: gregorian.id } })
    expect(copy.definition).toEqual(gregorian.definition)
    expect((await list()).map((c) => c.name)).toEqual(['En blanco', 'Gregoriano', 'Copia'])
    await undo('createCalendar')
    expect((await list()).map((c) => c.name)).toEqual(['En blanco', 'Gregoriano'])
  })

  it('con su definición de una vez (el de Eana); con problemas, dice cuáles y no se crea', async () => {
    const created = await eana()
    expect(created.definition.months).toHaveLength(16)
    expect(created.definition.eras.map((e: { name: string }) => e.name)).toContain('Era del Eclipse')
    await fails(
      'createCalendar',
      {
        worldId,
        name: 'Roto',
        from: {
          definition: {
            ...EANA,
            seasons: [
              { name: 'Otoño', startDay: 244, endDay: 334 },
              { name: 'Invierno', startDay: 330, endDay: 60 }
            ]
          }
        }
      },
      'BAD_CALENDAR'
    )
    expect(await list()).toHaveLength(1)
  })

  it('describir 1250-Siega-18: día de la semana, estación, era y lunas; sumar días y cuántos faltan', async () => {
    const { id } = await eana()
    const described = await ok200('describeDate', {
      worldId,
      date: '1250-Siega-18',
      addDays: 10,
      until: '1251-Siega-18'
    })
    expect(described).toMatchObject({
      calendarId: id,
      calendar: 'Eana',
      date: {
        text: 'Frostelle, 18 de Siega de 1250 RC',
        form: '1250-Siega-18',
        weekday: 'Frostelle',
        season: 'Verano',
        era: { name: 'Era de la República', abbreviation: 'ER' }
      },
      primary: null,
      added: { form: '1250-Siega-28' },
      daysUntil: 364
    })
    expect(described.date.moons.map((m: { name: string }) => m.name)).toEqual(['Melancolía', 'Eternidad'])
    // La era del eclipse (oculta), al máster sí
    expect((await ok200('describeDate', { calendarId: id, date: '1300-Siega-2' })).date.era.name).toBe(
      'Era del Eclipse'
    )
    await fails('describeDate', { calendarId: id, date: '1250-Siega-29' }, 'BAD_DATE')
    await fails(
      'describeDate',
      { worldId: (await ok200('createWorld', { name: 'Vacío' })).id, date: '1' },
      'NO_CALENDAR'
    )
  })

  it('una jugadora los lee sin las eras solo del máster (API y descripción) y no puede cambiarlos', async () => {
    const { id } = await eana()
    const seen = await list(ana.cookie)
    expect(seen[0]?.definition.eras.map((e) => e.name)).not.toContain('Era del Eclipse')
    expect(JSON.stringify(seen)).not.toContain('Eclipse')
    const one = await ok200('getCalendar', { calendarId: id }, ana.cookie)
    expect(JSON.stringify(one)).not.toContain('Eclipse')
    const described = await ok200('describeDate', { calendarId: id, date: '1300-Siega-2' }, ana.cookie)
    expect(described.date.era.name).toBe('Era de la República')
    expect(JSON.stringify(described)).not.toContain('Eclipse')
    // Y «ver como jugador» del máster, igual
    expect(JSON.stringify(await list())).toContain('Eclipse')
    expect((await call('updateCalendar', { calendarId: id, name: 'Mío' }, ana.cookie)).statusCode).toBe(404)
    expect((await call('deleteCalendar', { calendarId: id }, ana.cookie)).statusCode).toBe(404)
    expect((await call('createCalendar', { worldId, name: 'Mío' }, ana.cookie)).statusCode).toBe(404)
  })

  it('hacer principal: solo uno; el anterior recibe la correspondencia inversa y lo convertido cuadra igual', async () => {
    const primary = await eana()
    const elves = await ok200('createCalendar', { worldId, name: 'Élfico', from: 'blank' })
    const updated = await ok200('updateCalendar', {
      calendarId: elves.id,
      definition: { ...elves.definition, months: elves.definition.months, correspondence: { date: '-300-Cierzo-1' } }
    })
    expect(updated.definition.correspondence).toEqual({
      calendarId: primary.id,
      date: { year: -300, month: expect.any(String), day: 1 }
    })
    const first = elves.definition.months[0].id
    const before = await ok200('convertDate', { calendarId: primary.id, to: elves.id, date: '1250-Siega-18' })
    const inPrimary = await ok200('describeDate', { calendarId: elves.id, date: { year: 0, month: first, day: 1 } })
    expect(inPrimary.primary).toMatchObject({ calendarId: primary.id, text: '1 de Cierzo de -300 RC' })
    expect((await ok200('getCalendar', { calendarId: elves.id })).convertible).toBe(true)

    await ok200('updateCalendar', { calendarId: elves.id, primary: true })
    const calendars = await list()
    expect(calendars.filter((c) => c.primary).map((c) => c.name)).toEqual(['Élfico'])
    expect(calendars.find((c) => c.name === 'Élfico')?.definition.correspondence).toBeNull()
    expect(calendars.find((c) => c.name === 'Eana')?.definition.correspondence).toMatchObject({ calendarId: elves.id })
    expect(await ok200('convertDate', { calendarId: primary.id, to: elves.id, date: '1250-Siega-18' })).toEqual(before)
    await undo('updateCalendar')
    expect((await list()).filter((c) => c.primary).map((c) => c.name)).toEqual(['Eana'])
  })

  it('sin correspondencia no se convierte', async () => {
    const primary = await eana()
    const loose = await ok200('createCalendar', { worldId, name: 'Suelto', from: 'gregorian' })
    await fails('convertDate', { calendarId: loose.id, to: primary.id, date: '2000' }, 'CALENDAR_NOT_CONVERTIBLE')
    expect((await ok200('describeDate', { calendarId: loose.id, date: '2000' })).primary).toBeNull()
  })

  it('ordenar: tras otro o el primero', async () => {
    await ok200('createCalendar', { worldId, name: 'A' })
    const b = await ok200('createCalendar', { worldId, name: 'B' })
    const c = await ok200('createCalendar', { worldId, name: 'C' })
    await ok200('updateCalendar', { calendarId: c.id, after: null })
    expect((await list()).map((x) => x.name)).toEqual(['C', 'A', 'B'])
    await ok200('updateCalendar', { calendarId: c.id, after: b.id })
    expect((await list()).map((x) => x.name)).toEqual(['A', 'B', 'C'])
  })

  it('cambiar la definición no reescribe fechas; quitar un mes con fechas se impide; con otra versión, no se guarda', async () => {
    const created = await eana()
    const siega = created.definition.months.find((m: { name: string }) => m.name === 'Siega').id
    // Una fuente de fechas de prueba: dos fechas en Siega
    DATE_SOURCES.push({
      dates: async (_db, calendarId) =>
        calendarId === created.id
          ? [{ start: { year: 1250, month: siega, day: 3 } }, { start: { year: 1250, month: siega } }]
          : []
    })
    const without = created.definition.months.filter((m: { id: string }) => m.id !== siega)
    await fails(
      'updateCalendar',
      { calendarId: created.id, definition: { ...created.definition, months: without } },
      'CALENDAR_MONTH_IN_USE'
    )
    await fails('deleteCalendar', { calendarId: created.id }, 'CALENDAR_IN_USE')
    // Renombrar un mes sí: va por id
    const renamed = created.definition.months.map((m: { id: string; name: string }) =>
      m.id === siega ? { ...m, name: 'Cosecha' } : m
    )
    const saved = await ok200('updateCalendar', {
      calendarId: created.id,
      version: created.version,
      definition: { ...created.definition, months: renamed }
    })
    expect(saved.definition.months.find((m: { id: string }) => m.id === siega).name).toBe('Cosecha')
    await fails(
      'updateCalendar',
      { calendarId: created.id, version: created.version, name: 'Otro' },
      'CALENDAR_CHANGED'
    )
  })

  it('borrar: el principal no mientras haya otros; quita las correspondencias con él y se deshace entero', async () => {
    const primary = await eana()
    const elves = await ok200('createCalendar', { worldId, name: 'Élfico' })
    await ok200('updateCalendar', {
      calendarId: elves.id,
      definition: { ...elves.definition, correspondence: { date: '0-Cierzo-1' } }
    })
    await fails('deleteCalendar', { calendarId: primary.id }, 'CALENDAR_IS_PRIMARY')
    const third = await ok200('createCalendar', { worldId, name: 'Tercero' })
    await ok200('updateCalendar', { calendarId: third.id, primary: true })
    await ok200('deleteCalendar', { calendarId: primary.id })
    expect((await list()).map((c) => c.name)).toEqual(['Élfico', 'Tercero'])
    expect((await list()).find((c) => c.name === 'Élfico')?.definition.correspondence).toBeNull()
    await undo('deleteCalendar')
    const back = await list()
    expect(back.map((c) => c.name)).toEqual(['Eana', 'Élfico', 'Tercero'])
    expect(back.find((c) => c.name === 'Élfico')?.definition.correspondence).toMatchObject({ calendarId: primary.id })
  })

  it('el historial lo cuenta con su nombre', async () => {
    await eana()
    const { entries } = await ok200('listHistory', { worldId })
    expect(entries[0]).toMatchObject({ action: 'createCalendar', details: { name: 'Eana' } })
  })
})
