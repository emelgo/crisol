/**
 * Lo que cae en un calendario, para su vista grande (ajustes tras los módulos, bloque C): todos los eventos sueltos del
 * mundo y las páginas con fecha, sin que haga falta una cronología, en ese calendario (lo de otros, convertido; lo que
 * no se puede convertir, contado). Solo quien lleva el mundo: una jugadora no lo lee (le llega por las cronologías)
 */
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

describe('lo que cae en un calendario (vista grande)', () => {
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

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_calendar_entries'), { max: 4 })
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
    const campaignId = (await ok200('createCampaign', { worldId, name: 'La Marca' })).id
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

  it('los eventos y las páginas con fecha, sin cronologías; lo de otro calendario, convertido o contado', async () => {
    const varn = await ok200('createCalendar', { worldId, name: 'Cuenta de Varn', from: 'gregorian' })
    const elfos = await ok200('createCalendar', { worldId, name: 'Cómputo élfico', from: 'gregorian' })
    await ok200('updateCalendar', {
      calendarId: elfos.id,
      definition: { ...elfos.definition, correspondence: { date: '100-1-1' } }
    })
    await ok200('createCalendar', { worldId, name: 'Kharum', from: 'blank' })
    await ok200('createTimelineEvents', {
      worldId,
      events: [
        { title: 'Boda de Ilsa', date: '1247-3-18', group: 'La Corona', hidden: true },
        { title: 'Llegada de los elfos', date: '0-1-2', calendar: 'Cómputo élfico' },
        { title: 'Perdido', date: '3', calendar: 'Kharum' }
      ]
    })
    const puerto = (await ok200('createPage', { worldId, title: 'Puerto Ceniza', parentId: null })).id
    await ok200('editPage', { pageId: puerto, properties: [{ name: 'Fundación', type: 'date', value: '412-6-21' }] })

    const out = await ok200('listCalendarEntries', { calendarId: varn.id })
    expect(out.entries.map((e: { title: string; text: string }) => [e.title, e.text])).toEqual([
      ['Llegada de los elfos', '2 de Enero de 100'],
      ['Puerto Ceniza', '21 de Junio de 412'],
      ['Boda de Ilsa', '18 de Marzo de 1247']
    ])
    expect(out.entries[0]).toMatchObject({ kind: 'event', converted: { name: 'Cómputo élfico' } })
    expect(out.entries[1]).toMatchObject({ kind: 'page', pageId: puerto, property: 'Fundación' })
    expect(out.entries[2]).toMatchObject({ hidden: true })
    expect(out.outside).toBe(1)
    expect(out.groups.map((g: { name: string }) => g.name)).toEqual(['La Corona'])
  })

  it('solo quien lleva el mundo: la jugadora no lo lee, y un calendario que no existe es 404', async () => {
    const varn = await ok200('createCalendar', { worldId, name: 'Cuenta de Varn', from: 'gregorian' })
    await ok200('createTimelineEvents', { worldId, events: [{ title: 'Boda de Ilsa', date: '1247-3-18' }] })
    const player = await call('listCalendarEntries', { calendarId: varn.id }, ana.cookie)
    expect(player.statusCode).toBe(404)
    expect(player.body).not.toContain('Boda')
    expect((await call('listCalendarEntries', { calendarId: crypto.randomUUID() })).statusCode).toBe(404)
  })
})
