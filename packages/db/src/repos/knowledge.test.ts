import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connect } from '../client.ts'
import { user } from '../schema/auth.ts'
import { characters } from '../schema/characters.ts'
import { operations } from '../schema/history.ts'
import { organizationMembers, organizations } from '../schema/organizations.ts'
import { freshTestDatabase, resetDatabase } from '../testing.ts'
import * as campaignsRepo from './campaigns.ts'
import * as knowledgeRepo from './knowledge.ts'
import * as pagesRepo from './pages.ts'
import * as undoRepo from './undo.ts'
import * as worldsRepo from './worlds.ts'

const prepared = () => ({ tokenHash: crypto.randomUUID(), secretSealed: 'v1.cifrado' })

describe('lo que sabe cada campaña', () => {
  let conn: ReturnType<typeof connect>
  let organizationId: string
  let worldId: string
  let campaignId: string
  const ui = (action: string) => ({ organizationId, worldId, actorId: 'u1', via: 'ui' as const, action })

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_db_knowledge'), { max: 2 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    await conn.db.insert(user).values([{ id: 'u1', name: 'Enrique', email: 'e@crisol.test' }])
    const [org] = await conn.db.insert(organizations).values({ name: 'Valdren' }).returning()
    organizationId = org?.id ?? ''
    await conn.db.insert(organizationMembers).values({ organizationId, userId: 'u1', role: 'owner' })
    const world = await worldsRepo.createWorldWithMaster(conn.db, ui('createWorld'), {
      organizationId,
      name: 'Valdren',
      masterId: 'u1'
    })
    worldId = world.id
    const campaign = await campaignsRepo.createCampaignWithMaster(conn.db, ui('createCampaign'), {
      worldId,
      name: 'La Marca',
      masterId: 'u1',
      invitation: prepared()
    })
    campaignId = campaign.id
  })

  afterAll(async () => {
    await conn?.close()
  })

  const mark = (change: Partial<knowledgeRepo.MarkChange>) =>
    knowledgeRepo.setMark(conn.db, ui('setKnowledge'), {
      worldId,
      campaignId,
      kind: 'page',
      targetId: 'p1',
      known: true,
      characters: null,
      ...change
    })

  it('poner, cambiar y quitar una marca', async () => {
    await mark({})
    expect(await knowledgeRepo.listMarks(conn.db, { worldId, campaignIds: [campaignId] })).toEqual([
      { campaignId, kind: 'page', targetId: 'p1', known: true, characters: null }
    ])
    const lia = crypto.randomUUID()
    await mark({ characters: [lia, lia] })
    expect((await knowledgeRepo.listMarks(conn.db, { worldId, campaignIds: [campaignId] }))[0]?.characters).toEqual([
      lia
    ])
    await mark({ known: null })
    expect(await knowledgeRepo.listMarks(conn.db, { worldId, campaignIds: [campaignId] })).toEqual([])
  })

  it('en el mundo y en «no la conocen», el público no se guarda', async () => {
    await mark({ campaignId: null, characters: [crypto.randomUUID()] })
    await mark({ targetId: 'p2', known: false, characters: [crypto.randomUUID()] })
    const marks = await knowledgeRepo.listMarks(conn.db, { worldId, campaignIds: [campaignId] })
    expect(marks.map((m) => m.characters)).toEqual([null, null])
  })

  it('una sola marca por campaña (o mundo) y cosa', async () => {
    await mark({ campaignId: null })
    await mark({ campaignId: null, known: false })
    await mark({})
    const marks = await knowledgeRepo.listMarks(conn.db, { worldId, campaignIds: 'all' })
    expect(marks).toHaveLength(2)
  })

  it('las marcas de otra campaña no se leen salvo con «all»', async () => {
    const other = await campaignsRepo.createCampaignWithMaster(conn.db, ui('createCampaign'), {
      worldId,
      name: 'Los del norte',
      masterId: 'u1',
      invitation: prepared()
    })
    await mark({ campaignId: other.id })
    await mark({ campaignId: null, targetId: 'p9' })
    expect(await knowledgeRepo.listMarks(conn.db, { worldId, campaignIds: [campaignId] })).toHaveLength(1)
    expect(await knowledgeRepo.listMarks(conn.db, { worldId, campaignIds: [] })).toHaveLength(1)
    expect(await knowledgeRepo.listMarks(conn.db, { worldId, campaignIds: 'all' })).toHaveLength(2)
  })

  it('poner una marca se deshace', async () => {
    await mark({})
    const [op] = (await conn.db.select().from(operations)).filter((o) => o.action === 'setKnowledge')
    const result = await undoRepo.undoOperation(conn.db, ui('undo'), op?.id ?? '')
    expect(result.status).toBe('undone')
    expect(await knowledgeRepo.listMarks(conn.db, { worldId, campaignIds: 'all' })).toEqual([])
  })

  it('una campaña nueva empieza de cero, o con lo que sabe otra (lo de sus personajes, como «no la conocen»)', async () => {
    await mark({})
    await mark({ targetId: 'p2', known: false })
    await mark({ targetId: 'p3', characters: [crypto.randomUUID()] })
    const fresh = await campaignsRepo.createCampaignWithMaster(conn.db, ui('createCampaign'), {
      worldId,
      name: 'De cero',
      masterId: 'u1',
      invitation: prepared(),
      knowledge: { start: 'none' }
    })
    const copy = await campaignsRepo.createCampaignWithMaster(conn.db, ui('createCampaign'), {
      worldId,
      name: 'Copia',
      masterId: 'u1',
      invitation: prepared(),
      knowledge: { start: 'campaign', campaignId }
    })
    expect(await knowledgeRepo.knowsWorld(conn.db, [fresh.id, copy.id, campaignId])).toEqual(
      new Map([
        [fresh.id, false],
        [copy.id, true],
        [campaignId, true]
      ])
    )
    const copied = await knowledgeRepo.listMarks(conn.db, { worldId, campaignIds: [copy.id] })
    // Lo que solo sabían unos personajes, como «no la conocen» para toda la copia
    expect(
      copied
        .filter((m) => m.campaignId === copy.id)
        .map((m) => [m.targetId, m.known])
        .sort()
    ).toEqual([
      ['p1', true],
      ['p2', false],
      ['p3', false]
    ])
  })

  it('el árbol del mundo y los personajes de una cuenta', async () => {
    const { page: home } = await pagesRepo.createHomePage(conn.db, ui('createPage'), { worldId, title: 'Valdren' })
    expect(await knowledgeRepo.worldTree(conn.db, worldId)).toEqual([{ id: home.id, parentId: null }])
    const [lia] = await conn.db
      .insert(characters)
      .values({ campaignId, ownerId: 'u1', name: 'Lía', system: 'blank', build: {}, play: {} })
      .returning()
    expect(await knowledgeRepo.characterIdsOf(conn.db, campaignId, 'u1')).toEqual([lia?.id])
  })
})
