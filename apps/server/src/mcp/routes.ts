import { requireMcpAuth } from '@better-auth/mcp'
import { loadMemberships } from '@crisol/db'
import { actorFrom, ownedOrganizations } from '@crisol/domain'
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
}

const forbidden = () =>
  new Response(
    JSON.stringify({ error: 'forbidden', error_description: 'De momento solo el propietario puede conectar Claude' }),
    { status: 403, headers: { 'content-type': 'application/json' } }
  )

/**
 * POST /mcp: Streamable HTTP. Atiende el protocolo 2026-07-28 y, sin sesión, el de 2025 (claude.ai puede usar
 * cualquiera de los dos). Cada petición trae un token OAuth de Better Auth atado a este recurso.
 */
export function registerMcpRoutes(app: FastifyInstance, { auth, jwksUrl, ...env }: McpDeps) {
  const { db, publicUrl } = env
  const handler = createMcpHandler(({ authInfo }) => buildMcpServer(env, String(authInfo?.extra?.userId)))
  const protect = requireMcpAuth(
    auth,
    async (request, claims) => {
      const userId = claims.sub
      if (!userId) return forbidden()
      // Módulo 0: solo el propietario de una organización usa el conector. Se mira en cada petición
      const actor = actorFrom(userId, await loadMemberships(db, userId))
      if (ownedOrganizations(actor).length === 0) return forbidden()
      const scope = typeof claims.scope === 'string' ? claims.scope.split(' ') : []
      return handler.fetch(request, {
        authInfo: { token: '', clientId: String(claims.azp ?? ''), scopes: scope, extra: { userId } }
      })
    },
    { resource: mcpResource(publicUrl), jwksUrl }
  )

  app.route({
    method: ['POST', 'GET', 'DELETE'],
    url: '/mcp',
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
