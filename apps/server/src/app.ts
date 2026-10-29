import { type Database, loadMemberships } from '@crisol/db'
import { actorFrom } from '@crisol/domain'
import fastifyRateLimit from '@fastify/rate-limit'
import fastifyWebsocket from '@fastify/websocket'
import Fastify, { type FastifyInstance } from 'fastify'
import type { ActionEnv } from './actions/context.ts'
import { registerActionRoutes } from './actions/routes.ts'
import type { Auth } from './auth/auth.ts'
import { registerAuthRoutes } from './auth/routes.ts'
import { registerBootstrapRoutes } from './bootstrap.ts'
import { type HealthChecks, registerHealth } from './health.ts'
import { registerOriginGuard } from './http.ts'
import { registerJoinRoutes } from './join.ts'
import { registerMcpRoutes } from './mcp/routes.ts'
import { createRealtime } from './realtime/hub.ts'
import { type RealtimeRouteOptions, registerRealtimeRoutes } from './realtime/routes.ts'
import { registerWeb, webBuild } from './web.ts'

export interface AppDeps {
  checks: HealthChecks
  /** Cuánto se espera a cada servicio en /api/health */
  healthTimeoutMs?: number
  logger?: boolean
  /** La web compilada; sin ella, el servidor solo da la API */
  webDir?: string
  /** Cuentas y arranque; sin ellas el servidor solo da la salud y la web */
  accounts?: { auth: Auth; db: Database; publicUrl: string; sealKey: Buffer }
  /** El JWKS del propio servidor: con él se monta /mcp */
  mcpJwksUrl?: string
  /** Los relojes del canal en tiempo real (las pruebas los acortan) */
  realtimeTimers?: Pick<RealtimeRouteOptions, 'sessionCheckMs' | 'heartbeatMs'>
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false })
  registerHealth(app, deps.checks, deps.healthTimeoutMs ?? 2000)
  if (deps.accounts) {
    const { auth, db, publicUrl, sealKey } = deps.accounts
    // El bus del proceso: cada evento mira las pertenencias de quien lo recibiría, recién leídas
    const realtime = createRealtime(
      async (userId) => actorFrom(userId, await loadMemberships(db, userId)),
      (error) => app.log.error(error)
    )
    const env: ActionEnv = { db, publicUrl, sealKey, realtime }
    // Límite de intentos solo donde se pide (las rutas de Better Auth tienen el suyo)
    app.register(fastifyRateLimit, { global: false })
    // Los mensajes del cliente no se usan: se corta cualquier cosa grande
    app.register(fastifyWebsocket, { options: { maxPayload: 1024 } })
    registerOriginGuard(app, publicUrl)
    registerAuthRoutes(app, auth)
    registerBootstrapRoutes(app, db, auth)
    registerActionRoutes(app, env, auth)
    // Dentro de register: así se añaden después de cargar los plugins que usan (límite de intentos, WebSocket)
    app.register(async (scope) => registerJoinRoutes(scope, env, auth))
    const build = deps.webDir ? webBuild(deps.webDir) : null
    app.register(async (scope) =>
      registerRealtimeRoutes(scope, { auth, publicUrl, realtime, build, ...deps.realtimeTimers })
    )
    if (deps.mcpJwksUrl) registerMcpRoutes(app, { ...env, auth, jwksUrl: deps.mcpJwksUrl })
  }
  if (deps.webDir) registerWeb(app, deps.webDir)
  return app
}
