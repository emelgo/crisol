import { ACTIONS, openApi } from '@crisol/contracts'
import { loadMemberships } from '@crisol/db'
import { actorFrom, ForbiddenError, NotFoundError } from '@crisol/domain'
import { FILE_BYTES } from '@crisol/systems'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { Auth } from '../auth/auth.ts'
import { toHeaders } from '../http.ts'
import { type ActionEnv, InvalidRequestError, TooManyRequestsError } from './context.ts'
import { implementationsByName } from './implementations.ts'

export function registerActionRoutes(app: FastifyInstance, env: ActionEnv, auth: Auth) {
  const { db } = env
  app.get('/api/openapi.json', async () => openApi(ACTIONS))

  const run = async (name: string, request: FastifyRequest, reply: FastifyReply) => {
    const impl = implementationsByName.get(name)
    if (!impl) return reply.code(404).send({ code: 'UNKNOWN_ACTION' })
    const session = await auth.api.getSession({ headers: toHeaders(request.headers) })
    if (!session) return reply.code(401).send({ code: 'UNAUTHENTICATED' })
    const input = impl.action.input.safeParse(request.body ?? {})
    if (!input.success) return reply.code(400).send({ code: 'INVALID_INPUT', issues: input.error.issues })

    // Las pertenencias se leen en cada petición: revocar es inmediato
    const actor = actorFrom(session.user.id, await loadMemberships(db, session.user.id))
    try {
      const output = await impl.handler({ ...env, actor, via: 'ui' }, input.data)
      // La salida pasa por el contrato: lo que no está en él no sale
      return impl.action.output.parse(output)
    } catch (error) {
      if (error instanceof NotFoundError) return reply.code(404).send({ code: 'NOT_FOUND' })
      if (error instanceof ForbiddenError) return reply.code(403).send({ code: 'FORBIDDEN' })
      if (error instanceof TooManyRequestsError) return reply.code(429).send({ code: error.code })
      if (error instanceof InvalidRequestError) return reply.code(400).send({ code: error.code })
      throw error
    }
  }

  app.post<{ Params: { name: string } }>('/api/actions/:name', (request, reply) =>
    run(request.params.name, request, reply)
  )

  // Un sistema entero (hasta 2 MB) y el archivo de uno con su contenido (hasta 10 MB): con más sitio, y solo con sesión,
  // que se mira antes de leer el cuerpo
  for (const name of BIG_ACTIONS)
    app.post(`/api/actions/${name}`, {
      bodyLimit: FILE_BYTES + 1024 * 1024,
      onRequest: async (request, reply) => {
        if (!(await auth.api.getSession({ headers: toHeaders(request.headers) })))
          return reply.code(401).send({ code: 'UNAUTHENTICATED' })
      },
      handler: (request, reply) => run(name, request, reply)
    })
}

/** Las acciones que llevan un sistema entero o su archivo */
export const BIG_ACTIONS = ['updateSystem', 'importSystem', 'checkSystem'] as const
