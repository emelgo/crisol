/**
 * El centro de actividad de una campaña (módulos 8 y 10 · campaña, decisiones 19-23): lo nuevo desde la última visita,
 * de otros, con lo que cada uno puede ver (el máster: notas, revelado y fechas; la jugadora: lo que le revelan y las
 * fechas; los dos, el registro por día); marcarlo como visto lo vacía; las operaciones guardan su campaña
 */
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import { createTestAuth, signUpTestUser, TEST_CALENDAR, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

type Activity = {
  since: string | null
  count: number
  items: Array<{ type: string; title?: string; to?: string; by?: { name: string } | null; created?: boolean }>
  log: Array<{ day: string; messages: number; rolls: number; shown: number }>
}

describe('el centro de actividad (8 · campaña)', () => {
  let conn: ReturnType<typeof connect>
  let auth: ReturnType<typeof createTestAuth>
  let app: ReturnType<typeof buildApp>
  let master: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let bea: { userId: string; cookie: string }
  let worldId: string
  let campaignId: string

  const call = (name: string, payload: object, cookie = master.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const activity = (cookie = master.cookie): Promise<Activity> =>
    ok200('getCampaignActivity', { campaignId, timeZone: 'Europe/Madrid' }, cookie)
  const seen = (cookie = master.cookie) => ok200('markActivitySeen', { campaignId }, cookie)
  const join = async (person: { cookie: string }) => {
    const url = (await ok200('getInvitation', { campaignId })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: person.cookie }
    })
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_activity'), { max: 4 })
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
    campaignId = (await ok200('createCampaign', { worldId, name: 'La Marca', knowledge: { start: 'none' } })).id
    ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    bea = await signUpTestUser(auth, { name: 'Bea', email: 'bea@crisol.test' })
    await join(ana)
    await join(bea)
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('al máster: las notas de las jugadoras y el registro de otros, por día; visto, se vacía hasta lo siguiente', async () => {
    await seen()
    const note = await ok200('createPlayerNote', { campaignId, title: 'Pistas', markdown: 'El molino' }, ana.cookie)
    await ok200('sendMessage', { campaignId, text: 'Hola' }, ana.cookie)
    await ok200('rollDice', { campaignId, formula: '1d20', visibility: 'all' }, bea.cookie)
    await ok200('sendMessage', { campaignId, text: 'Mío no cuenta' })
    const now = await activity()
    expect(now.since).not.toBeNull()
    expect(now.items).toMatchObject([{ type: 'note', title: 'Pistas', by: { name: 'Ana' }, created: true }])
    expect(now.log).toEqual([{ day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), messages: 1, rolls: 1, shown: 0 }])
    expect(now.count).toBe(3)

    // La operación de la nota guarda su campaña
    const [op] = await conn.db.select().from(schema.operations).where(eq(schema.operations.action, 'createPlayerNote'))
    expect(op?.campaignId).toBe(campaignId)

    await seen()
    expect((await activity()).count).toBe(0)
    await ok200(
      'updatePlayerNote',
      { id: note.note.id, version: note.note.version, title: 'Pistas del molino' },
      ana.cookie
    )
    expect((await activity()).items).toMatchObject([{ type: 'note', title: 'Pistas del molino', created: false }])
  })

  it('a la jugadora: lo que le revelan y los cambios de fecha; nunca notas de otras, susurros ajenos ni lo oculto', async () => {
    await seen(ana.cookie)
    await ok200('createCalendar', { worldId, name: 'Eana', from: { definition: TEST_CALENDAR } })
    await ok200('setCampaignToday', { campaignId, date: '1250-Siega-18' })
    const pageId = (await ok200('createPage', { worldId, title: 'El molino' })).id
    expect((await ok200('reveal', { worldId, campaignId, kind: 'page', targetId: pageId })).told).toBe(2)
    await ok200('createPlayerNote', { campaignId, title: 'Secreto de Bea' }, bea.cookie)
    await ok200('sendMessage', { campaignId, text: 'Solo al máster', whisper: ['master'] }, bea.cookie)
    await ok200('rollDice', { campaignId, formula: '1d20', visibility: 'hidden' })
    await ok200('sendMessage', { campaignId, text: 'Para todos' }, bea.cookie)

    const mine = await activity(ana.cookie)
    expect(mine.items.map((i) => i.type).sort()).toEqual(['date', 'revealed'])
    expect(mine.items.find((i) => i.type === 'revealed')?.title).toBe('El molino')
    expect(mine.items.find((i) => i.type === 'date')?.to).toContain('18 de Siega')
    expect(mine.log).toMatchObject([{ messages: 1, rolls: 0, shown: 0 }])
    expect(JSON.stringify(mine)).not.toContain('Secreto de Bea')
    expect(JSON.stringify(mine)).not.toContain('EE')
    expect(mine.count).toBe(3)

    // El máster no ve como nuevo lo que hizo él (la fecha, lo revelado), sí lo de Bea (su nota y su susurro)
    const theirs = await activity()
    expect(theirs.items.map((i) => i.type)).toEqual(['note'])
    expect(theirs.log).toMatchObject([{ messages: 2 }])
  })

  it('sin visita, desde que está en la campaña; una zona horaria que no existe no vale', async () => {
    await ok200('sendMessage', { campaignId, text: 'Hola' }, ana.cookie)
    expect((await activity(bea.cookie)).log).toMatchObject([{ messages: 1 }])
    expect((await activity(bea.cookie)).since).toBeNull()
    const response = await call('getCampaignActivity', { campaignId, timeZone: 'Marte/Olimpo' })
    expect(response.json().code).toBe('BAD_TIME_ZONE')
  })
})
