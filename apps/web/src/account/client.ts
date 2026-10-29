/**
 * Lo que la web necesita de las cuentas. La implementación real usa el cliente de Better Auth y la API del arranque;
 * las pruebas usan account/fake.ts.
 */
import { createAuthClient } from 'better-auth/react'

export interface Account {
  name: string
  email: string
}

export type Result = { ok: true } | { ok: false; code: string }

export interface BootstrapInput {
  secret: string
  name: string
  email: string
  password: string
}

export interface AccountClient {
  useAccount(): { account: Account | null; pending: boolean }
  signIn(email: string, password: string): Promise<Result>
  signOut(): Promise<void>
  rename(name: string): Promise<Result>
  bootstrapInfo(secret: string): Promise<{ organizationName: string } | null>
  redeemBootstrap(input: BootstrapInput): Promise<Result>
}

/** Traduce el estado HTTP de un error de Better Auth a un código de la web */
export function errorCode(status: number | undefined): string {
  if (status === 401) return 'INVALID_CREDENTIALS'
  if (status === 429) return 'TOO_MANY_REQUESTS'
  return 'UNKNOWN'
}

export function createAccountClient(): AccountClient {
  const auth = createAuthClient({ basePath: '/api/auth' })
  return {
    useAccount() {
      const { data, isPending } = auth.useSession()
      return { account: data ? { name: data.user.name, email: data.user.email } : null, pending: isPending }
    },
    async signIn(email, password) {
      const { error } = await auth.signIn.email({ email, password })
      return error ? { ok: false, code: errorCode(error.status) } : { ok: true }
    },
    async signOut() {
      await auth.signOut()
    },
    async rename(name) {
      const { error } = await auth.updateUser({ name })
      return error ? { ok: false, code: errorCode(error.status) } : { ok: true }
    },
    async bootstrapInfo(secret) {
      const response = await fetch(`/api/bootstrap/${encodeURIComponent(secret)}`)
      return response.ok ? ((await response.json()) as { organizationName: string }) : null
    },
    async redeemBootstrap(input) {
      const response = await fetch('/api/bootstrap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input)
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { code?: string }
        return { ok: false, code: body.code ?? errorCode(response.status) }
      }
      // La cookie de sesión ya está puesta: que el cliente vuelva a leer la sesión
      auth.$store.notify('$sessionSignal')
      return { ok: true }
    }
  }
}
