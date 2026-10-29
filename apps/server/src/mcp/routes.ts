import { requireMcpAuth } from '@better-auth/mcp'
import { type Database, loadMemberships } from '@crisol/db'
import { actorFrom, ownedOrganizations } from '@crisol/domain'
import { createMcpHandler } from '@modelcontextprotocol/server'
import type { FastifyInstance } from 'fastify'
import { type Auth, mcpResource } from '../auth/auth.ts'
import { toHeaders } from '../http.ts'
import { buildMcpServer } from './tools.ts'

export interface McpDeps {
  db: Database
  sealKey: Buffer
  auth: Auth
  publicUrl: string
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
export function registerMcpRoutes(app: FastifyInstance, { db, auth, publicUrl, jwksUrl, sealKey }: McpDeps) {
  const handler = createMcpHandler(({ authInfo }) =>
    buildMcpServer({ db, publicUrl, sealKey }, String(authInfo?.extra?.userId))
  )
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
