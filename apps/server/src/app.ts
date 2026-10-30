import { type Database, loadMemberships } from '@crisol/db'
import { actorFrom } from '@crisol/domain'
import fastifyRateLimit from '@fastify/rate-limit'
import fastifyWebsocket from '@fastify/websocket'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import type { ActionEnv } from './actions/context.ts'
import { implementationsByName } from './actions/implementations.ts'
import { registerActionRoutes } from './actions/routes.ts'
import type { Auth } from './auth/auth.ts'
import { registerAuthRoutes } from './auth/routes.ts'
import { registerBootstrapRoutes } from './bootstrap.ts'
import { registerCollabRoutes } from './collab/routes.ts'
import { createCollab, MAX_MESSAGE_BYTES } from './collab/server.ts'
import { type HealthChecks, registerHealth } from './health.ts'
import { redactSecrets, registerOriginGuard } from './http.ts'
import { registerJoinRoutes } from './join.ts'
import { registerMcpRoutes } from './mcp/routes.ts'
import { createRealtime } from './realtime/hub.ts'
import { type RealtimeRouteOptions, registerRealtimeRoutes } from './realtime/routes.ts'
import { registerWeb, webBuild } from './web.ts'
import { jsonOfDoc } from './wiki/content.ts'
import { linksOfStored } from './wiki/links.ts'
import { registerWikiRoutes } from './wiki/routes.ts'

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
  /** Cuánto espera una herramienta MCP la aprobación (las pruebas lo acortan) */
  approvalWaitMs?: number
}

export function buildApp(deps: AppDeps): FastifyInstance {
  // En el registro, cada petición sin los secretos de su URL
  const logger = {
    serializers: { req: (request: FastifyRequest) => ({ method: request.method, url: redactSecrets(request.url) }) }
  }
  const app = Fastify({ logger: deps.logger ? logger : false })
  registerHealth(app, deps.checks, deps.healthTimeoutMs ?? 2000)
  if (deps.accounts) {
    const { auth, db, publicUrl, sealKey } = deps.accounts
    // El bus del proceso: cada evento mira las pertenencias de quien lo recibiría, recién leídas
    const realtime = createRealtime(
      async (userId) => actorFrom(userId, await loadMemberships(db, userId)),
      (error) => app.log.error(error)
    )
    // Los documentos de Yjs de la wiki (ADR-0003)
    const collab = createCollab({
      db,
      onError: (error) => app.log.error(error),
      // Los enlaces salen del texto: se rehacen con cada guardado (env se crea justo después)
      onStored: ({ document, kind, userId, ...source }) =>
        linksOfStored(env, source, jsonOfDoc(document, kind === 'separate'), {
          kind,
          actorId: userId,
          onError: (error) => app.log.error(error)
        })
    })
    const env: ActionEnv = { db, publicUrl, sealKey, realtime, collab, actions: implementationsByName }
    // Límite de intentos solo donde se pide (las rutas de Better Auth tienen el suyo)
    app.register(fastifyRateLimit, { global: false })
    // Lo más que manda un cliente: un cambio de un documento (el canal en tiempo real corta antes: no escucha)
    app.register(fastifyWebsocket, { options: { maxPayload: MAX_MESSAGE_BYTES } })
    registerOriginGuard(app, publicUrl)
    registerAuthRoutes(app, auth)
    registerBootstrapRoutes(app, db, auth)
    registerActionRoutes(app, env, auth)
    // Dentro de register: así se añaden después de cargar los plugins que usan (límite de intentos, WebSocket)
    app.register(async (scope) => registerJoinRoutes(scope, env, auth))
    app.register(async (scope) => registerWikiRoutes(scope, env, auth))
    const build = deps.webDir ? webBuild(deps.webDir) : null
    app.register(async (scope) =>
      registerRealtimeRoutes(scope, { auth, publicUrl, realtime, build, ...deps.realtimeTimers })
    )
    app.register(async (scope) => registerCollabRoutes(scope, { auth, publicUrl, collab }))
    if (deps.mcpJwksUrl) {
      const wait = deps.approvalWaitMs ? { approvalWaitMs: deps.approvalWaitMs } : {}
      registerMcpRoutes(app, { ...env, auth, jwksUrl: deps.mcpJwksUrl, ...wait })
    }
  }
  if (deps.webDir) registerWeb(app, deps.webDir)
  return app
}
