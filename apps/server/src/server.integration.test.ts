import type { AddressInfo } from 'node:net'
import { freshTestDatabase } from '@crisol/db/testing'
import { describe, expect, it } from 'vitest'
import { startServer } from './server.ts'

describe('startServer contra Postgres y Valkey reales', () => {
  it('escucha, responde a /api/health y se para limpiamente', async () => {
    const server = await startServer({
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: 0,
      DATABASE_URL: await freshTestDatabase('crisol_test_server'),
      VALKEY_URL: process.env.TEST_VALKEY_URL ?? 'redis://127.0.0.1:63790'
    })
    try {
      const { port } = server.app.server.address() as AddressInfo
      const response = await fetch(`http://127.0.0.1:${port}/api/health`)
      expect(await response.json()).toEqual({ status: 'ok', postgres: 'ok', valkey: 'ok' })
    } finally {
      await server.stop()
    }
  })
})
