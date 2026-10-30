/** Las rutas de la wiki que no son acciones: exportar devuelve un .zip, no JSON */
import { exportInput } from '@crisol/contracts'
import { loadMemberships } from '@crisol/db'
import { actorFrom, ForbiddenError, NotFoundError } from '@crisol/domain'
import type { FastifyInstance } from 'fastify'
import type { ActionEnv } from '../actions/context.ts'
import type { Auth } from '../auth/auth.ts'
import { toHeaders } from '../http.ts'
import { exportZip } from './export.ts'

export function registerWikiRoutes(app: FastifyInstance, env: ActionEnv, auth: Auth) {
  // Exportar un mundo entero pesa: pocas veces seguidas
  app.post('/api/export', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const session = await auth.api.getSession({ headers: toHeaders(request.headers) })
    if (!session) return reply.code(401).send({ code: 'UNAUTHENTICATED' })
    const input = exportInput.safeParse(request.body ?? {})
    if (!input.success) return reply.code(400).send({ code: 'INVALID_INPUT', issues: input.error.issues })
    const actor = actorFrom(session.user.id, await loadMemberships(env.db, session.user.id))
    try {
      const { name, zip } = await exportZip({ ...env, actor, via: 'ui' }, input.data)
      const ascii =
        name
          .normalize('NFD')
          .replace(/[^\x20-\x7e]/g, '')
          .replace(/"/g, '') || 'wiki'
      return reply
        .header('content-type', 'application/zip')
        .header(
          'content-disposition',
          `attachment; filename="${ascii}.zip"; filename*=UTF-8''${encodeURIComponent(`${name}.zip`)}`
        )
        .header('cache-control', 'no-store')
        .send(zip)
    } catch (error) {
      if (error instanceof NotFoundError) return reply.code(404).send({ code: 'NOT_FOUND' })
      if (error instanceof ForbiddenError) return reply.code(403).send({ code: 'FORBIDDEN' })
      throw error
    }
  })
}
