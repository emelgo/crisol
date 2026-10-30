import { APIError } from 'better-auth/api'
import type { Auth } from './auth.ts'
import { allowSignup } from './signup-gate.ts'

/**
 * Crea una cuenta con email y contraseña desde un flujo del servidor que lo permite (arranque, invitación). Devuelve
 * la cuenta y las cabeceras con la cookie de sesión; si el email ya tiene cuenta, null.
 */
export async function signUpAllowed(
  auth: Auth,
  person: { name: string; firstName?: string; lastName?: string; email: string; password: string }
) {
  try {
    return await allowSignup(() => auth.api.signUpEmail({ body: person, returnHeaders: true }))
  } catch (error) {
    if (error instanceof APIError && error.body?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') return null
    throw error
  }
}
