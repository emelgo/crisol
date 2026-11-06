import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { redeemBootstrap } from '../bootstrap.ts'
import { createTestAuth } from '../testing.ts'
import { runCli } from './cli.ts'

const PUBLIC_URL = 'https://crisol.test'

describe('pnpm crisol', () => {
  let conn: ReturnType<typeof connect>
  let out: string[]
  let err: string[]
  const run = (...argv: string[]) =>
    runCli(argv, { db: conn.db, publicUrl: PUBLIC_URL, out: (t) => out.push(t), err: (t) => err.push(t) })

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_cli'), { max: 2 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    out = []
    err = []
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('arranque da el enlace de la cuenta del propietario en la URL pública', async () => {
    expect(await run('arranque', '--org', 'Crisol de Enrique')).toBe(0)
    expect(out.join('\n')).toMatch(/^https:\/\/crisol\.test\/arranque\/[\w-]{43}$/m)
    expect(out.join('\n')).toContain('Crisol de Enrique')
  })

  it('sin organización pide el nombre', async () => {
    expect(await run('arranque')).toBe(1)
    expect(err[0]).toMatch(/--org/)
  })

  it('con propietario ya creado no da otro arranque', async () => {
    await run('arranque', '--org', 'Crisol de Enrique')
    const secret = out.find((line) => line.includes('/arranque/'))?.split('/arranque/')[1] ?? ''
    const auth = createTestAuth(conn.db, PUBLIC_URL)
    await redeemBootstrap(conn.db, auth, {
      secret,
      name: 'Enrique',
      email: 'e@crisol.test',
      password: 'una-clave-larga'
    })
    expect(await run('arranque')).toBe(1)
    expect(err[0]).toMatch(/propietario/)
  })

  it('una orden desconocida explica el uso', async () => {
    expect(await run('borrar-todo')).toBe(2)
    expect(err[0]).toMatch(/^Uso:/)
  })

  it('una opción desconocida explica el uso', async () => {
    expect(await run('arranque', '--forzar')).toBe(2)
    expect(err[0]).toMatch(/^Uso:/)
  })

  it('sistema-5e pasa las campañas y personajes del 5e de serie a una copia en su cuenta; sin ninguna, nada', async () => {
    expect(await run('sistema-5e')).toBe(0)
    expect(out.at(-1)).toBe('El 5e, a una copia en 0 cuentas: 0 campañas y 0 personajes')
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Fateforge' }).returning()
    const [user] = await conn.db
      .insert(schema.user)
      .values({ id: crypto.randomUUID(), name: 'Ana', email: 'ana@crisol.test', emailVerified: true })
      .returning()
    if (!org || !user) throw new Error('sin cuenta')
    const [world] = await conn.db.insert(schema.worlds).values({ organizationId: org.id, name: 'Eana' }).returning()
    if (!world) throw new Error('sin mundo')
    const [old, other] = await conn.db
      .insert(schema.campaigns)
      .values([
        { worldId: world.id, name: 'La Marca', system: '5e' },
        { worldId: world.id, name: 'Otra', system: 'blank' }
      ])
      .returning()
    if (!old || !other) throw new Error('sin campañas')
    await conn.db
      .insert(schema.characters)
      .values({ campaignId: other.id, ownerId: user.id, name: 'Thora', system: '5e' })
    expect(await run('sistema-5e')).toBe(0)
    expect(out.at(-1)).toBe('El 5e, a una copia en 1 cuentas: 1 campañas y 1 personajes')
    const [copy] = await conn.db.select().from(schema.systems)
    expect(copy?.organizationId).toBe(org.id)
    const campaigns = await conn.db.select().from(schema.campaigns)
    expect(campaigns.find((c) => c.id === old.id)?.system).toBe(copy?.id)
    expect(campaigns.find((c) => c.id === other.id)?.system).toBe('blank')
    expect((await conn.db.select().from(schema.characters))[0]?.system).toBe(copy?.id)
  }, 60_000)
})
