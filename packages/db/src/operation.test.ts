import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connect } from './client.ts'
import { operation, TRACKED_TABLES } from './operation.ts'
import { user } from './schema/auth.ts'
import { changes, operations } from './schema/history.ts'
import { organizations } from './schema/organizations.ts'
import { worldMembers, worlds } from './schema/worlds.ts'
import { freshTestDatabase, resetDatabase } from './testing.ts'

describe('operation', () => {
  let conn: ReturnType<typeof connect>
  let organizationId: string
  const ctx = () => ({
    organizationId,
    actorId: 'u1',
    via: 'ui' as const,
    action: 'createWorld',
    details: { name: 'Eana' }
  })

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_db_operation'), { max: 2 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    await conn.db.insert(user).values({ id: 'u1', name: 'Enrique', email: 'e@crisol.test' })
    const [org] = await conn.db.insert(organizations).values({ name: 'Fateforge' }).returning()
    organizationId = org?.id ?? ''
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('una inserción queda como un cambio con la fila completa después, y con la autoría', async () => {
    const world = await operation(conn.db, ctx(), (w) => w.insert(worlds, { organizationId, name: 'Eana' }))
    expect(world).toMatchObject({ name: 'Eana', version: 1, createdBy: 'u1', updatedBy: 'u1' })

    const [op] = await conn.db.select().from(operations)
    expect(op).toMatchObject({
      organizationId,
      actorId: 'u1',
      via: 'ui',
      action: 'createWorld',
      details: { name: 'Eana' },
      worldId: world.id
    })
    const [change] = await conn.db.select().from(changes)
    expect(change).toMatchObject({ operationId: op?.id, seq: 1, tableName: 'worlds', rowId: world.id, before: null })
    expect(change?.after).toMatchObject({ id: world.id, name: 'Eana', organization_id: organizationId, version: 1 })
  })

  it('los cambios de una petición forman una sola operación, en orden', async () => {
    await operation(conn.db, ctx(), async (w) => {
      const world = await w.insert(worlds, { organizationId, name: 'Eana' })
      await w.insert(worldMembers, { worldId: world.id, userId: 'u1', role: 'master' })
    })
    expect(await conn.db.select().from(operations)).toHaveLength(1)
    const rows = await conn.db.select().from(changes).orderBy(changes.seq)
    expect(rows.map((c) => c.tableName)).toEqual(['worlds', 'world_members'])
  })

  it('una actualización sube la versión y guarda cómo estaba antes', async () => {
    const world = await operation(conn.db, ctx(), (w) => w.insert(worlds, { organizationId, name: 'Eana' }))
    await conn.db.insert(user).values({ id: 'u2', name: 'IA', email: 'ia@crisol.test' })
    const renamed = await operation(conn.db, { ...ctx(), actorId: 'u2', via: 'ai', tool: 'renombrar' }, (w) =>
      w.update(worlds, world.id, { name: 'Eana (Fateforge)' })
    )
    expect(renamed).toMatchObject({ name: 'Eana (Fateforge)', version: 2, createdBy: 'u1', updatedBy: 'u2' })
    const update = (await conn.db.select().from(changes)).find((c) => c.before !== null)
    expect(update?.before).toMatchObject({ name: 'Eana', version: 1 })
    expect(update?.after).toMatchObject({ name: 'Eana (Fateforge)', version: 2, updated_by: 'u2' })
  })

  it('quitar una fila guarda cómo estaba y nada después', async () => {
    const world = await operation(conn.db, ctx(), (w) => w.insert(worlds, { organizationId, name: 'Eana' }))
    await operation(conn.db, ctx(), (w) => w.remove(worlds, world.id))
    const removal = (await conn.db.select().from(changes)).find((c) => c.after === null)
    expect(removal?.before).toMatchObject({ id: world.id, name: 'Eana' })
    expect(await conn.db.select().from(worlds)).toEqual([])
  })

  it('si algo falla a mitad no queda nada: ni filas ni operación', async () => {
    await expect(
      operation(conn.db, ctx(), async (w) => {
        await w.insert(worlds, { organizationId, name: 'Eana' })
        throw new Error('falla a mitad')
      })
    ).rejects.toThrow('falla a mitad')
    expect(await conn.db.select().from(worlds)).toEqual([])
    expect(await conn.db.select().from(operations)).toEqual([])
  })

  it('una operación que no cambia nada no queda en el historial', async () => {
    await operation(conn.db, ctx(), async (w) => w.read.select().from(worlds))
    expect(await conn.db.select().from(operations)).toEqual([])
  })

  it('actualizar una fila que no existe falla', async () => {
    await expect(
      operation(conn.db, ctx(), (w) => w.update(worlds, '00000000-0000-4000-8000-000000000000', { name: 'x' }))
    ).rejects.toThrow('No existe')
  })

  it('la operación sabe de qué mundo es aunque solo toque sus miembros', async () => {
    const world = await operation(conn.db, ctx(), (w) => w.insert(worlds, { organizationId, name: 'Eana' }))
    await operation(conn.db, ctx(), (w) => w.insert(worldMembers, { worldId: world.id, userId: 'u1', role: 'master' }))
    const ops = await conn.db.select().from(operations)
    expect(ops.every((op) => op.worldId === world.id)).toBe(true)
  })

  it('el mundo se puede decir cuando los cambios no lo llevan (los miembros de una campaña)', async () => {
    const world = await operation(conn.db, ctx(), (w) => w.insert(worlds, { organizationId, name: 'Eana' }))
    await operation(conn.db, { ...ctx(), worldId: world.id }, (w) => w.update(organizations, organizationId, {}))
    const ops = await conn.db.select().from(operations)
    expect(ops.map((op) => op.worldId)).toEqual([world.id, world.id])
  })

  it('todas las tablas de dominio pasan por el historial', async () => {
    // Las que no: cuentas y sesiones (Better Auth), el propio historial, el arranque y las migraciones
    const notTracked = new Set(['user', 'session', 'account', 'verification', 'rate_limit', 'operations', 'changes'])
    notTracked.add('bootstrap_tokens')
    // Los ajustes y la cola de la IA: lo que se aprueba pasa por el historial al hacerse
    notTracked.add('ai_settings').add('approvals')
    const tables = await conn.sql<
      { name: string }[]
    >`select tablename as name from pg_tables where schemaname = 'public'`
    // Las de OAuth y sus claves también son de Better Auth
    const domain = tables
      .map((t) => t.name)
      .filter((name) => !notTracked.has(name) && name !== 'jwks' && !name.startsWith('oauth_'))
    expect(domain.sort()).toEqual(Object.keys(TRACKED_TABLES).sort())
  })

  it('al crear una organización, la operación es de esa organización', async () => {
    const org = await operation(conn.db, { actorId: null, via: 'system', action: 'createOrganization' }, (w) =>
      w.insert(organizations, { name: 'Otra' })
    )
    const [op] = await conn.db.select().from(operations)
    expect(op?.organizationId).toBe(org.id)
  })

  it('si no se puede saber de qué organización es, falla y no deja nada', async () => {
    const world = await operation(conn.db, ctx(), (w) => w.insert(worlds, { organizationId, name: 'Eana' }))
    await expect(
      operation(conn.db, { actorId: 'u1', via: 'ui', action: 'addMaster' }, (w) =>
        w.insert(worldMembers, { worldId: world.id, userId: 'u1', role: 'master' })
      )
    ).rejects.toThrow('No se sabe de qué organización')
    expect(await conn.db.select().from(worldMembers)).toEqual([])
    expect(await conn.db.select().from(operations)).toHaveLength(1)
  })

  it('la fila escrita es la que se lee después', async () => {
    const world = await operation(conn.db, ctx(), (w) => w.insert(worlds, { organizationId, name: 'Eana' }))
    const [stored] = await conn.db.select().from(worlds).where(eq(worlds.id, world.id))
    expect(stored).toEqual(world)
  })
})
