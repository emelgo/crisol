import Fastify, { type FastifyInstance } from 'fastify'
import { type HealthChecks, registerHealth } from './health.ts'

export interface AppDeps {
  checks: HealthChecks
  /** Cuánto se espera a cada servicio en /api/health */
  healthTimeoutMs?: number
  logger?: boolean
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false })
  registerHealth(app, deps.checks, deps.healthTimeoutMs ?? 2000)
  return app
}
