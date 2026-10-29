import Fastify, { type FastifyInstance } from 'fastify'
import { type HealthChecks, registerHealth } from './health.ts'
import { registerWeb } from './web.ts'

export interface AppDeps {
  checks: HealthChecks
  /** Cuánto se espera a cada servicio en /api/health */
  healthTimeoutMs?: number
  logger?: boolean
  /** La web compilada; sin ella, el servidor solo da la API */
  webDir?: string
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false })
  registerHealth(app, deps.checks, deps.healthTimeoutMs ?? 2000)
  if (deps.webDir) registerWeb(app, deps.webDir)
  return app
}
