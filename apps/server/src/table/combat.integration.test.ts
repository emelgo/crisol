import type { TableServerMessage } from '@crisol/contracts'
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { exampleFile } from '@crisol/systems/examples'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined
const GOBLIN = 'guerrero_goblin_2014'
type WebSocket = Awaited<ReturnType<FastifyInstance['injectWS']>>
type Combatant = {
  id: string
  name: string
  kind: string
  actorId: string
  tokenId: string | null
  initiative: number | null
  modifier: number | null
  group: string | null
  active: boolean
  defeated: boolean
  conditions: Array<{ id: string; name: string; rounds?: number }>
}
type Combat = {
  id: string
  round: number
  turnId: string | null
  initiativeRoll: string | null
  combatants: Combatant[]
}

/** Los mensajes de una conexión; next() espera al siguiente del tipo que se pida (los demás se saltan) */
function inbox(ws: WebSocket) {
  const queued: TableServerMessage[] = []
  const waiters: Array<(m: TableServerMessage) => void> = []
  ws.on('message', (data: Buffer) => {
    const message = JSON.parse(String(data)) as TableServerMessage
    const waiter = waiters.shift()
    if (waiter) waiter(message)
    else queued.push(message)
  })
  const one = () =>
    new Promise<TableServerMessage>((resolve, reject) => {
      const first = queued.shift()
      if (first) return resolve(first)
      const timer = setTimeout(() => reject(new Error('No llegó ningún mensaje')), 2000)
      waiters.push((m) => {
        clearTimeout(timer)
        resolve(m)
      })
    })
  return {
    async next<T extends TableServerMessage['type']>(type: T): Promise<Extract<TableServerMessage, { type: T }>> {
      for (;;) {
        const message = await one()
        if (message.type === type) return message as Extract<TableServerMessage, { type: T }>
      }
    }
  }
}

describe('el combate de la mesa (docs/specs/combate.md)', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let master: { userId: string; cookie: string }
  let worldId: string
  let campaignId: string
  let sceneId: string
  let systemId: string
  const sockets: WebSocket[] = []

  const call = (name: string, payload: object, cookie = master.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const code = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    return { status: response.statusCode, code: response.json().code }
  }
  const combat = async (): Promise<Combat> => (await ok200('getCombat', { campaignId })).combat
  const byName = (view: Combat, name: string) => {
    const found = view.combatants.find((c) => c.name === name)
    if (!found) throw new Error(`no está ${name}`)
    return found
  }
  const lastOperation = async () => {
    const history = await ok200('listHistory', { worldId })
    return history.operations?.[0] ?? history.entries?.[0]
  }
  /** Una criatura con una recarga y acciones legendarias, en el compendio del mundo (como el goblin, pero suya) */
  const dragon = async () => {
    const goblin = exampleFile('5e').content.find((c) => c.key === GOBLIN)
    if (!goblin) throw new Error('sin goblin')
    await ok200('putWorldContent', {
      worldId,
      systemId,
      items: [
        {
          type: 'criatura',
          key: 'dragoncillo',
          concept: 'dragoncillo',
          data: { ...goblin.data, name: { es: 'Dragoncillo', en: 'Wyrmling' } },
          mechanics: {
            resources: [{ key: 'legendarias', label: 'Acciones legendarias', max: '3', recovery: 'other' }],
            actions: [
              {
                key: 'aliento',
                label: 'Aliento de fuego',
                recharge: '5-6',
                save: { ability: 'des', dc: '12' },
                damage: [{ formula: '4d6', type: 'fuego' }]
              },
              { key: 'cola', label: 'Coletazo', activation: 'legendary', uses: 'legendarias', cost: 1, attack: '4' }
            ]
          }
        }
      ]
    })
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_combat'), { max: 4 })
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
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Mesa' }).returning()
    if (!org) throw new Error('sin organización')
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org.id, userId: master.userId, role: 'owner' })
    worldId = (await ok200('createWorld', { name: 'Valdren' })).id
    systemId = (await ok200('importSystem', { file: exampleFile('5e') })).system.id
    campaignId = (await ok200('createCampaign', { worldId, name: 'La Marca', system: systemId })).id
    const pageId = (await ok200('createPage', { worldId, title: 'Cripta de Varn' })).id
    const tab = await ok200('createPageTab', { pageId, kind: 'scene' })
    sceneId = (await ok200('getScene', { tabId: tab.id })).id
    await ok200('updateScene', { sceneId, grid: { size: 100, offsetX: 0, offsetY: 0 } })
    await ok200('openScene', { campaignId, sceneId })
  })

  afterEach(async () => {
    for (const ws of sockets.splice(0)) ws.terminate()
    await app.close()
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('el encuentro de goblins: tirar con la tirada del sistema, pasar dos rondas y que un estado de una ronda se vaya solo', async () => {
    const encounter = await ok200('saveEncounter', {
      worldId,
      systemId,
      name: 'Emboscada',
      members: [
        {
          key: GOBLIN,
          unique: false,
          at: [
            { dx: 0, dy: 0 },
            { dx: 1, dy: 0 },
            { dx: 2, dy: 0 }
          ]
        }
      ]
    })
    await ok200('placeEncounter', { campaignId, sceneId, encounterId: encounter.id, column: 1, row: 1 })
    const thora = (await ok200('createCharacter', { campaignId, name: 'Thora' })).character
    await ok200('placeTokens', { campaignId, sceneId, tokens: [{ characterId: thora.id, column: 5, row: 5 }] })

    const started: Combat = await ok200('startCombat', { campaignId })
    expect(started).toMatchObject({ round: 0, turnId: null, initiativeRoll: 'Iniciativa' })
    expect(started.combatants.map((c) => c.name).sort()).toEqual(['Goblin 1', 'Goblin 2', 'Goblin 3', 'Thora'])
    // Las copias, en un grupo; cada una con su ficha
    const goblins = started.combatants.filter((c) => c.kind === 'creature')
    expect(new Set(goblins.map((c) => c.group))).toEqual(new Set([GOBLIN]))
    expect(goblins.every((c) => c.tokenId)).toBe(true)
    expect((await code('startCombat', { campaignId })).code).toBe('COMBAT_RUNNING')

    // Las criaturas: una tirada para el grupo, con la fórmula del sistema (1d20 + 2 del goblin), oculta en el registro
    const rolled = await ok200('rollInitiative', { campaignId, who: 'creatures' })
    expect(rolled.failed).toEqual([])
    expect(rolled.rolls).toHaveLength(1)
    expect(rolled.rolls[0].combatantIds).toHaveLength(3)
    const total = rolled.rolls[0].total as number
    expect(total).toBeGreaterThanOrEqual(3)
    expect(total).toBeLessThanOrEqual(22)
    for (const goblin of (rolled.combat as Combat).combatants.filter((c) => c.kind === 'creature'))
      expect(goblin).toMatchObject({ initiative: total, modifier: 2 })
    const log = (await ok200('listRolls', { campaignId })).rolls
    const initiativeRoll = log.find((r: { id: string }) => r.id === rolled.rolls[0].rollId)
    expect(initiativeRoll).toMatchObject({ visibility: 'hidden', label: 'Goblin 1 · Iniciativa' })
    expect(initiativeRoll.formula).toMatch(/^1d20/)
    // La de Thora la dice su jugadora: se escribe
    await ok200('setInitiative', { campaignId, values: [{ combatantId: byName(started, 'Thora').id, initiative: 30 }] })

    // Goblin 1, derribado una ronda
    const goblin1 = byName(started, 'Goblin 1')
    const fresh = (await ok200('getInPlay', { creatureId: goblin1.actorId })).creature
    await ok200('playCreature', {
      creatureId: goblin1.actorId,
      version: fresh.version,
      condition: { add: { name: 'Derribado', rounds: 1 } }
    })

    // Ronda 1: Thora y luego los goblins (un turno para los tres): al empezar el suyo, el estado se va
    const first = await ok200('nextTurn', { campaignId })
    expect(first.combat).toMatchObject({ round: 1 })
    expect(first.started.names).toEqual(['Thora'])
    expect(byName(first.combat, 'Thora').active).toBe(true)
    const second = await ok200('nextTurn', { campaignId })
    expect(second.started.names).toEqual(['Goblin 1', 'Goblin 2', 'Goblin 3'])
    expect(second.started.expired).toEqual([{ name: 'Goblin 1', condition: 'Derribado' }])
    expect(byName(second.combat, 'Goblin 1').conditions).toEqual([])
    expect(second.combat.combatants.filter((c: Combatant) => c.active)).toHaveLength(3)
    // Ronda 2
    const third = await ok200('nextTurn', { campaignId })
    expect(third.combat).toMatchObject({ round: 2, turnId: byName(started, 'Thora').id })
    await ok200('nextTurn', { campaignId })
    const back = await ok200('previousTurn', { campaignId })
    expect(back).toMatchObject({ round: 2, turnId: byName(started, 'Thora').id })

    // Hacia atrás, hasta el turno de los goblins de la ronda 1 (sin caducar nada)
    await ok200('previousTurn', { campaignId })
    const view = await combat()
    expect(view).toMatchObject({ round: 1, turnId: second.combat.turnId })
  })

  it('deshacer el paso de turno devuelve el estado que caducó', async () => {
    const goblin = (await ok200('putInPlay', { campaignId, key: GOBLIN, count: 1 })).creatures[0]
    await ok200('placeTokens', { campaignId, sceneId, tokens: [{ creatureId: goblin.id, x: 50, y: 50 }] })
    await ok200('startCombat', { campaignId })
    await ok200('playCreature', {
      creatureId: goblin.id,
      version: goblin.version,
      condition: { add: { name: 'Aturdido', rounds: 1 } }
    })
    const next = await ok200('nextTurn', { campaignId })
    expect(next.started.expired).toEqual([{ name: 'Goblin 1', condition: 'Aturdido' }])
    await ok200('undoOperation', { operationId: (await lastOperation()).id })
    const view = await combat()
    expect(view.round).toBe(0)
    expect(view.combatants[0]?.conditions.map((c) => c.name)).toEqual(['Aturdido'])
  })

  it('salta a quien está a 0; acabar quita las copias a 0 con sus fichas, y deshacerlo lo devuelve todo', async () => {
    const placed = (
      await ok200('placeTokens', { campaignId, sceneId, tokens: [{ content: { key: GOBLIN, count: 3 }, x: 0, y: 0 }] })
    ).tokens
    const started: Combat = await ok200('startCombat', { campaignId })
    const [g1, g2, g3] = ['Goblin 1', 'Goblin 2', 'Goblin 3'].map((n) => byName(started, n))
    if (!g1 || !g2 || !g3) throw new Error('faltan goblins')
    // El 1, aparte y primero; los otros dos, juntos
    await ok200('groupCombatants', { campaignId, combatantIds: [g1.id], together: false })
    await ok200('setInitiative', {
      campaignId,
      values: [
        { combatantId: g1.id, initiative: 20 },
        { combatantId: g2.id, initiative: 10 }
      ]
    })
    const creature = placed[0].actor
    await ok200('playCreature', { creatureId: creature.id, version: creature.version, damage: 100 })
    expect(byName(await combat(), 'Goblin 1').defeated).toBe(true)
    const next = await ok200('nextTurn', { campaignId })
    expect(next.started.names).toEqual(['Goblin 2', 'Goblin 3'])
    expect(byName(next.combat, 'Goblin 3').initiative).toBe(10)

    expect(await ok200('endCombat', { campaignId })).toEqual({ removed: [g1.actorId] })
    expect(await combat()).toBeNull()
    expect((await ok200('listInPlay', { campaignId })).creatures).toHaveLength(2)
    expect((await ok200('getCampaignTable', { campaignId })).tokens).toHaveLength(2)

    await ok200('undoOperation', { operationId: (await lastOperation()).id })
    const back = await combat()
    expect(back.combatants).toHaveLength(3)
    expect(back.round).toBe(1)
    expect((await ok200('listInPlay', { campaignId })).creatures).toHaveLength(3)
    expect((await ok200('getCampaignTable', { campaignId })).tokens).toHaveLength(3)
    // Todas las copias, también las que siguen en pie
    expect((await ok200('endCombat', { campaignId, remove: 'generic' })).removed).toHaveLength(3)
  })

  it('al empezar su turno se tiran sus recargas gastadas y se reponen sus legendarias', async () => {
    await dragon()
    const wyrm = (await ok200('putInPlay', { campaignId, key: 'dragoncillo', unique: true })).creatures[0]
    await ok200('placeTokens', { campaignId, sceneId, tokens: [{ creatureId: wyrm.id, x: 50, y: 50 }] })
    // Usar el aliento lo deja gastado; gasta dos legendarias
    await ok200('rollForCreature', {
      creatureId: wyrm.id,
      action: { item: null, key: 'aliento', part: 'damage' }
    })
    let now = (await ok200('getInPlay', { creatureId: wyrm.id })).creature
    expect(now.play.uses).toEqual({ '': { 'recarga:aliento': 1 } })
    now = (
      await ok200('playCreature', {
        creatureId: wyrm.id,
        version: now.version,
        spend: { item: null, key: 'legendarias', by: 2 }
      })
    ).creature
    expect(now.play.uses).toEqual({ '': { 'recarga:aliento': 1, legendarias: 2 } })

    await ok200('startCombat', { campaignId })
    const next = await ok200('nextTurn', { campaignId })
    expect(next.started.restored).toEqual([{ name: 'Dragoncillo', resource: 'Acciones legendarias' }])
    const after = (await ok200('getInPlay', { creatureId: wyrm.id })).creature
    // Con un 5 o un 6 se recarga; si no, sigue gastada
    if (next.started.recharged.length > 0) {
      expect(next.started.recharged).toEqual([{ name: 'Dragoncillo', action: 'Aliento de fuego' }])
      expect(after.play.uses).toEqual({})
    } else expect(after.play.uses).toEqual({ '': { 'recarga:aliento': 1 } })
    // Recargarla a mano
    if (next.started.recharged.length === 0) {
      const recharged = await ok200('playCreature', {
        creatureId: wyrm.id,
        version: after.version,
        spend: { item: null, key: 'aliento', by: -1 }
      })
      expect(recharged.creature.play.uses).toEqual({})
    }
  })

  it('la pantalla ve la franja de turnos sin las ocultas ni la iniciativa de las criaturas', async () => {
    await ok200('presentScene', { campaignId })
    // Sin muros, la escena va «sin visión automática»: la pantalla ve lo que se destapa a mano (docs/specs/vision.md)
    await ok200('changeFog', {
      campaignId,
      mode: 'reveal',
      shape: 'rectangle',
      x: -500,
      y: -500,
      width: 20_000,
      height: 20_000
    })
    const thora = (await ok200('createCharacter', { campaignId, name: 'Thora' })).character
    const placed = (
      await ok200('placeTokens', {
        campaignId,
        sceneId,
        tokens: [
          { content: { key: GOBLIN, count: 2 }, x: 0, y: 0 },
          { characterId: thora.id, x: 500, y: 500 }
        ]
      })
    ).tokens
    await ok200('updateToken', { tokenId: placed[1].id, hidden: true })
    const started: Combat = await ok200('startCombat', { campaignId })
    await ok200('groupCombatants', {
      campaignId,
      combatantIds: started.combatants.filter((c) => c.kind === 'creature').map((c) => c.id),
      together: false
    })
    await ok200('setInitiative', {
      campaignId,
      values: started.combatants.map((c, i) => ({ combatantId: c.id, initiative: c.kind === 'character' ? 30 : i }))
    })
    const ws = await app.injectWS('/api/table', { headers: { origin: BASE_URL, cookie: master.cookie } })
    sockets.push(ws)
    const box = inbox(ws)
    ws.send(JSON.stringify({ type: 'join', campaignId, view: 'screen' }))
    const first = (await box.next('screen')).screen
    expect(first.combat?.round).toBe(0)
    expect(first.combat?.combatants.map((c) => c.name).sort()).toEqual(['Goblin 1', 'Thora'])
    const goblin = first.combat?.combatants.find((c) => c.kind === 'creature')
    expect(goblin?.initiative).toBeNull()
    expect(first.combat?.combatants.find((c) => c.kind === 'character')?.initiative).toEqual(expect.any(Number))
    expect(JSON.stringify(first.combat)).not.toMatch(/"life"|"modifier"|"Goblin 2"/)

    await ok200('nextTurn', { campaignId })
    const turned = (await box.next('screen')).screen
    expect(turned.combat?.round).toBe(1)
    // La de mayor iniciativa es Thora: su turno se ve
    expect(turned.combat?.combatants.find((c) => c.active)?.name).toBe('Thora')
    await ok200('hideScreen', { campaignId, hidden: true })
    expect((await box.next('screen')).screen.combat).toBeNull()
  })

  it('sin tirada de iniciativa en el sistema, se escribe a mano', async () => {
    const empty = (await ok200('createSystem', { name: 'Sin tiradas', from: 'blank' })).id
    const blank = (await ok200('createCampaign', { worldId, name: 'Sin reglas', system: empty })).id
    await ok200('openScene', { campaignId: blank, sceneId })
    const lia = (await ok200('createCharacter', { campaignId: blank, name: 'Lía' })).character
    await ok200('placeTokens', { campaignId: blank, sceneId, tokens: [{ characterId: lia.id, x: 0, y: 0 }] })
    const started: Combat = await ok200('startCombat', { campaignId: blank })
    expect(started.initiativeRoll).toBeNull()
    expect((await code('rollInitiative', { campaignId: blank })).code).toBe('NO_INITIATIVE_ROLL')
    const written = await ok200('setInitiative', {
      campaignId: blank,
      values: [{ combatantId: started.combatants[0]?.id, initiative: 17 }]
    })
    expect(written.combatants[0].initiative).toBe(17)
  })

  it('un jugador no empieza, ni ve, ni pasa turnos', async () => {
    const ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    const url = (await ok200('getInvitation', { campaignId })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: ana.cookie }
    })
    await ok200('placeTokens', { campaignId, sceneId, tokens: [{ content: { key: GOBLIN }, x: 0, y: 0 }] })
    expect((await code('startCombat', { campaignId }, ana.cookie)).status).toBe(403)
    const started: Combat = await ok200('startCombat', { campaignId })
    for (const [name, payload] of [
      ['getCombat', { campaignId }],
      ['nextTurn', { campaignId }],
      ['rollInitiative', { campaignId }],
      ['setInitiative', { campaignId, values: [{ combatantId: started.combatants[0]?.id, initiative: 1 }] }],
      ['endCombat', { campaignId }]
    ] as const)
      expect((await code(name, payload, ana.cookie)).status, name).toBe(403)
    expect((await combat()).round).toBe(0)
  })
})
