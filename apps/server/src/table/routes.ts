/**
 * Las rutas de la mesa (ADR-0018): su WebSocket (/api/table), por el que cada conexión recibe su proyección, y las
 * teselas de las escenas: subirlas (quien lleva la wiki), pedirlas el máster (todas) y pedirlas la pantalla de la tele
 * (solo las de la escena presentada que tocan lo explorado o lo visible; las del borde, recortadas si la campaña lo
 * pide: docs/specs/vision.md)
 */
import type { Readable } from 'node:stream'
import {
  MAX_TILE_BYTES,
  TABLE_CLOSE_KICKED,
  type TableServerMessage,
  type TableViewer,
  tableClientMessage
} from '@crisol/contracts'
import { campaignsRepo, loadMemberships, scenesRepo } from '@crisol/db'
import { actorFrom, can } from '@crisol/domain'
import { type FogGrid, hasTile, type TileRef, tilePyramid, tileWorldRect } from '@crisol/tabletop'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { authorizedPage, authorizedScene } from '../actions/access.ts'
import { type ActionContext, type ActionEnv, errorCode } from '../actions/context.ts'
import type { Auth } from '../auth/auth.ts'
import { TooLargeError } from '../files/storage.ts'
import { clientIp, toHeaders } from '../http.ts'
import { tablePresenceChanged } from '../realtime/events.ts'
import { CLOSE_SESSION_ENDED } from '../realtime/routes.ts'
import { visionOf } from './projection.ts'
import type { TableRooms } from './rooms.ts'
import { maskSignature, tileCoverage } from './tile-crop.ts'
import type { VisionResult } from './vision.ts'

type Campaign = NonNullable<Awaited<ReturnType<typeof campaignsRepo.findCampaign>>>

export interface TableRouteOptions {
  /** Cada cuánto se vuelve a comprobar la sesión y el permiso (si caducan, la conexión se cierra) */
  sessionCheckMs?: number
  heartbeatMs?: number
}

/** Lo más que manda un cliente por el canal de la mesa, y cuántos mensajes en vivo por segundo se reenvían */
const MAX_TABLE_MESSAGE = 4096
const MAX_LIVE_PER_SECOND = 60

const tileParams = z.object({
  version: z.uuid(),
  level: z.coerce.number().int().min(0).max(15),
  x: z.coerce.number().int().min(0).max(1000),
  y: z.coerce.number().int().min(0).max(1000)
})

/** Una tesela es un WebP: RIFF, su tamaño y WEBP */
const isWebp = (head: Uint8Array) =>
  head.length >= 12 &&
  String.fromCharCode(...head.subarray(0, 4)) === 'RIFF' &&
  String.fromCharCode(...head.subarray(8, 12)) === 'WEBP'

/**
 * Cómo puede cargar la pantalla una tesela de la escena presentada, con lo que puede ver (lo explorado y lo visible):
 * nada si no lo toca; entera si cae dentro; recortada si pisa el borde. Con «enteras», las del borde van enteras solo
 * en el nivel de más detalle (asoma como mucho una tesela), sin guardarse en el navegador (`edge`): las de los niveles reducidos cubren mucho mapa (la de
 * arriba, el mapa entero) y se recortan siempre, o la tele tendría el mapa entero en pequeño
 */
export function screenTileAllowed(
  mask: FogGrid,
  scene: { width: number; height: number; tileSize: number },
  tile: TileRef,
  fit: 'whole' | 'cropped'
): 'deny' | 'whole' | 'edge' | 'crop' {
  const pyramid = tilePyramid(scene.width, scene.height, scene.tileSize)
  if (!hasTile(pyramid, tile)) return 'deny'
  const coverage = tileCoverage(mask, tileWorldRect(pyramid, tile))
  if (coverage === 'none') return 'deny'
  if (coverage === 'full') return 'whole'
  // La del borde, entera pero sin guardarse en el navegador: al pasar a «recortadas» se pide otra vez
  return fit === 'whole' && tile.level === 0 ? 'edge' : 'crop'
}

/** Las teselas recortadas que ya se hicieron, por tesela y huella de su máscara (las últimas) */
const CROPPED_KEEP = 256

/** Los bytes de un flujo */
async function readAll(stream: Readable) {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return new Uint8Array(Buffer.concat(chunks))
}

/** Lo que se espera para avisar de quién está en la Mesa (juntando los cambios de entre medias) */
const PRESENCE_MS = 300

export function registerTableRoutes(
  app: FastifyInstance,
  env: ActionEnv & { table: TableRooms },
  auth: Auth,
  options: TableRouteOptions & { publicUrl: string } = { publicUrl: env.publicUrl }
) {
  const allowed = new URL(options.publicUrl).origin
  const { table } = env
  // El cuerpo de una tesela es la imagen tal cual: se pasa sin leer, como flujo
  app.addContentTypeParser('image/webp', (_request, payload, done) => done(null, payload))

  const contextOf = async (request: FastifyRequest): Promise<ActionContext | null> => {
    const session = await auth.api.getSession({ headers: toHeaders(request.headers) })
    if (!session) return null
    return { ...env, actor: actorFrom(session.user.id, await loadMemberships(env.db, session.user.id)), via: 'ui' }
  }

  const fail = (reply: FastifyReply, error: unknown) => {
    if (error instanceof TooLargeError) return reply.code(413).send({ code: 'TOO_LARGE', maxBytes: MAX_TILE_BYTES })
    const code = errorCode(error)
    if (code === 'NOT_FOUND') return reply.code(404).send({ code })
    if (code === 'FORBIDDEN') return reply.code(403).send({ code })
    if (code) return reply.code(400).send({ code })
    throw error
  }

  const sendTile = async (reply: FastifyReply, found: { storageKey: string; bytes: number } | null, keep = true) => {
    if (!found || !env.storage) return reply.code(404).send({ code: 'NOT_FOUND' })
    // Una tesela no cambia nunca: su versión va en la ruta (salvo la del borde de la pantalla, que puede recortarse)
    return reply
      .header('cache-control', keep ? 'private, max-age=31536000, immutable' : 'private, no-store')
      .header('x-content-type-options', 'nosniff')
      .header('cross-origin-resource-policy', 'same-origin')
      .header('content-type', 'image/webp')
      .header('content-length', found.bytes)
      .send(env.storage.read(found.storageKey))
  }

  // Muchas seguidas al trocear un mapa grande: el límite es holgado
  const uploads = { config: { rateLimit: { max: 6000, timeWindow: '1 minute', keyGenerator: clientIp } } }

  app.put('/api/scenes/:sceneId/tiles/:version/:level/:x/:y', uploads, async (request, reply) => {
    const ctx = await contextOf(request)
    if (!ctx) return reply.code(401).send({ code: 'UNAUTHENTICATED' })
    const params = tileParams.extend({ sceneId: z.uuid() }).safeParse(request.params)
    if (!params.success || !env.storage) return reply.code(404).send({ code: 'NOT_FOUND' })
    const { sceneId, ...at } = params.data
    try {
      const { scene } = await authorizedScene(ctx, 'page.write', sceneId)
      if (Number(request.headers['content-length'] ?? 0) > MAX_TILE_BYTES) throw new TooLargeError()
      const stored = await env.storage.write(scene.worldId, request.body as Readable, MAX_TILE_BYTES)
      if (!isWebp(stored.head)) {
        await env.storage.remove(stored.key)
        return reply.code(415).send({ code: 'BAD_TYPE' })
      }
      const old = await scenesRepo.putTile(ctx.db, { sceneId, ...at, storageKey: stored.key, bytes: stored.size })
      if (old) await env.storage.remove(old)
      return reply.code(204).send()
    } catch (error) {
      return fail(reply, error)
    }
  })

  app.get('/api/scenes/:sceneId/tiles/:version/:level/:x/:y', async (request, reply) => {
    const ctx = await contextOf(request)
    if (!ctx) return reply.code(401).send({ code: 'UNAUTHENTICATED' })
    const params = tileParams.extend({ sceneId: z.uuid() }).safeParse(request.params)
    if (!params.success) return reply.code(404).send({ code: 'NOT_FOUND' })
    const { sceneId, ...at } = params.data
    try {
      await authorizedScene(ctx, 'page.read', sceneId)
      return sendTile(reply, await scenesRepo.findTile(ctx.db, { sceneId, ...at }))
    } catch (error) {
      return fail(reply, error)
    }
  })

  const cropped = new Map<string, Uint8Array>()
  /**
   * La vista que se está calculando para las teselas, por campaña y escena: las que llegan a la vez (la pantalla pide
   * muchas al cargar) esperan a la misma en vez de calcular cada una la suya
   */
  const viewing = new Map<string, Promise<VisionResult | null>>()
  const screenVision = (ctx: ActionContext, campaign: Campaign, scene: scenesRepo.SceneRow) => {
    const fresh = env.vision?.peek(campaign.id, scene.id)
    if (fresh) return Promise.resolve(fresh)
    const key = `${campaign.id}:${scene.id}`
    let running = viewing.get(key)
    if (!running) {
      running = visionOf(ctx, campaign, scene).finally(() => viewing.delete(key))
      viewing.set(key, running)
    }
    return running
  }

  // Lo que ve el grupo (la tele y la Mesa de cada jugador): solo la escena presentada (sin ocultar), en su versión de
  // ahora, y lo que su vista deja
  app.get('/api/campaigns/:campaignId/screen/tiles/:version/:level/:x/:y', async (request, reply) => {
    const ctx = await contextOf(request)
    if (!ctx) return reply.code(401).send({ code: 'UNAUTHENTICATED' })
    const params = tileParams.extend({ campaignId: z.uuid() }).safeParse(request.params)
    if (!params.success) return reply.code(404).send({ code: 'NOT_FOUND' })
    const { campaignId, ...at } = params.data
    const campaign = await campaignsRepo.findCampaign(ctx.db, campaignId)
    if (!campaign || !can(ctx.actor, 'campaign.read', { campaignId, worldId: campaign.worldId }))
      return reply.code(404).send({ code: 'NOT_FOUND' })
    const mesa = await scenesRepo.campaignTable(ctx.db, campaignId)
    const scene = mesa.presentedSceneId ? await scenesRepo.findScene(ctx.db, mesa.presentedSceneId) : null
    if (
      !scene ||
      mesa.screenHidden ||
      !scene.tiles ||
      scene.tiles.version !== at.version ||
      !scene.width ||
      !scene.height
    )
      return reply.code(404).send({ code: 'NOT_FOUND' })
    // Lo que ve el grupo: la vista guardada si nada ha cambiado desde entonces o, si no, calculada ahora
    const vision = await screenVision(ctx, campaign, scene)
    if (!vision) return reply.code(404).send({ code: 'NOT_FOUND' })
    const size = { width: scene.width, height: scene.height, tileSize: scene.tiles.size }
    const allowed = screenTileAllowed(vision.screenMask, size, at, mesa.tileFit)
    if (allowed === 'deny') return reply.code(404).send({ code: 'NOT_FOUND' })
    const found = await scenesRepo.findTile(ctx.db, { sceneId: scene.id, ...at })
    if (allowed === 'whole' || allowed === 'edge') return sendTile(reply, found, allowed === 'whole')
    if (!found || !env.storage || !env.vision) return reply.code(404).send({ code: 'NOT_FOUND' })
    // Recortada con la máscara: cambia según se explora, así que no se guarda en el navegador
    const rect = tileWorldRect(tilePyramid(size.width, size.height, size.tileSize), at)
    const key = `${scene.id}:${at.version}:${at.level}:${at.x}:${at.y}:${maskSignature(vision.screenMask, rect)}`
    let bytes = cropped.get(key)
    if (!bytes) {
      bytes = await env.vision.crop({
        bytes: await readAll(env.storage.read(found.storageKey)),
        mask: vision.screenMaskData,
        tile: at,
        tileSize: size.tileSize
      })
      cropped.set(key, bytes)
      if (cropped.size > CROPPED_KEEP) cropped.delete(cropped.keys().next().value as string)
    }
    return reply
      .header('cache-control', 'private, no-store')
      .header('x-content-type-options', 'nosniff')
      .header('cross-origin-resource-policy', 'same-origin')
      .header('content-type', 'image/webp')
      .header('content-length', bytes.byteLength)
      .send(Buffer.from(bytes))
  })

  // Lo que para cada conexión: al cerrar el servidor se para todo
  const stops = new Set<() => void>()
  app.addHook('onClose', async () => {
    for (const stop of stops) stop()
  })
  const users = new WeakMap<FastifyRequest, string>()
  // Quién está en la Mesa: se avisa como mucho una vez por campaña cada poco (entrar, salir o cambiar de pestaña muchas
  // veces seguidas no inunda a la campaña de avisos ni de lecturas)
  const announcing = new Map<string, ReturnType<typeof setTimeout>>()
  const announce = (scope: { campaignId: string; worldId: string }) => {
    if (announcing.has(scope.campaignId)) return
    announcing.set(
      scope.campaignId,
      setTimeout(() => {
        announcing.delete(scope.campaignId)
        env.realtime.publish(tablePresenceChanged(scope))
      }, PRESENCE_MS)
    )
  }
  app.addHook('onClose', async () => {
    for (const timer of announcing.values()) clearTimeout(timer)
    announcing.clear()
  })

  app.get(
    '/api/table',
    {
      websocket: true,
      preValidation: async (request, reply) => {
        if (request.headers.origin !== allowed) return reply.code(403).send({ code: 'BAD_ORIGIN' })
        const session = await auth.api.getSession({ headers: toHeaders(request.headers) })
        if (session) users.set(request, session.user.id)
      }
    },
    (socket, request) => {
      const userId = users.get(request)
      if (!userId) return socket.close(CLOSE_SESSION_ENDED)
      const say = (message: TableServerMessage) => socket.send(JSON.stringify(message))
      let joined: { campaignId: string; worldId: string; viewer: TableViewer; leave: () => void } | null = null
      let joining = false
      let closed = false
      let window = { start: 0, count: 0 }

      /**
       * Si la cuenta sigue pudiendo mirar la mesa de esa campaña así (con sus pertenencias de ahora): el máster y la tele,
       * quien la lleva; la Mesa de un jugador, cualquiera de la campaña
       */
      const allowedNow = async (campaignId: string, worldId: string, viewer: TableViewer) =>
        can(
          actorFrom(userId, await loadMemberships(env.db, userId)),
          viewer === 'player' ? 'campaign.read' : 'table.manage',
          { campaignId, worldId }
        )

      socket.on('message', async (data: Buffer) => {
        if (data.byteLength > MAX_TABLE_MESSAGE) return socket.close(1009, 'Demasiado grande')
        let parsed: ReturnType<typeof tableClientMessage.safeParse>
        try {
          parsed = tableClientMessage.safeParse(JSON.parse(data.toString('utf8')))
        } catch {
          parsed = tableClientMessage.safeParse(null)
        }
        if (!parsed.success) return say({ type: 'error', code: 'BAD_MESSAGE' })
        const message = parsed.data
        if (message.type === 'join') {
          if (joined || joining) return say({ type: 'error', code: 'BAD_MESSAGE' })
          joining = true
          const campaign = await campaignsRepo.findCampaign(env.db, message.campaignId)
          // Quien no está en ella no entra; un jugador, solo a su Mesa (lo que ve el grupo)
          if (!campaign || !(await allowedNow(campaign.id, campaign.worldId, message.view))) {
            say({ type: 'error', code: campaign ? 'FORBIDDEN' : 'NOT_FOUND' })
            return socket.close(4403, 'Sin permiso')
          }
          // A quien echó el máster, su Mesa de jugador no le deja entrar hasta que le deje volver (docs/specs/sala.md)
          if (
            message.view === 'player' &&
            (await scenesRepo.campaignTable(env.db, campaign.id)).kicked.includes(userId)
          ) {
            say({ type: 'error', code: 'KICKED' })
            return socket.close(TABLE_CLOSE_KICKED, 'Fuera de la Mesa')
          }
          const leaveRoom = await table.join(campaign.id, message.view, socket)
          // Se cerró mientras entraba: fuera ya
          if (closed) return leaveRoom()
          const scope = { campaignId: campaign.id, worldId: campaign.worldId }
          // Quién está en la Mesa: entra (y sale con la conexión)
          env.presence?.add(campaign.id, socket, {
            userId,
            viewer: message.view,
            close: () => {
              say({ type: 'error', code: 'KICKED' })
              socket.close(TABLE_CLOSE_KICKED, 'Fuera de la Mesa')
            }
          })
          announce(scope)
          const leave = () => {
            leaveRoom()
            env.presence?.remove(scope.campaignId, socket)
            announce(scope)
          }
          joined = { campaignId: campaign.id, worldId: campaign.worldId, viewer: message.view, leave }
          // Lo que suena, puesto al día: quien entra tarde va por donde va (docs/specs/sonido.md)
          if (env.sound) {
            const sound = await env.sound.view(campaign.id).catch(() => null)
            // Sin nada sonando no hace falta: el aparato empieza en silencio
            if (sound && !closed && (sound.voices.length > 0 || sound.lists.length > 0))
              say({ type: 'sound', sound, serverNow: Date.now() })
          }
          return
        }
        if (!joined) return say({ type: 'error', code: 'NOT_JOINED' })
        // Si tiene la pestaña a la vista: cualquiera que mire, con el mismo tope por segundo que lo que va en vivo
        if (message.type === 'presence') {
          const at = Date.now()
          if (at - window.start > 1000) window = { start: at, count: 0 }
          if (++window.count > MAX_LIVE_PER_SECOND) return
          if (env.presence?.setActive(joined.campaignId, socket, message.active))
            announce({ campaignId: joined.campaignId, worldId: joined.worldId })
          return
        }
        // La hora del servidor, para que cada aparato mida su desfase (cualquiera que mire, con el tope por segundo)
        if (message.type === 'time') {
          const at = Date.now()
          if (at - window.start > 1000) window = { start: at, count: 0 }
          if (++window.count > MAX_LIVE_PER_SECOND) return
          return say({ type: 'time', t: message.t, serverNow: Date.now() })
        }
        // Lo que va en vivo (el encuadre, el arrastre, la medida, el láser): del máster, y con un tope por segundo; de la
        // Mesa de un jugador, solo el arrastre de sus fichas (docs/specs/mover-jugadores.md)
        const player = joined.viewer === 'player' && message.type === 'drag'
        if (joined.viewer !== 'master' && !player) return say({ type: 'error', code: 'BAD_MESSAGE' })
        const now = Date.now()
        if (now - window.start > 1000) window = { start: now, count: 0 }
        if (++window.count > MAX_LIVE_PER_SECOND) return
        if (player) return table.drag(joined.campaignId, message.moves, socket, userId)
        if (message.type === 'viewport') table.viewport(joined.campaignId, message.view)
        else if (message.type === 'drag') table.drag(joined.campaignId, message.moves, socket)
        else if (message.type === 'measure') table.measure(joined.campaignId, message.measure, socket)
        else table.laser(joined.campaignId, message.points, socket)
      })

      const headers = toHeaders(request.headers)
      const sessionCheck = setInterval(async () => {
        const session = await auth.api.getSession({ headers }).catch(() => null)
        if (session?.user.id !== userId) return socket.close(CLOSE_SESSION_ENDED, 'Sin sesión')
        if (joined && !(await allowedNow(joined.campaignId, joined.worldId, joined.viewer).catch(() => false)))
          socket.close(4403, 'Sin permiso')
      }, options.sessionCheckMs ?? 60_000)
      let alive = true
      socket.on('pong', () => {
        alive = true
      })
      const heartbeat = setInterval(() => {
        if (!alive) return socket.terminate()
        alive = false
        socket.ping()
      }, options.heartbeatMs ?? 30_000)
      const stop = () => {
        closed = true
        clearInterval(sessionCheck)
        clearInterval(heartbeat)
        joined?.leave()
        joined = null
        stops.delete(stop)
      }
      stops.add(stop)
      socket.on('close', stop)
    }
  )
}
