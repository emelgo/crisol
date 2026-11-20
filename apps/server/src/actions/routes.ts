import { ACTIONS, FOUNDRY_ZIP_BYTES, openApi, SYSTEM_IMAGES_BYTES } from '@crisol/contracts'
import { loadMemberships } from '@crisol/db'
import { actorFrom, ForbiddenError, NotFoundError } from '@crisol/domain'
import { FILE_BYTES } from '@crisol/systems'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { requesterOf, viaOf } from '../auth/api-tokens.ts'
import type { Auth } from '../auth/auth.ts'
import { type ActionEnv, InvalidRequestError, malformedId, TooManyRequestsError } from './context.ts'
import { implementationsByName } from './implementations.ts'

export function registerActionRoutes(app: FastifyInstance, env: ActionEnv, auth: Auth) {
  const { db } = env
  app.get('/api/openapi.json', async () => openApi(ACTIONS))

  const run = async (name: string, request: FastifyRequest, reply: FastifyReply) => {
    const impl = implementationsByName.get(name)
    if (!impl) return reply.code(404).send({ code: 'UNKNOWN_ACTION' })
    // La sesión de la web o un token de acceso (ADR-0033)
    const requester = await requesterOf(request, auth, db)
    if (!requester) return reply.code(401).send({ code: 'UNAUTHENTICATED' })
    const input = impl.action.input.safeParse(request.body ?? {})
    if (!input.success) return reply.code(400).send({ code: 'INVALID_INPUT', issues: input.error.issues })

    // Las pertenencias se leen en cada petición: revocar es inmediato
    const actor = actorFrom(requester.userId, await loadMemberships(db, requester.userId))
    try {
      const output = await impl.handler({ ...env, actor, ...viaOf(requester) }, input.data)
      // La salida pasa por el contrato: lo que no está en él no sale
      return impl.action.output.parse(output)
    } catch (error) {
      if (error instanceof NotFoundError || malformedId(error)) return reply.code(404).send({ code: 'NOT_FOUND' })
      if (error instanceof ForbiddenError) return reply.code(403).send({ code: 'FORBIDDEN' })
      if (error instanceof TooManyRequestsError) return reply.code(429).send({ code: error.code })
      if (error instanceof InvalidRequestError) return reply.code(400).send({ code: error.code })
      throw error
    }
  }

  app.post<{ Params: { name: string } }>('/api/actions/:name', (request, reply) =>
    run(request.params.name, request, reply)
  )

  // Un sistema entero (hasta 2 MB), el archivo de uno con su contenido (hasta 64 MB) y el zip de uno de Foundry: con
  // más sitio, y solo con sesión (o token), que se mira antes de leer el cuerpo
  for (const [name, bodyLimit] of Object.entries(BIG_ACTIONS))
    app.post(`/api/actions/${name}`, {
      bodyLimit,
      onRequest: async (request, reply) => {
        if (!(await requesterOf(request, auth, db))) return reply.code(401).send({ code: 'UNAUTHENTICATED' })
      },
      handler: (request, reply) => run(name, request, reply)
    })
}

const MB = 1024 * 1024
/** Un sistema entero o su archivo, con un poco de margen */
const SYSTEM_BODY = FILE_BYTES + MB
/** El zip de Foundry en base64 (un tercio más), con margen */
const FOUNDRY_BODY = Math.ceil(FOUNDRY_ZIP_BYTES / 3) * 4 + MB

/** Las acciones que llevan un sistema entero, su archivo, un zip de Foundry o un mapa, con lo que cabe en cada una */
export const BIG_ACTIONS: Readonly<Record<string, number>> = {
  updateSystem: SYSTEM_BODY,
  importSystem: SYSTEM_BODY,
  checkSystem: SYSTEM_BODY,
  trySystemRoll: SYSTEM_BODY,
  createSystem: SYSTEM_BODY,
  inspectFoundry: FOUNDRY_BODY,
  importFoundry: FOUNDRY_BODY,
  inspectFoundryScenes: FOUNDRY_BODY,
  importFoundryScenes: FOUNDRY_BODY,
  putSystemImages: Math.ceil(SYSTEM_IMAGES_BYTES / 3) * 4 + MB,
  // Un mapa en SVG dibujado por la IA, y lo que trae un UVTT (muros y luces) al poner su imagen
  drawScene: 6 * MB,
  setSceneImage: 6 * MB
}
