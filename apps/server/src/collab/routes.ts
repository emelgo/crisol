import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { Auth } from '../auth/auth.ts'
import { toHeaders } from '../http.ts'
import { CLOSE_SESSION_ENDED } from '../realtime/routes.ts'
import type { Collab } from './server.ts'

export interface CollabRouteOptions {
  auth: Auth
  publicUrl: string
  collab: Collab
  /** Cada cuánto se vuelve a comprobar la sesión (si caduca o se cierra, se cierra también) */
  sessionCheckMs?: number
}

/**
 * La edición en vivo: un WebSocket por pestaña en /api/collab con todos sus documentos abiertos (Hocuspocus los
 * multiplexa). Como el canal en tiempo real: solo nuestro origen y con sesión. Necesita @fastify/websocket registrado
 */
export function registerCollabRoutes(app: FastifyInstance, options: CollabRouteOptions) {
  const { auth, collab } = options
  const allowed = new URL(options.publicUrl).origin
  const users = new WeakMap<FastifyRequest, string>()
  const stops = new Set<() => void>()
  app.addHook('onClose', async () => {
    for (const stop of stops) stop()
    // Lo que se estaba escribiendo se guarda antes de cerrar (y no choca con lo que venga después)
    await collab.close()
  })

  app.get(
    '/api/collab',
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
      const headers = toHeaders(request.headers)
      const connection = collab.hocuspocus.handleConnection(
        socket,
        new Request(new URL(request.url, options.publicUrl), { headers }),
        { userId }
      )
      socket.on('message', (data: Buffer) => connection.handleMessage(new Uint8Array(data)))
      socket.on('pong', () => connection.touch())
      const sessionCheck = setInterval(async () => {
        const session = await auth.api.getSession({ headers }).catch(() => null)
        if (session?.user.id !== userId) socket.close(CLOSE_SESSION_ENDED, 'Sin sesión')
      }, options.sessionCheckMs ?? 60_000)
      const stop = () => {
        clearInterval(sessionCheck)
        stops.delete(stop)
      }
      stops.add(stop)
      socket.on('close', (code: number, reason: Buffer) => {
        stop()
        connection.handleClose({ code, reason: reason.toString() } as CloseEvent)
      })
    }
  )
}
