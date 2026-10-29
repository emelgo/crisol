import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connect } from '../client.ts'
import { user } from '../schema/auth.ts'
import { changes, operations } from '../schema/history.ts'
import { bootstrapTokens, organizationMembers, organizations } from '../schema/organizations.ts'
import { freshTestDatabase, resetDatabase } from '../testing.ts'
import * as bootstrap from './bootstrap.ts'
import { isOwner, listMemberOrganizations, loadMemberships } from './memberships.ts'
import * as worldsRepo from './worlds.ts'

const DAY = 24 * 60 * 60 * 1000

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

  it('las pertenencias dicen el rol en cada organización y en cada mundo', async () => {
    const world = await worldsRepo.createWorldWithMaster(conn.db, ui('createWorld'), {
      organizationId,
      name: 'Eana',
      masterId: 'u1'
    })
    expect(await loadMemberships(conn.db, 'u1')).toEqual({
      organizations: [{ organizationId, role: 'owner' }],
      worlds: [{ worldId: world.id, organizationId, role: 'master' }]
    })
    expect(await loadMemberships(conn.db, 'u2')).toEqual({ organizations: [], worlds: [] })
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
