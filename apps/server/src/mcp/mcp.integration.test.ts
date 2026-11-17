import { createHash, randomBytes } from 'node:crypto'
import type { Approval, Campaign, HistoryEntry, Invitation, SystemFull, World } from '@crisol/contracts'
import { aiRepo, connect, schema } from '@crisol/db'
import { freshTestDatabase } from '@crisol/db/testing'
import { toFile } from '@crisol/systems'
import { exampleFile } from '@crisol/systems/examples'
import { fronteras } from '@crisol/systems/fixtures'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startServer } from '../server.ts'
import { seedExampleTemplates, signUpTestUser, TEST_AUTH_SECRET, TEST_CALENDAR, testDataDir } from '../testing.ts'
import { mcpTestHelpers } from './test-client.ts'

type History = { entries: HistoryEntry[] }
type Approvals = { pending: Approval[]; recent: Approval[] }

// Puerto fijo: el recurso y el emisor de los tokens salen de PUBLIC_URL, que tiene que ser la dirección real
const PORT = 8132
const BASE = `http://127.0.0.1:${PORT}`

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
        QUEUE_PREFIX: 'crisol-test',
        MODEL_DIR: '/sin-modelo',
        AUTH_SECRET: TEST_AUTH_SECRET,
        PUBLIC_URL: BASE,
        DATA_DIR: testDataDir()
      },
      // Lo que espera aprobación contesta enseguida: aquí no se aprueba durante la espera
      { approvalWaitMs: 50 }
    )
  })

  afterAll(async () => {
    await server?.stop()
    await conn?.close()
  })

  const { account, oauthClient, accessToken, connected, connectAs, api, closeClients } = mcpTestHelpers(
    BASE,
    () => server,
    () => conn
  )
  afterAll(closeClients)

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
      // El cliente comprueba lo que vuelve con su esquema (como claude.ai): los sistemas, con su icono y su portada
      const systems = await client.callTool({ name: 'listar_sistemas', arguments: {} })
      expect(systems.isError ?? false).toBe(false)
      // Las instrucciones, al día (tanda 9): el editor a mano y los capítulos
      expect(client.getInstructions()).toContain('editor por pasos')
      expect(client.getInstructions()).toContain('capitulos_libro')
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

  it('con un token falso no se lee el cuerpo, aunque sea grande', async () => {
    const response = await fetch(new URL('/mcp', BASE), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer falso' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { relleno: 'x'.repeat(5_000_000) } })
    })
    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata')
  })

  it('un token falso no sirve', async () => {
    expect((await rpc('no-es-un-token', 'tools/list')).status).toBe(401)
  })

  /** El cliente oficial con el token de un propietario recién conectado */
  it('cada herramienta en cada modo: leer siempre; lo demás se hace, espera o no se hace', async () => {
    const { userId, cookie, call } = await connected()
    const world = (await call<World>('crear_mundo', { name: 'Eana' })).data
    const campaign = (await call<Campaign>('crear_campana', { worldId: world.id, name: 'La Marca' })).data
    const history = (await call<History>('ver_historial', { worldId: world.id })).data
    const operationId = history.entries[0]?.id
    const page = await api<{ id: string }>(cookie, 'createPage', { worldId: world.id, title: 'Lugares' })
    await api(cookie, 'editPage', { pageId: page.id, body: { mode: 'append', markdown: 'Texto.' } })
    const { versions } = await api<{ versions: { id: string }[] }>(cookie, 'listPageVersions', { pageId: page.id })
    const own = await api<{ id: string }>(cookie, 'createTemplate', { name: 'Frente' })
    const system = (await api<{ system: SystemFull }>(cookie, 'importSystem', { file: toFile(fronteras, []) })).system
    const five = (await api<{ system: SystemFull }>(cookie, 'importSystem', { file: exampleFile('5e') })).system.id
    const cases: Array<[string, Record<string, unknown>, 'read' | 'write' | 'players' | 'delete']> = [
      ['listar_mundos', {}, 'read'],
      ['ver_campana', { campaignId: campaign.id }, 'read'],
      ['ver_historial', { worldId: world.id }, 'read'],
      ['pendientes', {}, 'read'],
      ['enlace_invitacion', { campaignId: campaign.id }, 'read'],
      ['ver_arbol', { worldId: world.id }, 'read'],
      ['leer_pagina', { pageId: page.id, ids: true }, 'read'],
      ['enlaces_pagina', { pageId: page.id }, 'read'],
      ['enlaces_pagina', { worldId: world.id }, 'read'],
      ['versiones_pagina', { pageId: page.id }, 'read'],
      ['listar_archivos', { worldId: world.id }, 'read'],
      ['listar_etiquetas', {}, 'read'],
      ['ver_pestanas', { pageId: page.id }, 'read'],
      ['listar_plantillas', {}, 'read'],
      ['ver_plantilla', { templateId: own.id }, 'read'],
      ['crear_plantilla', { name: 'Frente de Eana', copyOf: 'Frente' }, 'write'],
      ['cambiar_plantilla', { templateId: own.id, skeleton: '## En una frase' }, 'write'],
      ['borrar_plantilla', { templateId: own.id }, 'delete'],
      ['buscar_paginas', { worldId: world.id, query: 'lugares' }, 'read'],
      ['restaurar_version', { pageId: page.id, versionId: versions[0]?.id }, 'write'],
      ['crear_mundo', { name: 'Otro' }, 'write'],
      ['crear_paginas', { worldId: world.id, parentId: null, pages: [{ key: 'a', title: 'Nueva' }] }, 'write'],
      ['editar_pagina', { pageId: page.id, body: { mode: 'append', markdown: 'Más.' } }, 'write'],
      ['mover_pagina', { pageId: page.id, parentId: null }, 'write'],
      ['borrar_pagina', { pageId: page.id }, 'delete'],
      ['crear_campana', { worldId: world.id, name: 'Otra' }, 'write'],
      ['enlace_invitacion', { campaignId: campaign.id, change: 'regenerate' }, 'players'],
      ['enlace_invitacion', { campaignId: campaign.id, change: 'close' }, 'players'],
      ['tirar_dados', { formula: '1d20+5' }, 'read'],
      ['tirar_dados', { formula: '1d20+5', campaignId: campaign.id }, 'write'],
      ['ver_tiradas', { campaignId: campaign.id }, 'read'],
      ['formato_sistemas', {}, 'read'],
      ['listar_sistemas', {}, 'read'],
      ['ver_sistema', { systemId: system.id }, 'read'],
      ['ver_sistema', { systemId: system.id, parts: ['dice'] }, 'read'],
      ['validar_sistema', { document: fronteras }, 'read'],
      ['probar_formula', { systemId: system.id, type: 'personaje', formula: '7 + @vigor' }, 'read'],
      ['probar_tirada', { systemId: system.id, roll: 'atributo', element: 'vigor' }, 'read'],
      ['crear_sistema', { name: 'Otro' }, 'write'],
      ['cambiar_sistema', { systemId: system.id, version: 1, changes: [{ path: 'summary', value: 'Otro' }] }, 'write'],
      ['buscar_contenido', { systemId: five, query: 'espada larga' }, 'read'],
      ['leer_contenido', { systemId: five, keys: ['espada_larga_2024'] }, 'read'],
      [
        'probar_accion',
        {
          systemId: five,
          item: 'aliento',
          action: 'usar',
          document: {
            items: [
              { id: 'guerrero', content: 'guerrero_2024', data: { nivel: 5, inicial: true } },
              { id: 'aliento', content: 'guerrero_tomar_aliento_2024', from: 'guerrero' }
            ]
          }
        },
        'read'
      ],
      // En copiloto se hacen: cada uno sube la versión del sistema
      [
        'guardar_contenido',
        {
          systemId: system.id,
          version: 2,
          items: [
            {
              type: 'objeto',
              key: 'amuleto',
              source: null,
              data: { name: 'Amuleto' },
              mechanics: { effects: [{ target: 'defensa', op: 'add', value: '1', when: '@este.equipado' }] }
            }
          ]
        },
        'write'
      ],
      ['borrar_contenido', { systemId: system.id, version: 3, keys: ['amuleto'] }, 'delete'],
      ['cambiar_campana', { campaignId: campaign.id, system: system.id }, 'write'],
      ['borrar_sistema', { systemId: system.id }, 'delete'],
      ['deshacer', { operationId }, 'delete']
    ]
    const expected = {
      readOnly: { read: 'run', write: 'refuse', players: 'refuse', delete: 'refuse' },
      assistant: { read: 'run', write: 'ask', players: 'ask', delete: 'ask' },
      copilot: { read: 'run', write: 'run', players: 'ask', delete: 'ask' }
    } as const
    for (const mode of ['readOnly', 'assistant', 'copilot'] as const) {
      await aiRepo.setAiMode(conn.db, userId, mode)
      // Lo que esperaba del modo anterior no cuenta para el tope de la cola
      await conn.db.delete(schema.approvals).where(eq(schema.approvals.userId, userId))
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
    // Con la cobertura y la máquina cargada, más de 20 s
  }, 60_000)

  it('desde cero (ADR-0015): la IA hace un sistema con su hoja, su creador y su compendio, y un personaje con él', async () => {
    const { userId, cookie, call } = await connected()
    await aiRepo.setAiMode(conn.db, userId, 'copilot')
    const document = {
      format: 1,
      id: 'ceniza',
      name: 'Ceniza',
      summary: 'Un juego pequeño, hecho desde cero.',
      version: '1',
      languages: ['es'],
      types: {
        personaje: {
          document: 'actor',
          label: 'Personaje',
          fields: {
            atributos: {
              kind: 'set',
              label: 'Atributos',
              elements: [
                { key: 'fuerza', label: 'Fuerza' },
                { key: 'ingenio', label: 'Ingenio' },
                { key: 'temple', label: 'Temple' }
              ],
              fields: { valor: { kind: 'number', label: 'Valor', default: 0, integer: true, min: 0, max: 5 } }
            },
            sendas: { kind: 'items', label: 'Sendas', of: ['senda'] },
            dones: { kind: 'items', label: 'Dones', of: ['don'] },
            nivel: { kind: 'derived', label: 'Nivel', formula: 'sum(@sendas.nivel)' },
            aguante: { kind: 'derived', label: 'Aguante', formula: '6 + @atributos.temple.valor * 2 + @nivel' }
          }
        },
        senda: {
          document: 'item',
          label: 'Senda',
          fields: {
            nivel: { kind: 'number', label: 'Nivel', default: 1, integer: true, min: 1, max: 10 },
            descripcion: { kind: 'text', label: 'Descripción', lines: 6 }
          }
        },
        don: { document: 'item', label: 'Don', fields: { descripcion: { kind: 'text', label: 'Descripción' } } }
      },
      rolls: {
        atributo: {
          label: 'Atributo',
          formula: '1d10 + @este.valor',
          for: { set: 'atributos' },
          bands: [
            { if: '@total >= 10', label: 'Éxito', tone: 'success' },
            { if: 'true', label: 'Fallo', tone: 'failure' }
          ]
        }
      },
      dice: { default: '1d10', critical: 'none' },
      card: ['nivel', 'aguante'],
      creation: [
        { key: 'senda', kind: 'content', type: 'senda', label: 'Senda', levels: true },
        {
          key: 'atributos',
          kind: 'scores',
          label: 'Atributos',
          set: 'atributos',
          field: 'valor',
          creation: true,
          methods: [{ key: 'reparto', kind: 'array', label: 'Reparto', values: [3, 2, 1] }]
        },
        { key: 'dones', kind: 'content', type: 'don', label: 'Dones', min: 1, max: 2, creation: true },
        { key: 'resumen', kind: 'summary', label: 'Resumen' }
      ],
      compendium: { sections: [{ key: 'personajes', label: 'Personajes', types: ['senda', 'don'] }], types: {} }
    }
    const system = (await call<SystemFull>('crear_sistema', { document })).data
    expect(system).toMatchObject({ name: 'Ceniza', builtIn: false, version: 1 })
    const saved = await call('guardar_contenido', {
      systemId: system.id,
      version: 1,
      items: [
        { type: 'senda', key: 'guerrera', source: null, data: { name: 'Guerrera', descripcion: 'Golpea primero.' } },
        { type: 'don', key: 'ojo_avizor', source: null, data: { name: 'Ojo avizor', descripcion: 'Ves de lejos.' } }
      ]
    })
    expect(saved.isError, saved.text).toBeFalsy()
    const world = (await call<World>('crear_mundo', { name: 'Cenizas' })).data
    const campaign = (await call<Campaign>('crear_campana', { worldId: world.id, name: 'Brasas', system: system.id }))
      .data
    // Lo de los personajes (cosa de jugadores) espera al máster aun en copiloto: lo aprueba en Crisol
    const asMaster = async (tool: string, args: Record<string, unknown>) => {
      const asked = await call(tool, args)
      expect(asked.isError, asked.text).toBeFalsy()
      if (!asked.text.startsWith('PENDING_APPROVAL')) return
      const { pending } = (await call<Approvals>('pendientes')).data
      const approved = await fetch(new URL('/api/actions/approve', BASE), {
        method: 'POST',
        headers: { cookie, origin: BASE, 'content-type': 'application/json' },
        body: JSON.stringify({ approvalId: pending[0]?.id })
      })
      expect(await approved.json()).toMatchObject({ status: 'done' })
    }
    const current = async () => {
      const { characters } = (
        await call<{ characters: { id: string; version: number }[] }>('listar_personajes', { campaignId: campaign.id })
      ).data
      const [one] = characters
      if (!one) throw new Error('sin personaje')
      return one
    }
    // El compendio del mundo: guardar en él, encontrarlo desde la campaña, copiar del sistema y quitar
    const own = await call('guardar_contenido', {
      systemId: system.id,
      worldId: world.id,
      items: [{ type: 'don', key: 'fuego_del_valle', data: { name: 'Fuego del valle', descripcion: 'Arde.' } }]
    })
    expect(own.isError, own.text).toBeFalsy()
    const found = await call<{ items: { key: string; world?: boolean }[] }>('buscar_contenido', {
      systemId: system.id,
      campaignId: campaign.id,
      query: 'fuego'
    })
    expect(found.data.items).toEqual([expect.objectContaining({ key: 'fuego_del_valle', world: true })])
    const copied = await call<{ key: string }>('copiar_contenido', {
      worldId: world.id,
      systemId: system.id,
      key: 'ojo_avizor',
      to: 'world',
      name: 'Ojo de halcón'
    })
    expect(copied.isError, copied.text).toBeFalsy()
    const read = await call<{ items: { data: { name: unknown }; world?: { origin: { key: string } } }[] }>(
      'leer_compendio',
      { campaignId: campaign.id, keys: [copied.data.key] }
    )
    expect(read.data.items[0]).toMatchObject({
      data: { name: 'Ojo de halcón' },
      world: { origin: { key: 'ojo_avizor' } }
    })
    const origin = await call<{ changes: unknown[] }>('origen_contenido', {
      worldId: world.id,
      systemId: system.id,
      key: copied.data.key
    })
    expect(origin.data.changes).toEqual([])
    // Quitar, en copiloto, espera al máster
    await asMaster('borrar_contenido', { systemId: system.id, worldId: world.id, keys: ['fuego_del_valle'] })
    const gone = await call<{ items: unknown[] }>('buscar_contenido', {
      systemId: system.id,
      campaignId: campaign.id,
      query: 'fuego'
    })
    expect(gone.data.items).toEqual([])
    await asMaster('crear_personaje', { campaignId: campaign.id, name: 'Ária' })
    const { id } = await current()
    await asMaster('elegir_personaje', {
      characterId: id,
      version: (await current()).version,
      add: [
        { step: 'senda', key: 'guerrera' },
        { step: 'dones', key: 'ojo_avizor' }
      ],
      scores: { method: 'reparto', base: { fuerza: 3, ingenio: 1, temple: 2 } }
    })
    await asMaster('elegir_personaje', { characterId: id, version: (await current()).version, confirm: 'created' })
    const seen = await call<{
      character: { status: string; summary: { stats: { key: string; value: string }[] } }
    }>('ver_personaje', { characterId: id })
    expect(seen.data.character.status).toBe('ready')
    // Su hoja, calculada con lo elegido: nivel 1 y aguante 6 + 2 × 2 + 1
    expect(seen.data.character.summary.stats).toEqual([
      { key: 'nivel', label: 'Nivel', value: '1' },
      { key: 'aguante', label: 'Aguante', value: '11' }
    ])
  }, 60_000)

  it('en copiloto, Claude crea una campaña sin preguntar y regenerar el enlace espera; al aprobarlo se hace', async () => {
    const { cookie, call } = await connected()
    const world = (await call<World>('crear_mundo', { name: 'Eana' })).data
    const campaign = (await call<Campaign>('crear_campana', { worldId: world.id, name: 'Los Cuervos' })).data
    expect((await call('ver_campana', { campaignId: campaign.id })).data).toMatchObject({
      campaign: { name: 'Los Cuervos', role: 'master' },
      world: { id: world.id, name: 'Eana' },
      members: [{ name: expect.stringMatching(/^Enrique /), role: 'master' }]
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

  it('Claude crea y cambia páginas en Markdown; lo que espera aprobación se aplica sobre lo de ese momento', async () => {
    const { userId, cookie, call } = await connected()
    const world = (await call<World>('crear_mundo', { name: 'Eana' })).data
    type Created = { pages: { key: string; id: string }[] }
    const created = await call<Created>('crear_paginas', {
      worldId: world.id,
      parentId: null,
      pages: [
        {
          key: 'p',
          title: 'Puerto Ceniza',
          markdown: 'Uno.\n\n## Historia\n\nEl faro.\n\n> [!secreto]\n> La Hermandad.'
        }
      ]
    })
    const pageId = created.data.pages[0]?.id
    const read = await call<{ markdown: string }>('leer_pagina', { pageId, ids: true })
    expect(read.data.markdown).toContain('> [!secreto]\n> La Hermandad.')
    const firstId = /^Uno\. \^([a-z0-9]{8})$/m.exec(read.data.markdown)?.[1]

    // En modo asistente espera; el máster borra el bloque antes de aprobar: queda fallida, con su código
    await aiRepo.setAiMode(conn.db, userId, 'assistant')
    const asked = await call('editar_pagina', { pageId, body: { mode: 'block', blockId: firstId, markdown: 'Dos.' } })
    expect(asked.text).toMatch(/^PENDING_APPROVAL/)
    await api(cookie, 'editPage', {
      pageId,
      body: { mode: 'replace', markdown: 'Otra cosa.\n\n## Historia\n\nEl faro.' }
    })
    let { pending } = (await call<Approvals>('pendientes')).data
    expect(pending[0]).toMatchObject({ action: 'editPage', details: { page: 'Puerto Ceniza' } })
    expect(await api(cookie, 'approve', { approvalId: pending[0]?.id })).toMatchObject({
      status: 'failed',
      error: 'BLOCK_NOT_FOUND'
    })

    // Una sección: se aplica sobre lo de ahora, y dice que la página cambió entre medias
    const section = await call('editar_pagina', {
      pageId,
      body: { mode: 'section', section: 'Historia', markdown: 'Ardió.' }
    })
    expect(section.text).toMatch(/^PENDING_APPROVAL/)
    await api(cookie, 'editPage', { pageId, body: { mode: 'append', markdown: '## Barrios\n\nDel máster.' } })
    ;({ pending } = (await call<Approvals>('pendientes')).data)
    expect(await api(cookie, 'approve', { approvalId: pending[0]?.id })).toMatchObject({ status: 'done' })
    const after = (await call<{ markdown: string }>('leer_pagina', { pageId })).data.markdown
    expect(after).toBe('Otra cosa.\n\n## Historia\n\nArdió.\n\n## Barrios\n\nDel máster.\n')
    const { recent } = (await call<Approvals>('pendientes')).data
    expect(recent[0]).toMatchObject({ status: 'done' })
    const { entries } = (await call<History>('ver_historial', { worldId: world.id })).data
    expect(entries[0]).toMatchObject({ action: 'editPage', via: 'ai', tool: 'editar_pagina' })
  })

  it('la IA tira (en una campaña, oculta por defecto; sin campaña, solo el resultado) y lleva el «hoy» de una campaña', async () => {
    const { call } = await connected()
    const world = (await call<World>('crear_mundo', { name: 'Eana' })).data
    const campaign = (await call<Campaign>('crear_campana', { worldId: world.id, name: 'La Marca' })).data
    const hidden = await call<{ roll: { visibility: string; ai: boolean; label: string } }>('tirar_dados', {
      campaignId: campaign.id,
      formula: '1d8 # Encuentro en los muelles'
    })
    expect(hidden.data.roll).toMatchObject({ visibility: 'hidden', ai: true, label: 'Encuentro en los muelles' })
    await call('tirar_dados', { campaignId: campaign.id, formula: '1d20 # Para todos', visibility: 'all' })
    const listed = await call<{ rolls: { label: string; visibility: string }[] }>('ver_tiradas', {
      campaignId: campaign.id
    })
    expect(listed.data.rolls.map((r) => [r.label, r.visibility])).toEqual([
      ['Encuentro en los muelles', 'hidden'],
      ['Para todos', 'all']
    ])
    const tried = await call<{ total: number; detail: string }>('tirar_dados', { formula: '4d6kh3' })
    expect(tried.data.detail).toMatch(/^4d6kh3 → \[/)
    // Sin apuntar: el registro sigue con dos
    expect((await call<{ rolls: unknown[] }>('ver_tiradas', { campaignId: campaign.id })).data.rolls).toHaveLength(2)
    // Una que no vale: le dice por qué
    const bad = await call('tirar_dados', { formula: '1d20+' })
    expect(bad.isError).toBe(true)
    expect(bad.text).toContain('No se entiende «1d20+» al final')

    // El «hoy» de una campaña (8 · campaña), con la misma conexión: los tokens de OAuth tienen tope
    const eana = (await call<World>('crear_mundo', { name: 'Eana' })).data
    const marca = (await call<Campaign>('crear_campana', { worldId: eana.id, name: 'La Marca' })).data
    const calendar = await call('crear_calendario', {
      worldId: eana.id,
      name: 'Eana',
      from: { definition: TEST_CALENDAR }
    })
    expect(calendar.isError, calendar.text).toBeFalsy()
    expect((await call('cambiar_fecha', { campaignId: marca.id, days: 1 })).text).toContain('NO_TODAY')
    const set = await call<{ today: { form: string } }>('cambiar_fecha', {
      campaignId: marca.id,
      date: '1250-Siega-18'
    })
    expect(set.data.today.form).toBe('1250-Siega-18')
    const today = await call<{ forecast: unknown[]; weather: { condition: string } }>('fecha_de_hoy', {
      campaignId: marca.id
    })
    expect(today.data.forecast).toHaveLength(7)
    const days = await call<{ days: Array<{ form: string }> }>('ver_clima', { campaignId: marca.id, days: 3 })
    expect(days.data.days.map((d) => d.form)).toEqual(['1250-Siega-18', '1250-Siega-19', '1250-Siega-20'])
    const changed = await call('cambiar_clima', {
      campaignId: marca.id,
      weather: { condition: 'fog', low: 2, high: 6, wind: 'calm', windDirection: 'N' }
    })
    expect(changed.isError, changed.text).toBeFalsy()
    const plan = await call<{ days: number; arrival: { form: string } }>('planear_viaje', {
      campaignId: marca.id,
      distance: 48,
      medium: 'foot'
    })
    expect(plan.data).toMatchObject({ days: 2, arrival: { form: '1250-Siega-20' } })
    const done = await call<{ today: { form: string } }>('planear_viaje', {
      campaignId: marca.id,
      distance: 48,
      advance: true,
      zone: 'coast'
    })
    expect(done.data.today.form).toBe('1250-Siega-20')
    const activity = await call<{ count: number }>('actividad_campana', { campaignId: marca.id })
    expect(activity.isError, activity.text).toBeFalsy()
  })

  it('la IA crea una tabla del mundo y tira en ella: oculta por defecto; luego la reinicia', async () => {
    const { cookie, call } = await connected()
    const system = (await api<{ system: SystemFull }>(cookie, 'importSystem', { file: toFile(fronteras, []) })).system
    const world = (await call<World>('crear_mundo', { name: 'Eana' })).data
    const campaign = (await call<Campaign>('crear_campana', { worldId: world.id, name: 'La Marca', system: system.id }))
      .data
    const saved = await call('guardar_contenido', {
      systemId: system.id,
      worldId: world.id,
      items: [
        {
          type: 'tabla',
          key: 'encuentros',
          data: { name: 'Encuentros' },
          table: { replacement: false, rows: [{ id: 'a', from: 1, to: 1, text: 'Lobos' }] }
        }
      ]
    })
    expect(saved.isError, saved.text).toBeFalsy()
    const rolled = await call<{ roll: { visibility: string; ai: boolean }; drawn: string[] }>('tirar_tabla_compendio', {
      campaignId: campaign.id,
      key: 'encuentros'
    })
    expect(rolled.data).toMatchObject({ roll: { visibility: 'hidden', ai: true }, drawn: ['a'] })
    expect((await call('tirar_tabla_compendio', { campaignId: campaign.id, key: 'encuentros' })).text).toContain(
      'TABLE_EMPTY'
    )
    expect(
      (await call('reiniciar_tabla_compendio', { campaignId: campaign.id, key: 'encuentros' })).isError
    ).toBeFalsy()
  })

  it('la IA reparte el botín: lo pone en el grupo, pasa una poción a un personaje y reparte las monedas', async () => {
    const { cookie, call } = await connected()
    const five = (await api<{ system: SystemFull }>(cookie, 'importSystem', { file: exampleFile('5e') })).system.id
    const world = (await call<World>('crear_mundo', { name: 'Valdren' })).data
    const campaign = (await call<Campaign>('crear_campana', { worldId: world.id, name: 'La Marca', system: five })).data
    const thora = (
      await api<{ character: { id: string } }>(cookie, 'createCharacter', { campaignId: campaign.id, name: 'Thora' })
    ).character.id
    // Lo de los jugadores espera al máster: lo aprueba en Crisol
    const asMaster = async (tool: string, args: Record<string, unknown>) => {
      const asked = await call(tool, args)
      expect(asked.isError, asked.text).toBeFalsy()
      if (!asked.text.startsWith('PENDING_APPROVAL')) return
      const { pending } = (await call<Approvals>('pendientes')).data
      expect(await api(cookie, 'approve', { approvalId: pending[0]?.id })).toMatchObject({ status: 'done' })
    }
    type PartyView = {
      party: { version: number; items: { id: string; quantity: number }[]; coins: Record<string, number> }
    }
    const seen = async () => (await call<PartyView>('ver_grupo', { campaignId: campaign.id })).data
    await asMaster('cambiar_grupo', {
      campaignId: campaign.id,
      version: 0,
      add: { key: 'pocion_de_curacion_2024', quantity: 2 }
    })
    await asMaster('cambiar_grupo', {
      campaignId: campaign.id,
      version: (await seen()).party.version,
      coins: { po: 30 }
    })
    const pocion = (await seen()).party.items[0]
    await asMaster('mover_en_grupo', {
      campaignId: campaign.id,
      from: { party: pocion?.id },
      to: { character: thora },
      quantity: 1
    })
    await asMaster('monedas_grupo', { campaignId: campaign.id, split: [thora] })
    const after = await seen()
    expect(after.party.items[0]?.quantity).toBe(1)
    expect(after.party.coins).toEqual({ po: 0 })
    const character = await api<{ character: { play: { items: { key: string }[]; values: Record<string, unknown> } } }>(
      cookie,
      'getCharacter',
      { characterId: thora }
    )
    expect(character.character.play.items.map((i) => i.key)).toEqual(['pocion_de_curacion_2024'])
    expect(character.character.play.values.monedas).toEqual({ po: 30 })
  })

  it('la IA y las criaturas en juego: pone goblins, tira por uno, aplica el daño y los quita', async () => {
    const { cookie, call } = await connected()
    const five = (await api<{ system: SystemFull }>(cookie, 'importSystem', { file: exampleFile('5e') })).system.id
    const world = (await call<World>('crear_mundo', { name: 'Valdren' })).data
    const campaign = (await call<Campaign>('crear_campana', { worldId: world.id, name: 'La Marca', system: five })).data
    const put = await call<{ creatures: { id: string; name: string }[] }>('poner_en_juego', {
      campaignId: campaign.id,
      key: 'guerrero_goblin_2014',
      count: 2
    })
    expect(put.isError, put.text).toBeFalsy()
    const [one, two] = put.data.creatures
    if (!one || !two) throw new Error('sin goblins')
    const sheet = await call<{ state: { actions: { key: string }[] } }>('ver_criatura', { creatureId: one.id })
    expect(sheet.data.state.actions.map((a) => a.key)).toEqual(['cimitarra', 'arco_corto'])
    const rolled = await call<{ roll: { id: string; label: string; visibility: string; ai: boolean } }>(
      'tirar_por_criatura',
      { creatureId: one.id, action: { item: null, key: 'cimitarra', part: 'damage' } }
    )
    expect(rolled.data.roll).toMatchObject({ label: 'Goblin 1 · Cimitarra · daño', visibility: 'hidden', ai: true })
    const applied = await call<{ applied: { name: string }[] }>('aplicar_tirada', {
      campaignId: campaign.id,
      rollId: rolled.data.roll.id,
      targets: [{ creatureId: two.id, multiplier: 1 }]
    })
    expect(applied.isError, applied.text).toBeFalsy()
    expect(applied.data.applied.map((a) => a.name)).toEqual(['Goblin 2'])
    const listed = await call<{ creatures: { name: string; life: { value: number } }[] }>('ver_en_juego', {
      campaignId: campaign.id
    })
    expect(listed.data.creatures.map((c) => c.name)).toEqual(['Goblin 1', 'Goblin 2'])
    // Quitar, en copiloto, espera al máster
    const removed = await call('quitar_de_juego', { campaignId: campaign.id, copiesOf: 'guerrero_goblin_2014' })
    expect(removed.text.startsWith('PENDING_APPROVAL')).toBe(true)
  })

  it('criterio 1: la IA hace un sistema de 2d6, lo valida, prueba una tirada y una fórmula, y sale en «Sistemas»', async () => {
    const { cookie, call } = await connected()
    const format = await call<{ docs: string }>('formato_sistemas')
    expect(format.data.docs).toContain('## Las fórmulas')
    // Con una errata: validar dice su ruta, dónde está y por qué; crear no guarda nada y lo dice igual
    const draft = structuredClone(fronteras) as unknown as {
      types: { personaje: { fields: { defensa: { formula: string } } } }
    }
    draft.types.personaje.fields.defensa.formula = '7 + @vigr'
    const checked = await call<{ valid: boolean; problems: { path: string; where: string }[] }>('validar_sistema', {
      document: draft
    })
    expect(checked.data.valid).toBe(false)
    expect(checked.data.problems[0]).toMatchObject({
      path: 'types.personaje.fields.defensa.formula',
      where: 'Personaje › Defensa › Fórmula'
    })
    const refused = await call('crear_sistema', { document: draft })
    expect(refused.isError).toBe(true)
    expect(refused.text).toContain(
      'SYSTEM_INVALID: types.personaje.fields.defensa.formula (Personaje › Defensa › Fórmula): No existe «@vigr» en Personaje'
    )
    // Bien escrito: se crea, se prueba y se cambia por rutas
    const created = await call<SystemFull>('crear_sistema', { document: fronteras })
    expect(created.isError).toBeFalsy()
    const id = created.data.id
    const formula = await call<{ value: number; terms: { label: string }[] }>('probar_formula', {
      systemId: id,
      type: 'personaje',
      formula: '7 + @vigor',
      document: { data: { vigor: 2 } }
    })
    expect(formula.data.value).toBe(9)
    expect(formula.data.terms.map((t) => t.label)).toEqual(['Base', 'Vigor'])
    const roll = await call<{ label: string; band: { label: string } }>('probar_tirada', {
      systemId: id,
      roll: 'atributo',
      element: 'astucia',
      document: { data: { astucia: 1 } }
    })
    expect(roll.data.label).toBe('Atributo · Astucia')
    expect(['Éxito total', 'Éxito con coste', 'Fallo']).toContain(roll.data.band.label)
    const changed = await call<{ system: SystemFull }>('cambiar_sistema', {
      systemId: id,
      version: 1,
      changes: [{ path: 'rolls.atributo.bands[0].label', value: 'Éxito pleno' }]
    })
    expect(changed.data.system.version).toBe(2)
    const parts = await call<{ parts: Record<string, { label: string }> }>('ver_sistema', {
      systemId: id,
      parts: ['rolls.atributo.bands[0]']
    })
    expect(parts.data.parts['rolls.atributo.bands[0]']?.label).toBe('Éxito pleno')
    // Sale en «Sistemas», en Mis mundos
    const { systems } = await api<{ systems: { id: string; name: string; version: number }[] }>(
      cookie,
      'listSystems',
      {}
    )
    expect(systems.find((s) => s.id === id)).toMatchObject({ name: 'Fronteras', version: 2 })
  })

  it('el formato de los sistemas, también como recurso', async () => {
    const owner = await account('owner')
    const token = await accessToken(owner.cookie, await oauthClient(owner.cookie))
    const listed = await result(await rpc(token, 'resources/list'))
    expect(listed.result.resources.map((r: { uri: string }) => r.uri)).toContain('crisol://sistemas/formato')
    const read = await result(await rpc(token, 'resources/read', { uri: 'crisol://sistemas/formato' }))
    expect(read.result.contents[0].text).toContain('# El formato de los sistemas de Crisol')
  })

  it('Claude crea con plantilla; si un valor no cabe en su campo, el error le dice qué campos tiene', async () => {
    const { cookie, call } = await connected()
    // Las plantillas de ejemplo en su cuenta (no hay de serie)
    const ids = await seedExampleTemplates(async (name, payload) => {
      const data = await api(cookie, name, payload as Record<string, unknown>)
      return { json: () => data }
    })
    const world = (await call<World>('crear_mundo', { name: 'Eana' })).data
    const bad = await call('crear_paginas', {
      worldId: world.id,
      parentId: null,
      pages: [{ key: 'a', title: 'Mamá Gris', template: 'PNJ', markdown: '---\nFacción: 7\n---\n' }]
    })
    expect(bad.isError).toBe(true)
    expect(bad.text).toContain('«Facción» no cabe en el campo «Facción» de PNJ')
    expect(bad.text).toContain('Sus campos: Especie (texto), Rol (texto), Facción (páginas, una)')
    const made = await call<{ pages: { id: string }[] }>('crear_paginas', {
      worldId: world.id,
      parentId: null,
      pages: [{ key: 'a', title: 'Mamá Gris', template: 'PNJ', markdown: '---\nRol: Jefa\n---\n' }]
    })
    const read = await call<{ page: { template: string } }>('leer_pagina', { pageId: made.data.pages[0]?.id })
    expect(read.data.page.template).toBe(ids.pnj)
  })

  it('lo de otra organización no existe para Claude: ni se ve, ni se pide, ni se deshace', async () => {
    const mine = await connected()
    const other = await connected()
    const theirWorld = (await other.call<World>('crear_mundo', { name: 'Ajeno' })).data
    const theirCampaign = (await other.call<Campaign>('crear_campana', { worldId: theirWorld.id, name: 'Secreta' }))
      .data
    const theirOperation = (await other.call<History>('ver_historial', { worldId: theirWorld.id })).data.entries[0]?.id
    type Created = { pages: { id: string }[] }
    const theirSystem = (await other.call<SystemFull>('crear_sistema', { document: fronteras })).data
    const theirPage = (
      await other.call<Created>('crear_paginas', {
        worldId: theirWorld.id,
        parentId: null,
        pages: [{ key: 'p', title: 'Página ajena', markdown: '> [!secreto]\n> Lo que nadie más sabe.' }]
      })
    ).data.pages[0]?.id

    expect(JSON.stringify((await mine.call('listar_mundos')).data)).not.toMatch(/Ajeno|Secreta/)
    expect(JSON.stringify((await mine.call('listar_sistemas')).data)).not.toContain(theirSystem.id)
    for (const [tool, args] of [
      ['ver_campana', { campaignId: theirCampaign.id }],
      ['enlace_invitacion', { campaignId: theirCampaign.id }],
      ['enlace_invitacion', { campaignId: theirCampaign.id, change: 'regenerate' }],
      ['crear_campana', { worldId: theirWorld.id, name: 'Intrusa' }],
      ['ver_historial', { worldId: theirWorld.id }],
      ['deshacer', { operationId: theirOperation }],
      ['leer_pagina', { pageId: theirPage }],
      ['editar_pagina', { pageId: theirPage, body: { mode: 'append', markdown: 'Intrusa' } }],
      ['crear_paginas', { worldId: theirWorld.id, parentId: null, pages: [{ key: 'x', title: 'Intrusa' }] }],
      ['ver_sistema', { systemId: theirSystem.id }],
      ['ver_sistema', { systemId: theirSystem.id, parts: ['dice'] }],
      ['cambiar_sistema', { systemId: theirSystem.id, version: 1, changes: [{ path: 'name', value: 'Intruso' }] }],
      ['probar_formula', { systemId: theirSystem.id, type: 'personaje', formula: '1' }],
      ['probar_tirada', { systemId: theirSystem.id, roll: 'atributo' }],
      ['buscar_contenido', { systemId: theirSystem.id }],
      ['leer_contenido', { systemId: theirSystem.id, keys: ['x'] }],
      ['probar_accion', { systemId: theirSystem.id, item: null, action: 'x' }],
      [
        'guardar_contenido',
        {
          systemId: theirSystem.id,
          version: 1,
          items: [{ type: 'objeto', key: 'x', source: null, data: { name: 'X' } }]
        }
      ],
      ['borrar_contenido', { systemId: theirSystem.id, version: 1, keys: ['x'] }],
      ['borrar_sistema', { systemId: theirSystem.id }],
      ['crear_sistema', { name: 'Copia', from: theirSystem.id }]
    ] as const) {
      const result = await mine.call(tool, args)
      expect(`${tool}: ${result.text}`).toMatch(new RegExp(`^${tool}: NOT_FOUND`))
      expect(result.text).not.toContain('nadie más sabe')
    }
    expect((await mine.call('pendientes')).data).toEqual({ pending: [], recent: [] })
  })

  it('lo que sabe cada campaña (ADR-0017): la IA del máster marca con aprobación y ve como jugador; la de una jugadora solo lee lo suyo', async () => {
    const { cookie, call } = await connected()
    const world = (await call<World>('crear_mundo', { name: 'Valdren' })).data
    const campaign = (await call<Campaign>('crear_campana', { worldId: world.id, name: 'La Marca' })).data
    const created = await api<{ pages: { id: string; title: string }[] }>(cookie, 'createPages', {
      worldId: world.id,
      parentId: null,
      pages: [
        { key: 'a', title: 'Aldoria', markdown: 'Un reino.\n\n> [!secreto]\n> El rey ha muerto.' },
        { key: 'v', title: 'Varn' }
      ]
    })
    const aldoria = created.pages.find((p) => p.title === 'Aldoria')?.id ?? ''
    const varn = created.pages.find((p) => p.title === 'Varn')?.id ?? ''

    // Marcar pide aprobación (copiloto): lo revelado no se puede «des-saber»
    const asked = await call('marcar_conocimiento', {
      worldId: world.id,
      campaignId: campaign.id,
      kind: 'page',
      targetId: aldoria,
      known: true
    })
    expect(asked.text).toMatch(/^PENDING_APPROVAL/)
    const { pending } = (await call<Approvals>('pendientes')).data
    expect(pending[0]).toMatchObject({
      tool: 'marcar_conocimiento',
      details: { kind: 'page', name: 'Aldoria', known: true, campaign: 'La Marca', world: 'Valdren' }
    })
    await api(cookie, 'approve', { approvalId: pending[0]?.id })
    const known = (
      await call<{ campaigns: { name: string; audience: unknown }[] }>('quien_conoce', { pageId: aldoria })
    ).data
    expect(known.campaigns).toEqual([expect.objectContaining({ name: 'La Marca', audience: 'all' })])
    const asCampaign = (
      await call<{ markdown: string }>('ver_como_jugador', { campaignId: campaign.id, pageId: aldoria })
    ).data
    expect(asCampaign.markdown).toContain('Un reino.')
    expect(asCampaign.markdown).not.toContain('El rey ha muerto')
    const tree = (await call<{ pages: { title: string }[] }>('ver_arbol', { worldId: world.id })).data
    expect(tree.pages.map((p) => p.title)).toEqual(['Aldoria', 'Varn'])

    // Una jugadora de La Marca conecta su IA: ve lo que sabe su campaña, y no escribe
    const ana = await signUpTestUser(server.auth, { name: 'Ana', email: `ana-${Date.now()}@crisol.test` })
    const link = await api<{ url: string }>(cookie, 'getInvitation', { campaignId: campaign.id })
    await fetch(new URL('/api/join', BASE), {
      method: 'POST',
      headers: { cookie: ana.cookie, origin: BASE, 'content-type': 'application/json' },
      body: JSON.stringify({ secret: link.url.split('/unirse/')[1] })
    })
    const player = await connectAs(ana, cookie)
    // Los calendarios (módulo 8): la IA del máster crea el de Eana de una vez y lo describe; la de la jugadora los lee
    // sin las eras solo del máster, por ninguna herramienta, y no los cambia
    const fest = (name: string) => ({ name, days: 7, festival: true })
    const month = (name: string) => ({ name, days: 28 })
    const months = [
      fest('Alba Triste'),
      ...['Cierzo', 'Escarcha', 'Deshielo'].map(month),
      fest('Carnaval'),
      ...['Siembra', 'Florida', 'Pastos'].map(month),
      fest('Semana del Yunque'),
      ...['Siega', 'Trilla', 'Vendimia'].map(month),
      fest('Semana de las Hermanas'),
      ...['Hojarasca', 'Brumas', 'Nochelarga'].map(month)
    ]
    const definition = {
      yearSuffix: 'RC',
      weekdays: ['Herrero', 'Hacedor', 'Muerte', 'Frostelle', 'Flora', 'Eternidad', 'Melancolía'],
      months,
      seasons: [
        { name: 'Invierno', startDay: 1, endDay: 91 },
        { name: 'Primavera', startDay: 92, endDay: 182 },
        { name: 'Verano', startDay: 183, endDay: 273 },
        { name: 'Otoño', startDay: 274, endDay: 364 }
      ],
      moons: [
        { name: 'Melancolía', cycleDays: 28, offsetDays: -1.25 },
        { name: 'Eternidad', cycleDays: 91, offsetDays: 48.1875 }
      ],
      eras: [
        { name: 'Era de los Nuevos Reinos', start: '-980', end: '-1' },
        { name: 'Era del Eclipse', start: '1300-Siega-1', hidden: true },
        { name: 'Era de la República', abbreviation: 'ER', start: '0' }
      ]
    }
    // Con un problema, la IA lee cuál
    const wrong = await call('crear_calendario', {
      worldId: world.id,
      name: 'Eana',
      from: { definition: { ...definition, seasons: [{ name: 'Larga', startDay: 1, endDay: 400 }] } }
    })
    expect(wrong.text).toContain('BAD_CALENDAR')
    expect(wrong.text).toContain('«Larga» debe empezar y acabar entre el día 1 y el 364 del año')
    const madeCalendar = await call<{ id: string; primary: boolean }>('crear_calendario', {
      worldId: world.id,
      name: 'Eana',
      from: { definition }
    })
    expect(madeCalendar.isError, madeCalendar.text).toBeFalsy()
    expect(madeCalendar.data.primary).toBe(true)
    const described = await call<{ date: { text: string; season: string; era: { name: string } } }>('describir_fecha', {
      worldId: world.id,
      date: '1250-Siega-18'
    })
    expect(described.data.date).toMatchObject({
      text: 'Frostelle, 18 de Siega de 1250 RC',
      season: 'Verano',
      era: { name: 'Era de la República' }
    })
    const seen = await call<{ months: { name: string; number: number | null }[] }>('ver_calendario', {
      calendarId: madeCalendar.data.id
    })
    expect(seen.data.months.find((m) => m.name === 'Siega')?.number).toBe(7)
    const calendar = madeCalendar.data
    for (const [tool, args] of [
      ['listar_calendarios', { worldId: world.id }],
      ['ver_calendario', { calendarId: calendar.id }],
      ['describir_fecha', { calendarId: calendar.id, date: '1300-Siega-5' }]
    ] as const) {
      const result = await player.call(tool, args)
      expect(result.isError, result.text).toBeFalsy()
      expect(result.text).toContain('Era de la República')
      expect(result.text).not.toContain('Eclipse')
    }
    expect((await player.call('borrar_calendario', { calendarId: calendar.id })).isError).toBe(true)
    // Las fechas (módulo 8): la IA del máster fecha Aldoria con la forma 1250-Siega-18 y la lee legible; mal escrita,
    // dice por qué. Un campo «Oculto» de fecha no le llega a la de la jugadora
    await api(cookie, 'setPageProperties', {
      pageId: aldoria,
      properties: [{ name: 'Coronación', type: 'date', hidden: true, value: null }]
    })
    const dated = await call('editar_pagina', {
      pageId: aldoria,
      properties: [
        { name: 'Fundación', type: 'date', value: '1250-Siega-12/1250-Trilla-3' },
        { name: 'Coronación', type: 'date', value: '1302-Vendimia-5' }
      ]
    })
    expect(dated.isError, dated.text).toBeFalsy()
    const badly = await call('editar_pagina', {
      pageId: aldoria,
      properties: [{ name: 'Fundación', type: 'date', value: '1250-Nada-3' }]
    })
    expect(badly.text).toMatch(/^BAD_DATE.*Nada/)
    const masterDates = (await call<{ dates: { name: string; text: string }[] }>('leer_pagina', { pageId: aldoria }))
      .data.dates
    expect(masterDates).toEqual([
      expect.objectContaining({ name: 'Fundación', text: '12 de Siega – 3 de Trilla de 1250 RC' }),
      expect.objectContaining({ name: 'Coronación', text: '5 de Vendimia de 1302 RC' })
    ])
    // Las cronologías (módulo 8): la IA del máster pasa una de una vez con crear_eventos y la lee en orden con
    // ver_cronologia (las páginas con fecha salen solas); mal fechada, dice cuál. La de la jugadora solo ve la
    // revelada, sin lo oculto ni el campo oculto de fecha
    const events = await call('crear_eventos', {
      worldId: world.id,
      events: [
        { title: 'Boda de Aldren', date: '1250-Siega-18', group: 'La Corona' },
        { title: 'Campaña de los Pasos', date: '1250-Siega-20/1250-Trilla-3', group: 'Guerras' },
        { title: 'Feria de Vendimia', date: '413-Vendimia-1 (cada año)' },
        { title: 'Secreto del rey', date: '1251', hidden: true }
      ]
    })
    expect(events.isError, events.text).toBeFalsy()
    const misdated = await call('crear_eventos', {
      worldId: world.id,
      events: [
        { title: 'Bien', date: '1250' },
        { title: 'Mal', date: '1250-Nada-3' }
      ]
    })
    expect(misdated.text).toMatch(/^BAD_DATE.*n\.º 2/)
    const chronology = await call<{ id: string }>('crear_cronologia', { worldId: world.id, name: 'Historia' })
    expect(chronology.isError, chronology.text).toBeFalsy()
    const timeline = await call<{ entries: { title: string; form: string; field?: string }[] }>('ver_cronologia', {
      chronologyId: chronology.data.id
    })
    expect(timeline.data.entries.map((e) => [e.title, e.field ?? null, e.form])).toEqual([
      ['Feria de Vendimia', null, '413-Vendimia-1 (cada año)'],
      ['Aldoria', 'Fundación', '1250-Siega-12/1250-Trilla-3'],
      ['Boda de Aldren', null, '1250-Siega-18'],
      ['Campaña de los Pasos', null, '1250-Siega-20/1250-Trilla-3'],
      ['Secreto del rey', null, '1251'],
      ['Aldoria', 'Coronación', '1302-Vendimia-5']
    ])
    expect((await player.call('ver_cronologia', { chronologyId: chronology.data.id })).isError).toBe(true)
    await api(cookie, 'setKnowledge', {
      worldId: world.id,
      campaignId: campaign.id,
      kind: 'chronology',
      targetId: chronology.data.id,
      known: true
    })
    const theirs = await player.call<{ entries: { title: string }[] }>('ver_cronologia', {
      chronologyId: chronology.data.id
    })
    expect(theirs.data.entries.map((e) => e.title)).toEqual([
      'Feria de Vendimia',
      'Aldoria',
      'Boda de Aldren',
      'Campaña de los Pasos'
    ])
    for (const leak of ['Secreto', 'Coronación', '1302']) expect(theirs.text).not.toContain(leak)
    const listed = await player.call('listar_cronologias', { worldId: world.id })
    expect(listed.text).toContain('Historia')
    expect(
      (await player.call('crear_eventos', { worldId: world.id, events: [{ title: 'x', date: '1' }] })).isError
    ).toBe(true)
    const own = (await player.call<{ pages: { title: string }[] }>('ver_arbol', { worldId: world.id })).data
    expect(own.pages.map((p) => p.title)).toEqual(['Aldoria'])
    const readCall = await player.call<{ markdown: string; dates: { name: string }[] }>('leer_pagina', {
      pageId: aldoria
    })
    const read = readCall.data
    expect(read.dates.map((d) => d.name)).toEqual(['Fundación'])
    for (const leak of ['Coronación', 'Vendimia', '1302']) expect(readCall.text).not.toContain(leak)
    expect(read.markdown).toContain('Un reino.')
    expect(read.markdown).not.toContain('El rey ha muerto')
    expect((await player.call('leer_pagina', { pageId: varn })).isError).toBe(true)
    expect((await player.call('buscar_paginas', { worldId: world.id, query: 'rey' })).data).toMatchObject({
      results: []
    })
    const write = await player.call('editar_pagina', { pageId: aldoria, body: { mode: 'append', markdown: 'Mío' } })
    expect(write.text).toMatch(/^READ_ONLY/)
    expect((await player.call('quien_conoce', { pageId: aldoria })).isError).toBe(true)
    // Salvo el texto de una página que su campaña puede escribir (docs/specs/pagina-de-jugadores.md)
    const diary = await api<{ id: string }>(cookie, 'createPage', { worldId: world.id, title: 'Diario' })
    await api(cookie, 'setPageEditors', {
      worldId: world.id,
      campaignId: campaign.id,
      pageId: diary.id,
      editors: 'all'
    })
    const written = await player.call('editar_pagina', {
      pageId: diary.id,
      body: { mode: 'append', markdown: 'Día 1.' }
    })
    expect(written.isError, written.text).toBeFalsy()
    const titled = await player.call('editar_pagina', { pageId: diary.id, title: 'Otro' })
    expect(titled.text).toMatch(/^PLAYER_PAGE/)
    // En modo asistente, su petición espera a que ella la apruebe
    await api(ana.cookie, 'setAiMode', { mode: 'assistant' })
    const awaiting = await player.call('editar_pagina', {
      pageId: diary.id,
      body: { mode: 'append', markdown: 'Día 2.' }
    })
    expect(awaiting.text).toMatch(/^PENDING_APPROVAL/)

    // Revelar en partida (con aviso): también espera aprobación; lo_que_sabe lo lista
    const reveal = await call('revelar', { worldId: world.id, kind: 'page', targetId: varn })
    expect(reveal.text).toMatch(/^PENDING_APPROVAL/)
    const waiting = (await call<Approvals>('pendientes')).data.pending
    expect(waiting[0]).toMatchObject({ tool: 'revelar', details: { kind: 'page', name: 'Varn', known: true } })
    await api(cookie, 'approve', { approvalId: waiting[0]?.id })
    // (la cronología revelada arriba, también)
    const group = (await call<{ campaign: { name: string }[] }>('lo_que_sabe', { campaignId: campaign.id })).data
    expect(group.campaign.map((k) => k.name)).toEqual(['Varn', 'Diario', 'Historia', 'Aldoria'])
    expect((await player.call('leer_pagina', { pageId: varn })).isError).toBeFalsy()
    expect((await player.call('revelar', { worldId: world.id, kind: 'page', targetId: aldoria })).text).toMatch(
      /^READ_ONLY/
    )
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
