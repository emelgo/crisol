import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import fastifyStatic from '@fastify/static'
import type { FastifyInstance } from 'fastify'

const IMMUTABLE = 'public, max-age=31536000, immutable'

/** La vista previa de un enlace de invitación (WhatsApp, Discord): genérica, sin datos de la campaña */
const INVITATION_PREVIEW = 'Invitación a una campaña de Crisol'

/** Sirve la web compilada (apps/web/dist). Las rutas de la app que no son archivos devuelven index.html */
export function registerWeb(app: FastifyInstance, webDir: string) {
  const index = join(webDir, 'index.html')
  const invitationPage = existsSync(index)
    ? readFileSync(index, 'utf8').replace(
        /(<meta property="og:description" content=")[^"]*(")/,
        `$1${INVITATION_PREVIEW}$2`
      )
    : null
  app.register(fastifyStatic, {
    root: webDir,
    wildcard: false,
    setHeaders: (response, path) => {
      // Los recursos llevan huella en el nombre: no cambian nunca. index.html sí
      response.header('cache-control', path.includes('/assets/') ? IMMUTABLE : 'no-cache')
    }
  })
  app.setNotFoundHandler((request, reply) => {
    const isRead = request.method === 'GET' || request.method === 'HEAD'
    const isAppRoute = isRead && !request.url.startsWith('/api/') && !request.url.startsWith('/assets/')
    if (isAppRoute) {
      // Toda la app es privada: que no se indexe
      reply.header('cache-control', 'no-cache').header('x-robots-tag', 'noindex')
      if (request.url.startsWith('/unirse/') && invitationPage) return reply.type('text/html').send(invitationPage)
      return reply.sendFile('index.html')
    }
    return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'No existe' })
  })
}
