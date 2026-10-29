import type { FastifyInstance } from 'fastify'
import { toHeaders } from '../http.ts'
import type { Auth } from './auth.ts'

/** Monta Better Auth en /api/auth/* (sus rutas reciben y devuelven Fetch Request/Response) */
export function registerAuthRoutes(app: FastifyInstance, auth: Auth) {
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    handler: async (request, reply) => {
      const headers = toHeaders(request.headers)
      const response = await auth.handler(
        new Request(new URL(request.url, `http://${request.headers.host}`), {
          method: request.method,
          headers,
          ...(request.body ? { body: JSON.stringify(request.body) } : {})
        })
      )
      reply.status(response.status)
      // Todas las cookies: Headers.forEach las juntaría en una
      response.headers.forEach((value, key) => {
        if (key !== 'set-cookie') reply.header(key, value)
      })
      const cookies = response.headers.getSetCookie()
      if (cookies.length > 0) reply.header('set-cookie', cookies)
      return reply.send(response.body ? await response.text() : null)
    }
  })
}
