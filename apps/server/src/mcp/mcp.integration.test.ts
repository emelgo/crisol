import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { connect, schema } from '@crisol/db'
import { freshTestDatabase } from '@crisol/db/testing'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startServer } from '../server.ts'
import { signUpTestUser, TEST_AUTH_SECRET } from '../testing.ts'

// Puerto fijo: el recurso y el emisor de los tokens salen de PUBLIC_URL, que tiene que ser la dirección real
const PORT = 8132
const BASE = `http://127.0.0.1:${PORT}`
// Como la de claude.ai: HTTPS. Nunca se visita: la prueba solo lee el código de la URL
const REDIRECT = 'https://cliente.example/callback'

describe('conector MCP con OAuth', () => {
  let server: Awaited<ReturnType<typeof startServer>>
  let conn: ReturnType<typeof connect>

  beforeAll(async () => {
    const url = await freshTestDatabase('crisol_test_mcp')
    conn = connect(url, { max: 2 })
    server = await startServer({
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT,
      DATABASE_URL: url,
      VALKEY_URL: process.env.TEST_VALKEY_URL ?? 'redis://127.0.0.1:63790',
      AUTH_SECRET: TEST_AUTH_SECRET,
      PUBLIC_URL: BASE
    })
  })

  afterAll(async () => {
    await server?.stop()
    await conn?.close()
  })

  // La base de datos se vacía una sola vez: Better Auth da de alta el recurso MCP al primer uso y lo recuerda
  /** Una cuenta (propietaria o no) en una organización nueva, con su cookie de sesión */
  const account = async (role: 'owner' | 'member') => {
    const person = await signUpTestUser(server.auth, { name: 'Enrique', email: `${randomUUID()}@crisol.test` })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Fateforge' }).returning()
    if (!org) throw new Error('sin organización')
    await conn.db.insert(schema.organizationMembers).values({ organizationId: org.id, userId: person.userId, role })
    return person
  }

  /** Un cliente OAuth público (como claude.ai, pero registrado a mano por el propietario en vez de por CIMD) */
  const oauthClient = (ownerCookie: string) =>
    server.auth.api.adminCreateOAuthClient({
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
    expect(consentPage.pathname).toBe('/oauth/consentimiento')

    const consent = await fetch(new URL('/api/auth/oauth2/consent', BASE), {
      method: 'POST',
      headers: { cookie, origin: BASE, 'content-type': 'application/json' },
      body: JSON.stringify({ accept: true, oauth_query: consentPage.search.slice(1) })
    })
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

  /** Una petición JSON-RPC del protocolo de 2025 (sin sesión: el servidor es sin estado) */
  const rpc = (token: string | null, method: string, params: object = {}) =>
    fetch(new URL('/mcp', BASE), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2025-06-18',
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    })
  /** La respuesta JSON-RPC, venga en JSON o en un flujo SSE */
  const result = async (response: Response) => {
    const text = await response.text()
    const json = text.startsWith('{')
      ? text
      : (text.split('\n').find((line) => line.startsWith('data:')) ?? '').slice(5)
    return JSON.parse(json)
  }

  it('sin token responde 401 y dice dónde están los metadatos del recurso', async () => {
    const response = await rpc(null, 'tools/list')
    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=')
  })

  it('publica los metadatos del recurso y del servidor de autorización en la raíz', async () => {
    const resource = await (await fetch(new URL('/.well-known/oauth-protected-resource/mcp', BASE))).json()
    expect(resource).toMatchObject({ resource: `${BASE}/mcp`, authorization_servers: [`${BASE}/api/auth`] })
    const issuer = await (await fetch(new URL('/.well-known/oauth-authorization-server/api/auth', BASE))).json()
    expect(issuer).toMatchObject({ issuer: `${BASE}/api/auth`, client_id_metadata_document_supported: true })
  })

  it('el propietario conecta Claude y lista sus mundos', async () => {
    const owner = await account('owner')
    const token = await accessToken(owner.cookie, await oauthClient(owner.cookie))

    const initialize = await rpc(token, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'pruebas', version: '1' }
    })
    expect(initialize.status).toBe(200)
    expect((await result(initialize)).result.serverInfo.name).toBe('crisol')

    const tools = await result(await rpc(token, 'tools/list'))
    expect(tools.result.tools.map((t: { name: string }) => t.name)).toContain('listar_mundos')

    const call = await result(await rpc(token, 'tools/call', { name: 'listar_mundos', arguments: {} }))
    expect(call.result.structuredContent).toEqual({ worlds: [] })
  })

  it('con el cliente oficial del protocolo actual también funciona', async () => {
    const owner = await account('owner')
    const token = await accessToken(owner.cookie, await oauthClient(owner.cookie))
    const client = new Client({ name: 'pruebas', version: '1' })
    await client.connect(
      new StreamableHTTPClientTransport(new URL('/mcp', BASE), {
        requestInit: { headers: { authorization: `Bearer ${token}` } }
      })
    )
    try {
      const { tools } = await client.listTools()
      expect(tools.map((t) => t.name)).toContain('listar_mundos')
      const call = await client.callTool({ name: 'listar_mundos', arguments: {} })
      expect(call.structuredContent).toEqual({ worlds: [] })
    } finally {
      await client.close()
    }
  })

  it('un token de quien no es propietario no sirve (módulo 0)', async () => {
    const owner = await account('owner')
    const member = await account('member')
    const token = await accessToken(member.cookie, await oauthClient(owner.cookie))
    const response = await rpc(token, 'tools/list')
    expect(response.status).toBe(403)
  })

  it('quien no es propietario no puede registrar clientes OAuth', async () => {
    const member = await account('member')
    const response = await fetch(new URL('/api/auth/oauth2/create-client', BASE), {
      method: 'POST',
      headers: { cookie: member.cookie, origin: BASE, 'content-type': 'application/json' },
      body: JSON.stringify({ redirect_uris: ['https://malo.example/cb'], client_name: 'Crisol' })
    })
    expect(response.status).toBe(401)
    const clients = await conn.db.select().from(schema.oauthClient)
    expect(clients.some((c) => c.redirectUris?.includes('https://malo.example/cb'))).toBe(false)
  })

  it('un token falso no sirve', async () => {
    expect((await rpc('no-es-un-token', 'tools/list')).status).toBe(401)
  })
})
