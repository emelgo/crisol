import type { IncomingHttpHeaders } from 'node:http'
import type { FastifyInstance } from 'fastify'

/** Cabeceras de Node a Headers de Fetch (Better Auth trabaja con Fetch) */
export function toHeaders(incoming: IncomingHttpHeaders): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(incoming)) {
    if (Array.isArray(value)) for (const v of value) headers.append(key, v)
    else if (value !== undefined) headers.set(key, String(value))
  }
  return headers
}

const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Además de SameSite=Lax: una petición que cambia algo y trae un Origin que no es el del sitio se rechaza. Las rutas
 * de Better Auth hacen su propia comprobación.
 */
export function registerOriginGuard(app: FastifyInstance, publicUrl: string) {
  const allowed = new URL(publicUrl).origin
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin
    if (!WRITES.has(request.method) || !request.url.startsWith('/api/') || request.url.startsWith('/api/auth/')) return
    if (origin !== undefined && origin !== allowed) return reply.code(403).send({ code: 'BAD_ORIGIN' })
  })
}
