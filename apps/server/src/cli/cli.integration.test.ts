import { connect } from '@crisol/db'
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
})
