import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connect } from '../client.ts'
import { user } from '../schema/auth.ts'
import { organizationMembers, organizations } from '../schema/organizations.ts'
import { freshTestDatabase, resetDatabase } from '../testing.ts'
import * as campaignsRepo from './campaigns.ts'
import * as diceRepo from './dice.ts'
import * as worldsRepo from './worlds.ts'

describe('las tiradas', () => {
  let conn: ReturnType<typeof connect>
  let worldId: string
  let campaignId: string
  let otherCampaignId: string

  const roll = (overrides: Partial<Parameters<typeof diceRepo.insertRoll>[2]> = {}, limit = 60) =>
    diceRepo.insertRoll(conn.db, limit, {
      campaignId,
      worldId,
      userId: 'u1',
      ai: false,
      formula: '1d20+5',
      label: 'Ataque',
      visibility: 'all',
      result: {
        total: 19,
        detail: '1d20+5 → [14] + 5 = 19',
        critical: null,
        dice: [{ sides: 20, value: 14, kept: true }]
      },
      ...overrides
    })

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_db_dice'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    await conn.db.insert(user).values([
      { id: 'u1', name: 'Enrique', email: 'e@crisol.test', diceColor: '#3a7bd5' },
      { id: 'u2', name: 'Ana', email: 'a@crisol.test' }
    ])
    const [org] = await conn.db.insert(organizations).values({ name: 'Fateforge' }).returning()
    const organizationId = org?.id ?? ''
    await conn.db.insert(organizationMembers).values({ organizationId, userId: 'u1', role: 'owner' })
    const ui = (action: string) => ({ organizationId, actorId: 'u1', via: 'ui' as const, action })
    const world = await worldsRepo.createWorldWithMaster(conn.db, ui('createWorld'), {
      organizationId,
      name: 'Eana',
      masterId: 'u1'
    })
    worldId = world.id
    const invitation = () => ({ tokenHash: crypto.randomUUID(), secretSealed: 'v1.cifrado' })
    const campaign = (name: string) =>
      campaignsRepo.createCampaignWithMaster(conn.db, ui('createCampaign'), {
        worldId,
        name,
        masterId: 'u1',
        invitation: invitation()
      })
    campaignId = (await campaign('La Marca')).id
    otherCampaignId = (await campaign('El Norte')).id
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('se guarda ya resuelta y se lee con el nombre y el color de quien tira', async () => {
    const saved = await roll()
    expect(saved).toMatchObject({
      campaignId,
      userId: 'u1',
      name: 'Enrique',
      color: '#3a7bd5',
      ai: false,
      formula: '1d20+5',
      label: 'Ataque',
      visibility: 'all',
      result: { total: 19 }
    })
    expect(saved?.createdAt).toBeInstanceOf(Date)
    const { rolls } = await diceRepo.listRolls(conn.db, { campaignId, viewerId: 'u1', master: true })
    expect(rolls.map((r) => [r.id, r.name, r.color])).toEqual([[saved?.id, 'Enrique', '#3a7bd5']])
  })

  it('pasado el límite del último minuto no se guarda; las de hace más de un minuto no cuentan', async () => {
    expect(await roll({}, 2)).not.toBeNull()
    expect(await roll({}, 2)).not.toBeNull()
    expect(await roll({}, 2)).toBeNull()
    // Las de otra persona no le cuentan
    expect(await roll({ userId: 'u2' }, 2)).not.toBeNull()
    await conn.db.execute(sql`update dice_rolls set created_at = now() - interval '2 minutes' where user_id = 'u1'`)
    expect(await roll({}, 2)).not.toBeNull()
  })

  it('a la vez, no se cuelan más que las del límite', async () => {
    const done = await Promise.all(Array.from({ length: 8 }, () => roll({}, 5)))
    expect(done.filter((r) => r !== null)).toHaveLength(5)
  })

  it('el máster las ve todas; los demás, las de todos y las suyas', async () => {
    await roll({ visibility: 'all', label: 'Pública' })
    await roll({ visibility: 'hidden', label: 'Oculta' })
    await roll({ userId: 'u2', visibility: 'self', label: 'De Ana' })
    await roll({ userId: 'u2', visibility: 'master', label: 'Al máster' })
    const labels = async (viewerId: string, master: boolean) =>
      (await diceRepo.listRolls(conn.db, { campaignId, viewerId, master })).rolls.map((r) => r.label)
    expect(await labels('u1', true)).toEqual(['Pública', 'Oculta', 'De Ana', 'Al máster'])
    expect(await labels('u2', false)).toEqual(['Pública', 'De Ana', 'Al máster'])
  })

  it('de 50 en 50 hacia atrás; el cursor solo vale en su campaña', async () => {
    for (let i = 1; i <= 52; i++) await roll({ label: `T${i}` })
    const elsewhere = await roll({ campaignId: otherCampaignId, label: 'Fuera' })
    const first = await diceRepo.listRolls(conn.db, { campaignId, viewerId: 'u1', master: true })
    expect(first.rolls).toHaveLength(diceRepo.ROLLS_PAGE)
    expect(first.rolls[0]?.label).toBe('T3')
    expect(first.rolls.at(-1)?.label).toBe('T52')
    const second = await diceRepo.listRolls(conn.db, {
      campaignId,
      viewerId: 'u1',
      master: true,
      before: first.next ?? undefined
    })
    expect(second.rolls.map((r) => r.label)).toEqual(['T1', 'T2'])
    expect(second.next).toBeNull()
    // Un id de otra campaña no sirve de cursor: como si no se diera
    const wrong = await diceRepo.listRolls(conn.db, { campaignId, viewerId: 'u1', master: true, before: elsewhere?.id })
    expect(wrong.rolls.at(-1)?.label).toBe('T52')
  })
})
