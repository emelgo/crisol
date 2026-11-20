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
const GOBLIN = 'guerrero_goblin_2014'

describe('las criaturas en juego (docs/specs/criaturas.md)', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let master: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let worldId: string
  let campaignId: string
  let five: string

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

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_creatures'), { max: 4 })
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
    five = (await ok200('importSystem', { file: exampleFile('5e') })).system.id
    campaignId = (await ok200('createCampaign', { worldId, name: 'La Marca', system: five })).id
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

  it('poner en juego copias numeradas: con su vida, sus cifras y en orden; las siguientes siguen la cuenta', async () => {
    const put = await ok200('putInPlay', { campaignId, key: GOBLIN, count: 3 })
    expect(put.creatures.map((c: { name: string }) => c.name)).toEqual(['Goblin 1', 'Goblin 2', 'Goblin 3'])
    expect(put.creatures[0]).toMatchObject({
      key: GOBLIN,
      number: 1,
      unique: false,
      type: 'criatura',
      life: { path: 'pg', value: 7, max: 7, temp: 0 },
      stats: [{ key: 'ca', label: 'Clase de armadura', value: '15' }, expect.objectContaining({ key: 'iniciativa' })],
      condition: 'ok'
    })
    const more = await ok200('putInPlay', { campaignId, key: GOBLIN, formula: '2' })
    expect(more.creatures.map((c: { number: number }) => c.number)).toEqual([4, 5])
    const { creatures } = await ok200('listInPlay', { campaignId })
    expect(creatures.map((c: { name: string }) => c.name)).toEqual([
      'Goblin 1',
      'Goblin 2',
      'Goblin 3',
      'Goblin 4',
      'Goblin 5'
    ])
    // Con los PG tirados, cada una los suyos (2d6)
    const rolled = await ok200('putInPlay', { campaignId, key: GOBLIN, count: 4, hp: 'rolled' })
    for (const c of rolled.creatures) {
      expect(c.life.max).toBeGreaterThanOrEqual(2)
      expect(c.life.max).toBeLessThanOrEqual(12)
      expect(c.life.value).toBe(c.life.max)
    }
    // Lo que no es una criatura, o no existe, no
    expect((await code('putInPlay', { campaignId, key: 'espada_larga_2014' })).code).toBe('NOT_A_CREATURE')
    expect((await code('putInPlay', { campaignId, key: 'no_existe' })).status).toBe(404)
  })

  it('una única: la del mundo, una sola por entrada, que guarda su estado', async () => {
    const copy = await ok200('copyContent', { worldId, systemId: five, key: GOBLIN, to: 'world', name: 'Goblin jefe' })
    const [jefe] = (await ok200('putInPlay', { campaignId, key: copy.key, unique: true })).creatures
    expect(jefe).toMatchObject({ name: 'Goblin jefe', number: null, unique: true })
    expect(await code('putInPlay', { campaignId, key: copy.key, unique: true })).toEqual({
      status: 400,
      code: 'UNIQUE_TAKEN'
    })
    // Y además, copias de esa entrada
    const [copia] = (await ok200('putInPlay', { campaignId, key: copy.key })).creatures
    expect(copia).toMatchObject({ name: 'Goblin jefe 1', unique: false })
  })

  it('lo de la partida: daño (malherida y fuera de combate), curación, otro máximo, tirar PG y la versión', async () => {
    const [, two] = (await ok200('putInPlay', { campaignId, key: GOBLIN, count: 2 })).creatures
    const hurt = await ok200('playCreature', { creatureId: two.id, version: two.version, damage: 4 })
    expect(hurt.creature).toMatchObject({ life: { value: 3, max: 7 }, condition: 'bloodied' })
    expect(hurt.state.sheet.pg).toMatchObject({ value: 3, max: 7 })
    expect(await code('playCreature', { creatureId: two.id, version: two.version, damage: 1 })).toEqual({
      status: 400,
      code: 'CREATURE_CHANGED'
    })
    const down = await ok200('playCreature', { creatureId: two.id, version: hurt.creature.version, damage: 10 })
    expect(down.creature).toMatchObject({ life: { value: 0 }, condition: 'down' })
    const bigger = await ok200('playCreature', {
      creatureId: two.id,
      version: down.creature.version,
      max: { value: 20 },
      heal: 15
    })
    expect(bigger.creature.life).toMatchObject({ value: 15, max: 20 })
    const back = await ok200('playCreature', {
      creatureId: two.id,
      version: bigger.creature.version,
      max: { value: null }
    })
    expect(back.creature.life).toMatchObject({ value: 7, max: 7 })
    const reroll = await ok200('playCreature', { creatureId: two.id, version: back.creature.version, rollHp: true })
    expect(reroll.creature.life.value).toBe(reroll.creature.life.max)
    const renamed = await ok200('playCreature', {
      creatureId: two.id,
      version: reroll.creature.version,
      name: 'Tuerto'
    })
    expect(renamed.creature.name).toBe('Tuerto')
  })

  it('tirar por una: su cimitarra a su nombre, oculta de entrada, y su daño', async () => {
    const [one] = (await ok200('putInPlay', { campaignId, key: GOBLIN })).creatures
    const attack = await ok200('rollForCreature', {
      creatureId: one.id,
      action: { item: null, key: 'cimitarra', part: 'attack' }
    })
    expect(attack.roll).toMatchObject({ label: 'Goblin 1 · Cimitarra', visibility: 'hidden' })
    expect(attack.roll.formula).toMatch(/^1d20\+4/)
    const damage = await ok200('rollForCreature', {
      creatureId: one.id,
      action: { item: null, key: 'cimitarra', part: 'damage' },
      visibility: 'all'
    })
    expect(damage.roll).toMatchObject({ label: 'Goblin 1 · Cimitarra · daño', visibility: 'all' })
    const save = await ok200('rollForCreature', { creatureId: one.id, roll: { key: 'salvacion', element: 'des' } })
    expect(save.roll.label).toMatch(/^Goblin 1 · /)
  })

  it('una acción con opciones (ADR-0033): sale en su hoja con cada una armada y se tira la elegida', async () => {
    const beholder = {
      type: 'criatura',
      key: 'contemplador',
      data: { name: { es: 'Contemplador' } },
      mechanics: {
        actions: [
          {
            key: 'rayos',
            label: 'Rayos oculares',
            save: { ability: 'des', dc: '16' },
            count: 2,
            distinct: true,
            pick: '1d2',
            options: [
              { key: 'encanto', label: 'Rayo de encanto', save: { ability: 'sab', dc: '16' } },
              { key: 'enervante', label: 'Rayo enervante', damage: [{ formula: '4d8', type: 'necrotico' }] }
            ]
          }
        ]
      }
    }
    await ok200('putWorldContent', { worldId, systemId: five, items: [beholder] })
    const [one] = (await ok200('putInPlay', { campaignId, key: 'contemplador' })).creatures
    const { state } = await ok200('getInPlay', { creatureId: one.id })
    const rayos = state.actions.find((a: { key: string }) => a.key === 'rayos')
    expect(rayos).toMatchObject({ count: 2, distinct: true, pick: '1d2' })
    expect(rayos.options.map((o: { key: string; save: { dc: number } | null }) => [o.key, o.save?.dc])).toEqual([
      ['encanto', 16],
      ['enervante', 16]
    ])
    const damage = await ok200('rollForCreature', {
      creatureId: one.id,
      action: { item: null, key: 'rayos', part: 'damage', option: 'enervante' }
    })
    expect(damage.roll.label).toBe('Contemplador 1 · Rayos oculares · Rayo enervante · daño')
    expect(damage.roll.formula).toBe('4d8')
    expect(
      (
        await code('rollForCreature', {
          creatureId: one.id,
          action: { item: null, key: 'rayos', part: 'damage', option: 'no' }
        })
      ).status
    ).toBe(400)
  })

  it('sus conjuros (ADR-0033): con su CD, enlazados al compendio, se lanzan y los de N al día gastan y vuelven', async () => {
    const mago = {
      type: 'criatura',
      key: 'mago_oscuro',
      data: { name: { es: 'Mago oscuro' } },
      mechanics: {
        spellcasting: {
          ability: 'int',
          dc: '15',
          attack: '7',
          groups: [{ spells: ['luz'] }, { label: '1/día', uses: 1, spells: ['bola_de_fuego'] }]
        }
      }
    }
    await ok200('putWorldContent', { worldId, systemId: five, items: [mago] })
    const [one] = (await ok200('putInPlay', { campaignId, key: 'mago_oscuro' })).creatures
    const { state } = await ok200('getInPlay', { creatureId: one.id })
    expect(state.spellcasting).toMatchObject({
      dc: 15,
      attack: 7,
      groups: [{ uses: null }, { label: '1/día', uses: 1 }]
    })
    const fireball = state.spellcasting.groups[1].spells[0]
    expect(fireball).toMatchObject({ ref: 'bola_de_fuego', name: 'Bola de fuego', resource: 'conjuro_1_0' })
    expect(fireball.key).toMatch(/^bola_de_fuego_20(14|24)$/)
    expect(state.resources.find((r: { key: string }) => r.key === 'conjuro_1_0')).toMatchObject({
      label: 'Bola de fuego',
      max: 1,
      left: 1,
      recovery: 'long'
    })

    // Lanzarlo: su daño, a nombre de la criatura
    const cast = await ok200('rollForCreature', { creatureId: one.id, spell: { key: fireball.key, part: 'damage' } })
    expect(cast.roll.label).toBe('Mago oscuro 1 · Bola de fuego · daño')
    expect(cast.roll.formula).toBe('8d6')
    // Uno que no es suyo, no
    expect(
      (await code('rollForCreature', { creatureId: one.id, spell: { key: 'espada_larga_2014', part: 'damage' } }))
        .status
    ).toBe(400)

    // Gastar su uso y recuperarlo con un descanso largo
    const spent = await ok200('playCreature', {
      creatureId: one.id,
      version: one.version,
      play: { uses: { '': { conjuro_1_0: 1 } } }
    })
    expect(spent.state.resources.find((r: { key: string }) => r.key === 'conjuro_1_0').left).toBe(0)
    const rested = await ok200('playCreature', { creatureId: one.id, version: spent.creature.version, rest: 'long' })
    expect(rested.state.resources.find((r: { key: string }) => r.key === 'conjuro_1_0').left).toBe(1)
  })

  it('quitar las copias de una entrada (la única se queda) y deshacerlo', async () => {
    await ok200('putInPlay', { campaignId, key: GOBLIN, count: 3 })
    const [unique] = (await ok200('putInPlay', { campaignId, key: GOBLIN, unique: true, name: 'Jefe' })).creatures
    const { removed } = await ok200('removeFromPlay', { campaignId, copiesOf: GOBLIN })
    expect(removed).toHaveLength(3)
    expect((await ok200('listInPlay', { campaignId })).creatures.map((c: { id: string }) => c.id)).toEqual([unique.id])
    const history = await ok200('listHistory', {})
    const entry = history.entries.find((e: { action: string }) => e.action === 'removeFromPlay')
    expect((await ok200('undoOperation', { operationId: entry.id })).status).toBe('undone')
    expect((await ok200('listInPlay', { campaignId })).creatures).toHaveLength(4)
    // Sin copias, la cuenta vuelve a empezar
    await ok200('removeFromPlay', { campaignId, copiesOf: GOBLIN })
    const [again] = (await ok200('putInPlay', { campaignId, key: GOBLIN })).creatures
    expect(again.number).toBe(1)
  })

  it('aplicar una tirada: a varias, con su multiplicador y sus resistencias, y a un personaje', async () => {
    const [one, two] = (await ok200('putInPlay', { campaignId, key: GOBLIN, count: 2 })).creatures
    // Un goblin del mundo que resiste lo cortante
    const [original] = (await ok200('getSystemContent', { systemId: five, keys: [GOBLIN] })).items
    await ok200('putWorldContent', {
      worldId,
      systemId: five,
      items: [
        {
          type: 'criatura',
          key: 'goblin_duro',
          data: { ...original.data, name: 'Goblin duro', resistencias: ['cortante'] }
        }
      ]
    })
    const [hard] = (await ok200('putInPlay', { campaignId, key: 'goblin_duro', unique: true })).creatures
    // Thora, de la jugadora, completa: el máster le aplica el daño
    const thora = (await ok200('createCharacter', { campaignId, name: 'Thora' }, ana.cookie)).character
    const built = await ok200(
      'updateCharacter',
      {
        characterId: thora.id,
        version: 1,
        build: {
          scores: { method: 'matriz', base: { fue: 15, des: 14, con: 13, int: 12, sab: 10, car: 8 } },
          picks: [
            { id: 'c1', step: 'clase', key: 'guerrero_2024', level: 1 },
            { id: 'e1', step: 'especie', key: 'enano_2024' },
            { id: 't1', step: 'trasfondo', key: 'acolito_2024' }
          ]
        }
      },
      ana.cookie
    )
    const thoraMax = built.state.sheet.pg.max as number

    const { roll } = await ok200('rollForCreature', {
      creatureId: one.id,
      action: { item: null, key: 'cimitarra', part: 'damage' }
    })
    expect(roll.apply).toEqual({ kind: 'damage', parts: [{ amount: roll.total, type: 'cortante' }] })
    const { applied } = await ok200('applyRoll', {
      campaignId,
      rollId: roll.id,
      targets: [
        { creatureId: one.id, multiplier: 1 },
        { creatureId: two.id, multiplier: 0.5 },
        { creatureId: hard.id, multiplier: 1 },
        { characterId: thora.id, multiplier: 2 }
      ]
    })
    expect(applied).toEqual([
      {
        id: one.id,
        kind: 'creature',
        name: 'Goblin 1',
        amount: roll.total,
        life: { value: Math.max(0, 7 - roll.total), max: 7 }
      },
      expect.objectContaining({ id: two.id, amount: Math.floor(roll.total / 2) }),
      expect.objectContaining({ id: hard.id, amount: Math.floor(roll.total / 2) }),
      expect.objectContaining({
        id: thora.id,
        kind: 'character',
        name: 'Thora',
        amount: roll.total * 2,
        life: { value: Math.max(0, thoraMax - roll.total * 2), max: thoraMax }
      })
    ])
    // Una tirada sin daño no se aplica; la jugadora no aplica nada
    const attack = await ok200('rollForCreature', {
      creatureId: one.id,
      action: { item: null, key: 'cimitarra', part: 'attack' }
    })
    expect(
      (
        await code('applyRoll', {
          campaignId,
          rollId: attack.roll.id,
          targets: [{ creatureId: two.id, multiplier: 1 }]
        })
      ).code
    ).toBe('NOTHING_TO_APPLY')
    expect(
      (
        await code(
          'applyRoll',
          { campaignId, rollId: roll.id, targets: [{ creatureId: two.id, multiplier: 1 }] },
          ana.cookie
        )
      ).status
    ).toBe(403)
  })

  it('la jugadora no ve la lista del máster ni cambia nada', async () => {
    const [one] = (await ok200('putInPlay', { campaignId, key: GOBLIN })).creatures
    for (const [name, payload] of [
      ['listInPlay', { campaignId }],
      ['getInPlay', { creatureId: one.id }],
      ['putInPlay', { campaignId, key: GOBLIN }],
      ['playCreature', { creatureId: one.id, version: one.version, damage: 1 }],
      ['rollForCreature', { creatureId: one.id, action: { item: null, key: 'cimitarra', part: 'attack' } }],
      ['removeFromPlay', { campaignId, creatureIds: [one.id] }]
    ] as const) {
      const response = await call(name, payload, ana.cookie)
      expect([403, 404], `${name}: ${response.body}`).toContain(response.statusCode)
      expect(response.body).not.toContain('Goblin 1')
    }
  })
})
