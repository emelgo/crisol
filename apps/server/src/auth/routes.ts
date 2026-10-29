import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { toHeaders } from '../http.ts'
import type { Auth } from './auth.ts'

/**
 * Monta Better Auth en /api/auth/* (sus rutas reciben y devuelven Fetch Request/Response). También le pasa
 * /.well-known/* de la raíz: los clientes OAuth y MCP buscan ahí los metadatos del servidor y del recurso.
 */
export function registerAuthRoutes(app: FastifyInstance, auth: Auth) {
  // OAuth envía formularios (el canje de códigos, la revocación): se pasan tal cual
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_request, body, done) =>
    done(null, body)
  )
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    handler: (request, reply) => forward(auth, request, reply)
  })
  app.route({
    method: ['GET', 'HEAD'],
    url: '/.well-known/*',
    handler: (request, reply) => forward(auth, request, reply)
  })
}

async function forward(auth: Auth, request: FastifyRequest, reply: FastifyReply) {
  const response = await auth.handler(
    new Request(new URL(request.url, `http://${request.headers.host}`), {
      method: request.method,
      headers: toHeaders(request.headers),
      ...(request.body ? { body: typeof request.body === 'string' ? request.body : JSON.stringify(request.body) } : {})
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
