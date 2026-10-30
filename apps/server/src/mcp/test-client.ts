/** Para las pruebas del MCP: cuentas, el flujo OAuth de claude.ai y un cliente del protocolo conectado */
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { type connect, schema } from '@crisol/db'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import type { startServer } from '../server.ts'
import { signUpTestUser } from '../testing.ts'

// Como la de claude.ai: HTTPS. Nunca se visita: la prueba solo lee el código de la URL
export const REDIRECT = 'https://cliente.example/callback'

export function mcpTestHelpers(
  BASE: string,
  server: () => Awaited<ReturnType<typeof startServer>>,
  database: () => ReturnType<typeof connect>
) {
  // La base de datos se vacía una sola vez: Better Auth da de alta el recurso MCP al primer uso y lo recuerda
  /** Una cuenta (propietaria o no) en una organización nueva, con su cookie de sesión */
  const account = async (role: 'owner' | 'member') => {
    const person = await signUpTestUser(server().auth, { name: 'Enrique', email: `${randomUUID()}@crisol.test` })
    const [org] = await database().db.insert(schema.organizations).values({ name: 'Fateforge' }).returning()
    if (!org) throw new Error('sin organización')
    await database()
      .db.insert(schema.organizationMembers)
      .values({ organizationId: org.id, userId: person.userId, role })
    return person
  }

  /** Un cliente OAuth público (como claude.ai, pero registrado a mano por el propietario en vez de por CIMD) */
  const oauthClient = (ownerCookie: string) =>
    server().auth.api.adminCreateOAuthClient({
      headers: new Headers({ cookie: ownerCookie }),
      body: { redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none', client_name: 'Pruebas' }
    })

  /** El flujo de claude.ai: autorizar, consentir y canjear el código con PKCE */
  const accessToken = async (cookie: string, client: { client_id: string }) => {
    const verifier = randomBytes(32).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const authorize = new URL('/api/auth/oauth2/authorize', BASE)
    for (const [key, value] of Object.entries({
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: REDIRECT,
      scope: 'openid profile offline_access',
      state: 'estado',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      resource: `${BASE}/mcp`
    }))
      authorize.searchParams.set(key, value)

    // Como un navegador: claude.ai abre esta URL en el del máster
    const toConsent = await fetch(authorize, { headers: { cookie, accept: 'text/html' }, redirect: 'manual' })
    const location = toConsent.headers.get('location') ?? ((await toConsent.json()) as { url?: string }).url ?? ''
    const consentPage = new URL(location, BASE)
    if (consentPage.pathname !== '/oauth/consentimiento') throw new Error(`Sin pantalla de permiso: ${consentPage}`)

    const consent = await fetch(new URL('/api/auth/oauth2/consent', BASE), {
      method: 'POST',
      headers: { cookie, origin: BASE, 'content-type': 'application/json' },
      body: JSON.stringify({ accept: true, oauth_query: consentPage.search.slice(1) })
    })
    if (!consent.ok) throw new Error(`Permiso rechazado: ${consent.status}`)
    const { url } = (await consent.json()) as { url: string }
    const code = new URL(url).searchParams.get('code') ?? ''

    const token = await fetch(new URL('/api/auth/oauth2/token', BASE), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT,
        client_id: client.client_id,
        code_verifier: verifier,
        resource: `${BASE}/mcp`
      })
    })
    const body = (await token.json()) as { access_token?: string }
    if (!body.access_token) throw new Error(`Sin token: ${JSON.stringify(body)}`)
    return body.access_token
  }

  const connected = async () => {
    const owner = await account('owner')
    const token = await accessToken(owner.cookie, await oauthClient(owner.cookie))
    const client = new Client({ name: 'pruebas', version: '1' })
    await client.connect(
      new StreamableHTTPClientTransport(new URL('/mcp', BASE), {
        requestInit: { headers: { authorization: `Bearer ${token}` } }
      })
    )
    clients.push(client)
    /** Llama a una herramienta: devuelve lo que contesta y su texto */
    const call = async <T = Record<string, unknown>>(name: string, args: Record<string, unknown> = {}) => {
      const result = await client.callTool({ name, arguments: args })
      const text = (result.content as Array<{ text?: string }>).map((c) => c.text ?? '').join('\n')
      return { ...result, text, data: result.structuredContent as T }
    }
    return { ...owner, call }
  }
  const clients: Client[] = []

  /** Una acción de la API con la sesión del máster (lo que aún no tiene herramienta, o aprobar) */
  const api = async <T = Record<string, unknown>>(cookie: string, name: string, body: Record<string, unknown>) => {
    const response = await fetch(new URL(`/api/actions/${name}`, BASE), {
      method: 'POST',
      headers: { cookie, origin: BASE, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
    return (await response.json()) as T
  }

  /** Cierra los clientes conectados */
  const closeClients = () => Promise.all(clients.splice(0).map((client) => client.close()))
  return { account, oauthClient, accessToken, connected, api, closeClients }
}
