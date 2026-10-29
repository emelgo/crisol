import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connect } from '../client.ts'
import type { OperationContext } from '../operation.ts'
import { user } from '../schema/auth.ts'
import { campaigns } from '../schema/campaigns.ts'
import { operations } from '../schema/history.ts'
import { organizationMembers, organizations } from '../schema/organizations.ts'
import { worlds } from '../schema/worlds.ts'
import { freshTestDatabase, resetDatabase } from '../testing.ts'
import * as campaignsRepo from './campaigns.ts'
import * as invitationsRepo from './invitations.ts'
import { loadMemberships } from './memberships.ts'
import * as trashRepo from './trash.ts'
import { undoOperation } from './undo.ts'
import * as worldsRepo from './worlds.ts'

const DAY = 24 * 60 * 60 * 1000

describe('papelera', () => {
  let conn: ReturnType<typeof connect>
  let organizationId: string
  const ctx = (action: string, actorId = 'u1'): OperationContext => ({ organizationId, actorId, via: 'ui', action })

  /** Eana con La Marca y Pepe dentro */
  const setup = async () => {
    const world = await worldsRepo.createWorldWithMaster(conn.db, ctx('createWorld'), {
      organizationId,
      name: 'Eana',
      masterId: 'u1'
    })
    const tokenHash = crypto.randomUUID()
    const campaign = await campaignsRepo.createCampaignWithMaster(conn.db, ctx('createCampaign'), {
      worldId: world.id,
      name: 'La Marca',
      masterId: 'u1',
      invitation: { tokenHash, secretSealed: 'v1.x' }
    })
    const link = await invitationsRepo.findInvitation(conn.db, campaign.id)
    await invitationsRepo.joinCampaign(conn.db, ctx('joinCampaign', 'u2'), {
      invitationId: link?.id ?? '',
      campaignId: campaign.id,
      organizationId,
      userId: 'u2'
    })
    return { world, campaign, tokenHash }
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_db_trash'), { max: 2 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    await conn.db.insert(user).values([
      { id: 'u1', name: 'Enrique', email: 'e@crisol.test' },
      { id: 'u2', name: 'Pepe', email: 'p@crisol.test' }
    ])
    const [org] = await conn.db.insert(organizations).values({ name: 'Fateforge' }).returning()
    organizationId = org?.id ?? ''
    await conn.db.insert(organizationMembers).values({ organizationId, userId: 'u1', role: 'owner' })
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('una campaña borrada no sale en ninguna vista: ni en la lista, ni a sus jugadores, ni por su enlace', async () => {
    const { world, campaign, tokenHash } = await setup()
    await trashRepo.deleteCampaign(conn.db, ctx('deleteCampaign'), campaign.id)
    expect(await campaignsRepo.listCampaigns(conn.db, { worldId: world.id, userId: 'u1', onlyMember: false })).toEqual(
      []
    )
    expect(await campaignsRepo.findCampaign(conn.db, campaign.id)).toBeNull()
    expect(await invitationsRepo.findInvitationByHash(conn.db, tokenHash)).toBeNull()
    expect((await loadMemberships(conn.db, 'u2')).campaigns).toEqual([])
    expect(await worldsRepo.listMemberWorlds(conn.db, 'u2')).toEqual([])
    // El máster sigue viendo el mundo
    expect(await worldsRepo.listMemberWorlds(conn.db, 'u1')).toHaveLength(1)
  })

  it('un mundo borrado se lleva sus campañas de las vistas, para todos', async () => {
    const { world, campaign, tokenHash } = await setup()
    await trashRepo.deleteWorld(conn.db, ctx('deleteWorld'), world.id)
    expect(await worldsRepo.listMemberWorlds(conn.db, 'u1')).toEqual([])
    expect(await worldsRepo.findWorld(conn.db, world.id)).toBeNull()
    expect(await campaignsRepo.findCampaign(conn.db, campaign.id)).toBeNull()
    expect(await invitationsRepo.findInvitationByHash(conn.db, tokenHash)).toBeNull()
    expect(await loadMemberships(conn.db, 'u1')).toMatchObject({ worlds: [], campaigns: [] })
    expect((await loadMemberships(conn.db, 'u2')).campaigns).toEqual([])
  })

  it('restaurar deja la misma fila y vuelve a todas partes', async () => {
    const { world, campaign } = await setup()
    await trashRepo.deleteCampaign(conn.db, ctx('deleteCampaign'), campaign.id)
    await trashRepo.restoreCampaign(conn.db, ctx('restoreCampaign'), campaign.id)
    expect(await campaignsRepo.findCampaign(conn.db, campaign.id)).toMatchObject({ id: campaign.id, name: 'La Marca' })
    expect((await loadMemberships(conn.db, 'u2')).campaigns).toEqual([
      { campaignId: campaign.id, worldId: world.id, role: 'player' }
    ])
  })

  it('deshacer el borrado también la restaura', async () => {
    const { campaign } = await setup()
    await trashRepo.deleteCampaign(conn.db, ctx('deleteCampaign'), campaign.id)
    const ops = await conn.db.select().from(operations)
    const deleted = ops.find((op) => op.action === 'deleteCampaign')
    expect(await undoOperation(conn.db, ctx('undoOperation'), deleted?.id ?? '')).toMatchObject({ status: 'undone' })
    expect(await campaignsRepo.findCampaign(conn.db, campaign.id)).not.toBeNull()
  })

  it('la papelera: la de un mundo, sus campañas; la de la organización, también los mundos; con su fecha de purga', async () => {
    const { world, campaign } = await setup()
    const other = await worldsRepo.createWorldWithMaster(conn.db, ctx('createWorld'), {
      organizationId,
      name: 'Otro',
      masterId: 'u1'
    })
    await trashRepo.deleteCampaign(conn.db, ctx('deleteCampaign'), campaign.id)
    await trashRepo.deleteWorld(conn.db, ctx('deleteWorld'), other.id)

    const inWorld = await trashRepo.listTrash(conn.db, { worldId: world.id })
    expect(inWorld).toEqual([
      {
        kind: 'campaign',
        id: campaign.id,
        name: 'La Marca',
        worldId: world.id,
        worldName: 'Eana',
        deletedAt: expect.any(Date)
      }
    ])
    const inOrganization = await trashRepo.listTrash(conn.db, { organizationId })
    expect(inOrganization.map((item) => [item.kind, item.name])).toEqual([
      ['world', 'Otro'],
      ['campaign', 'La Marca']
    ])
    expect(await trashRepo.findTrashedCampaign(conn.db, campaign.id)).toMatchObject({
      name: 'La Marca',
      worldId: world.id,
      organizationId,
      worldInTrash: false
    })
    expect(await trashRepo.findTrashedWorld(conn.db, other.id)).toMatchObject({ name: 'Otro', organizationId })
    expect(await trashRepo.findTrashedWorld(conn.db, world.id)).toBeNull()
  })

  it('las campañas de un mundo en la papelera no salen sueltas en la de la organización', async () => {
    const { world, campaign } = await setup()
    await trashRepo.deleteCampaign(conn.db, ctx('deleteCampaign'), campaign.id)
    await trashRepo.deleteWorld(conn.db, ctx('deleteWorld'), world.id)
    expect((await trashRepo.listTrash(conn.db, { organizationId })).map((item) => item.kind)).toEqual(['world'])
    expect(await trashRepo.findTrashedCampaign(conn.db, campaign.id)).toMatchObject({ worldInTrash: true })
  })

  it('quiénes están: los de las campañas y los del mundo', async () => {
    const { world, campaign } = await setup()
    expect(await trashRepo.peopleOf(conn.db, { campaignId: campaign.id })).toEqual(
      expect.arrayContaining([
        { userId: 'u1', campaignId: campaign.id },
        { userId: 'u2', campaignId: campaign.id }
      ])
    )
    expect(await trashRepo.peopleOf(conn.db, { worldId: world.id })).toEqual(
      expect.arrayContaining([
        { userId: 'u1', campaignId: null },
        { userId: 'u2', campaignId: campaign.id }
      ])
    )
  })

  describe('la purga, con el reloj simulado', () => {
    const now = new Date('2026-12-01T04:00:00Z')
    const ago = (days: number) => new Date(now.getTime() - days * DAY)

    it('quita lo que lleva más de 30 días en la papelera; lo de menos se queda', async () => {
      const { world, campaign } = await setup()
      const other = await worldsRepo.createWorldWithMaster(conn.db, ctx('createWorld'), {
        organizationId,
        name: 'Otro',
        masterId: 'u1'
      })
      await trashRepo.deleteCampaign(conn.db, ctx('deleteCampaign'), campaign.id)
      await trashRepo.deleteWorld(conn.db, ctx('deleteWorld'), other.id)
      await conn.sql`update campaigns set deleted_at = ${ago(31).toISOString()} where id = ${campaign.id}`
      await conn.sql`update worlds set deleted_at = ${ago(29).toISOString()} where id = ${other.id}`

      expect(await trashRepo.purge(conn.db, now)).toMatchObject({ campaigns: 1, worlds: 0 })
      expect(await conn.db.select().from(campaigns)).toEqual([])
      expect((await conn.db.select().from(worlds)).map((w) => w.name).sort()).toEqual(['Eana', 'Otro'])
      // Pepe ya no tiene nada en la organización: deja de ser miembro, como al expulsarlo
      expect(await loadMemberships(conn.db, 'u2')).toEqual({ organizations: [], worlds: [], campaigns: [] })
      expect((await loadMemberships(conn.db, 'u1')).organizations).toEqual([{ organizationId, role: 'owner' }])
      expect(world.id).toBeDefined()
    })

    it('purgar un mundo se lleva sus campañas, y el historial de más de 90 días se va', async () => {
      const { world } = await setup()
      await trashRepo.deleteWorld(conn.db, ctx('deleteWorld'), world.id)
      await conn.sql`update worlds set deleted_at = ${ago(40).toISOString()} where id = ${world.id}`
      await conn.sql`update operations set created_at = ${ago(91).toISOString()} where action <> 'deleteWorld'`

      expect(await trashRepo.purge(conn.db, now)).toMatchObject({ worlds: 1, operations: 3 })
      expect(await conn.db.select().from(campaigns)).toEqual([])
      expect((await conn.db.select().from(operations)).map((op) => op.action)).toEqual(['deleteWorld'])
    })
  })
})
