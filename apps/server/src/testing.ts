/** Ayudas para las pruebas del servidor */
import { randomBytes } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Database } from '@crisol/db'
import { EXAMPLE_TEMPLATES } from '@crisol/domain'
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

/** Una carpeta de datos nueva para una prueba (los bytes de los archivos), en la temporal del sistema */
export const testDataDir = () => mkdtempSync(join(tmpdir(), 'crisol-prueba-'))

/**
 * Las plantillas de ejemplo (las que fueron de serie: PNJ, Lugar, Facción…) en la cuenta de quien llama, con sus tablas
 * y sus enlaces apuntando entre ellas. Devuelve el id de cada una por su id legible («pnj»); también se encuentran por
 * su nombre (`template: 'pnj'` casa con «PNJ»)
 */
export async function seedExampleTemplates(
  call: (name: string, payload: object) => Promise<{ json(): unknown }>,
  organizationId?: string
): Promise<Record<string, string>> {
  const ids: Record<string, string> = {}
  for (const template of EXAMPLE_TEMPLATES) {
    const made = (await call('createTemplate', {
      name: template.name,
      icon: template.icon,
      ...(organizationId ? { organizationId } : {})
    })) as { json(): { id: string } }
    ids[template.id] = made.json().id
  }
  // Lo que nombra a otra (sus tablas, sus enlaces), con su id de verdad
  const remap = <T>(value: T): T =>
    JSON.parse(JSON.stringify(value), (key, v) =>
      key === 'template' && typeof v === 'string' && ids[v]
        ? ids[v]
        : key === 'targets' && Array.isArray(v)
          ? v.map((each) => ids[each] ?? each)
          : v
    )
  // Primero los campos de todas (las tablas de un panel se comprueban contra ellos), luego los paneles
  for (const template of EXAMPLE_TEMPLATES) {
    await call('updateTemplate', {
      templateId: ids[template.id],
      fields: remap(template.fields),
      skeleton: template.skeleton
    })
  }
  for (const template of EXAMPLE_TEMPLATES) {
    if (template.panel.length > 0)
      await call('updateTemplate', { templateId: ids[template.id], panel: remap(template.panel) })
  }
  return ids
}
