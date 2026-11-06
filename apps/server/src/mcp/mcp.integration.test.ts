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
import { TEST_AUTH_SECRET, testDataDir } from '../testing.ts'
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

  const { account, oauthClient, accessToken, connected, api, closeClients } = mcpTestHelpers(
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
      ['ver_plantilla', { templateId: 'pnj' }, 'read'],
      ['crear_plantilla', { name: 'PNJ de Eana', copyOf: 'pnj' }, 'write'],
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

  it('la IA tira: en una campaña, oculta por defecto y marcada como de la IA; sin campaña, solo el resultado', async () => {
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
    const { call } = await connected()
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
    expect(read.data.page.template).toBe('pnj')
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
