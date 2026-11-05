import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

/** Un enano guerrero acólito, con sus características: lo que el 5e pide para terminarlo */
const complete = (klass = 'guerrero_2024', level = 1) => ({
  scores: { method: 'matriz', base: { fue: 15, des: 14, con: 13, int: 12, sab: 10, car: 8 } },
  picks: [
    { id: 'c1', step: 'clase', key: klass, level },
    { id: 'e1', step: 'especie', key: 'enano_2024' },
    { id: 't1', step: 'trasfondo', key: 'acolito_2024' }
  ]
})

describe('los personajes de una campaña', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let master: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let bruno: { userId: string; cookie: string }
  let campaignId: string

  const call = (name: string, payload: object, cookie: string) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const fails = async (name: string, payload: object, cookie: string) => {
    const response = await call(name, payload, cookie)
    return { status: response.statusCode, code: response.json().code as string }
  }
  const join = async (cookie: string) => {
    const url = (await ok200('getInvitation', { campaignId })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie }
    })
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_characters'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY }
    })
    master = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Fateforge' }).returning()
    if (!org) throw new Error('sin organización')
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org.id, userId: master.userId, role: 'owner' })
    const world = await ok200('createWorld', { name: 'Eana' })
    campaignId = (await ok200('createCampaign', { worldId: world.id, name: 'La Marca', system: '5e' })).id
    ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    bruno = await signUpTestUser(auth, { name: 'Bruno', email: 'bruno@crisol.test' })
    await join(ana.cookie)
    await join(bruno.cookie)
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('cada jugador ve los suyos; el máster, todos; lo de otro no existe para quien no puede verlo', async () => {
    const thora = (await ok200('createCharacter', { campaignId, name: 'Thora' }, ana.cookie)).character
    expect(thora).toMatchObject({
      name: 'Thora',
      system: '5e',
      status: 'creating',
      owner: { id: ana.userId, name: 'Ana' },
      build: {},
      play: {},
      version: 1
    })
    const lisandro = (await ok200('createCharacter', { campaignId, name: 'Lisandro' }, bruno.cookie)).character
    const unnamed = (await ok200('createCharacter', { campaignId }, ana.cookie)).character
    expect(unnamed.name).toBe('Sin nombre')

    const names = async (cookie: string) =>
      (await ok200('listCharacters', { campaignId }, cookie)).characters.map((c: { name: string }) => c.name)
    expect(await names(master.cookie)).toEqual(['Thora', 'Lisandro', 'Sin nombre'])
    expect(await names(ana.cookie)).toEqual(['Thora', 'Sin nombre'])
    expect(await names(bruno.cookie)).toEqual(['Lisandro'])

    // Bruno no ve a Thora, ni la cambia, ni la borra, ni ve sus versiones
    expect((await fails('getCharacter', { characterId: thora.id }, bruno.cookie)).status).toBe(404)
    expect(
      (await fails('updateCharacter', { characterId: thora.id, version: 1, name: 'X' }, bruno.cookie)).status
    ).toBe(404)
    expect((await fails('deleteCharacter', { characterId: thora.id }, bruno.cookie)).status).toBe(404)
    expect((await fails('listCharacterVersions', { characterId: thora.id }, bruno.cookie)).status).toBe(404)
    // El máster ve a Lisandro entero
    expect((await ok200('getCharacter', { characterId: lisandro.id })).character.name).toBe('Lisandro')

    // Alguien de fuera: ni la lista
    const stranger = await signUpTestUser(auth, { name: 'Carla', email: 'carla@crisol.test' })
    expect((await fails('listCharacters', { campaignId }, stranger.cookie)).status).toBe(404)
    expect((await fails('getCharacter', { characterId: thora.id }, stranger.cookie)).status).toBe(404)
  })

  it('el máster lo hace para otro miembro y cambia su dueño; un jugador, no; quien no está, no lo juega', async () => {
    const forAna = (await ok200('createCharacter', { campaignId, name: 'Fray Ambrós', ownerId: ana.userId })).character
    expect(forAna.owner).toEqual({ id: ana.userId, name: 'Ana' })
    expect((await fails('createCharacter', { campaignId, ownerId: ana.userId }, bruno.cookie)).status).toBe(403)
    const stranger = await signUpTestUser(auth, { name: 'Carla', email: 'carla@crisol.test' })
    expect((await fails('createCharacter', { campaignId, ownerId: stranger.userId }, master.cookie)).code).toBe(
      'NOT_A_MEMBER'
    )
    const moved = await ok200('updateCharacter', { characterId: forAna.id, version: 1, ownerId: bruno.userId })
    expect(moved.character.owner.name).toBe('Bruno')
    // Bruno, ya su dueño, no se lo pasa a otro
    expect(
      (await fails('updateCharacter', { characterId: forAna.id, version: 2, ownerId: ana.userId }, bruno.cookie)).status
    ).toBe(403)
  })

  it('se cambia con la versión que se leyó; al terminarlo y al confirmar un nivel deja versiones, y se restaura', async () => {
    const created = (await ok200('createCharacter', { campaignId, name: 'Thora' }, ana.cookie)).character
    // Sin lo que pide su sistema, no se termina
    expect(
      (await fails('updateCharacter', { characterId: created.id, version: 1, confirm: 'created' }, ana.cookie)).code
    ).toBe('INCOMPLETE')
    const step = await ok200('updateCharacter', { characterId: created.id, version: 1, build: complete() }, ana.cookie)
    expect(step.character).toMatchObject({ version: 2, summary: { line: 'Enano · Guerrero 1', level: 1 } })
    expect(step.state).toMatchObject({ level: 1, complete: true })
    expect(step.state.steps.map((st: { key: string }) => st.key)).toEqual([
      'clase',
      'especie',
      'trasfondo',
      'caracteristicas',
      'detalles',
      'resumen'
    ])
    expect(step.state.decisions.map((d: { label: string }) => d.label)).toContain('Habilidades')
    expect(
      (await fails('updateCharacter', { characterId: created.id, version: 1, name: 'Otra' }, ana.cookie)).code
    ).toBe('CHARACTER_CHANGED')
    const done = await ok200('updateCharacter', { characterId: created.id, version: 2, confirm: 'created' }, ana.cookie)
    expect(done.character.status).toBe('ready')
    const later = await ok200(
      'updateCharacter',
      {
        characterId: created.id,
        version: 3,
        name: 'Thora Piedrahonda',
        build: complete('guerrero_2024', 2),
        confirm: 'level'
      },
      ana.cookie
    )
    const { versions } = await ok200('listCharacterVersions', { characterId: created.id }, ana.cookie)
    expect(versions.map((v: { kind: string; name: string; level: number }) => [v.kind, v.name, v.level])).toEqual([
      ['level', 'Thora Piedrahonda', 2],
      ['created', 'Thora', 1]
    ])
    const back = await ok200(
      'restoreCharacterVersion',
      { characterId: created.id, versionId: versions[1].id, version: later.character.version },
      ana.cookie
    )
    expect(back.character).toMatchObject({ name: 'Thora', status: 'ready', summary: { level: 1 } })
    expect(back.state.level).toBe(1)
    // Restaurar es un cambio más: el máster lo deshace desde el historial
    const history = await ok200('listHistory', {})
    const restored = history.entries.find((e: { action: string }) => e.action === 'restoreCharacterVersion')
    expect(restored.details).toMatchObject({ name: 'Thora Piedrahonda', kind: 'created' })
    expect((await ok200('undoOperation', { operationId: restored.id })).status).toBe('undone')
    expect((await ok200('getCharacter', { characterId: created.id })).character.name).toBe('Thora Piedrahonda')
  })

  it('borrar uno se lleva sus versiones, y deshacerlo lo devuelve entero', async () => {
    const created = (await ok200('createCharacter', { campaignId, name: 'Thora' }, ana.cookie)).character
    await ok200(
      'updateCharacter',
      { characterId: created.id, version: 1, build: complete(), confirm: 'created' },
      ana.cookie
    )
    await ok200('deleteCharacter', { characterId: created.id }, ana.cookie)
    expect((await fails('getCharacter', { characterId: created.id }, ana.cookie)).status).toBe(404)
    const history = await ok200('listHistory', {})
    const deleted = history.entries.find((e: { action: string }) => e.action === 'deleteCharacter')
    expect((await ok200('undoOperation', { operationId: deleted.id })).status).toBe('undone')
    expect((await ok200('getCharacter', { characterId: created.id }, ana.cookie)).character.status).toBe('ready')
    expect((await ok200('listCharacterVersions', { characterId: created.id }, ana.cookie)).versions).toHaveLength(1)
  })

  it('elegir por partes (la IA): varias cosas de una vez, lo pendiente con sus opciones, y lo que no existe no vale', async () => {
    const created = (await ok200('createCharacter', { campaignId, name: 'Lisandro' }, bruno.cookie)).character
    const chosen = await ok200(
      'chooseForCharacter',
      {
        characterId: created.id,
        version: 1,
        add: [
          { step: 'clase', key: 'picaro_2024', level: 1 },
          { step: 'especie', key: 'humano_2024' },
          { step: 'trasfondo', key: 'criminal_2024' }
        ],
        scores: { method: 'matriz', base: { fue: 8, des: 15, con: 14, int: 12, sab: 10, car: 13 } }
      },
      bruno.cookie
    )
    expect(chosen.state.complete).toBe(true)
    expect(chosen.character.summary.line).toBe('Humano · Pícaro 1')
    const pending = chosen.state.decisions.filter((d: { pending: boolean }) => d.pending)
    const skills = pending.find((d: { label: string }) => d.label === 'Habilidades')
    expect(skills.options.length).toBeGreaterThan(4)
    const decided = await ok200(
      'chooseForCharacter',
      {
        characterId: created.id,
        version: chosen.character.version,
        decisions: { [skills.id]: skills.options.slice(0, skills.count).map((o: { value: string }) => o.value) },
        confirm: 'created'
      },
      bruno.cookie
    )
    expect(decided.character.status).toBe('ready')
    expect(decided.state.decisions.find((d: { id: string }) => d.id === skills.id).pending).toBe(false)
    expect(
      (
        await fails(
          'chooseForCharacter',
          { characterId: created.id, version: decided.character.version, add: [{ step: 'magia', key: 'x' }] },
          bruno.cookie
        )
      ).code
    ).toBe('BAD_CHOICE')
  })

  it('el servidor hace cumplir las reglas: lo que no existe, de otro tipo, repetido, por encima de 20 o sin lo que pide, no', async () => {
    const created = (await ok200('createCharacter', { campaignId, name: 'Thora' }, ana.cookie)).character
    const base = complete('guerrero_2024', 4)
    const saved = await ok200('updateCharacter', { characterId: created.id, version: 1, build: base }, ana.cookie)
    const bad = async (build: unknown) =>
      (await fails('updateCharacter', { characterId: created.id, version: saved.character.version, build }, ana.cookie))
        .code
    expect(
      await bad({ ...base, picks: [...base.picks, { id: 'x', step: 'clase', key: 'no_existe_2024', level: 1 }] })
    ).toBe('BAD_CHOICE')
    expect(await bad({ ...base, picks: [...base.picks, { id: 'x', step: 'clase', key: 'bola_de_fuego_2024' }] })).toBe(
      'BAD_CHOICE'
    )
    expect(
      await bad({ ...base, picks: [...base.picks, { id: 'x', step: 'clase', key: 'guerrero_2024', level: 1 }] })
    ).toBe('BAD_CHOICE')
    expect(await bad({ ...base, picks: base.picks.map((p) => (p.id === 'c1' ? { ...p, level: 25 } : p)) })).toBe(
      'BAD_CHOICE'
    )
    expect(await bad({ ...base, values: { pg_max: 999 } })).toBe('BAD_CHOICE')
    expect(await bad({ ...base, decisions: { 'c1>habilidades': ['volar', 'nadar'] } })).toBe('BAD_CHOICE')
    expect(await bad({ ...base, decisions: { 'c1>habilidades': ['atletismo', 'atletismo'] } })).toBe('BAD_CHOICE')
    expect(await bad({ cualquier: 'cosa' })).toBe('BAD_CHOICE')
    // La multiclase: Inteligencia 12 no llega para el mago (con la elección por partes, igual)
    expect(await bad({ ...base, picks: [...base.picks, { id: 'm', step: 'clase', key: 'mago_2024', level: 1 }] })).toBe(
      'BAD_CHOICE'
    )
    expect(
      (
        await fails(
          'chooseForCharacter',
          { characterId: created.id, version: saved.character.version, add: [{ step: 'clase', key: 'mago_2024' }] },
          ana.cookie
        )
      ).code
    ).toBe('BAD_CHOICE')
    // Con Inteligencia 13, sí
    const smarter = { ...base, scores: { method: 'mano', base: { ...base.scores.base, int: 13 } } }
    const ready = await ok200(
      'updateCharacter',
      { characterId: created.id, version: saved.character.version, build: smarter },
      ana.cookie
    )
    const multi = await ok200(
      'chooseForCharacter',
      { characterId: created.id, version: ready.character.version, add: [{ step: 'clase', key: 'mago_2024' }] },
      ana.cookie
    )
    expect(multi.character.summary.line).toBe('Enano · Guerrero 4 · Mago 1')
  })

  it('otro jugador no elige ni restaura en un personaje que no es suyo', async () => {
    const created = (await ok200('createCharacter', { campaignId, name: 'Thora' }, ana.cookie)).character
    const done = await ok200(
      'updateCharacter',
      { characterId: created.id, version: 1, build: complete(), confirm: 'created' },
      ana.cookie
    )
    const { versions } = await ok200('listCharacterVersions', { characterId: created.id }, ana.cookie)
    expect(
      (
        await fails(
          'chooseForCharacter',
          { characterId: created.id, version: done.character.version, values: { notas: 'mío' } },
          bruno.cookie
        )
      ).status
    ).toBe(404)
    expect(
      (
        await fails(
          'restoreCharacterVersion',
          { characterId: created.id, versionId: versions[0].id, version: done.character.version },
          bruno.cookie
        )
      ).status
    ).toBe(404)
  })

  it('tirar por un personaje: una tirada de su sistema y un ataque con lo que lleva, a su registro', async () => {
    const created = (await ok200('createCharacter', { campaignId, name: 'Thora' }, ana.cookie)).character
    const saved = await ok200(
      'updateCharacter',
      {
        characterId: created.id,
        version: 1,
        build: complete(),
        play: { items: [{ id: 'e1', key: 'espada_larga_2024', equipped: true }] }
      },
      ana.cookie
    )
    expect(saved.state.carried).toMatchObject([{ id: 'e1', name: 'Espada larga', type: 'arma', equipped: true }])
    expect(saved.state.rolls.map((r: { key: string }) => r.key)).toEqual(
      expect.arrayContaining(['habilidad', 'ataque'])
    )
    const athletics = await ok200(
      'rollForCharacter',
      { characterId: created.id, roll: { key: 'habilidad', element: 'atletismo' } },
      ana.cookie
    )
    expect(athletics.roll.label).toMatch(/^Thora · .*Atletismo/)
    expect(athletics.roll.formula).toMatch(/^1d20/)
    const attack = await ok200(
      'rollForCharacter',
      { characterId: created.id, roll: { key: 'ataque', element: 'p:e1' }, visibility: 'self' },
      ana.cookie
    )
    expect(attack.roll).toMatchObject({ visibility: 'self', label: expect.stringContaining('Espada larga') })
    const { rolls } = await ok200('listRolls', { campaignId })
    expect(rolls.map((r: { label: string }) => r.label)).toEqual(expect.arrayContaining([athletics.roll.label]))
    // Lo que no vale: oculta (jugadora), una tirada que no existe, otra persona
    expect(
      (
        await fails(
          'rollForCharacter',
          { characterId: created.id, roll: { key: 'habilidad', element: 'atletismo' }, visibility: 'hidden' },
          ana.cookie
        )
      ).code
    ).toBe('VISIBILITY_NOT_ALLOWED')
    expect((await fails('rollForCharacter', { characterId: created.id, roll: { key: 'nada' } }, ana.cookie)).code).toBe(
      'BAD_ROLL'
    )
    expect(
      (await fails('rollForCharacter', { characterId: created.id, roll: { key: 'iniciativa' } }, bruno.cookie)).status
    ).toBe(404)
    // Lo de la partida: algo que no está en el contenido no se añade
    expect(
      (
        await fails(
          'updateCharacter',
          {
            characterId: created.id,
            version: saved.character.version,
            play: { items: [{ id: 'x', key: 'nada_2024' }] }
          },
          ana.cookie
        )
      ).code
    ).toBe('BAD_PLAY')
  })

  it('lo de la partida (la IA): daño, curación, gastar usos y descansar, con su estado', async () => {
    const created = (await ok200('createCharacter', { campaignId, name: 'Thora' }, ana.cookie)).character
    const ready = await ok200(
      'updateCharacter',
      { characterId: created.id, version: 1, build: complete('barbaro_2024', 2) },
      ana.cookie
    )
    const max = ready.state.sheet.pg.max as number
    expect(ready.state.sheet.pg.value).toBe(max)
    const hurt = await ok200(
      'playCharacter',
      { characterId: created.id, version: ready.character.version, damage: 5, temp: 3 },
      ana.cookie
    )
    expect(hurt.state.sheet.pg).toMatchObject({ value: max - 5, temp: 3 })
    const rage = hurt.state.resources.find((r: { key: string }) => r.key === 'furias')
    const raged = await ok200(
      'playCharacter',
      { characterId: created.id, version: hurt.character.version, spend: { item: rage.item, key: 'furias', by: 1 } },
      ana.cookie
    )
    expect(raged.state.resources.find((r: { key: string }) => r.key === 'furias').used).toBe(1)
    const rested = await ok200(
      'playCharacter',
      { characterId: created.id, version: raged.character.version, rest: 'long' },
      ana.cookie
    )
    expect(rested.state.sheet.pg.value).toBe(max)
    expect(rested.state.resources.find((r: { key: string }) => r.key === 'furias').used).toBe(0)
    expect(
      (
        await fails(
          'playCharacter',
          { characterId: created.id, version: rested.character.version, resource: 'nada', damage: 1 },
          ana.cookie
        )
      ).code
    ).toBe('BAD_PLAY')
    expect(
      (
        await fails(
          'playCharacter',
          { characterId: created.id, version: rested.character.version, rest: 'long' },
          bruno.cookie
        )
      ).status
    ).toBe(404)
  })

  it('una campaña sin sistema no tiene personajes', async () => {
    const world = (await ok200('listWorlds', {})).worlds[0]
    const none = await ok200('createCampaign', { worldId: world.id, name: 'Sin reglas' })
    expect((await fails('createCharacter', { campaignId: none.id }, master.cookie)).code).toBe('NO_SYSTEM')
  })
})
