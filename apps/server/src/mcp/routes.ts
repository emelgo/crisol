import { requireMcpAuth } from '@better-auth/mcp'
import { campaignsRepo, loadMemberships } from '@crisol/db'
import { type Actor, actorFrom, ownedOrganizations } from '@crisol/domain'
import { FILE_BYTES } from '@crisol/systems'
import { createMcpHandler } from '@modelcontextprotocol/server'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { ActionEnv } from '../actions/context.ts'
import { type Auth, ensureCampaignResource } from '../auth/auth.ts'
import { toHeaders } from '../http.ts'
import { buildMcpServer, campaignInstructions } from './connectors.ts'
import { type CampaignScope, campaignResource, type McpScope, mcpResource } from './scope.ts'

export interface McpDeps extends ActionEnv {
  auth: Auth
  /** El JWKS del propio servidor por loopback: verificar tokens no da la vuelta por Caddy */
  jwksUrl: string
  /** Cuánto espera una herramienta la aprobación (15 s; las pruebas lo acortan) */
  approvalWaitMs?: number
}

const json = (status: number, body: object, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

const forbidden = (description = 'Esta cuenta no puede conectar una IA') =>
  json(403, { error: 'forbidden', error_description: description })

/** Lo que el servidor de MCP sabe de cada petición: de quién es y a qué conector va */
interface Connection {
  userId: string
  scope: McpScope
  instructions?: string
}

/** Una conexión quitada en Ajustes: vuelve a pedir permiso, como con un token caducado */
const revoked = (resource: string) =>
  json(
    401,
    { jsonrpc: '2.0', error: { code: -32000, message: 'Esta conexión se ha quitado en Crisol' }, id: null },
    {
      'www-authenticate': `Bearer error="invalid_token", resource_metadata="${metadataUrl(resource)}"`
    }
  )

const metadataUrl = (resource: string) => {
  const url = new URL(resource)
  return `${url.origin}/.well-known/oauth-protected-resource${url.pathname}`
}

/** Pasa la respuesta Fetch a Fastify */
async function send(reply: FastifyReply, response: Response, body: 'text' | 'stream' = 'stream') {
  reply.status(response.status)
  response.headers.forEach((value, key) => {
    reply.header(key, value)
  })
  return reply.send(body === 'text' ? await response.text() : response.body)
}

const fetchRequest = (request: FastifyRequest, publicUrl: string, withBody: boolean) =>
  new Request(new URL(request.url, publicUrl), {
    method: withBody ? request.method : 'POST',
    headers: toHeaders(request.headers),
    ...(withBody && request.body ? { body: JSON.stringify(request.body) } : {})
  })

/** El papel de la cuenta en una campaña: máster (de la campaña o de su mundo), jugadora o ninguno */
function roleIn(actor: Actor, campaign: { id: string; worldId: string }): CampaignScope['role'] | null {
  const own = actor.campaigns.get(campaign.id)?.role
  if (own === 'master' || actor.worlds.get(campaign.worldId)?.role === 'master') return 'master'
  return own === 'player' ? 'player' : null
}

/**
 * El conector MCP (Streamable HTTP; el protocolo 2026-07-28 y, sin sesión, el de 2025). Dos tipos (ADR-0030):
 * - /mcp, «Crisol · Mundos»: para quien crea mundos, con todas las herramientas (quien solo juega, solo las de leer);
 * - /mcp/campanas/:campaignId, «Crisol · {campaña}»: solo esa campaña, con las herramientas de su papel en ella.
 * Cada petición trae un token OAuth de Better Auth atado a la dirección de su conector, que se comprueba antes de leer
 * el cuerpo (la firma, el recurso y la caducidad)
 */
export function registerMcpRoutes(app: FastifyInstance, { auth, jwksUrl, approvalWaitMs, ...env }: McpDeps) {
  const { db, publicUrl, aiConnections } = env
  const wait = approvalWaitMs ? { approvalWaitMs } : {}
  const handler = createMcpHandler(({ authInfo }) => {
    // Lo pone serve, después de comprobar el token: sin él no se llega aquí
    const { userId, scope, instructions } = (authInfo?.extra ?? {}) as unknown as Connection
    return buildMcpServer(env, userId, { ...wait, scope, ...(instructions ? { instructions } : {}) })
  })

  /** Comprueba el token de ese recurso y, si vale, atiende la petición con la conexión que diga connection */
  const serve = (
    resource: string,
    connection: (userId: string) => Promise<Connection | Response>
  ): ((request: Request) => Promise<Response>) =>
    requireMcpAuth(
      auth,
      async (request, claims) => {
        const userId = claims.sub
        const clientId = String(claims.azp ?? '')
        if (!userId) return forbidden()
        if (aiConnections?.isRemoved(userId, clientId, resource, Number(claims.iat ?? 0))) return revoked(resource)
        const found = await connection(userId)
        if (found instanceof Response) return found
        aiConnections?.used(userId, clientId, resource)
        const scopes = typeof claims.scope === 'string' ? claims.scope.split(' ') : []
        return handler.fetch(request, {
          authInfo: { token: '', clientId, scopes, extra: found as unknown as Record<string, unknown> }
        })
      },
      { resource, jwksUrl }
    )

  /** Solo el token (antes de leer el cuerpo): lo demás lo hace serve */
  const verify = (resource: string) =>
    requireMcpAuth(auth, async () => new Response(null, { status: 204 }), { resource, jwksUrl })

  const route = (
    url: string,
    resourceOf: (request: FastifyRequest) => string | null,
    connection: (request: FastifyRequest, userId: string) => Promise<Connection | Response>
  ) =>
    app.route({
      method: ['POST', 'GET', 'DELETE'],
      url,
      // Un sistema entero (crear_sistema, validar_sistema) puede pesar como su archivo
      bodyLimit: FILE_BYTES + 1024 * 1024,
      onRequest: async (request, reply) => {
        const resource = resourceOf(request)
        if (!resource) return reply.status(404).send({ error: 'not_found' })
        const response = await verify(resource)(fetchRequest(request, publicUrl, false))
        if (response.status === 204) return
        return send(reply, response, 'text')
      },
      handler: async (request, reply) => {
        const resource = resourceOf(request) ?? ''
        const response = await serve(resource, (userId) => connection(request, userId))(
          fetchRequest(request, publicUrl, true)
        )
        return send(reply, response)
      }
    })

  // «Crisol · Mundos»: el propietario de una organización, el máster de un mundo o quien juega (ADR-0017), mirado en
  // cada petición
  route(
    '/mcp',
    () => mcpResource(publicUrl),
    async (_request, userId) => {
      const actor = actorFrom(userId, await loadMemberships(db, userId))
      const playerOnly =
        ownedOrganizations(actor).length === 0 && ![...actor.worlds.values()].some((w) => w.role === 'master')
      if (playerOnly && actor.campaigns.size === 0) return forbidden()
      return { userId, scope: { kind: 'worlds', readOnly: playerOnly } }
    }
  )

  // Las instrucciones de una campaña cambian poco (el hoy, los personajes): un minuto en memoria, no en cada llamada
  const instructions = new Map<string, { at: number; text: Promise<string> }>()
  const instructionsOf = (userId: string, scope: CampaignScope) => {
    const now = Date.now()
    const key = JSON.stringify([userId, scope.campaignId, scope.role])
    const found = instructions.get(key)
    if (found && now - found.at < 60_000) return found.text
    for (const [old, { at }] of instructions) if (now - at >= 60_000) instructions.delete(old)
    const text = campaignInstructions(env, userId, scope)
    instructions.set(key, { at: now, text })
    // Si falla, no se guarda el fallo
    text.catch(() => instructions.delete(key))
    return text
  }

  // «Crisol · {campaña}»: solo quien juega o dirige en ella; su papel, en cada petición
  const campaignIdOf = (request: FastifyRequest) => (request.params as { campaignId?: string }).campaignId ?? ''
  route(
    '/mcp/campanas/:campaignId',
    (request) => {
      const resource = campaignResource(publicUrl, campaignIdOf(request))
      return /^[0-9a-f-]{36}$/.test(campaignIdOf(request)) ? resource : null
    },
    async (request, userId) => {
      const campaign = await campaignsRepo.findCampaign(db, campaignIdOf(request))
      const actor = actorFrom(userId, await loadMemberships(db, userId))
      const role = campaign ? roleIn(actor, campaign) : null
      if (!campaign || !role) return forbidden('Esta cuenta no está en esta campaña')
      const scope: CampaignScope = {
        kind: 'campaign',
        campaignId: campaign.id,
        worldId: campaign.worldId,
        organizationId: campaign.organizationId,
        name: campaign.name,
        role
      }
      return { userId, scope, instructions: await instructionsOf(userId, scope) }
    }
  )

  // Sus metadatos (RFC 9728), los mismos que los de /mcp con su dirección y su nombre. Darlos de alta aquí deja el
  // recurso listo antes de que el cliente pida la autorización
  app.route({
    method: ['GET', 'HEAD'],
    url: '/.well-known/oauth-protected-resource/mcp/campanas/:campaignId',
    handler: async (request, reply) => {
      const resource = campaignResource(publicUrl, campaignIdOf(request))
      const campaign = await ensureCampaignResource(db, publicUrl, resource)
      if (!campaign) return reply.status(404).send({ error: 'not_found' })
      const base = await auth.handler(
        new Request(new URL('/.well-known/oauth-protected-resource/mcp', publicUrl), { method: 'GET' })
      )
      const metadata = { ...((await base.json()) as object), resource, resource_name: `Crisol · ${campaign.name}` }
      reply.header('content-type', 'application/json')
      reply.header('cache-control', base.headers.get('cache-control') ?? 'no-store')
      return reply.send(request.method === 'HEAD' ? null : metadata)
    }
  })
}
