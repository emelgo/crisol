import type { RealtimeMessage } from '@crisol/contracts'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { Auth } from '../auth/auth.ts'
import { toHeaders } from '../http.ts'
import type { Realtime } from './hub.ts'

export interface RealtimeRouteOptions {
  auth: Auth
  publicUrl: string
  realtime: Realtime
  /** La versión de la web que se sirve (ver webBuild), para que una pestaña vieja sepa que tiene que recargar */
  build?: string | null
  /** Cada cuánto se vuelve a comprobar la sesión (si caduca o se cierra, el canal también) */
  sessionCheckMs?: number
  /** Cada cuánto se manda el latido; sin respuesta, la conexión se da por perdida */
  heartbeatMs?: number
  /** Qué campaña tiene abierta la pestaña fuera de la Mesa (null: ninguna), para la presencia (docs/specs/sala.md) */
  onFocus?: (key: object, userId: string, campaignId: string | null) => void
}

const focusMessage = z.object({ type: z.literal('focus'), campaignId: z.uuid().nullable() })

/** Códigos de cierre propios (4000-4999): la web sabe que no debe reconectar sin sesión */
export const CLOSE_SESSION_ENDED = 4401

/**
 * El canal en tiempo real: un WebSocket por pestaña con sesión, en /api/realtime. Solo manda; no escucha. Necesita el
 * plugin @fastify/websocket ya registrado
 */
export function registerRealtimeRoutes(app: FastifyInstance, options: RealtimeRouteOptions) {
  const { auth, realtime } = options
  const allowed = new URL(options.publicUrl).origin
  const users = new WeakMap<FastifyRequest, string>()
  // Lo que para cada conexión: al cerrar el servidor se para todo, aunque el cliente no haya cerrado bien
  const stops = new Set<() => void>()
  app.addHook('onClose', async () => {
    for (const stop of stops) stop()
  })

  app.get(
    '/api/realtime',
    {
      websocket: true,
      // Antes de aceptar la conexión. Un WebSocket lleva las cookies aunque lo abra otra web: solo vale nuestro origen
      preValidation: async (request, reply) => {
        if (request.headers.origin !== allowed) return reply.code(403).send({ code: 'BAD_ORIGIN' })
        // Sin sesión se acepta y se cierra al momento con 4401: un 401 al abrir el navegador lo ve como un corte de red
        // (1006) y el cliente reintentaría sin saber que tiene que volver a entrar
        const session = await auth.api.getSession({ headers: toHeaders(request.headers) })
        if (session) users.set(request, session.user.id)
      }
    },
    (socket, request) => {
      const userId = users.get(request)
      if (!userId) return socket.close(CLOSE_SESSION_ENDED)
      socket.send(JSON.stringify({ type: 'hello', build: options.build ?? null } satisfies RealtimeMessage))
      // El canal solo escucha qué campaña tiene abierta la pestaña; lo grande se corta (el WebSocket admite hasta 1 MB
      // por la edición en vivo)
      let focusAt = { start: 0, count: 0 }
      socket.on('message', (data: Buffer) => {
        if (data.byteLength > 1024) return socket.close(1009, 'Demasiado grande')
        const now = Date.now()
        if (now - focusAt.start > 1000) focusAt = { start: now, count: 0 }
        if (++focusAt.count > 10) return
        let parsed: ReturnType<typeof focusMessage.safeParse>
        try {
          parsed = focusMessage.safeParse(JSON.parse(data.toString('utf8')))
        } catch {
          return
        }
        if (parsed.success) options.onFocus?.(socket, userId, parsed.data.campaignId)
      })
      const disconnect = realtime.connect(userId, socket)
      const headers = toHeaders(request.headers)
      const sessionCheck = setInterval(async () => {
        const session = await auth.api.getSession({ headers }).catch(() => null)
        if (session?.user.id !== userId) socket.close(CLOSE_SESSION_ENDED, 'Sin sesión')
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
        options.onFocus?.(socket, userId, null)
        clearInterval(sessionCheck)
        clearInterval(heartbeat)
        disconnect()
        stops.delete(stop)
      }
      stops.add(stop)
      socket.on('close', stop)
    }
  )
}
