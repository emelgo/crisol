import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined

describe('POST /api/actions/:name', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }
  let organizationId: string

  const call = (name: string, payload: object, cookie?: string, origin = BASE_URL) =>
    app.inject({
      method: 'POST',
      url: `/api/actions/${name}`,
      payload,
      headers: { origin, ...(cookie ? { cookie } : {}) }
    })

  /** Una organización con su propietario */
  const organizationWithOwner = async (name: string, email: string) => {
    const person = await signUpTestUser(auth, { name, email })
    const [org] = await conn.db.insert(schema.organizations).values({ name }).returning()
    if (!org) throw new Error('sin organización')
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org.id, userId: person.userId, role: 'owner' })
    return { ...person, organizationId: org.id }
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_actions'), { max: 2 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY }
    })
    const created = await organizationWithOwner('Enrique', 'enrique@crisol.test')
    owner = created
    organizationId = created.organizationId
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('sin sesión da 401', async () => {
    const response = await call('listWorlds', {})
    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ code: 'UNAUTHENTICATED' })
  })

  it('una acción que no existe da 404', async () => {
    expect((await call('borrarTodo', {}, owner.cookie)).json()).toEqual({ code: 'UNKNOWN_ACTION' })
  })

  it('el propietario crea un mundo, queda de máster y la operación queda en el historial', async () => {
    const response = await call('createWorld', { name: 'Eana' }, owner.cookie)
    expect(response.statusCode).toBe(200)
    const world = response.json()
    expect(world).toEqual({ id: expect.any(String), organizationId, name: 'Eana', role: 'master', version: 1 })

    const [op] = await conn.db.select().from(schema.operations)
    expect(op).toMatchObject({
      action: 'createWorld',
      details: { name: 'Eana' },
      actorId: owner.userId,
      via: 'ui',
      worldId: world.id
    })
    expect((await call('listWorlds', {}, owner.cookie)).json()).toEqual({ worlds: [world] })
  })

  it('el máster renombra su mundo y la versión sube', async () => {
    const world = (await call('createWorld', { name: 'Eana' }, owner.cookie)).json()
    const response = await call('renameWorld', { worldId: world.id, name: 'Eana (Fateforge)' }, owner.cookie)
    expect(response.json()).toMatchObject({ name: 'Eana (Fateforge)', version: 2 })
    const ops = await conn.db.select().from(schema.operations)
    expect(ops.find((op) => op.action === 'renameWorld')?.details).toEqual({ from: 'Eana', to: 'Eana (Fateforge)' })
  })

  it('un miembro que no es propietario no crea mundos', async () => {
    const member = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: member.userId, role: 'member' })
    const response = await call('createWorld', { name: 'Eana', organizationId }, member.cookie)
    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ code: 'FORBIDDEN' })
  })

  it('sin organizaciones propias, crear un mundo pide decir cuál', async () => {
    const stranger = await signUpTestUser(auth, { name: 'Nadie', email: 'nadie@crisol.test' })
    expect((await call('createWorld', { name: 'Eana' }, stranger.cookie)).json()).toEqual({
      code: 'ORGANIZATION_REQUIRED'
    })
  })

  it('el mundo de otra organización no existe para quien no está en ella', async () => {
    const other = await organizationWithOwner('Otra', 'otra@crisol.test')
    const foreign = (await call('createWorld', { name: 'Ajeno' }, other.cookie)).json()

    const rename = await call('renameWorld', { worldId: foreign.id, name: 'Mío' }, owner.cookie)
    expect(rename.statusCode).toBe(404)
    expect(rename.json()).toEqual({ code: 'NOT_FOUND' })
    expect(
      (await call('createWorld', { name: 'X', organizationId: other.organizationId }, owner.cookie)).statusCode
    ).toBe(404)
    expect((await call('listWorlds', {}, owner.cookie)).json()).toEqual({ worlds: [] })
  })

  it('datos no válidos dan 400 y no escriben nada', async () => {
    const response = await call('createWorld', { name: '   ' }, owner.cookie)
    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ code: 'INVALID_INPUT' })
    expect(await conn.db.select().from(schema.worlds)).toEqual([])
  })

  it('una petición desde otro origen se rechaza aunque traiga la cookie', async () => {
    const response = await call('createWorld', { name: 'Eana' }, owner.cookie, 'https://malo.example')
    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ code: 'BAD_ORIGIN' })
    expect(await conn.db.select().from(schema.worlds)).toEqual([])
  })

  it('la respuesta solo lleva lo que dice el contrato', async () => {
    const world = (await call('createWorld', { name: 'Eana' }, owner.cookie)).json()
    expect(Object.keys(world).sort()).toEqual(['id', 'name', 'organizationId', 'role', 'version'])
  })

  it('listOrganizations da las organizaciones de la cuenta con su rol', async () => {
    expect((await call('listOrganizations', {}, owner.cookie)).json()).toEqual({
      organizations: [{ id: organizationId, name: 'Enrique', role: 'owner' }]
    })
  })

  describe('campañas', () => {
    it('el máster crea campañas en su mundo, las lista y renombra; queda en el historial', async () => {
      const world = (await call('createWorld', { name: 'Eana' }, owner.cookie)).json()
      const created = await call('createCampaign', { worldId: world.id, name: 'La Marca' }, owner.cookie)
      expect(created.json()).toMatchObject({ worldId: world.id, name: 'La Marca', role: 'master', version: 1 })
      const renamed = await call(
        'renameCampaign',
        { campaignId: created.json().id, name: 'La Marca del Este' },
        owner.cookie
      )
      expect(renamed.json()).toMatchObject({ name: 'La Marca del Este', version: 2 })
      expect((await call('listCampaigns', { worldId: world.id }, owner.cookie)).json().campaigns).toHaveLength(1)

      const ops = await conn.db.select().from(schema.operations)
      expect(ops.find((op) => op.action === 'createCampaign')).toMatchObject({
        worldId: world.id,
        details: { name: 'La Marca', world: 'Eana' }
      })
    })

    it('un jugador ve el mundo y su campaña, pero no las demás ni puede cambiarlas', async () => {
      const world = (await call('createWorld', { name: 'Eana' }, owner.cookie)).json()
      const mine = (await call('createCampaign', { worldId: world.id, name: 'B' }, owner.cookie)).json()
      const other = (await call('createCampaign', { worldId: world.id, name: 'A' }, owner.cookie)).json()
      const player = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
      await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: player.userId, role: 'member' })
      await conn.db
        .insert(schema.campaignMembers)
        .values({ campaignId: mine.id, userId: player.userId, role: 'player' })

      expect((await call('listWorlds', {}, player.cookie)).json().worlds).toEqual([{ ...world, role: 'player' }])
      expect((await call('listCampaigns', { worldId: world.id }, player.cookie)).json().campaigns).toEqual([
        { ...mine, role: 'player' }
      ])
      expect((await call('renameCampaign', { campaignId: mine.id, name: 'X' }, player.cookie)).statusCode).toBe(403)
      expect((await call('renameCampaign', { campaignId: other.id, name: 'X' }, player.cookie)).statusCode).toBe(404)
      expect((await call('createCampaign', { worldId: world.id, name: 'X' }, player.cookie)).statusCode).toBe(403)
      expect((await call('renameWorld', { worldId: world.id, name: 'X' }, player.cookie)).statusCode).toBe(403)
    })

    it('las campañas de un mundo ajeno no existen para quien no está en él', async () => {
      const other = await organizationWithOwner('Otra', 'otra@crisol.test')
      const world = (await call('createWorld', { name: 'Ajeno' }, other.cookie)).json()
      const campaign = (await call('createCampaign', { worldId: world.id, name: 'C' }, other.cookie)).json()
      expect((await call('listCampaigns', { worldId: world.id }, owner.cookie)).statusCode).toBe(404)
      expect((await call('createCampaign', { worldId: world.id, name: 'X' }, owner.cookie)).statusCode).toBe(404)
      expect((await call('renameCampaign', { campaignId: campaign.id, name: 'X' }, owner.cookie)).statusCode).toBe(404)
      expect(
        (await call('renameCampaign', { campaignId: '00000000-0000-4000-8000-000000000000', name: 'X' }, owner.cookie))
          .statusCode
      ).toBe(404)
    })
  })

  describe('enlace de invitación', () => {
    const campaignOf = async () => {
      const world = (await call('createWorld', { name: 'Eana' }, owner.cookie)).json()
      return (await call('createCampaign', { worldId: world.id, name: 'La Marca' }, owner.cookie)).json()
    }
    const secretOf = (url: string) => url.split('/unirse/')[1] ?? ''

    it('la campaña nace con un enlace abierto en la URL pública', async () => {
      const campaign = await campaignOf()
      const invitation = (await call('getInvitation', { campaignId: campaign.id }, owner.cookie)).json()
      expect(invitation).toMatchObject({ campaignId: campaign.id, open: true, joins: 0 })
      expect(invitation.url).toMatch(/^https:\/\/crisol\.test\/unirse\/[\w-]{43}$/)
    })

    it('el secreto no está en claro en la base de datos, ni en el historial', async () => {
      const campaign = await campaignOf()
      const secret = secretOf((await call('getInvitation', { campaignId: campaign.id }, owner.cookie)).json().url)
      const rows = await conn.sql`select to_jsonb(i)::text as row from invitation_links i`
      const history = await conn.sql`select coalesce(after, before)::text as row from changes`
      expect([...rows, ...history].some((r) => String(r.row).includes(secret))).toBe(false)
    })

    it('un enlace nuevo deja sin valor el anterior', async () => {
      const campaign = await campaignOf()
      const before = (await call('getInvitation', { campaignId: campaign.id }, owner.cookie)).json()
      const after = (await call('regenerateInvitation', { campaignId: campaign.id }, owner.cookie)).json()
      expect(after.url).not.toBe(before.url)
      expect((await call('getInvitation', { campaignId: campaign.id }, owner.cookie)).json().url).toBe(after.url)
      const old =
        await conn.sql`select 1 from invitation_links where token_hash = encode(sha256(${secretOf(before.url)}::bytea), 'hex')`
      expect(old).toHaveLength(0)
      const ops = await conn.db.select().from(schema.operations)
      expect(ops.find((op) => op.action === 'regenerateInvitation')).toMatchObject({
        worldId: campaign.worldId,
        details: { campaign: 'La Marca' }
      })
    })

    it('se cierran y se abren las invitaciones sin cambiar el enlace', async () => {
      const campaign = await campaignOf()
      const before = (await call('getInvitation', { campaignId: campaign.id }, owner.cookie)).json()
      const closed = (await call('setInvitationsOpen', { campaignId: campaign.id, open: false }, owner.cookie)).json()
      expect(closed).toMatchObject({ open: false, url: before.url })
      expect(
        (await call('setInvitationsOpen', { campaignId: campaign.id, open: true }, owner.cookie)).json().open
      ).toBe(true)
    })

    it('un jugador de la campaña no ve ni toca el enlace; alguien de fuera, ni sabe que existe', async () => {
      const campaign = await campaignOf()
      const player = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
      await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: player.userId, role: 'member' })
      await conn.db
        .insert(schema.campaignMembers)
        .values({ campaignId: campaign.id, userId: player.userId, role: 'player' })
      for (const [name, input] of [
        ['getInvitation', { campaignId: campaign.id }],
        ['regenerateInvitation', { campaignId: campaign.id }],
        ['setInvitationsOpen', { campaignId: campaign.id, open: false }]
      ] as const) {
        expect((await call(name, input, player.cookie)).statusCode).toBe(403)
      }
      const other = await organizationWithOwner('Otra', 'otra@crisol.test')
      expect((await call('getInvitation', { campaignId: campaign.id }, other.cookie)).statusCode).toBe(404)
    })

    it('si el enlace no se puede leer (otra clave), se ofrece generar uno', async () => {
      const campaign = await campaignOf()
      await conn.sql`update invitation_links set secret_sealed = 'v1.AAAA.AAAA.AAAA'`
      expect((await call('getInvitation', { campaignId: campaign.id }, owner.cookie)).json()).toMatchObject({
        url: null
      })
      await conn.sql`delete from invitation_links`
      expect((await call('getInvitation', { campaignId: campaign.id }, owner.cookie)).json()).toMatchObject({
        url: null,
        issuedAt: null
      })
      expect((await call('regenerateInvitation', { campaignId: campaign.id }, owner.cookie)).json().url).toMatch(
        /\/unirse\//
      )
    })
  })

  describe('miembros', () => {
    /** Eana con La Marca y una jugadora dentro */
    const campaignWithPlayer = async () => {
      const world = (await call('createWorld', { name: 'Eana' }, owner.cookie)).json()
      const campaign = (await call('createCampaign', { worldId: world.id, name: 'La Marca' }, owner.cookie)).json()
      const player = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
      await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: player.userId, role: 'member' })
      await conn.db
        .insert(schema.campaignMembers)
        .values({ campaignId: campaign.id, userId: player.userId, role: 'player' })
      return { world, campaign, player }
    }

    it('el máster y los jugadores ven quién está; nadie más sabe que la campaña existe', async () => {
      const { campaign, player } = await campaignWithPlayer()
      const members = [
        { userId: owner.userId, name: 'Enrique', role: 'master' },
        { userId: player.userId, name: 'Jugadora', role: 'player' }
      ]
      expect((await call('listMembers', { campaignId: campaign.id }, owner.cookie)).json()).toEqual({ members })
      expect((await call('listMembers', { campaignId: campaign.id }, player.cookie)).json()).toEqual({ members })
      const other = await organizationWithOwner('Otra', 'otra@crisol.test')
      expect((await call('listMembers', { campaignId: campaign.id }, other.cookie)).statusCode).toBe(404)
    })

    it('el máster expulsa: el jugador deja de ver la campaña y la organización; queda en el historial del mundo', async () => {
      const { world, campaign, player } = await campaignWithPlayer()
      const response = await call('removeMember', { campaignId: campaign.id, userId: player.userId }, owner.cookie)
      expect(response.json()).toEqual({ members: [{ userId: owner.userId, name: 'Enrique', role: 'master' }] })

      expect((await call('listMembers', { campaignId: campaign.id }, player.cookie)).statusCode).toBe(404)
      expect((await call('listWorlds', {}, player.cookie)).json()).toEqual({ worlds: [] })
      expect((await call('listOrganizations', {}, player.cookie)).json()).toEqual({ organizations: [] })
      const op = (await conn.db.select().from(schema.operations)).find((o) => o.action === 'removeMember')
      expect(op).toMatchObject({ worldId: world.id, details: { campaign: 'La Marca', member: 'Jugadora' } })
    })

    it('un jugador no expulsa, el máster no se expulsa y a quien no está no se le encuentra', async () => {
      const { campaign, player } = await campaignWithPlayer()
      const remove = (userId: string, cookie: string) =>
        call('removeMember', { campaignId: campaign.id, userId }, cookie)
      expect((await remove(owner.userId, player.cookie)).statusCode).toBe(403)
      expect((await remove(owner.userId, owner.cookie)).json()).toEqual({ code: 'MASTER_NOT_REMOVABLE' })
      expect((await remove('nadie', owner.cookie)).statusCode).toBe(404)
      expect((await call('listMembers', { campaignId: campaign.id }, owner.cookie)).json().members).toHaveLength(2)
    })

    it('un jugador sale de la campaña; el máster no puede salir de la suya', async () => {
      const { world, campaign, player } = await campaignWithPlayer()
      const left = await call('leaveCampaign', { campaignId: campaign.id }, player.cookie)
      expect(left.statusCode).toBe(200)
      expect(left.json()).toEqual({})
      expect((await call('listCampaigns', { worldId: world.id }, player.cookie)).statusCode).toBe(404)
      const op = (await conn.db.select().from(schema.operations)).find((o) => o.action === 'leaveCampaign')
      expect(op).toMatchObject({ actorId: player.userId, worldId: world.id, details: { campaign: 'La Marca' } })

      expect((await call('leaveCampaign', { campaignId: campaign.id }, owner.cookie)).statusCode).toBe(403)
      expect((await call('leaveCampaign', { campaignId: campaign.id }, player.cookie)).statusCode).toBe(404)
    })
  })

  describe('historial', () => {
    it('el máster ve el de su mundo, de lo último a lo primero, con quién y por dónde', async () => {
      const world = (await call('createWorld', { name: 'Eana' }, owner.cookie)).json()
      const campaign = (await call('createCampaign', { worldId: world.id, name: 'La Marca' }, owner.cookie)).json()
      await call('regenerateInvitation', { campaignId: campaign.id }, owner.cookie)

      const history = (await call('listHistory', { worldId: world.id }, owner.cookie)).json()
      expect(history.next).toBeNull()
      expect(history.entries.map((e: { action: string }) => e.action)).toEqual([
        'regenerateInvitation',
        'createCampaign',
        'createWorld'
      ])
      expect(history.entries[1]).toEqual({
        id: expect.any(String),
        at: expect.any(String),
        actor: { id: owner.userId, name: 'Enrique' },
        via: 'ui',
        tool: null,
        action: 'createCampaign',
        details: { name: 'La Marca', world: 'Eana' },
        worldId: world.id,
        undoneBy: null,
        undoes: null
      })
    })

    it('el propietario ve el de toda la organización, por páginas', async () => {
      for (const name of ['A', 'B', 'C']) await call('createWorld', { name }, owner.cookie)
      const first = (await call('listHistory', { limit: 2 }, owner.cookie)).json()
      expect(first.entries.map((e: { details: { name: string } }) => e.details.name)).toEqual(['C', 'B'])
      const rest = (await call('listHistory', { limit: 2, before: first.next }, owner.cookie)).json()
      expect(rest).toMatchObject({ next: null, entries: [{ details: { name: 'A' } }] })
    })

    it('un jugador no ve el historial; alguien de fuera, ni que existe', async () => {
      const world = (await call('createWorld', { name: 'Eana' }, owner.cookie)).json()
      const campaign = (await call('createCampaign', { worldId: world.id, name: 'La Marca' }, owner.cookie)).json()
      const player = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
      await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: player.userId, role: 'member' })
      await conn.db
        .insert(schema.campaignMembers)
        .values({ campaignId: campaign.id, userId: player.userId, role: 'player' })
      expect((await call('listHistory', { worldId: world.id }, player.cookie)).statusCode).toBe(403)
      expect((await call('listHistory', { organizationId }, player.cookie)).statusCode).toBe(403)
      expect((await call('listHistory', {}, player.cookie)).json()).toEqual({ code: 'ORGANIZATION_REQUIRED' })

      const other = await organizationWithOwner('Otra', 'otra@crisol.test')
      expect((await call('listHistory', { worldId: world.id }, other.cookie)).statusCode).toBe(404)
      expect((await call('listHistory', { organizationId }, other.cookie)).statusCode).toBe(404)
    })
  })

  describe('deshacer', () => {
    const historyOf = async (worldId: string) =>
      (await call('listHistory', { worldId }, owner.cookie)).json().entries as Array<{
        id: string
        action: string
        undoneBy: string | null
        undoes: string | null
        details: Record<string, unknown>
      }>

    it('el máster deshace crear una campaña; el historial lo cuenta y se puede rehacer', async () => {
      const world = (await call('createWorld', { name: 'Eana' }, owner.cookie)).json()
      await call('createCampaign', { worldId: world.id, name: 'La Marca' }, owner.cookie)
      const created = (await historyOf(world.id))[0]
      const undone = (await call('undoOperation', { operationId: created?.id }, owner.cookie)).json()
      expect(undone).toMatchObject({
        status: 'undone',
        entry: {
          action: 'undoOperation',
          undoes: created?.id,
          actor: { name: 'Enrique' },
          details: { action: 'createCampaign', details: { name: 'La Marca', world: 'Eana' } }
        }
      })
      expect((await call('listCampaigns', { worldId: world.id }, owner.cookie)).json().campaigns).toEqual([])
      const [undo, original] = await historyOf(world.id)
      expect(original).toMatchObject({ id: created?.id, undoneBy: undo?.id })

      const redone = (await call('undoOperation', { operationId: undo?.id }, owner.cookie)).json()
      expect(redone.status).toBe('undone')
      expect((await call('listCampaigns', { worldId: world.id }, owner.cookie)).json().campaigns).toHaveLength(1)
    })

    it('si algo cambió después, no deshace y dice qué operación fue', async () => {
      const world = (await call('createWorld', { name: 'Eana' }, owner.cookie)).json()
      const campaign = (await call('createCampaign', { worldId: world.id, name: 'La Marca' }, owner.cookie)).json()
      await call('renameCampaign', { campaignId: campaign.id, name: 'La Marca del Este' }, owner.cookie)
      const created = (await historyOf(world.id)).find((e) => e.action === 'createCampaign')
      const result = (await call('undoOperation', { operationId: created?.id }, owner.cookie)).json()
      expect(result).toMatchObject({
        status: 'conflict',
        by: { action: 'renameCampaign', details: { from: 'La Marca', to: 'La Marca del Este' } }
      })
      expect((await call('listCampaigns', { worldId: world.id }, owner.cookie)).json().campaigns).toHaveLength(1)
    })

    it('deshacer una entrada saca al jugador al momento', async () => {
      const world = (await call('createWorld', { name: 'Eana' }, owner.cookie)).json()
      const campaign = (await call('createCampaign', { worldId: world.id, name: 'La Marca' }, owner.cookie)).json()
      const url = (await call('getInvitation', { campaignId: campaign.id }, owner.cookie)).json().url as string
      const player = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
      await app.inject({
        method: 'POST',
        url: '/api/join',
        payload: { secret: url.split('/unirse/')[1] },
        headers: { origin: BASE_URL, cookie: player.cookie }
      })
      expect((await call('listMembers', { campaignId: campaign.id }, player.cookie)).statusCode).toBe(200)
      const joined = (await historyOf(world.id)).find((e) => e.action === 'joinCampaign')
      expect((await call('undoOperation', { operationId: joined?.id }, owner.cookie)).json().status).toBe('undone')
      expect((await call('listMembers', { campaignId: campaign.id }, player.cookie)).statusCode).toBe(404)
    })

    it('un jugador no deshace; alguien de fuera, ni sabe que existe; nada se deshace dos veces', async () => {
      const world = (await call('createWorld', { name: 'Eana' }, owner.cookie)).json()
      const campaign = (await call('createCampaign', { worldId: world.id, name: 'La Marca' }, owner.cookie)).json()
      const player = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
      await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: player.userId, role: 'member' })
      await conn.db
        .insert(schema.campaignMembers)
        .values({ campaignId: campaign.id, userId: player.userId, role: 'player' })
      const [created] = await historyOf(world.id)
      const undo = (cookie: string, operationId = created?.id) => call('undoOperation', { operationId }, cookie)

      expect((await undo(player.cookie)).statusCode).toBe(403)
      const other = await organizationWithOwner('Otra', 'otra@crisol.test')
      expect((await undo(other.cookie)).statusCode).toBe(404)
      expect((await undo(owner.cookie, '00000000-0000-4000-8000-000000000000')).statusCode).toBe(404)

      await call('renameCampaign', { campaignId: campaign.id, name: 'X' }, owner.cookie)
      const [renamed] = await historyOf(world.id)
      expect((await undo(owner.cookie, renamed?.id)).json().status).toBe('undone')
      expect((await undo(owner.cookie, renamed?.id)).json()).toEqual({ code: 'ALREADY_UNDONE' })
    })

    it('lo del sistema no se deshace', async () => {
      await conn.db.insert(schema.operations).values({ organizationId, actorId: null, via: 'system', action: 'seed' })
      const [seed] = (await call('listHistory', {}, owner.cookie)).json().entries
      expect((await call('undoOperation', { operationId: seed.id }, owner.cookie)).json()).toEqual({
        code: 'NOT_UNDOABLE'
      })
    })
  })

  describe('papelera', () => {
    /** Eana con La Marca y una jugadora dentro (que entró con el enlace) */
    const worldWithPlayer = async () => {
      const world = (await call('createWorld', { name: 'Eana' }, owner.cookie)).json()
      const campaign = (await call('createCampaign', { worldId: world.id, name: 'La Marca' }, owner.cookie)).json()
      const url = (await call('getInvitation', { campaignId: campaign.id }, owner.cookie)).json().url as string
      const secret = url.split('/unirse/')[1] ?? ''
      const player = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
      await app.inject({
        method: 'POST',
        url: '/api/join',
        payload: { secret },
        headers: { origin: BASE_URL, cookie: player.cookie }
      })
      return { world, campaign, player, secret }
    }

    it('el máster borra una campaña: desaparece para todos y su enlace no vale; la restaura y vuelve', async () => {
      const { world, campaign, player, secret } = await worldWithPlayer()
      expect((await call('deleteCampaign', { campaignId: campaign.id }, owner.cookie)).json()).toEqual({})
      expect((await call('listCampaigns', { worldId: world.id }, owner.cookie)).json().campaigns).toEqual([])
      expect((await call('listWorlds', {}, player.cookie)).json().worlds).toEqual([])
      expect((await app.inject({ method: 'GET', url: `/api/join/${secret}` })).statusCode).toBe(404)
      expect((await call('renameCampaign', { campaignId: campaign.id, name: 'X' }, owner.cookie)).statusCode).toBe(404)

      const trash = (await call('listTrash', { worldId: world.id }, owner.cookie)).json()
      expect(trash.items).toEqual([
        {
          kind: 'campaign',
          id: campaign.id,
          name: 'La Marca',
          worldId: world.id,
          worldName: 'Eana',
          deletedAt: expect.any(String),
          purgeAt: expect.any(String)
        }
      ])
      const { deletedAt, purgeAt } = trash.items[0]
      expect(new Date(purgeAt).getTime() - new Date(deletedAt).getTime()).toBe(30 * 24 * 60 * 60 * 1000)

      expect((await call('restoreCampaign', { campaignId: campaign.id }, owner.cookie)).json()).toEqual({
        id: campaign.id,
        name: 'La Marca'
      })
      expect((await call('listWorlds', {}, player.cookie)).json().worlds).toHaveLength(1)
      expect((await app.inject({ method: 'GET', url: `/api/join/${secret}` })).statusCode).toBe(200)
      const actions = (await call('listHistory', { worldId: world.id }, owner.cookie))
        .json()
        .entries.map((e: { action: string; details: object }) => [e.action, e.details])
      expect(actions.slice(0, 2)).toEqual([
        ['restoreCampaign', { name: 'La Marca', world: 'Eana' }],
        ['deleteCampaign', { name: 'La Marca', world: 'Eana' }]
      ])
    })

    it('borrar un mundo se lleva sus campañas; el propietario lo restaura desde la papelera de la organización', async () => {
      const { world, player } = await worldWithPlayer()
      await call('deleteWorld', { worldId: world.id }, owner.cookie)
      expect((await call('listWorlds', {}, owner.cookie)).json().worlds).toEqual([])
      expect((await call('listWorlds', {}, player.cookie)).json().worlds).toEqual([])
      expect((await call('listTrash', {}, owner.cookie)).json().items).toMatchObject([
        { kind: 'world', id: world.id, name: 'Eana' }
      ])
      expect((await call('restoreWorld', { worldId: world.id }, owner.cookie)).json()).toEqual({
        id: world.id,
        name: 'Eana'
      })
      expect((await call('listWorlds', {}, player.cookie)).json().worlds).toHaveLength(1)
    })

    it('el propietario deshace el borrado de un mundo desde el historial de la organización', async () => {
      const { world, player } = await worldWithPlayer()
      await call('deleteWorld', { worldId: world.id }, owner.cookie)
      const entries = (await call('listHistory', {}, owner.cookie)).json().entries as Array<{
        id: string
        action: string
      }>
      const deleted = entries.find((e) => e.action === 'deleteWorld')
      expect((await call('undoOperation', { operationId: deleted?.id }, owner.cookie)).json().status).toBe('undone')
      expect((await call('listWorlds', {}, player.cookie)).json().worlds).toHaveLength(1)
    })

    it('el máster puede deshacer que alguien saliera de su campaña: vuelve a estar en ella (decidido con Enrique)', async () => {
      const { world, campaign, player } = await worldWithPlayer()
      await call('leaveCampaign', { campaignId: campaign.id }, player.cookie)
      const entries = (await call('listHistory', { worldId: world.id }, owner.cookie)).json().entries as Array<{
        id: string
        action: string
      }>
      const left = entries.find((e) => e.action === 'leaveCampaign')
      expect((await call('undoOperation', { operationId: left?.id }, owner.cookie)).json().status).toBe('undone')
      expect((await call('listWorlds', {}, player.cookie)).json().worlds).toHaveLength(1)
    })

    it('una campaña de un mundo en la papelera vuelve con el mundo, no sola', async () => {
      const { world, campaign } = await worldWithPlayer()
      await call('deleteCampaign', { campaignId: campaign.id }, owner.cookie)
      await call('deleteWorld', { worldId: world.id }, owner.cookie)
      expect((await call('restoreCampaign', { campaignId: campaign.id }, owner.cookie)).json()).toEqual({
        code: 'WORLD_IN_TRASH'
      })
    })

    it('un jugador no borra ni ve la papelera; alguien de fuera, ni sabe que existe', async () => {
      const { world, campaign, player } = await worldWithPlayer()
      expect((await call('deleteCampaign', { campaignId: campaign.id }, player.cookie)).statusCode).toBe(403)
      expect((await call('deleteWorld', { worldId: world.id }, player.cookie)).statusCode).toBe(403)
      expect((await call('listTrash', { worldId: world.id }, player.cookie)).statusCode).toBe(403)
      await call('deleteCampaign', { campaignId: campaign.id }, owner.cookie)
      // Su única campaña está en la papelera: ya no ve el mundo, así que para ella no existe
      expect((await call('restoreCampaign', { campaignId: campaign.id }, player.cookie)).statusCode).toBe(404)

      const other = await organizationWithOwner('Otra', 'otra@crisol.test')
      expect((await call('restoreCampaign', { campaignId: campaign.id }, other.cookie)).statusCode).toBe(404)
      expect((await call('listTrash', { worldId: world.id }, other.cookie)).statusCode).toBe(404)
      expect((await call('deleteWorld', { worldId: world.id }, other.cookie)).statusCode).toBe(404)
      expect((await call('restoreWorld', { worldId: world.id }, other.cookie)).statusCode).toBe(404)
    })
  })

  it('GET /api/openapi.json describe las acciones', async () => {
    const doc = (await app.inject({ method: 'GET', url: '/api/openapi.json' })).json()
    expect(Object.keys(doc.paths)).toContain('/api/actions/createWorld')
  })
})
