import fastifyStatic from '@fastify/static'
import type { FastifyInstance } from 'fastify'

const IMMUTABLE = 'public, max-age=31536000, immutable'

/** Sirve la web compilada (apps/web/dist). Las rutas de la app que no son archivos devuelven index.html */
export function registerWeb(app: FastifyInstance, webDir: string) {
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
    if (isAppRoute) return reply.header('cache-control', 'no-cache').sendFile('index.html')
    return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'No existe' })
  })
}
