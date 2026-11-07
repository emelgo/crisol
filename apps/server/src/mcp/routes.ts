import { requireMcpAuth } from '@better-auth/mcp'
import { loadMemberships } from '@crisol/db'
import { actorFrom, ownedOrganizations } from '@crisol/domain'
import { FILE_BYTES } from '@crisol/systems'
import { createMcpHandler } from '@modelcontextprotocol/server'
import type { FastifyInstance } from 'fastify'
import type { ActionEnv } from '../actions/context.ts'
import { type Auth, mcpResource } from '../auth/auth.ts'
import { toHeaders } from '../http.ts'
import { buildMcpServer } from './tools.ts'

export interface McpDeps extends ActionEnv {
  auth: Auth
  /** El JWKS del propio servidor por loopback: verificar tokens no da la vuelta por Caddy */
  jwksUrl: string
  /** Cuánto espera una herramienta la aprobación (15 s; las pruebas lo acortan) */
  approvalWaitMs?: number
}

const forbidden = () =>
  new Response(JSON.stringify({ error: 'forbidden', error_description: 'Esta cuenta no puede conectar una IA' }), {
    status: 403,
    headers: { 'content-type': 'application/json' }
  })

/**
 * POST /mcp: Streamable HTTP. Atiende el protocolo 2026-07-28 y, sin sesión, el de 2025 (claude.ai puede usar
 * cualquiera de los dos). Cada petición trae un token OAuth de Better Auth atado a este recurso.
 */
export function registerMcpRoutes(app: FastifyInstance, { auth, jwksUrl, approvalWaitMs, ...env }: McpDeps) {
  const { db, publicUrl } = env
  const handler = createMcpHandler(({ authInfo }) =>
    buildMcpServer(env, String(authInfo?.extra?.userId), approvalWaitMs ? { approvalWaitMs } : {})
  )
  const protect = requireMcpAuth(
    auth,
    async (request, claims) => {
      const userId = claims.sub
      if (!userId) return forbidden()
      // El propietario de una organización o quien juega en una campaña (ADR-0017). Se mira en cada petición
      const actor = actorFrom(userId, await loadMemberships(db, userId))
      if (ownedOrganizations(actor).length === 0 && actor.campaigns.size === 0) return forbidden()
      const scope = typeof claims.scope === 'string' ? claims.scope.split(' ') : []
      return handler.fetch(request, {
        authInfo: { token: '', clientId: String(claims.azp ?? ''), scopes: scope, extra: { userId } }
      })
    },
    { resource: mcpResource(publicUrl), jwksUrl }
  )

  // Solo comprueba el token (antes de leer el cuerpo): lo demás lo hace protect
  const verified = requireMcpAuth(auth, async () => new Response(null, { status: 204 }), {
    resource: mcpResource(publicUrl),
    jwksUrl
  })

  app.route({
    method: ['POST', 'GET', 'DELETE'],
    url: '/mcp',
    // Un sistema entero (crear_sistema, validar_sistema) puede pesar como su archivo
    bodyLimit: FILE_BYTES + 1024 * 1024,
    // Sin un token que valga no se lee el cuerpo: se comprueba antes (la firma, el recurso y la caducidad)
    onRequest: async (request, reply) => {
      const response = await verified(
        new Request(new URL(request.url, publicUrl), { method: 'POST', headers: toHeaders(request.headers) })
      )
      if (response.status === 204) return
      reply.status(response.status)
      response.headers.forEach((value, key) => {
        reply.header(key, value)
      })
      return reply.send(await response.text())
    },
    handler: async (request, reply) => {
      const response = await protect(
        new Request(new URL(request.url, publicUrl), {
          method: request.method,
          headers: toHeaders(request.headers),
          ...(request.body ? { body: JSON.stringify(request.body) } : {})
        })
      )
      reply.status(response.status)
      response.headers.forEach((value, key) => {
        reply.header(key, value)
      })
      return reply.send(response.body)
    }
  })
}
