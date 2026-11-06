import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { exampleFile } from '@crisol/systems/examples'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined
const POCION = 'pocion_de_curacion_2024'

type User = { userId: string; cookie: string }

describe('el inventario del grupo (docs/specs/grupo.md)', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let master: User
  let ana: User
  let bruno: User
  let worldId: string
  let campaignId: string
  let thora: string
  let bram: string

  const call = (name: string, payload: object, cookie = master.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const code = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    return { status: response.statusCode, code: response.json().code as string }
  }
  const join = async (user: User) => {
    const url = (await ok200('getInvitation', { campaignId })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: user.cookie }
    })
  }
  const party = async (cookie = master.cookie) => (await ok200('getParty', { campaignId }, cookie)).party
  const carried = async (characterId: string) =>
    ((await ok200('getCharacter', { characterId })).character.play.items ?? []) as {
      id: string
      key: string
      quantity?: number
    }[]

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_party'), { max: 4 })
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
    const five = (await ok200('importSystem', { file: exampleFile('5e') })).system.id
    campaignId = (await ok200('createCampaign', { worldId, name: 'La Marca', system: five })).id
    ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    bruno = await signUpTestUser(auth, { name: 'Bruno', email: 'bruno@crisol.test' })
    await join(ana)
    await join(bruno)
    thora = (await ok200('createCharacter', { campaignId, name: 'Thora' }, ana.cookie)).character.id
    bram = (await ok200('createCharacter', { campaignId, name: 'Bram' }, bruno.cookie)).character.id
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('lo ven y lo cambian todos: del compendio y a mano, en contenedores; las monedas, las del sistema', async () => {
    const empty = await ok200('getParty', { campaignId }, ana.cookie)
    expect(empty.party).toEqual({ version: 0, containers: [{ id: 'grupo', name: '' }], items: [], coins: {} })
    expect(empty.coins.map((c: { key: string }) => c.key)).toEqual(['pc', 'pp', 'pe', 'po', 'ppt'])
    // La jugadora ve su personaje para mover; el máster, todos
    expect(empty.characters.map((c: { name: string }) => c.name)).toEqual(['Thora'])
    expect((await ok200('getParty', { campaignId })).characters).toHaveLength(2)

    let p = (await ok200('updateParty', { campaignId, version: 0, add: { key: POCION, quantity: 3 } }, ana.cookie))
      .party
    expect(p.items).toEqual([
      expect.objectContaining({ key: POCION, name: 'Poción de curación', quantity: 3, container: 'grupo' })
    ])
    p = (await ok200('updateParty', { campaignId, version: p.version, addContainer: { name: 'El carro' } })).party
    const carro = p.containers[1].id
    p = (
      await ok200(
        'updateParty',
        { campaignId, version: p.version, add: { name: 'Llave de bronce', note: 'De la cripta', container: carro } },
        bruno.cookie
      )
    ).party
    p = (await ok200('updateParty', { campaignId, version: p.version, coins: { po: 100, pp: 7 } })).party
    expect(p.coins).toEqual({ po: 100, pp: 7 })
    // Con una versión vieja, no; otra cosa del compendio que no se lleva, tampoco; ni monedas que no hay
    expect(await code('updateParty', { campaignId, version: 1, coins: { po: 1 } })).toEqual({
      status: 400,
      code: 'PARTY_CHANGED'
    })
    expect(await code('updateParty', { campaignId, version: p.version, add: { key: 'bola_de_fuego_2024' } })).toEqual({
      status: 400,
      code: 'NOT_CARRIED_TYPE'
    })
    expect(await code('updateParty', { campaignId, version: p.version, coins: { oro: 1 } })).toEqual({
      status: 400,
      code: 'NO_COIN'
    })
    // Quitar el carro: lo de dentro, al de serie
    p = (await ok200('updateParty', { campaignId, version: p.version, removeContainer: { id: carro } })).party
    expect(p.containers).toHaveLength(1)
    expect(p.items.map((i: { name: string; container: string }) => [i.name, i.container])).toEqual([
      ['Poción de curación', 'grupo'],
      ['Llave de bronce', 'grupo']
    ])
    // Quien no está en la campaña, nada
    const stranger = await signUpTestUser(auth, { name: 'Otro', email: 'otro@crisol.test' })
    expect((await call('getParty', { campaignId }, stranger.cookie)).statusCode).toBe(404)
  })

  it('mover sin duplicar: la jugadora coge del grupo para su personaje y lo devuelve; no con el de otro', async () => {
    const added = await ok200('updateParty', { campaignId, version: 0, add: { key: POCION, quantity: 3 } }, ana.cookie)
    const pocion = added.party.items[0].id
    let p = (
      await ok200(
        'moveItem',
        { campaignId, from: { party: pocion }, to: { character: thora }, quantity: 2 },
        ana.cookie
      )
    ).party
    expect(p.items[0].quantity).toBe(1)
    // Los movimientos, para todos los de la campaña
    const { moves } = await ok200('getParty', { campaignId }, bruno.cookie)
    expect(moves[0]).toMatchObject({
      action: 'moveItem',
      details: { name: 'Poción de curación', quantity: 2, from: null, to: 'Thora' },
      by: 'Ana',
      ai: false
    })
    expect(moves[1]).toMatchObject({ action: 'updateParty', details: { change: 'add', quantity: 3 } })
    let thoras = await carried(thora)
    expect(thoras).toEqual([expect.objectContaining({ key: POCION, quantity: 2 })])
    // Con el personaje de otro, no
    expect(
      (await call('moveItem', { campaignId, from: { party: pocion }, to: { character: bram } }, ana.cookie)).statusCode
    ).toBe(404)
    // De vuelta, una: se junta con la que quedaba
    p = (
      await ok200(
        'moveItem',
        { campaignId, from: { character: thora, item: thoras[0]?.id }, to: { container: 'grupo' }, quantity: 1 },
        ana.cookie
      )
    ).party
    expect(p.items).toEqual([expect.objectContaining({ key: POCION, quantity: 2 })])
    thoras = await carried(thora)
    expect(thoras[0]?.quantity).toBe(1)
    // Deshacer el último movimiento lo devuelve todo a su sitio
    const history = await ok200('listHistory', { worldId })
    const last = history.entries.find((e: { action: string }) => e.action === 'moveItem')
    expect((await ok200('undoOperation', { operationId: last.id })).status).toBe('undone')
    expect((await party()).items.find((i: { key: string }) => i.key === POCION).quantity).toBe(1)
    expect((await carried(thora))[0]?.quantity).toBe(2)
    // Lo escrito a mano se queda en el grupo
    const llave = (await ok200('updateParty', { campaignId, version: (await party()).version, add: { name: 'Llave' } }))
      .party.items[1]
    expect(await code('moveItem', { campaignId, from: { party: llave.id }, to: { character: thora } })).toEqual({
      status: 400,
      code: 'HANDWRITTEN_STAYS'
    })
  })

  it('las monedas: pasar sin quedar en negativo; el máster reparte (lo que sobra, al grupo)', async () => {
    await ok200('updateParty', { campaignId, version: 0, coins: { po: 100, pp: 7 } })
    let p = (await ok200('moveCoins', { campaignId, character: thora, toParty: false, coins: { po: 10 } }, ana.cookie))
      .party
    expect(p.coins.po).toBe(90)
    expect(
      await code('moveCoins', { campaignId, character: thora, toParty: true, coins: { po: 11 } }, ana.cookie)
    ).toEqual({
      status: 400,
      code: 'NOT_ENOUGH'
    })
    // Repartir: solo el máster
    expect((await call('splitCoins', { campaignId, characters: [thora, bram] }, ana.cookie)).statusCode).toBe(403)
    const split = await ok200('splitCoins', { campaignId, characters: [thora, bram] })
    expect(split.each).toEqual({ po: 45, pp: 3 })
    expect(split.party.coins).toEqual({ po: 0, pp: 1 })
    const coinsOf = async (characterId: string) =>
      (await ok200('getCharacter', { characterId })).character.play.values.monedas
    expect(await coinsOf(thora)).toEqual({ po: 55, pp: 3 })
    expect(await coinsOf(bram)).toEqual({ po: 45, pp: 3 })
    p = await party(ana.cookie)
    expect(p.version).toBeGreaterThan(1)
  })

  it('muchas a la vez con pocas conexiones: ninguna se queda colgada; la primera fila, una sola', async () => {
    // La primera fila del grupo, pedida a la vez: las dos entran
    const adds = await Promise.all(
      [1, 2, 3].map(() => call('updateParty', { campaignId, add: { name: 'Antorcha' } }, ana.cookie))
    )
    expect(adds.map((r) => r.statusCode)).toEqual([200, 200, 200])
    expect((await party()).items).toHaveLength(3)
    // Más operaciones a la vez que conexiones (4): todas acaban
    await ok200('updateParty', { campaignId, version: (await party()).version, coins: { po: 100 } })
    const moves = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        call('moveCoins', { campaignId, character: i % 2 ? thora : bram, toParty: false, coins: { po: 1 } })
      )
    )
    expect(moves.map((r) => r.statusCode)).toEqual(Array(8).fill(200))
    expect((await party()).coins.po).toBe(92)
    // Y de uno a otro en sentidos contrarios, a la vez: sin interbloqueo
    await ok200('updateParty', { campaignId, add: { key: POCION, quantity: 2 } })
    const pocion = (await party()).items.find((i: { key: string }) => i.key === POCION).id
    await ok200('moveItem', { campaignId, from: { party: pocion }, to: { character: thora }, quantity: 1 })
    await ok200('moveItem', { campaignId, from: { party: pocion }, to: { character: bram }, quantity: 1 })
    const [t1] = await carried(thora)
    const [b1] = await carried(bram)
    const crossed = await Promise.all([
      call('moveItem', { campaignId, from: { character: thora, item: t1?.id }, to: { character: bram } }),
      call('moveItem', { campaignId, from: { character: bram, item: b1?.id }, to: { character: thora } })
    ])
    // Se ordenan: la una tras la otra, y nada se pierde ni se duplica
    expect(crossed.map((r) => r.statusCode)).toEqual([200, 200])
    const count = async (id: string) =>
      (await carried(id)).reduce((n, i) => (i.key === POCION ? n + (i.quantity ?? 1) : n), 0)
    expect((await count(thora)) + (await count(bram))).toBe(2)
  })

  it('los topes, el mismo sitio, lo gastado que viaja, y un personaje de otra campaña', async () => {
    const insert = async (characterId: string, play: object) => {
      const { character } = await ok200('getCharacter', { characterId })
      await ok200('updateCharacter', { characterId, version: character.version, play })
    }
    // Útiles de sanador con usos gastados: van enteros, y vuelven con sus usos gastados
    await insert(thora, {
      items: [{ id: 'v1', key: 'utiles_de_sanador_2024', quantity: 2 }],
      uses: { 'p:v1': { usos: 1 } }
    })
    expect(
      await code(
        'moveItem',
        { campaignId, from: { character: thora, item: 'v1' }, to: { container: 'grupo' }, quantity: 1 },
        ana.cookie
      )
    ).toEqual({ status: 400, code: 'PARTIAL_WITH_USES' })
    const moved = await ok200(
      'moveItem',
      { campaignId, from: { character: thora, item: 'v1' }, to: { container: 'grupo' } },
      ana.cookie
    )
    expect(moved.characters).toEqual([
      expect.objectContaining({ id: thora, play: expect.objectContaining({ items: [] }) })
    ])
    const varita = (await party()).items[0]
    expect(varita.uses).toEqual({ usos: 1 })
    // Al mismo sitio, no
    expect(await code('moveItem', { campaignId, from: { party: varita.id }, to: { container: 'grupo' } })).toEqual({
      status: 400,
      code: 'SAME_PLACE'
    })
    await ok200('moveItem', { campaignId, from: { party: varita.id }, to: { character: bram } })
    const { character } = await ok200('getCharacter', { characterId: bram })
    const back = character.play.items[0]
    expect(character.play.uses[`p:${back.id}`]).toEqual({ usos: 1 })
    expect(
      await code('moveItem', { campaignId, from: { character: bram, item: back.id }, to: { character: bram } })
    ).toEqual({
      status: 400,
      code: 'SAME_PLACE'
    })

    // Lo que lleva no pasa de 100.000 de lo mismo
    await insert(thora, { items: [{ id: 'm1', key: POCION, quantity: 99_999 }] })
    await ok200('updateParty', { campaignId, add: { key: POCION, quantity: 5 } })
    const pila = (await party()).items.find((i: { key: string; uses?: object }) => i.key === POCION && !i.uses).id
    expect(await code('moveItem', { campaignId, from: { party: pila }, to: { character: thora } })).toEqual({
      status: 400,
      code: 'BAD_QUANTITY'
    })
    // Ni las monedas de nadie de 1.000.000.000; una hoja con más, no rompe el grupo
    await ok200('updateParty', { campaignId, version: (await party()).version, coins: { po: 1_000_000_000 } })
    await insert(thora, { values: { monedas: { po: 5 } } })
    expect(await code('moveCoins', { campaignId, character: thora, toParty: true, coins: { po: 5 } })).toEqual({
      status: 400,
      code: 'TOO_MANY_COINS'
    })
    await insert(bram, { values: { monedas: { po: 2_000_000_000 } } })
    expect(
      (await ok200('getParty', { campaignId })).characters.find((c: { id: string }) => c.id === bram).coins
    ).toEqual({ po: 2_000_000_000 })

    // Un personaje de otra campaña, ni para el máster
    const other = (
      await ok200('createCampaign', {
        worldId,
        name: 'Otra',
        system: (await ok200('getCampaign', { campaignId })).campaign.system.id
      })
    ).id
    const stranger = (await ok200('createCharacter', { campaignId: other, name: 'Fuera' })).character.id
    expect(
      (await call('moveCoins', { campaignId, character: stranger, toParty: false, coins: { po: 1 } })).statusCode
    ).toBe(404)
    expect((await call('splitCoins', { campaignId, characters: [stranger] })).statusCode).toBe(404)
    // Repartir: cantidades dichas, y un jugador no puede
    await ok200('updateParty', { campaignId, version: (await party()).version, coins: { po: 10 } })
    expect((await call('splitCoins', { campaignId, characters: [thora] }, ana.cookie)).statusCode).toBe(403)
    const split = await ok200('splitCoins', { campaignId, characters: [thora], amounts: { po: 4 } })
    expect(split.each).toEqual({ po: 4 })
    expect(split.party.coins.po).toBe(6)
    // Borrar un personaje no toca el grupo
    await ok200('deleteCharacter', { characterId: thora })
    expect((await party()).coins.po).toBe(6)
  })
})
