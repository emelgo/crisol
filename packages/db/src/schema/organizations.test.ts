import { getTableConfig } from 'drizzle-orm/pg-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connect } from '../client.ts'
import { freshTestDatabase, resetDatabase } from '../testing.ts'
import { user } from './auth.ts'
import { bootstrapTokens, organizationMembers, organizations } from './organizations.ts'

describe('organizaciones', () => {
  let conn: ReturnType<typeof connect>

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_db_orgs'), { max: 1 })
  })

  afterAll(async () => {
    await conn?.close()
  })

  const seed = async () => {
    const [org] = await conn.db.insert(organizations).values({ name: 'Crisol' }).returning()
    if (!org) throw new Error('sin organización')
    await conn.db.insert(user).values({ id: 'u1', name: 'Enrique', email: 'e@crisol.test' })
    await conn.db.insert(organizationMembers).values({ organizationId: org.id, userId: 'u1', role: 'owner' })
    await conn.db.insert(bootstrapTokens).values({ organizationId: org.id, tokenHash: 'h', expiresAt: new Date() })
    return org
  }

  it('borrar una organización se lleva sus miembros y sus enlaces, pero no las cuentas', async () => {
    await resetDatabase(conn.sql)
    const org = await seed()
    await conn.sql`delete from organizations where id = ${org.id}`
    expect(await conn.db.select().from(organizationMembers)).toEqual([])
    expect(await conn.db.select().from(bootstrapTokens)).toEqual([])
    expect(await conn.db.select().from(user)).toHaveLength(1)
  })

  it('las referencias a cuentas y organizaciones están declaradas con su política de borrado', () => {
    const onDelete = (table: Parameters<typeof getTableConfig>[0]) =>
      getTableConfig(table).foreignKeys.map((fk) => [getTableConfig(fk.reference().foreignTable).name, fk.onDelete])
    // Además de las de autoría (created_by, updated_by → user, set null)
    expect(onDelete(organizationMembers)).toEqual(
      expect.arrayContaining([
        ['organizations', 'cascade'],
        ['user', 'cascade'],
        ['user', 'set null']
      ])
    )
    expect(onDelete(bootstrapTokens)).toEqual([
      ['organizations', 'cascade'],
      ['user', 'set null']
    ])
  })

  it('un rol que no existe no entra', async () => {
    await resetDatabase(conn.sql)
    const org = await seed()
    await expect(
      conn.sql`insert into organization_members (organization_id, user_id, role) values (${org.id}, 'u1', 'admin')`
    ).rejects.toThrow()
  })

  it('resetDatabase deja todas las tablas vacías', async () => {
    await resetDatabase(conn.sql)
    await seed()
    await resetDatabase(conn.sql)
    expect(await conn.db.select().from(organizations)).toEqual([])
    expect(await conn.db.select().from(user)).toEqual([])
  })
})
