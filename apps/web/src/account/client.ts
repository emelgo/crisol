/**
 * Lo que la web necesita de las cuentas. La implementación real usa el cliente de Better Auth y la API del arranque;
 * las pruebas usan account/fake.ts.
 */
import { oauthProviderClient } from '@better-auth/oauth-provider/client'
import { inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export interface Account {
  /** Su id (para saber qué es suyo: sus tiradas) */
  id?: string
  /** El nombre de usuario: el apodo que se ve en la app */
  name: string
  email: string
  firstName?: string
  lastName?: string
  /** El color de sus dados (#rrggbb), o null sin elegir */
  diceColor?: string | null
  /** Si le caen en la pantalla los dados de los demás */
  diceOthers?: boolean
}

/** redirected: la página se va a otra dirección (OAuth) y no tiene que navegar */
export type Result = { ok: true; redirected?: boolean } | { ok: false; code: string }

export interface BootstrapInput {
  secret: string
  /** El nombre de usuario: el apodo que se ve en la app */
  name: string
  firstName: string
  lastName: string
  email: string
  password: string
}

/** Lo que enseña la página de un enlace de invitación */
export interface InvitationInfo {
  campaignName: string
  worldName: string
  masterName: string | null
}

/** Al unirse: joined (entra ahora), member (ya estaba), master (es su máster); y adónde lleva */
export type JoinResult =
  | { ok: true; status: 'joined' | 'member' | 'master'; worldId: string; campaignId: string }
  | { ok: false; code: string }

export interface AccountClient {
  useAccount(): { account: Account | null; pending: boolean }
  signIn(email: string, password: string): Promise<Result>
  signOut(): Promise<void>
  /** Vuelve a pedir la sesión al servidor (cuando algo dice que ya no la hay) */
  refreshSession(): void
  rename(name: string): Promise<Result>
  /** Nombre de usuario (si no lo tiene otra cuenta), nombre y apellido(s) */
  updateProfile(profile: {
    name: string
    firstName: string
    lastName: string
    diceColor?: string | null
  }): Promise<Result>
  /** Las preferencias de los dados: su color (null: automático) y si ver caer los de los demás */
  updateDice(dice: { diceOthers?: boolean; diceColor?: string | null }): Promise<Result>
  /** Con la actual; cierra las demás sesiones */
  changePassword(current: string, next: string): Promise<Result>
  bootstrapInfo(secret: string): Promise<{ organizationName: string } | null>
  /** El nombre de una aplicación OAuth (Claude…), para la página de consentimiento */
  oauthClientName(clientId: string): Promise<string | null>
  /** Permite o no la conexión de la página de consentimiento y vuelve a la aplicación */
  consent(accept: boolean): Promise<Result>
  /** La invitación de un enlace, o null si no vale (desconocido, cambiado o cerrado) */
  invitationInfo(secret: string): Promise<InvitationInfo | null>
  /** Unirse con sesión */
  join(secret: string): Promise<JoinResult>
  /** Crear la cuenta y unirse en la misma petición */
  signUpAndJoin(input: BootstrapInput): Promise<JoinResult>
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

async function joinRequest(url: string, body: object): Promise<JoinResult> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data = (await response.json().catch(() => ({}))) as { code?: string } & Partial<JoinResult>
  if (!response.ok) return { ok: false, code: data.code ?? errorCode(response.status) }
  return { ...(data as Extract<JoinResult, { ok: true }>), ok: true }
}

export function createAccountClient(): AccountClient {
  // El plugin añade la consulta firmada de la página (oauth_query) a las peticiones de entrar y de consentir
  const auth = createAuthClient({
    basePath: '/api/auth',
    plugins: [
      oauthProviderClient(),
      // Los campos propios de la cuenta (additionalFields en el servidor), con su tipo
      inferAdditionalFields({
        user: {
          firstName: { type: 'string', required: false },
          lastName: { type: 'string', required: false },
          diceColor: { type: 'string', required: false },
          diceOthers: { type: 'boolean', required: false }
        }
      })
    ]
  })
  return {
    useAccount() {
      const { data, isPending } = auth.useSession()
      // Nombre y apellido(s) son campos propios de la cuenta (additionalFields en el servidor)
      const extra = (data?.user ?? {}) as {
        firstName?: unknown
        lastName?: unknown
        diceColor?: unknown
        diceOthers?: unknown
      }
      return {
        account: data
          ? {
              id: data.user.id,
              name: data.user.name,
              email: data.user.email,
              firstName: typeof extra.firstName === 'string' ? extra.firstName : '',
              lastName: typeof extra.lastName === 'string' ? extra.lastName : '',
              diceColor: typeof extra.diceColor === 'string' ? extra.diceColor : null,
              diceOthers: extra.diceOthers !== false
            }
          : null,
        pending: isPending
      }
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
    refreshSession() {
      auth.$store.notify('$sessionSignal')
    },
    async rename(name) {
      const { error } = await auth.updateUser({ name })
      return error ? { ok: false, code: errorCode(error.status) } : { ok: true }
    },
    async updateProfile(profile) {
      const { error } = await auth.updateUser(profile as { name: string })
      if (!error) return { ok: true }
      return { ok: false, code: error.code === 'USERNAME_TAKEN' ? 'USERNAME_TAKEN' : errorCode(error.status) }
    },
    async updateDice(dice) {
      const { error } = await auth.updateUser(dice)
      return error ? { ok: false, code: errorCode(error.status) } : { ok: true }
    },
    async changePassword(current, next) {
      const { error } = await auth.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true
      })
      if (!error) return { ok: true }
      return { ok: false, code: error.code === 'INVALID_PASSWORD' ? 'WRONG_PASSWORD' : errorCode(error.status) }
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
    async invitationInfo(secret) {
      const response = await fetch(`/api/join/${encodeURIComponent(secret)}`)
      return response.ok ? ((await response.json()) as InvitationInfo) : null
    },
    async join(secret) {
      return joinRequest('/api/join', { secret })
    },
    async signUpAndJoin(input) {
      const result = await joinRequest('/api/join/signup', input)
      // La cookie de sesión ya está puesta: que el cliente vuelva a leer la sesión
      if (result.ok) auth.$store.notify('$sessionSignal')
      return result
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
