import { diceRoll, type RealtimeMessage } from '@crisol/contracts'
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined
type WebSocket = Awaited<ReturnType<FastifyInstance['injectWS']>>
const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('las tiradas de una campaña', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let master: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let bruno: { userId: string; cookie: string }
  let carla: { userId: string; cookie: string }
  let campaignId: string
  const sockets: WebSocket[] = []

  const call = (name: string, payload: object, cookie: string) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const roll = async (who: { cookie: string }, formula: string, visibility: string) => {
    const response = await call('rollDice', { campaignId, formula, visibility }, who.cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json().roll
  }
  const labels = async (who: { cookie: string }) => {
    const response = await call('listRolls', { campaignId }, who.cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json().rolls.map((r: { label: string }) => r.label)
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_dice'), { max: 4 })
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
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Fateforge' }).returning()
    const organizationId = org?.id ?? ''
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: master.userId, role: 'owner' })
    const worldId = (await call('createWorld', { name: 'Eana' }, master.cookie)).json().id
    campaignId = (await call('createCampaign', { worldId, name: 'La Marca' }, master.cookie)).json().id
    const player = async (name: string, email: string) => {
      const who = await signUpTestUser(auth, { name, email })
      await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: who.userId, role: 'member' })
      await conn.db.insert(schema.campaignMembers).values({ campaignId, userId: who.userId, role: 'player' })
      return who
    }
    ana = await player('Ana', 'ana@crisol.test')
    bruno = await player('Bruno', 'bruno@crisol.test')
    carla = await signUpTestUser(auth, { name: 'Carla', email: 'carla@crisol.test' })
  })

  afterEach(async () => {
    for (const ws of sockets.splice(0)) ws.terminate()
    await app.close()
  })

  afterAll(async () => {
    await conn?.close()
  })

  /** Las tiradas que le llegan en vivo a una cuenta */
  const listen = async (who: { cookie: string }) => {
    const ws = await app.injectWS('/api/realtime', { headers: { origin: BASE_URL, cookie: who.cookie } })
    sockets.push(ws)
    const got: string[] = []
    ws.on('message', (data: Buffer) => {
      const message = JSON.parse(String(data)) as RealtimeMessage
      if (message.type === 'rolled') got.push(message.roll.label ?? '')
    })
    return got
  }
  const until = async (check: () => boolean) => {
    for (let i = 0; i < 40 && !check(); i++) await settle(50)
  }

  it('el servidor tira: el total, cada dado y su desglose, de quién y con su visibilidad', async () => {
    const done = await roll(ana, '1d20+4 # Percepción', 'all')
    expect(diceRoll.safeParse(done).success).toBe(true)
    expect(done).toMatchObject({ formula: '1d20+4', label: 'Percepción', visibility: 'all', ai: false })
    expect(done.by).toEqual({ userId: ana.userId, name: 'Ana', color: null })
    expect(done.total).toBeGreaterThanOrEqual(5)
    expect(done.total).toBeLessThanOrEqual(24)
    expect(done.dice).toHaveLength(1)
    expect(done.dice[0]).toMatchObject({ sides: 20, kept: true })
    expect(done.detail).toBe(`1d20+4 → [${done.dice[0].value}] + 4 = ${done.total}`)
    expect(done.critical).toBe(done.dice[0].value === 20 ? 'high' : done.dice[0].value === 1 ? 'low' : null)
  })

  it('cada uno lee lo que puede ver: el máster, todo; cada jugadora, lo de todos y lo suyo', async () => {
    await roll(ana, '1d20+4 # Percepción', 'all')
    await roll(ana, '1d20+7 # Sigilo', 'master')
    await roll(bruno, '1d20+1 # ¿Me miente?', 'self')
    await roll(master, '1d20+2 # ¿La oyen?', 'hidden')
    expect(await labels(master)).toEqual(['Percepción', 'Sigilo', '¿Me miente?', '¿La oyen?'])
    expect(await labels(ana)).toEqual(['Percepción', 'Sigilo'])
    expect(await labels(bruno)).toEqual(['Percepción', '¿Me miente?'])
  })

  it('cada visibilidad, solo quien puede: las jugadoras no tiran en oculto; el máster, cualquiera', async () => {
    const hidden = await call('rollDice', { campaignId, formula: '1d20', visibility: 'hidden' }, ana.cookie)
    expect(hidden.statusCode).toBe(400)
    expect(hidden.json()).toMatchObject({ code: 'VISIBILITY_NOT_ALLOWED' })
    // Por si dirige el mundo y además juega en la campaña: la web le ofrece todos u oculta
    for (const visibility of ['all', 'self', 'master', 'hidden']) {
      const response = await call('rollDice', { campaignId, formula: '1d20', visibility }, master.cookie)
      expect(response.statusCode, visibility).toBe(200)
    }
  })

  it('una fórmula que no vale se rechaza (el porqué lo dice la web al escribirla, y a la IA el MCP)', async () => {
    const response = await call('rollDice', { campaignId, formula: '1d20+', visibility: 'all' }, ana.cookie)
    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ code: 'BAD_FORMULA' })
    expect(await labels(ana)).toEqual([])
  })

  it('quien no es de la campaña ni tira ni lee', async () => {
    expect((await call('rollDice', { campaignId, formula: '1d20', visibility: 'all' }, carla.cookie)).statusCode).toBe(
      404
    )
    expect((await call('listRolls', { campaignId }, carla.cookie)).statusCode).toBe(404)
  })

  it('el registro se lee hacia atrás, de 50 en 50, cada página en el orden en que se tiró', async () => {
    for (let i = 1; i <= 55; i++) await roll(master, `1d6 # Tirada ${i}`, 'all')
    const first = (await call('listRolls', { campaignId }, ana.cookie)).json()
    expect(first.rolls).toHaveLength(50)
    expect(first.rolls[0].label).toBe('Tirada 6')
    expect(first.rolls.at(-1).label).toBe('Tirada 55')
    const rest = (await call('listRolls', { campaignId, before: first.next }, ana.cookie)).json()
    expect(rest.rolls.map((r: { label: string }) => r.label)).toEqual([
      'Tirada 1',
      'Tirada 2',
      'Tirada 3',
      'Tirada 4',
      'Tirada 5'
    ])
    expect(rest.next).toBeNull()
  })

  it('en vivo, cada tirada le llega a quien la puede ver, una sola vez, y a nadie más', async () => {
    const toMaster = await listen(master)
    const toAna = await listen(ana)
    const toBruno = await listen(bruno)
    const toCarla = await listen(carla)
    await roll(master, '1d20 # Iniciativa', 'all')
    await until(() => toMaster.length > 0 && toAna.length > 0 && toBruno.length > 0)
    await roll(ana, '1d20+7 # Sigilo', 'master')
    await roll(bruno, '1d20+1 # ¿Me miente?', 'self')
    await roll(master, '1d20+2 # ¿La oyen?', 'hidden')
    await until(() => toMaster.length >= 4)
    await settle(200)
    expect(toMaster).toEqual(['Iniciativa', 'Sigilo', '¿Me miente?', '¿La oyen?'])
    expect(toAna).toEqual(['Iniciativa', 'Sigilo'])
    expect(toBruno).toEqual(['Iniciativa', '¿Me miente?'])
    expect(toCarla).toEqual([])
  })

  it('como mucho 60 tiradas por minuto y persona', async () => {
    for (let i = 0; i < 60; i++) await roll(ana, '1d6', 'all')
    const tooMany = await call('rollDice', { campaignId, formula: '1d6', visibility: 'all' }, ana.cookie)
    expect(tooMany.statusCode).toBe(429)
    expect(tooMany.json()).toEqual({ code: 'TOO_MANY_ROLLS' })
    // A las demás no les afecta
    await roll(bruno, '1d6 # Sigue', 'all')
  })

  it('el color de quien tira va con la tirada, si es un color de verdad', async () => {
    await conn.db.update(schema.user).set({ diceColor: '#2a9d8f' }).where(eq(schema.user.id, ana.userId))
    expect((await roll(ana, '1d6', 'all')).by.color).toBe('#2a9d8f')
    await conn.db
      .update(schema.user)
      .set({ diceColor: 'url(https://fuera.example)' })
      .where(eq(schema.user.id, ana.userId))
    expect((await roll(ana, '1d6', 'all')).by.color).toBeNull()
    expect((await roll(bruno, '1d6', 'all')).by.color).toBeNull()
  })

  it('tirar sin apuntar: da el resultado y no deja nada en el registro', async () => {
    const response = await call('tryDice', { formula: '2d6+3 # Prueba' }, carla.cookie)
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json()).toMatchObject({ formula: '2d6+3', label: 'Prueba' })
    expect(response.json().dice).toHaveLength(2)
    expect(await labels(master)).toEqual([])
    expect((await call('tryDice', { formula: '2d' }, carla.cookie)).json()).toEqual({ code: 'BAD_FORMULA' })
  })

  it('con muchas peticiones a la vez no se pasa del límite: 60 tiran y el resto, 429', async () => {
    const responses = await Promise.all(
      Array.from({ length: 90 }, () => call('rollDice', { campaignId, formula: '1d6', visibility: 'all' }, ana.cookie))
    )
    expect(responses.filter((r) => r.statusCode === 200)).toHaveLength(60)
    expect(responses.filter((r) => r.statusCode === 429)).toHaveLength(30)
  })

  it('tirar sin apuntar también tiene su límite por minuto', async () => {
    for (let i = 0; i < 60; i++) expect((await call('tryDice', { formula: '1d6' }, bruno.cookie)).statusCode).toBe(200)
    expect((await call('tryDice', { formula: '1d6' }, bruno.cookie)).statusCode).toBe(429)
  })

  it('el cursor de las anteriores es de la campaña: el id de una tirada de otra no sirve', async () => {
    const worldId = (await call('createWorld', { name: 'Otro' }, master.cookie)).json().id
    const other = (await call('createCampaign', { worldId, name: 'La Otra' }, master.cookie)).json().id
    const elsewhere = (
      await call('rollDice', { campaignId: other, formula: '1d6 # Fuera', visibility: 'all' }, master.cookie)
    ).json().roll.id
    await roll(master, '1d6 # Aquí', 'all')
    const page = (await call('listRolls', { campaignId, before: elsewhere }, master.cookie)).json()
    expect(page.rolls.map((r: { label: string }) => r.label)).toEqual(['Aquí'])
  })

  it('el color de los dados solo se guarda si es un color de verdad', async () => {
    const save = (diceColor: string) =>
      app.inject({
        method: 'POST',
        url: '/api/auth/update-user',
        payload: { diceColor },
        headers: { origin: BASE_URL, cookie: ana.cookie }
      })
    expect((await save('url(https://fuera.example)')).statusCode).toBe(400)
    expect((await save('#2a9d8f')).statusCode).toBe(200)
  })
})
