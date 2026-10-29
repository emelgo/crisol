/** Ayudas para las pruebas del servidor */
import { randomBytes } from 'node:crypto'
import type { Database } from '@crisol/db'
import { createAuth } from './auth/auth.ts'

/** Secreto de sesiones de usar y tirar: nada de literales que parezcan secretos en el repo */
export const TEST_AUTH_SECRET = randomBytes(32).toString('hex')

export function createTestAuth(db: Database, baseURL: string) {
  return createAuth({ db, secret: TEST_AUTH_SECRET, baseURL })
}
