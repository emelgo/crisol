import { cimd } from '@better-auth/cimd'
import { fetchClientMetadataResource } from '@better-auth/cimd/node'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { mcp } from '@better-auth/mcp'
import { authSchema, type Database, isOwner } from '@crisol/db'
import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'
import { jwt } from 'better-auth/plugins'
import { z } from 'zod'
import { signupAllowed } from './signup-gate.ts'

export interface AuthOptions {
  db: Database
  secret: string
  /** URL pública del sitio: de ella salen las cookies seguras y el origen en el que se confía */
  baseURL: string
  /** Otros orígenes desde los que se aceptan peticiones (Vite en desarrollo) */
  trustedOrigins?: string[]
}

const DAY = 60 * 60 * 24

/** El recurso MCP: los tokens del conector solo valen para él */
export const mcpResource = (baseURL: string) => new URL('/mcp', baseURL).toString()

const signupClosed = () => new APIError('FORBIDDEN', { message: 'El registro está cerrado', code: 'SIGNUP_CLOSED' })

const displayName = z.string().trim().min(1).max(80)

/** El perfil que se guarda: nombre visible de 1 a 80 caracteres y sin imagen (no hay en el módulo 0) */
function checkedProfile(user: { name?: unknown; image?: unknown }): { name?: string } {
  if (user.image !== undefined && user.image !== null) {
    throw new APIError('BAD_REQUEST', { message: 'Sin imagen de perfil', code: 'INVALID_PROFILE' })
  }
  if (user.name === undefined) return {}
  const name = displayName.safeParse(user.name)
  if (!name.success) throw new APIError('BAD_REQUEST', { message: 'Nombre no válido', code: 'INVALID_PROFILE' })
  return { name: name.data }
}

/** Los dominios de los clientes que se registran solos por CIMD (claude.ai) */
export const CIMD_HOSTS: ReadonlySet<string> = new Set(['claude.ai', 'claude.com'])

export function createAuth({ db, secret, baseURL, trustedOrigins = [] }: AuthOptions) {
  return betterAuth({
    secret,
    baseURL,
    basePath: '/api/auth',
    trustedOrigins,
    database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
    emailAndPassword: { enabled: true, minPasswordLength: 10, maxPasswordLength: 128, autoSignIn: true },
    session: { expiresIn: 30 * DAY, updateAge: DAY },
    // En la base de datos: sobrevive a reinicios y vale con varias instancias
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 5 }
      }
    },
    advanced: { useSecureCookies: baseURL.startsWith('https://') },
    // Conector MCP (ADR-0002): OAuth 2.1 con registro de clientes por CIMD, como prefiere claude.ai
    plugins: [
      jwt(),
      mcp({
        loginPage: '/entrar',
        consentPage: '/oauth/consentimiento',
        resource: mcpResource(baseURL),
        // Los clientes externos (claude.ai) se registran solos por CIMD; gestionar clientes a mano, solo el propietario
        clientPrivileges: async ({ user }) => (user ? isOwner(db, user.id) : false)
      }),
      cimd({
        fetchClientMetadataResource,
        metadataProfile: 'mcp-2026-07-28',
        // Módulo 0: solo se conecta Claude. Un cliente de otro dominio no se registra solo ni se hace pasar por él
        // (su nombre lo escribe quien publica sus metadatos), y el servidor no va a buscar documentos a cualquier sitio
        isMetadataDocumentUrlAllowed: (url) => CIMD_HOSTS.has(new URL(url).hostname)
      })
    ],
    hooks: {
      // Módulo 0: solo el propietario autoriza el conector (y /mcp lo vuelve a mirar en cada petición)
      before: createAuthMiddleware(async (ctx) => {
        // Registro cerrado antes de buscar el email: si no, la respuesta diría qué emails tienen cuenta
        if (ctx.path === '/sign-up/email' && !signupAllowed()) throw signupClosed()
        if (ctx.path !== '/oauth2/consent' || ctx.body?.accept !== true) return
        const session = await getSessionFromCtx(ctx)
        if (!session || !(await isOwner(db, session.user.id))) {
          throw new APIError('FORBIDDEN', { message: 'Solo el propietario puede conectar Claude', code: 'OWNER_ONLY' })
        }
      })
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!signupAllowed()) throw signupClosed()
            return { data: { ...user, ...checkedProfile(user) } }
          }
        },
        // El nombre lo ven sus compañeros, el máster y Claude: el mismo límite que al crear la cuenta
        update: {
          before: async (user) => ({ data: { ...user, ...checkedProfile(user) } })
        }
      }
    }
  })
}

export type Auth = ReturnType<typeof createAuth>
