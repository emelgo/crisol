import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connect } from '../client.ts'
import { user } from '../schema/auth.ts'
import { campaignMembers } from '../schema/campaigns.ts'
import { changes, operations } from '../schema/history.ts'
import { bootstrapTokens, organizationMembers, organizations } from '../schema/organizations.ts'
import { freshTestDatabase, resetDatabase } from '../testing.ts'
import * as bootstrap from './bootstrap.ts'
import * as campaignsRepo from './campaigns.ts'
import * as historyRepo from './history.ts'
import * as invitationsRepo from './invitations.ts'
import * as membersRepo from './members.ts'
import { isOwner, listMemberOrganizations, loadMemberships } from './memberships.ts'
import * as worldsRepo from './worlds.ts'

const DAY = 24 * 60 * 60 * 1000
/** Un secreto ya preparado (en el servidor: hash y cifrado de verdad) */
const prepared = () => ({ tokenHash: crypto.randomUUID(), secretSealed: 'v1.cifrado' })

describe('repositorios', () => {
  let conn: ReturnType<typeof connect>
  let organizationId: string
  const ui = (action: string) => ({ organizationId, actorId: 'u1', via: 'ui' as const, action })

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_db_repos'), { max: 2 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    await conn.db.insert(user).values([
      { id: 'u1', name: 'Enrique', email: 'e@crisol.test' },
      { id: 'u2', name: 'Otra', email: 'o@crisol.test' }
    ])
    const [org] = await conn.db.insert(organizations).values({ name: 'Fateforge' }).returning()
    organizationId = org?.id ?? ''
    await conn.db.insert(organizationMembers).values({ organizationId, userId: 'u1', role: 'owner' })
  })

  afterAll(async () => {
    await conn?.close()
  })

  describe('mundos', () => {
    it('crear un mundo hace máster a quien lo crea, en una sola operación', async () => {
      const world = await worldsRepo.createWorldWithMaster(conn.db, ui('createWorld'), {
        organizationId,
        name: 'Eana',
        masterId: 'u1'
      })
      expect(await worldsRepo.listMemberWorlds(conn.db, 'u1')).toEqual([
        { id: world.id, organizationId, name: 'Eana', version: 1, role: 'master' }
      ])
      expect(await conn.db.select().from(operations)).toHaveLength(1)
      expect(await conn.db.select().from(changes)).toHaveLength(2)
    })

    it('la lista sale por nombre y solo con los mundos de la cuenta', async () => {
      for (const name of ['Zafiro', 'Eana']) {
        await worldsRepo.createWorldWithMaster(conn.db, ui('createWorld'), { organizationId, name, masterId: 'u1' })
      }
      await worldsRepo.createWorldWithMaster(conn.db, ui('createWorld'), {
        organizationId,
        name: 'Ajeno',
        masterId: 'u2'
      })
      expect((await worldsRepo.listMemberWorlds(conn.db, 'u1')).map((w) => w.name)).toEqual(['Eana', 'Zafiro'])
    })

    it('renombrar sube la versión', async () => {
      const world = await worldsRepo.createWorldWithMaster(conn.db, ui('createWorld'), {
        organizationId,
        name: 'Eana',
        masterId: 'u1'
      })
      const renamed = await worldsRepo.renameWorld(conn.db, ui('renameWorld'), world.id, 'Eana II')
      expect(renamed).toMatchObject({ name: 'Eana II', version: 2 })
      expect(await worldsRepo.findWorld(conn.db, world.id)).toMatchObject({ name: 'Eana II', version: 2 })
    })

    it('un mundo que no existe no se encuentra', async () => {
      expect(await worldsRepo.findWorld(conn.db, '00000000-0000-4000-8000-000000000000')).toBeNull()
    })
  })

  describe('campañas', () => {
    const world = () =>
      worldsRepo.createWorldWithMaster(conn.db, ui('createWorld'), { organizationId, name: 'Eana', masterId: 'u1' })

    it('crear una campaña hace máster a quien la crea, en una sola operación', async () => {
      const w = await world()
      const campaign = await campaignsRepo.createCampaignWithMaster(conn.db, ui('createCampaign'), {
        worldId: w.id,
        name: 'La Marca del Este',
        masterId: 'u1',
        invitation: prepared()
      })
      expect(await campaignsRepo.listCampaigns(conn.db, { worldId: w.id, userId: 'u1', onlyMember: false })).toEqual([
        { id: campaign.id, worldId: w.id, name: 'La Marca del Este', version: 1, role: 'master' }
      ])
      const ops = await conn.db.select().from(operations)
      expect(ops.find((op) => op.action === 'createCampaign')?.worldId).toBe(w.id)
    })

    it('un jugador solo ve sus campañas, con su rol; el máster del mundo las ve todas', async () => {
      const w = await world()
      const mine = await campaignsRepo.createCampaignWithMaster(conn.db, ui('createCampaign'), {
        worldId: w.id,
        name: 'B',
        masterId: 'u1',
        invitation: prepared()
      })
      await campaignsRepo.createCampaignWithMaster(conn.db, ui('createCampaign'), {
        worldId: w.id,
        name: 'A',
        masterId: 'u1',
        invitation: prepared()
      })
      await conn.db.insert(campaignMembers).values({ campaignId: mine.id, userId: 'u2', role: 'player' })

      const forPlayer = await campaignsRepo.listCampaigns(conn.db, { worldId: w.id, userId: 'u2', onlyMember: true })
      expect(forPlayer.map((c) => [c.name, c.role])).toEqual([['B', 'player']])
      const forMaster = await campaignsRepo.listCampaigns(conn.db, { worldId: w.id, userId: 'u1', onlyMember: false })
      expect(forMaster.map((c) => c.name)).toEqual(['A', 'B'])
    })

    it('renombrar sube la versión y la campaña se encuentra con su organización', async () => {
      const w = await world()
      const campaign = await campaignsRepo.createCampaignWithMaster(conn.db, ui('createCampaign'), {
        worldId: w.id,
        name: 'Uno',
        masterId: 'u1',
        invitation: prepared()
      })
      expect(await campaignsRepo.renameCampaign(conn.db, ui('renameCampaign'), campaign.id, 'Dos')).toMatchObject({
        name: 'Dos',
        version: 2
      })
      expect(await campaignsRepo.findCampaign(conn.db, campaign.id)).toMatchObject({
        name: 'Dos',
        worldId: w.id,
        organizationId
      })
      expect(await campaignsRepo.findCampaign(conn.db, '00000000-0000-4000-8000-000000000000')).toBeNull()
    })
  })

  describe('enlaces de invitación', () => {
    const campaign = async () => {
      const w = await worldsRepo.createWorldWithMaster(conn.db, ui('createWorld'), {
        organizationId,
        name: 'Eana',
        masterId: 'u1'
      })
      const secret = prepared()
      const c = await campaignsRepo.createCampaignWithMaster(conn.db, ui('createCampaign'), {
        worldId: w.id,
        name: 'La Marca',
        masterId: 'u1',
        invitation: secret
      })
      return { world: w, campaign: c, secret }
    }

    it('la campaña nace con su enlace, abierto y sin entradas', async () => {
      const { campaign: c, secret } = await campaign()
      expect(await invitationsRepo.findInvitation(conn.db, c.id)).toMatchObject({
        tokenHash: secret.tokenHash,
        role: 'player',
        open: true,
        joins: 0
      })
    })

    it('por el hash se encuentra con su campaña, su mundo y su organización', async () => {
      const { world: w, campaign: c, secret } = await campaign()
      expect(await invitationsRepo.findInvitationByHash(conn.db, secret.tokenHash)).toMatchObject({
        campaignName: 'La Marca',
        worldId: w.id,
        worldName: 'Eana',
        organizationId,
        invitation: { campaignId: c.id }
      })
      expect(await invitationsRepo.findInvitationByHash(conn.db, 'no-existe')).toBeNull()
    })

    it('regenerar sustituye el enlace: el anterior ya no se encuentra y las entradas vuelven a cero', async () => {
      const { campaign: c, secret } = await campaign()
      await conn.sql`update invitation_links set joins = 3`
      const fresh = prepared()
      const updated = await invitationsRepo.regenerateInvitation(conn.db, ui('regenerateInvitation'), c.id, fresh)
      expect(updated).toMatchObject({ tokenHash: fresh.tokenHash, joins: 0, version: 2 })
      expect(await invitationsRepo.findInvitationByHash(conn.db, secret.tokenHash)).toBeNull()
    })

    it('regenerar una campaña sin enlace lo crea', async () => {
      const { campaign: c } = await campaign()
      await conn.sql`delete from invitation_links`
      expect(
        await invitationsRepo.regenerateInvitation(conn.db, ui('regenerateInvitation'), c.id, prepared())
      ).toMatchObject({
        campaignId: c.id,
        version: 1
      })
    })

    it('el nombre del máster de la campaña', async () => {
      const { campaign: c } = await campaign()
      expect(await invitationsRepo.campaignMasterName(conn.db, c.id)).toBe('Enrique')
      expect(await invitationsRepo.campaignMasterName(conn.db, '00000000-0000-4000-8000-000000000000')).toBeNull()
    })

    describe('entrar con el enlace', () => {
      const join = async (c: { id: string }, userId: string) => {
        const link = await invitationsRepo.findInvitation(conn.db, c.id)
        if (!link) throw new Error('sin enlace')
        return invitationsRepo.joinCampaign(
          conn.db,
          { actorId: userId, via: 'ui', action: 'joinCampaign', organizationId },
          { invitationId: link.id, campaignId: c.id, organizationId, userId }
        )
      }

      it('una cuenta nueva entra como jugadora y miembro de la organización, y el enlace suma una entrada', async () => {
        const { campaign: c } = await campaign()
        expect(await join(c, 'u2')).toEqual({ status: 'joined' })
        expect(await loadMemberships(conn.db, 'u2')).toMatchObject({
          organizations: [{ organizationId, role: 'member' }],
          campaigns: [{ campaignId: c.id, role: 'player' }]
        })
        expect((await invitationsRepo.findInvitation(conn.db, c.id))?.joins).toBe(1)
        const op = (await conn.db.select().from(operations)).find((o) => o.action === 'joinCampaign')
        expect(op).toMatchObject({ actorId: 'u2', organizationId })
      })

      it('si ya estaba, no cambia nada', async () => {
        const { campaign: c } = await campaign()
        await join(c, 'u2')
        expect(await join(c, 'u2')).toEqual({ status: 'member' })
        expect((await invitationsRepo.findInvitation(conn.db, c.id))?.joins).toBe(1)
      })

      it('el máster no entra como jugador', async () => {
        const { campaign: c } = await campaign()
        expect(await join(c, 'u1')).toEqual({ status: 'master' })
        expect((await invitationsRepo.findInvitation(conn.db, c.id))?.joins).toBe(0)
      })

      it('con las invitaciones cerradas nadie entra', async () => {
        const { campaign: c } = await campaign()
        await invitationsRepo.setInvitationsOpen(conn.db, ui('setInvitationsOpen'), c.id, false)
        expect(await join(c, 'u2')).toEqual({ status: 'closed' })
        expect((await loadMemberships(conn.db, 'u2')).campaigns).toEqual([])
      })
    })

    it('se pueden cerrar y abrir las invitaciones sin cambiar el enlace', async () => {
      const { campaign: c, secret } = await campaign()
      expect(await invitationsRepo.setInvitationsOpen(conn.db, ui('setInvitationsOpen'), c.id, false)).toMatchObject({
        open: false,
        tokenHash: secret.tokenHash
      })
      await conn.sql`delete from invitation_links`
      expect(await invitationsRepo.setInvitationsOpen(conn.db, ui('setInvitationsOpen'), c.id, true)).toBeNull()
    })
  })

  describe('miembros de una campaña', () => {
    let worldId: string
    const campaignNamed = async (name: string) => {
      const c = await campaignsRepo.createCampaignWithMaster(conn.db, ui('createCampaign'), {
        worldId,
        name,
        masterId: 'u1',
        invitation: prepared()
      })
      return c.id
    }
    const join = async (campaignId: string, userId: string) => {
      const link = await invitationsRepo.findInvitation(conn.db, campaignId)
      if (!link) throw new Error('sin enlace')
      await invitationsRepo.joinCampaign(
        conn.db,
        { actorId: userId, via: 'ui', action: 'joinCampaign', organizationId },
        { invitationId: link.id, campaignId, organizationId, userId }
      )
    }
    const remove = (campaignId: string, userId: string) =>
      membersRepo.removeCampaignMember(
        conn.db,
        { actorId: 'u1', via: 'ui', action: 'removeMember', organizationId, worldId },
        { campaignId, organizationId, userId }
      )

    beforeEach(async () => {
      await conn.db.insert(user).values({ id: 'u3', name: 'Ana', email: 'a@crisol.test' })
      const w = await worldsRepo.createWorldWithMaster(conn.db, ui('createWorld'), {
        organizationId,
        name: 'Eana',
        masterId: 'u1'
      })
      worldId = w.id
    })

    it('la lista sale con el máster primero y luego por nombre, con su rol', async () => {
      const c = await campaignNamed('La Marca')
      await join(c, 'u2')
      await join(c, 'u3')
      expect(await membersRepo.listCampaignMembers(conn.db, c)).toEqual([
        { userId: 'u1', name: 'Enrique', role: 'master' },
        { userId: 'u3', name: 'Ana', role: 'player' },
        { userId: 'u2', name: 'Otra', role: 'player' }
      ])
      expect(await membersRepo.findCampaignMember(conn.db, c, 'u2')).toEqual({ name: 'Otra', role: 'player' })
      expect(await membersRepo.findCampaignMember(conn.db, c, 'nadie')).toBeNull()
    })

    it('sin ninguna campaña más en la organización, deja de ser miembro de ella; queda en el historial del mundo', async () => {
      const c = await campaignNamed('La Marca')
      await join(c, 'u2')
      expect(await remove(c, 'u2')).toEqual({ status: 'removed', leftOrganization: true })
      expect(await loadMemberships(conn.db, 'u2')).toEqual({ organizations: [], worlds: [], campaigns: [] })
      const op = (await conn.db.select().from(operations)).find((o) => o.action === 'removeMember')
      expect(op).toMatchObject({ organizationId, worldId })
      const removed = await conn.db
        .select()
        .from(changes)
        .where(eq(changes.operationId, op?.id ?? ''))
      expect(removed.map((c) => [c.tableName, c.after])).toEqual([
        ['campaign_members', null],
        ['organization_members', null]
      ])
    })

    it('si le queda otra campaña en la organización, sigue en ella', async () => {
      const a = await campaignNamed('A')
      const b = await campaignNamed('B')
      await join(a, 'u2')
      await join(b, 'u2')
      expect(await remove(a, 'u2')).toEqual({ status: 'removed', leftOrganization: false })
      expect(await loadMemberships(conn.db, 'u2')).toMatchObject({
        organizations: [{ organizationId, role: 'member' }],
        campaigns: [{ campaignId: b }]
      })
    })

    it('al propietario no se le quita de la organización', async () => {
      await conn.db.insert(organizationMembers).values({ organizationId, userId: 'u2', role: 'owner' })
      const c = await campaignNamed('La Marca')
      await join(c, 'u2')
      expect(await remove(c, 'u2')).toEqual({ status: 'removed', leftOrganization: false })
      expect((await loadMemberships(conn.db, 'u2')).organizations).toEqual([{ organizationId, role: 'owner' }])
    })

    it('al máster no se le quita, y quien no está no cambia nada', async () => {
      const c = await campaignNamed('La Marca')
      const before = (await conn.db.select().from(operations)).length
      expect(await remove(c, 'u1')).toEqual({ status: 'master' })
      expect(await remove(c, 'u2')).toEqual({ status: 'not-member' })
      expect(await conn.db.select().from(operations)).toHaveLength(before)
      expect(await membersRepo.listCampaignMembers(conn.db, c)).toHaveLength(1)
    })
  })

  describe('historial', () => {
    /** Dos mundos con unas cuantas operaciones, en orden */
    const setup = async () => {
      const eana = await worldsRepo.createWorldWithMaster(conn.db, ui('createWorld'), {
        organizationId,
        name: 'Eana',
        masterId: 'u1'
      })
      const other = await worldsRepo.createWorldWithMaster(conn.db, ui('createWorld'), {
        organizationId,
        name: 'Otro',
        masterId: 'u1'
      })
      for (const name of ['Eana 2', 'Eana 3']) {
        await worldsRepo.renameWorld(conn.db, { ...ui('renameWorld'), details: { to: name } }, eana.id, name)
      }
      return { eana, other }
    }

    it('las operaciones de un mundo, de la más reciente a la más antigua, con quién las hizo', async () => {
      const { eana } = await setup()
      const ops = await historyRepo.listOperations(conn.db, { worldId: eana.id, limit: 10 })
      expect(ops.map((op) => op.action)).toEqual(['renameWorld', 'renameWorld', 'createWorld'])
      expect(ops[0]).toMatchObject({ actorId: 'u1', actorName: 'Enrique', via: 'ui', tool: null, worldId: eana.id })
      expect(ops[0]?.details).toEqual({ to: 'Eana 3' })
    })

    it('las de la organización incluyen todos sus mundos', async () => {
      await setup()
      const ops = await historyRepo.listOperations(conn.db, { organizationId, limit: 10 })
      expect(ops).toHaveLength(4)
    })

    it('se pagina con la última que se vio, sin repetir ni saltarse ninguna', async () => {
      const { eana } = await setup()
      const first = await historyRepo.listOperations(conn.db, { worldId: eana.id, limit: 2 })
      const rest = await historyRepo.listOperations(conn.db, {
        worldId: eana.id,
        limit: 2,
        before: first.at(-1)?.id ?? ''
      })
      expect([...first, ...rest].map((op) => op.id)).toEqual(
        (await historyRepo.listOperations(conn.db, { worldId: eana.id, limit: 10 })).map((op) => op.id)
      )
      expect(rest).toHaveLength(1)
    })

    it('las del sistema y las de una cuenta borrada salen sin nombre', async () => {
      const { eana } = await setup()
      await conn.db.delete(user).where(eq(user.id, 'u1'))
      const ops = await historyRepo.listOperations(conn.db, { worldId: eana.id, limit: 1 })
      expect(ops[0]).toMatchObject({ actorId: null, actorName: null })
    })
  })

  it('un jugador ve en su lista de mundos aquellos en los que juega', async () => {
    const w = await worldsRepo.createWorldWithMaster(conn.db, ui('createWorld'), {
      organizationId,
      name: 'Eana',
      masterId: 'u1'
    })
    const c = await campaignsRepo.createCampaignWithMaster(conn.db, ui('createCampaign'), {
      worldId: w.id,
      name: 'C',
      masterId: 'u1',
      invitation: prepared()
    })
    await conn.db.insert(campaignMembers).values({ campaignId: c.id, userId: 'u2', role: 'player' })
    expect(await worldsRepo.listMemberWorlds(conn.db, 'u2')).toEqual([
      { id: w.id, organizationId, name: 'Eana', version: 1, role: 'player' }
    ])
    expect((await worldsRepo.listMemberWorlds(conn.db, 'u1')).map((x) => x.role)).toEqual(['master'])
  })

  it('las pertenencias dicen el rol en cada organización y en cada mundo', async () => {
    const world = await worldsRepo.createWorldWithMaster(conn.db, ui('createWorld'), {
      organizationId,
      name: 'Eana',
      masterId: 'u1'
    })
    const campaign = await campaignsRepo.createCampaignWithMaster(conn.db, ui('createCampaign'), {
      worldId: world.id,
      name: 'C',
      masterId: 'u1',
      invitation: prepared()
    })
    expect(await loadMemberships(conn.db, 'u1')).toEqual({
      organizations: [{ organizationId, role: 'owner' }],
      worlds: [{ worldId: world.id, organizationId, role: 'master' }],
      campaigns: [{ campaignId: campaign.id, worldId: world.id, role: 'master' }]
    })
    expect(await loadMemberships(conn.db, 'u2')).toEqual({ organizations: [], worlds: [], campaigns: [] })
  })

  it('las organizaciones de la cuenta salen con su nombre y su rol', async () => {
    expect(await listMemberOrganizations(conn.db, 'u1')).toEqual([
      { id: organizationId, name: 'Fateforge', role: 'owner' }
    ])
    expect(await listMemberOrganizations(conn.db, 'u2')).toEqual([])
  })

  it('isOwner dice si la cuenta es propietaria de alguna organización', async () => {
    await conn.db.insert(organizationMembers).values({ organizationId, userId: 'u2', role: 'member' })
    expect(await isOwner(conn.db, 'u1')).toBe(true)
    expect(await isOwner(conn.db, 'u2')).toBe(false)
  })

  describe('arranque', () => {
    beforeEach(async () => {
      await resetDatabase(conn.sql)
      await conn.db.insert(user).values({ id: 'u1', name: 'Enrique', email: 'e@crisol.test' })
    })
    const future = () => new Date(Date.now() + DAY)

    it('crea la organización como operación del sistema y deja un enlace', async () => {
      const result = await bootstrap.prepareBootstrap(conn.db, {
        organizationName: 'Fateforge',
        tokenHash: 'h1',
        expiresAt: future()
      })
      expect(result).toMatchObject({ ok: true, organizationName: 'Fateforge' })
      const [op] = await conn.db.select().from(operations)
      expect(op).toMatchObject({ action: 'createOrganization', via: 'system', actorId: null })
      expect(await bootstrap.peekBootstrap(conn.db, 'h1', new Date())).toEqual({ organizationName: 'Fateforge' })
    })

    it('sin organización pide el nombre', async () => {
      expect(await bootstrap.prepareBootstrap(conn.db, { tokenHash: 'h1', expiresAt: future() })).toEqual({
        ok: false,
        code: 'ORGANIZATION_NAME_REQUIRED'
      })
    })

    it('repetirlo reutiliza la organización y deja solo el enlace nuevo', async () => {
      await bootstrap.prepareBootstrap(conn.db, { organizationName: 'Fateforge', tokenHash: 'h1', expiresAt: future() })
      await bootstrap.prepareBootstrap(conn.db, { tokenHash: 'h2', expiresAt: future() })
      expect(await conn.db.select().from(organizations)).toHaveLength(1)
      expect((await conn.db.select().from(bootstrapTokens)).map((t) => t.tokenHash)).toEqual(['h2'])
    })

    it('el enlace se gasta una sola vez, se puede devolver y al completarlo hay propietario', async () => {
      await bootstrap.prepareBootstrap(conn.db, { organizationName: 'Fateforge', tokenHash: 'h1', expiresAt: future() })
      const token = await bootstrap.consumeBootstrap(conn.db, 'h1', new Date())
      expect(await bootstrap.consumeBootstrap(conn.db, 'h1', new Date())).toBeNull()
      if (!token) throw new Error('sin enlace')
      await bootstrap.releaseBootstrap(conn.db, token.id)
      expect(await bootstrap.consumeBootstrap(conn.db, 'h1', new Date())).not.toBeNull()

      await bootstrap.completeBootstrap(conn.db, {
        tokenId: token.id,
        organizationId: token.organizationId,
        userId: 'u1'
      })
      expect(await loadMemberships(conn.db, 'u1')).toMatchObject({ organizations: [{ role: 'owner' }] })
      expect((await conn.db.select().from(operations)).map((op) => op.action)).toContain('bootstrapOwner')
      expect(await bootstrap.prepareBootstrap(conn.db, { tokenHash: 'h3', expiresAt: future() })).toEqual({
        ok: false,
        code: 'OWNER_EXISTS'
      })
    })

    it('un enlace caducado no vale', async () => {
      await bootstrap.prepareBootstrap(conn.db, {
        organizationName: 'Fateforge',
        tokenHash: 'h1',
        expiresAt: new Date(Date.now() - 1)
      })
      expect(await bootstrap.peekBootstrap(conn.db, 'h1', new Date())).toBeNull()
      expect(await bootstrap.consumeBootstrap(conn.db, 'h1', new Date())).toBeNull()
    })

    it('deleteUser borra la cuenta', async () => {
      await bootstrap.deleteUser(conn.db, 'u1')
      expect(await conn.db.select().from(user)).toEqual([])
    })
  })
})
