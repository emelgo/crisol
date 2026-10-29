import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { authSchema, type Database } from '@crisol/db'
import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
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
