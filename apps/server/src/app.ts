import type { Database } from '@crisol/db'
import Fastify, { type FastifyInstance } from 'fastify'
import type { Auth } from './auth/auth.ts'
import { registerAuthRoutes } from './auth/routes.ts'
import { registerBootstrapRoutes } from './bootstrap.ts'
import { type HealthChecks, registerHealth } from './health.ts'
import { registerWeb } from './web.ts'

export interface AppDeps {
  checks: HealthChecks
  /** Cuánto se espera a cada servicio en /api/health */
  healthTimeoutMs?: number
  logger?: boolean
  /** La web compilada; sin ella, el servidor solo da la API */
  webDir?: string
  /** Cuentas y arranque; sin ellas el servidor solo da la salud y la web */
  accounts?: { auth: Auth; db: Database }
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false })
  registerHealth(app, deps.checks, deps.healthTimeoutMs ?? 2000)
  if (deps.accounts) {
    registerAuthRoutes(app, deps.accounts.auth)
    registerBootstrapRoutes(app, deps.accounts.db, deps.accounts.auth)
  }
  if (deps.webDir) registerWeb(app, deps.webDir)
  return app
}
