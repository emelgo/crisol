/**
 * Lo que la web necesita de las cuentas. La implementación real usa el cliente de Better Auth y la API del arranque;
 * las pruebas usan account/fake.ts.
 */
import { oauthProviderClient } from '@better-auth/oauth-provider/client'
import { createAuthClient } from 'better-auth/react'

export interface Account {
  name: string
  email: string
}

/** redirected: la página se va a otra dirección (OAuth) y no tiene que navegar */
export type Result = { ok: true; redirected?: boolean } | { ok: false; code: string }

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
  /** El nombre de una aplicación OAuth (Claude…), para la página de consentimiento */
  oauthClientName(clientId: string): Promise<string | null>
  /** Permite o no la conexión de la página de consentimiento y vuelve a la aplicación */
  consent(accept: boolean): Promise<Result>
  redeemBootstrap(input: BootstrapInput): Promise<Result>
}

/** Traduce el estado HTTP de un error de Better Auth a un código de la web */
export function errorCode(status: number | undefined): string {
  if (status === 401) return 'INVALID_CREDENTIALS'
  if (status === 429) return 'TOO_MANY_REQUESTS'
  return 'UNKNOWN'
}

/** Respuesta de Better Auth cuando hay que seguir en otra dirección (un flujo OAuth) */
const redirectUrl = (data: unknown) =>
  data && typeof data === 'object' && 'url' in data && typeof data.url === 'string' ? data.url : null

export function createAccountClient(): AccountClient {
  // El plugin añade la consulta firmada de la página (oauth_query) a las peticiones de entrar y de consentir
  const auth = createAuthClient({ basePath: '/api/auth', plugins: [oauthProviderClient()] })
  return {
    useAccount() {
      const { data, isPending } = auth.useSession()
      return { account: data ? { name: data.user.name, email: data.user.email } : null, pending: isPending }
    },
    async signIn(email, password) {
      const { data, error } = await auth.signIn.email({ email, password })
      if (error) return { ok: false, code: errorCode(error.status) }
      // Si se entraba para autorizar una aplicación (OAuth), se sigue con la autorización
      const next = redirectUrl(data)
      if (next) window.location.assign(next)
      return { ok: true, redirected: Boolean(next) }
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
    async oauthClientName(clientId) {
      const { data } = await auth.$fetch<{ client_name?: string }>('/oauth2/public-client', {
        query: { client_id: clientId }
      })
      return data?.client_name ?? null
    },
    async consent(accept) {
      const { data, error } = await auth.$fetch('/oauth2/consent', { method: 'POST', body: { accept } })
      if (error) return { ok: false, code: errorCode(error.status) }
      const next = redirectUrl(data)
      if (next) window.location.assign(next)
      return { ok: true, redirected: Boolean(next) }
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
