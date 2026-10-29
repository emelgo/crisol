import { connect } from '@crisol/db'
import { freshTestDatabase } from '@crisol/db/testing'
import { Redis } from 'ioredis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from './app.ts'
import { serviceChecks } from './services.ts'

describe('GET /api/health contra Postgres y Valkey reales', () => {
  let db: ReturnType<typeof connect>
  let valkey: Redis

  beforeAll(async () => {
    db = connect(await freshTestDatabase('crisol_test_server'), { max: 1 })
    valkey = new Redis(process.env.TEST_VALKEY_URL ?? 'redis://127.0.0.1:63790')
  })

  afterAll(async () => {
    await db.close()
    valkey.disconnect()
  })

  it('da 200', async () => {
    const app = buildApp({ checks: serviceChecks(db, valkey) })
    const response = await app.inject({ method: 'GET', url: '/api/health' })
    expect(response.json()).toEqual({ status: 'ok', postgres: 'ok', valkey: 'ok' })
  })
})
