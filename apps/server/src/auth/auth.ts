import { cimd } from '@better-auth/cimd'
import { fetchClientMetadataResource } from '@better-auth/cimd/node'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { mcp } from '@better-auth/mcp'
import { authSchema, type Database, isOwner } from '@crisol/db'
import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { jwt } from 'better-auth/plugins'
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
      cimd({ fetchClientMetadataResource, metadataProfile: 'mcp-2026-07-28' })
    ],
    databaseHooks: {
      user: {
        create: {
          before: async () => {
            if (!signupAllowed()) {
              throw new APIError('FORBIDDEN', { message: 'El registro está cerrado', code: 'SIGNUP_CLOSED' })
            }
          }
        }
      }
    }
  })
}

export type Auth = ReturnType<typeof createAuth>
