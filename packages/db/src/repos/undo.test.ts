import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connect } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { user } from '../schema/auth.ts'
import { campaigns } from '../schema/campaigns.ts'
import { operations } from '../schema/history.ts'
import { invitationLinks } from '../schema/invitations.ts'
import { organizationMembers, organizations } from '../schema/organizations.ts'
import { worlds } from '../schema/worlds.ts'
import { freshTestDatabase, resetDatabase } from '../testing.ts'
import * as campaignsRepo from './campaigns.ts'
import * as invitationsRepo from './invitations.ts'
import * as membersRepo from './members.ts'
import { loadMemberships } from './memberships.ts'
import { undoOperation } from './undo.ts'
import * as worldsRepo from './worlds.ts'

describe('deshacer una operación', () => {
  let conn: ReturnType<typeof connect>
  let organizationId: string
  const ctx = (action: string, actorId = 'u1'): OperationContext => ({ organizationId, actorId, via: 'ui', action })
  const lastOperation = async (action: string) => {
    const ops = await conn.db.select().from(operations)
    const found = ops.filter((op) => op.action === action).at(-1)
    if (!found) throw new Error(`sin ${action}`)
    return found
  }
  const undo = (operationId: string) => undoOperation(conn.db, ctx('undo'), operationId)

  const world = () =>
    worldsRepo.createWorldWithMaster(conn.db, ctx('createWorld'), { organizationId, name: 'Eana', masterId: 'u1' })
  const campaign = async (worldId: string) =>
    campaignsRepo.createCampaignWithMaster(conn.db, ctx('createCampaign'), {
      worldId,
      name: 'La Marca',
      masterId: 'u1',
      invitation: { tokenHash: crypto.randomUUID(), secretSealed: 'v1.x' }
    })
  const join = async (campaignId: string, userId: string) => {
    const link = await invitationsRepo.findInvitation(conn.db, campaignId)
    return invitationsRepo.joinCampaign(conn.db, ctx('joinCampaign', userId), {
      invitationId: link?.id ?? '',
      campaignId,
      organizationId,
      userId
    })
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_db_undo'), { max: 2 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    await conn.db.insert(user).values([
      { id: 'u1', name: 'Enrique', email: 'e@crisol.test' },
      { id: 'u2', name: 'Pepe', email: 'p@crisol.test' },
      { id: 'u3', name: 'Ana', email: 'a@crisol.test' }
    ])
    const [org] = await conn.db.insert(organizations).values({ name: 'Fateforge' }).returning()
    organizationId = org?.id ?? ''
    await conn.db.insert(organizationMembers).values({ organizationId, userId: 'u1', role: 'owner' })
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('deshacer un renombrado deja la fila como estaba, en una operación nueva enlazada a la original', async () => {
    const w = await world()
    await worldsRepo.renameWorld(conn.db, ctx('renameWorld'), w.id, 'Eana 2')
    const renamed = await lastOperation('renameWorld')

    const result = await undo(renamed.id)
    expect(result).toMatchObject({ status: 'undone' })
    expect(await worldsRepo.findWorld(conn.db, w.id)).toMatchObject({ name: 'Eana', version: 1 })
    const undoOp = await lastOperation('undo')
    expect(undoOp).toMatchObject({ undoesId: renamed.id, worldId: w.id })
    expect((await lastOperation('renameWorld')).undoneById).toBe(undoOp.id)
  })

  it('deshacer lo deshecho lo vuelve a aplicar; lo ya deshecho no se deshace dos veces', async () => {
    const w = await world()
    await worldsRepo.renameWorld(conn.db, ctx('renameWorld'), w.id, 'Eana 2')
    const renamed = await lastOperation('renameWorld')
    await undo(renamed.id)
    expect(await undo(renamed.id)).toEqual({ status: 'already-undone' })
    expect(await undo((await lastOperation('undo')).id)).toMatchObject({ status: 'undone' })
    expect(await worldsRepo.findWorld(conn.db, w.id)).toMatchObject({ name: 'Eana 2', version: 2 })
  })

  it('deshacer lo posterior deja deshacer lo anterior', async () => {
    const w = await world()
    await worldsRepo.renameWorld(conn.db, ctx('renameWorld'), w.id, 'Eana 2')
    const first = await lastOperation('renameWorld')
    await worldsRepo.renameWorld(conn.db, ctx('renameWorld'), w.id, 'Eana 3')
    await undo((await lastOperation('renameWorld')).id)
    expect(await undo(first.id)).toMatchObject({ status: 'undone' })
    expect(await worldsRepo.findWorld(conn.db, w.id)).toMatchObject({ name: 'Eana' })
  })

  it('si algo se cambió después, no toca nada y dice qué operación fue', async () => {
    const w = await world()
    await worldsRepo.renameWorld(conn.db, ctx('renameWorld'), w.id, 'Eana 2')
    const first = await lastOperation('renameWorld')
    await worldsRepo.renameWorld(conn.db, ctx('renameWorld'), w.id, 'Eana 3')
    const second = await lastOperation('renameWorld')
    expect(await undo(first.id)).toEqual({ status: 'conflict', by: second.id })
    expect(await worldsRepo.findWorld(conn.db, w.id)).toMatchObject({ name: 'Eana 3' })
    expect(await conn.db.select().from(operations).where(eq(operations.action, 'undo'))).toEqual([])
  })

  it('deshacer crear una campaña la quita con su máster y su enlace', async () => {
    const w = await world()
    const c = await campaign(w.id)
    expect(await undo((await lastOperation('createCampaign')).id)).toMatchObject({ status: 'undone' })
    expect(await conn.db.select().from(campaigns)).toEqual([])
    expect(await conn.db.select().from(invitationLinks)).toEqual([])
    expect((await loadMemberships(conn.db, 'u1')).campaigns).toEqual([])
    expect(c.id).toBeDefined()
  })

  it('no quita algo de lo que depende otra cosa creada después: dice cuál', async () => {
    const w = await world()
    await campaign(w.id)
    expect(await undo((await lastOperation('createWorld')).id)).toEqual({
      status: 'conflict',
      by: (await lastOperation('createCampaign')).id
    })
    expect(await worldsRepo.findWorld(conn.db, w.id)).not.toBeNull()
  })

  it('deshacer una entrada saca al jugador; que entren otros después no lo impide', async () => {
    const c = await campaign((await world()).id)
    await join(c.id, 'u2')
    const pepe = await lastOperation('joinCampaign')
    await join(c.id, 'u3')
    expect(await undo(pepe.id)).toMatchObject({ status: 'undone' })
    expect(await loadMemberships(conn.db, 'u2')).toEqual({ organizations: [], worlds: [], campaigns: [] })
    expect((await loadMemberships(conn.db, 'u3')).campaigns).toHaveLength(1)
  })

  it('deshacer una expulsión vuelve a poner la misma fila, y en la organización', async () => {
    const c = await campaign((await world()).id)
    await join(c.id, 'u2')
    const [before] = await membersRepo
      .listCampaignMembers(conn.db, c.id)
      .then((m) => m.filter((x) => x.userId === 'u2'))
    await membersRepo.removeCampaignMember(conn.db, ctx('removeMember'), {
      campaignId: c.id,
      organizationId,
      userId: 'u2'
    })
    expect(await undo((await lastOperation('removeMember')).id)).toMatchObject({ status: 'undone' })
    expect(await membersRepo.listCampaignMembers(conn.db, c.id)).toContainEqual(before)
    expect((await loadMemberships(conn.db, 'u2')).organizations).toEqual([{ organizationId, role: 'member' }])
  })

  it('no vuelve a poner una fila si ya hay otra igual: si volvió a entrar, dice esa entrada', async () => {
    const c = await campaign((await world()).id)
    await join(c.id, 'u2')
    await membersRepo.removeCampaignMember(conn.db, ctx('removeMember'), {
      campaignId: c.id,
      organizationId,
      userId: 'u2'
    })
    const expelled = await lastOperation('removeMember')
    await join(c.id, 'u2')
    const rejoined = await lastOperation('joinCampaign')
    expect(await undo(expelled.id)).toEqual({ status: 'conflict', by: rejoined.id })
  })

  it('lo del sistema no se deshace, y lo que no existe tampoco', async () => {
    await operation(conn.db, { organizationId, actorId: null, via: 'system', action: 'seed' }, (w) =>
      w.update(organizations, organizationId, { name: 'Fateforge 2' })
    )
    expect(await undo((await lastOperation('seed')).id)).toEqual({ status: 'not-undoable' })
    expect(await undo('00000000-0000-4000-8000-000000000000')).toEqual({ status: 'not-found' })
    expect((await conn.db.select().from(worlds)).length).toBe(0)
  })
})
