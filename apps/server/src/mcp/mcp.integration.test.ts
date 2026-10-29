import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { Approval, Campaign, HistoryEntry, Invitation, World } from '@crisol/contracts'
import { aiRepo, connect, schema } from '@crisol/db'
import { freshTestDatabase } from '@crisol/db/testing'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startServer } from '../server.ts'
import { signUpTestUser, TEST_AUTH_SECRET } from '../testing.ts'

type History = { entries: HistoryEntry[] }
type Approvals = { pending: Approval[]; recent: Approval[] }

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
    server = await startServer(
      {
        NODE_ENV: 'test',
        HOST: '127.0.0.1',
        PORT,
        DATABASE_URL: url,
        VALKEY_URL: process.env.TEST_VALKEY_URL ?? 'redis://127.0.0.1:63790',
        AUTH_SECRET: TEST_AUTH_SECRET,
        PUBLIC_URL: BASE
      },
      // Lo que espera aprobación contesta enseguida: aquí no se aprueba durante la espera
      { approvalWaitMs: 50 }
    )
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

  it('quien no es propietario no puede dar el permiso, aunque lo fuerce (módulo 0)', async () => {
    const owner = await account('owner')
    const member = await account('member')
    await expect(accessToken(member.cookie, await oauthClient(owner.cookie))).rejects.toThrow('403')
  })

  it('si deja de ser propietario, su token deja de servir en la siguiente petición', async () => {
    const owner = await account('owner')
    const token = await accessToken(owner.cookie, await oauthClient(owner.cookie))
    await conn.sql`update organization_members set role = 'member' where user_id = ${owner.userId}`
    expect((await rpc(token, 'tools/list')).status).toBe(403)
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

  it('un cliente que se registra solo (CIMD) desde otro dominio no llega a pedir permiso', async () => {
    const owner = await account('owner')
    const authorize = new URL('/api/auth/oauth2/authorize', BASE)
    authorize.search = new URLSearchParams({
      response_type: 'code',
      client_id: 'https://malo.example/oauth/client.json',
      redirect_uri: 'https://malo.example/callback',
      scope: 'openid profile offline_access',
      state: 'estado',
      code_challenge: createHash('sha256').update(randomBytes(32).toString('base64url')).digest('base64url'),
      code_challenge_method: 'S256',
      resource: `${BASE}/mcp`
    }).toString()
    const response = await fetch(authorize, {
      headers: { cookie: owner.cookie, accept: 'text/html' },
      redirect: 'manual'
    })
    // Se rechaza por el dominio, antes de ir a buscar sus metadatos
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: 'invalid_client',
      error_description: expect.stringContaining('not permitted')
    })
    const clients = await conn.db.select().from(schema.oauthClient)
    expect(clients.some((c) => c.clientId === 'https://malo.example/oauth/client.json')).toBe(false)
  })

  it('un token falso no sirve', async () => {
    expect((await rpc('no-es-un-token', 'tools/list')).status).toBe(401)
  })

  /** El cliente oficial con el token de un propietario recién conectado */
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
  afterAll(async () => {
    await Promise.all(clients.map((client) => client.close()))
  })

  /** Una acción de la API con la sesión del máster (lo que aún no tiene herramienta, o aprobar) */
  const api = async <T = Record<string, unknown>>(cookie: string, name: string, body: Record<string, unknown>) => {
    const response = await fetch(new URL(`/api/actions/${name}`, BASE), {
      method: 'POST',
      headers: { cookie, origin: BASE, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
    return (await response.json()) as T
  }

  it('cada herramienta en cada modo: leer siempre; lo demás se hace, espera o no se hace', async () => {
    const { userId, cookie, call } = await connected()
    const world = (await call<World>('crear_mundo', { name: 'Eana' })).data
    const campaign = (await call<Campaign>('crear_campana', { worldId: world.id, name: 'La Marca' })).data
    const history = (await call<History>('ver_historial', { worldId: world.id })).data
    const operationId = history.entries[0]?.id
    const page = await api<{ id: string }>(cookie, 'createPage', { worldId: world.id, title: 'Lugares' })
    const cases: Array<[string, Record<string, unknown>, 'read' | 'write' | 'players' | 'delete']> = [
      ['listar_mundos', {}, 'read'],
      ['ver_campana', { campaignId: campaign.id }, 'read'],
      ['ver_historial', { worldId: world.id }, 'read'],
      ['pendientes', {}, 'read'],
      ['enlace_invitacion', { campaignId: campaign.id }, 'read'],
      ['ver_arbol', { worldId: world.id }, 'read'],
      ['crear_mundo', { name: 'Otro' }, 'write'],
      ['mover_pagina', { pageId: page.id, parentId: null }, 'write'],
      ['borrar_pagina', { pageId: page.id }, 'delete'],
      ['crear_campana', { worldId: world.id, name: 'Otra' }, 'write'],
      ['enlace_invitacion', { campaignId: campaign.id, change: 'regenerate' }, 'players'],
      ['enlace_invitacion', { campaignId: campaign.id, change: 'close' }, 'players'],
      ['deshacer', { operationId }, 'delete']
    ]
    const expected = {
      readOnly: { read: 'run', write: 'refuse', players: 'refuse', delete: 'refuse' },
      assistant: { read: 'run', write: 'ask', players: 'ask', delete: 'ask' },
      copilot: { read: 'run', write: 'run', players: 'ask', delete: 'ask' }
    } as const
    for (const mode of ['readOnly', 'assistant', 'copilot'] as const) {
      await aiRepo.setAiMode(conn.db, userId, mode)
      for (const [tool, args, kind] of cases) {
        const result = await call(tool, args)
        const outcome = result.text.startsWith('READ_ONLY')
          ? 'refuse'
          : result.text.startsWith('PENDING_APPROVAL')
            ? 'ask'
            : result.isError
              ? `error: ${result.text}`
              : 'run'
        expect(`${mode} ${tool} ${kind}: ${outcome}`).toBe(`${mode} ${tool} ${kind}: ${expected[mode][kind]}`)
      }
    }
  })

  it('en copiloto, Claude crea una campaña sin preguntar y regenerar el enlace espera; al aprobarlo se hace', async () => {
    const { cookie, call } = await connected()
    const world = (await call<World>('crear_mundo', { name: 'Eana' })).data
    const campaign = (await call<Campaign>('crear_campana', { worldId: world.id, name: 'Los Cuervos' })).data
    expect((await call('ver_campana', { campaignId: campaign.id })).data).toMatchObject({
      campaign: { name: 'Los Cuervos', role: 'master' },
      world: { id: world.id, name: 'Eana' },
      members: [{ name: 'Enrique', role: 'master' }]
    })
    const before = (await call<Invitation>('enlace_invitacion', { campaignId: campaign.id })).data.url

    const asked = await call('enlace_invitacion', { campaignId: campaign.id, change: 'regenerate' })
    expect(asked.text).toMatch(/^PENDING_APPROVAL/)
    const { pending } = (await call<Approvals>('pendientes')).data
    expect(pending).toEqual([
      expect.objectContaining({
        tool: 'enlace_invitacion',
        action: 'regenerateInvitation',
        details: { campaign: 'Los Cuervos' },
        status: 'pending'
      })
    ])

    // El máster lo aprueba en Crisol (con su sesión)
    const approved = await fetch(new URL('/api/actions/approve', BASE), {
      method: 'POST',
      headers: { cookie, origin: BASE, 'content-type': 'application/json' },
      body: JSON.stringify({ approvalId: pending[0]?.id })
    })
    expect(await approved.json()).toMatchObject({ status: 'done' })
    expect((await call<Invitation>('enlace_invitacion', { campaignId: campaign.id })).data.url).not.toBe(before)
    expect((await call('pendientes')).data).toMatchObject({ pending: [], recent: [{ status: 'done' }] })
    const { entries } = (await call<History>('ver_historial', { worldId: world.id })).data
    expect(entries.map((e) => [e.action, e.via, e.tool])).toEqual([
      ['regenerateInvitation', 'ai', 'enlace_invitacion'],
      ['createCampaign', 'ai', 'crear_campana'],
      ['createWorld', 'ai', 'crear_mundo']
    ])
  })

  it('Claude ve el árbol de la wiki y recoloca páginas; en modo asistente espera, con los títulos en la cola', async () => {
    const { userId, cookie, call } = await connected()
    const world = (await call<World>('crear_mundo', { name: 'Eana' })).data
    const people = await api<{ id: string }>(cookie, 'createPage', { worldId: world.id, title: 'Personajes' })
    const places = await api<{ id: string }>(cookie, 'createPage', { worldId: world.id, title: 'Lugares' })
    const maela = await api<{ id: string }>(cookie, 'createPage', {
      worldId: world.id,
      title: 'Maela Varn',
      parentId: places.id
    })
    type Tree = { pages: { title: string; level: number }[] }
    const tree = async () =>
      (await call<Tree>('ver_arbol', { worldId: world.id, levels: 3 })).data.pages.map((p) => `${p.level} ${p.title}`)
    expect(await tree()).toEqual(['1 Personajes', '1 Lugares', '2 Maela Varn'])

    await aiRepo.setAiMode(conn.db, userId, 'assistant')
    const asked = await call('mover_pagina', { pageId: maela.id, parentId: people.id })
    expect(asked.text).toMatch(/^PENDING_APPROVAL/)
    const { pending } = (await call<Approvals>('pendientes')).data
    expect(pending[0]).toMatchObject({ action: 'movePage', details: { page: 'Maela Varn', parent: 'Personajes' } })
    expect(await api(cookie, 'approve', { approvalId: pending[0]?.id })).toMatchObject({ status: 'done' })
    expect(await tree()).toEqual(['1 Personajes', '2 Maela Varn', '1 Lugares'])
    const { entries } = (await call<History>('ver_historial', { worldId: world.id })).data
    expect(entries[0]).toMatchObject({ action: 'movePage', via: 'ai', tool: 'mover_pagina' })
  })

  it('lo de otra organización no existe para Claude: ni se ve, ni se pide, ni se deshace', async () => {
    const mine = await connected()
    const other = await connected()
    const theirWorld = (await other.call<World>('crear_mundo', { name: 'Ajeno' })).data
    const theirCampaign = (await other.call<Campaign>('crear_campana', { worldId: theirWorld.id, name: 'Secreta' }))
      .data
    const theirOperation = (await other.call<History>('ver_historial', { worldId: theirWorld.id })).data.entries[0]?.id

    expect(JSON.stringify((await mine.call('listar_mundos')).data)).not.toMatch(/Ajeno|Secreta/)
    for (const [tool, args] of [
      ['ver_campana', { campaignId: theirCampaign.id }],
      ['enlace_invitacion', { campaignId: theirCampaign.id }],
      ['enlace_invitacion', { campaignId: theirCampaign.id, change: 'regenerate' }],
      ['crear_campana', { worldId: theirWorld.id, name: 'Intrusa' }],
      ['ver_historial', { worldId: theirWorld.id }],
      ['deshacer', { operationId: theirOperation }]
    ] as const) {
      const result = await mine.call(tool, args)
      expect(`${tool}: ${result.text}`).toMatch(new RegExp(`^${tool}: NOT_FOUND`))
    }
    expect((await mine.call('pendientes')).data).toEqual({ pending: [], recent: [] })
  })

  it('lo de la papelera no sale en listar_mundos', async () => {
    const { cookie, call } = await connected()
    const world = (await call<World>('crear_mundo', { name: 'Eana' })).data
    const campaign = (await call<Campaign>('crear_campana', { worldId: world.id, name: 'Borrada' })).data
    await fetch(new URL('/api/actions/deleteCampaign', BASE), {
      method: 'POST',
      headers: { cookie, origin: BASE, 'content-type': 'application/json' },
      body: JSON.stringify({ campaignId: campaign.id })
    })
    expect((await call('listar_mundos')).data).toEqual({
      worlds: [expect.objectContaining({ name: 'Eana', role: 'master', campaigns: [] })]
    })
  })
})
