/** Ayudas para las pruebas del servidor */
import { randomBytes } from 'node:crypto'
import type { Database } from '@crisol/db'
import { type Auth, createAuth } from './auth/auth.ts'
import { allowSignup } from './auth/signup-gate.ts'
import { deriveSealKey } from './secrets.ts'

/** Secreto de sesiones de usar y tirar: nada de literales que parezcan secretos en el repo */
export const TEST_AUTH_SECRET = randomBytes(32).toString('hex')
export const TEST_SEAL_KEY = deriveSealKey(TEST_AUTH_SECRET)

export function createTestAuth(db: Database, baseURL: string) {
  return createAuth({ db, secret: TEST_AUTH_SECRET, baseURL })
}

/** Crea una cuenta (saltándose el registro cerrado) y devuelve su id y la cookie de sesión lista para enviar */
export async function signUpTestUser(auth: Auth, person: { name: string; email: string }) {
  const { headers, response } = await allowSignup(() =>
    auth.api.signUpEmail({ body: { ...person, password: 'una-clave-de-pruebas' }, returnHeaders: true })
  )
  const cookie = headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  return { userId: response.user.id, cookie }
}
