import type { IncomingHttpHeaders } from 'node:http'
import type { FastifyInstance, FastifyRequest } from 'fastify'

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
export function registerOriginGuard(app: FastifyInstance, publicUrl: string, internal: readonly string[] = []) {
  // Además del sitio, el propio servidor por dentro (el Chromium del PDF): nadie de fuera puede abrir esa dirección
  const allowed = new Set([new URL(publicUrl).origin, ...internal.map((url) => new URL(url).origin)])
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin
    if (!WRITES.has(request.method) || !request.url.startsWith('/api/') || request.url.startsWith('/api/auth/')) return
    if (origin !== undefined && !allowed.has(origin)) return reply.code(403).send({ code: 'BAD_ORIGIN' })
  })
}

/** Clave de los límites de intentos: la IP que manda Caddy (la app solo escucha en loopback, detrás de él) */
export const clientIp = (request: FastifyRequest) => {
  const forwarded = request.headers['x-forwarded-for']
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim()
  return first || request.ip
}

/** Las rutas que llevan un secreto en la propia URL: el enlace de invitación y el de arranque */
const SECRET_PATHS = /\/(unirse|arranque|api\/join|api\/bootstrap)\/[^/?#]+/g

/** La URL para el registro, sin los secretos que lleve (quien lea los registros no debe poder entrar con ellos) */
export function redactSecrets(url: string): string {
  return url.replace(SECRET_PATHS, '/$1/…')
}
