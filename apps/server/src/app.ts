import { campaignsRepo, type Database, loadMemberships } from '@crisol/db'
import { actorFrom, can } from '@crisol/domain'
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
import type { SessionTimes } from './collab/sessions.ts'
import { registerFileRoutes } from './files/routes.ts'
import type { Storage } from './files/storage.ts'
import { type HealthChecks, registerHealth } from './health.ts'
import { redactSecrets, registerOriginGuard } from './http.ts'
import { registerJoinRoutes } from './join.ts'
import type { Embedder } from './library/embedder.ts'
import type { LibraryJobs } from './library/jobs.ts'
import { registerMcpRoutes } from './mcp/routes.ts'
import { tablePresenceChanged } from './realtime/events.ts'
import { createRealtime, type Realtime } from './realtime/hub.ts'
import { type RealtimeRouteOptions, registerRealtimeRoutes } from './realtime/routes.ts'
import { createTablePresence } from './table/presence.ts'
import { loadTable } from './table/projection.ts'
import { createTableRooms, type LoadTable, type TableRooms } from './table/rooms.ts'
import { registerTableRoutes } from './table/routes.ts'
import { createSoundClock } from './table/sound.ts'
import { createVision } from './table/vision.ts'
import { registerWeb, webBuild } from './web.ts'
import { boardElements, boardJson, isBoard } from './wiki/board.ts'
import { jsonOfDoc } from './wiki/content.ts'
import { linksOfStored } from './wiki/links.ts'
import type { PdfRenderer } from './wiki/pdf.ts'
import { actorPageView } from './wiki/reader.ts'
import { registerWikiRoutes } from './wiki/routes.ts'
import { closeSession, recoverSession } from './wiki/versions.ts'

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
  /** Cuánto duran las sesiones de edición (las pruebas las acortan) */
  sessionTimes?: SessionTimes
  /** Donde van los bytes de los archivos; sin él, no se pueden subir */
  storage?: Storage
  /** Lo más que pesa un archivo (las pruebas lo bajan) */
  maxFileBytes?: number
  /** El PDF de las hojas, con la dirección por dentro del servidor (sin él, «Descargar PDF» no está) */
  pdf?: { renderer: PdfRenderer; internalUrl: string }
  /** Leer el texto de los PDF en segundo plano; sin ello, no se leen */
  library?: LibraryJobs
  /** El modelo de la búsqueda por significado; sin él, solo por palabras */
  embedder?: Embedder
}

export function buildApp(deps: AppDeps): FastifyInstance {
  // En el registro, cada petición sin los secretos de su URL
  const logger = {
    serializers: { req: (request: FastifyRequest) => ({ method: request.method, url: redactSecrets(request.url) }) }
  }
  const app = Fastify({ logger: deps.logger ? logger : false })
  // Un fallo inesperado va al registro, no a quien pidió: su mensaje puede llevar consultas o rutas internas
  app.setErrorHandler((error, request, reply) => {
    const status = (error as { statusCode?: number }).statusCode ?? 500
    if (status < 500) return reply.send(error)
    request.log.error(error)
    return reply.code(status).send({ code: 'INTERNAL' })
  })
  registerHealth(app, deps.checks, deps.healthTimeoutMs ?? 2000)
  if (deps.accounts) {
    const { auth, db, publicUrl, sealKey } = deps.accounts
    // El bus del proceso: cada evento mira las pertenencias de quien lo recibiría, recién leídas
    const bus = createRealtime(
      async (userId) => actorFrom(userId, await loadMemberships(db, userId)),
      (error) => app.log.error(error),
      // Lo de una página, a un jugador solo si la ve (ADR-0017)
      (actor, worldId) => actorPageView(db, actor, worldId)
    )
    // Los documentos de Yjs de la wiki (ADR-0003)
    const collab = createCollab({
      db,
      onError: (error) => app.log.error(error),
      // Los enlaces salen del texto: se rehacen con cada guardado (env se crea justo después)
      // Las sesiones de edición: al cerrarse, su versión; al cargar, por si quedó una a medias
      onSessionClosed: (session) => closeSession(env, session),
      onBodyLoaded: (page) => recoverSession(env, page),
      ...(deps.sessionTimes ? { sessionTimes: deps.sessionTimes } : {}),
      onStored: ({ document, kind, userId, ...source }) =>
        // Una pizarra no es texto: sus tarjetas, sus imágenes y sus notas, como si lo fueran (docs/specs/pizarra.md)
        linksOfStored(
          env,
          source,
          isBoard(document) ? boardJson(boardElements(document)) : jsonOfDoc(document, kind === 'separate'),
          {
            kind,
            actorId: userId,
            onError: (error) => app.log.error(error)
          }
        )
    })
    // Las salas de la mesa: cada una vuelve a leer su mesa de la base cuando algo cambia (ADR-0018). Lo que cambia en
    // las criaturas en juego o en los personajes de una campaña (sus PG, sus estados) llega a sus fichas por el bus
    let load: LoadTable = async () => null
    // La vista del grupo: su hilo arranca la primera vez que hace falta y se para al cerrar
    const vision = createVision(db, (error) => app.log.error(error))
    app.addHook('onClose', async () => {
      await vision.close()
    })
    const rooms = createTableRooms(
      (campaignId) => load(campaignId),
      (error) => app.log.error(error)
    )
    // Lo que cambia en una mesa o en una escena deja sin valer su vista guardada (las teselas de la pantalla la miran)
    const table: TableRooms = {
      ...rooms,
      changed(campaignId) {
        vision.invalidate({ campaignId })
        rooms.changed(campaignId)
      },
      sceneChanged(sceneId) {
        vision.invalidate({ sceneId })
        rooms.sceneChanged(sceneId)
      }
    }
    const realtime: Realtime = {
      ...bus,
      publish: (...events) => {
        bus.publish(...events)
        for (const { message } of events)
          if (message.type === 'changed' && (message.what === 'creatures' || message.what === 'party'))
            table.changed(message.campaignId)
      }
    }
    const presence = createTablePresence()
    // El reloj del sonido: retoma lo que sonaba al arrancar y se para al cerrar (docs/specs/sonido.md)
    const sound = createSoundClock({ db, rooms: table, onError: (error) => app.log.error(error) })
    app.addHook('onReady', async () => {
      await sound.recover().catch((error) => app.log.error(error))
    })
    app.addHook('onClose', async () => {
      sound.close()
    })
    const env: ActionEnv = {
      db,
      publicUrl,
      sealKey,
      realtime,
      collab,
      table,
      presence,
      vision,
      sound,
      actions: implementationsByName,
      ...(deps.storage ? { storage: deps.storage } : {}),
      ...(deps.library ? { library: deps.library } : {}),
      ...(deps.embedder ? { embedder: deps.embedder } : {})
    }
    load = loadTable(env)
    // Límite de intentos solo donde se pide (las rutas de Better Auth tienen el suyo)
    app.register(fastifyRateLimit, { global: false })
    // Lo más que manda un cliente: un cambio de un documento (el canal en tiempo real corta antes: no escucha)
    app.register(fastifyWebsocket, { options: { maxPayload: MAX_MESSAGE_BYTES } })
    registerOriginGuard(app, publicUrl, deps.pdf ? [deps.pdf.internalUrl] : [])
    registerAuthRoutes(app, auth)
    registerBootstrapRoutes(app, db, auth)
    registerActionRoutes(app, env, auth)
    // Dentro de register: así se añaden después de cargar los plugins que usan (límite de intentos, WebSocket)
    app.register(async (scope) => registerJoinRoutes(scope, env, auth))
    app.register(async (scope) => registerWikiRoutes(scope, env, auth, deps.pdf?.renderer))
    app.register(async (scope) =>
      registerFileRoutes(scope, env, auth, deps.maxFileBytes ? { maxBytes: deps.maxFileBytes } : {})
    )
    const build = deps.webDir ? webBuild(deps.webDir) : null
    app.register(async (scope) =>
      registerRealtimeRoutes(scope, {
        auth,
        publicUrl,
        realtime,
        build,
        ...deps.realtimeTimers,
        // Quién tiene abierta una campaña fuera de la Mesa (docs/specs/sala.md): solo si es de ella
        onFocus: (key, userId, campaignId) => void campaignFocus(env, key, userId, campaignId)
      })
    )
    app.register(async (scope) => registerCollabRoutes(scope, { auth, publicUrl, collab }))
    app.register(async (scope) =>
      registerTableRoutes(scope, { ...env, table }, auth, { publicUrl, ...deps.realtimeTimers })
    )
    if (deps.mcpJwksUrl) {
      const wait = deps.approvalWaitMs ? { approvalWaitMs: deps.approvalWaitMs } : {}
      registerMcpRoutes(app, { ...env, auth, jwksUrl: deps.mcpJwksUrl, ...wait })
    }
  }
  if (deps.webDir) registerWeb(app, deps.webDir)
  return app
}

/** Apunta qué campaña tiene abierta una pestaña (si la cuenta es de ella) y avisa a las campañas cuya lista cambia */
async function campaignFocus(env: ActionEnv, key: object, userId: string, campaignId: string | null) {
  let target = campaignId
  if (target) {
    const campaign = await campaignsRepo.findCampaign(env.db, target)
    const actor = actorFrom(userId, await loadMemberships(env.db, userId))
    if (!campaign || !can(actor, 'campaign.read', { campaignId: target, worldId: campaign.worldId })) target = null
  }
  for (const changed of env.presence?.focus(key, { userId, campaignId: target }) ?? []) {
    const campaign = await campaignsRepo.findCampaign(env.db, changed)
    if (campaign) env.realtime.publish(tablePresenceChanged({ campaignId: changed, worldId: campaign.worldId }))
  }
}
