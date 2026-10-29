import { ACTIONS, openApi } from '@crisol/contracts'
import { type Database, loadMemberships } from '@crisol/db'
import { actorFrom, ForbiddenError, NotFoundError } from '@crisol/domain'
import type { FastifyInstance } from 'fastify'
import type { Auth } from '../auth/auth.ts'
import { toHeaders } from '../http.ts'
import { InvalidRequestError } from './context.ts'
import { organizationActions } from './organizations.ts'
import type { Implementation } from './registry.ts'
import { worldActions } from './worlds.ts'

/** Los servicios de todas las acciones del contrato */
export const IMPLEMENTATIONS: Implementation[] = [...organizationActions, ...worldActions]

export function registerActionRoutes(app: FastifyInstance, db: Database, auth: Auth) {
  const byName = new Map(IMPLEMENTATIONS.map((impl) => [impl.action.name, impl]))

  app.get('/api/openapi.json', async () => openApi(ACTIONS))

  app.post<{ Params: { name: string } }>('/api/actions/:name', async (request, reply) => {
    const impl = byName.get(request.params.name)
    if (!impl) return reply.code(404).send({ code: 'UNKNOWN_ACTION' })
    const session = await auth.api.getSession({ headers: toHeaders(request.headers) })
    if (!session) return reply.code(401).send({ code: 'UNAUTHENTICATED' })
    const input = impl.action.input.safeParse(request.body ?? {})
    if (!input.success) return reply.code(400).send({ code: 'INVALID_INPUT', issues: input.error.issues })

    // Las pertenencias se leen en cada petición: revocar es inmediato
    const actor = actorFrom(session.user.id, await loadMemberships(db, session.user.id))
    try {
      const output = await impl.handler({ db, actor, via: 'ui' }, input.data)
      // La salida pasa por el contrato: lo que no está en él no sale
      return impl.action.output.parse(output)
    } catch (error) {
      if (error instanceof NotFoundError) return reply.code(404).send({ code: 'NOT_FOUND' })
      if (error instanceof ForbiddenError) return reply.code(403).send({ code: 'FORBIDDEN' })
      if (error instanceof InvalidRequestError) return reply.code(400).send({ code: error.code })
      throw error
    }
  })
}
