// Servidor de las e2e: el de producción, con una base de datos nueva y la web compilada
import { randomBytes } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { freshTestDatabase, testDatabaseUrl } from '@crisol/db/testing'
import { startServer } from '@crisol/server/server'

export const E2E_PORT = 8131
export const E2E_DATABASE = 'crisol_test_e2e'

/** La base de datos del servidor de las e2e, para preparar datos desde las pruebas */
export const e2eDatabaseUrl = () => testDatabaseUrl(E2E_DATABASE)

if (import.meta.main) {
  await startServer({
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: E2E_PORT,
    DATABASE_URL: await freshTestDatabase(E2E_DATABASE),
    VALKEY_URL: process.env.TEST_VALKEY_URL ?? 'redis://127.0.0.1:63790',
    AUTH_SECRET: randomBytes(32).toString('hex'),
    PUBLIC_URL: `http://127.0.0.1:${E2E_PORT}`,
    WEB_DIR: join(import.meta.dirname, '..', 'apps', 'web', 'dist'),
    // Los bytes de los archivos, en una carpeta nueva cada vez
    DATA_DIR: mkdtempSync(join(tmpdir(), 'crisol-e2e-'))
  })
}
