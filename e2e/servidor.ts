// Servidor de las e2e: el de producción, con una base de datos nueva y la web compilada
import { join } from 'node:path'
import { freshTestDatabase } from '@crisol/db/testing'
import { startServer } from '@crisol/server/server'

export const E2E_PORT = 8131

if (import.meta.main) {
  await startServer({
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: E2E_PORT,
    DATABASE_URL: await freshTestDatabase('crisol_test_e2e'),
    VALKEY_URL: process.env.TEST_VALKEY_URL ?? 'redis://127.0.0.1:63790',
    WEB_DIR: join(import.meta.dirname, '..', 'apps', 'web', 'dist')
  })
}
