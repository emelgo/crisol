import type { Campaign, World } from '@crisol/contracts'
import { connect } from '@crisol/db'
import { freshTestDatabase } from '@crisol/db/testing'
import { exampleFile } from '@crisol/systems/examples'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startServer } from '../server.ts'
import { signUpTestUser, TEST_AUTH_SECRET, testDataDir } from '../testing.ts'
import { CAMPAIGN_MASTER_TOOLS, CAMPAIGN_PLAYER_TOOLS } from './connectors.ts'
import { mcpTestHelpers } from './test-client.ts'

// Puerto fijo: el recurso y el emisor de los tokens salen de PUBLIC_URL, que tiene que ser la dirección real
const PORT = 8134
const BASE = `http://127.0.0.1:${PORT}`

/** Los conectores de IA (ADR-0030): Mundos en /mcp y uno por campaña, con su propio token y sus herramientas */
describe('el conector de una campaña', () => {
  let server: Awaited<ReturnType<typeof startServer>>
  let conn: ReturnType<typeof connect>

  beforeAll(async () => {
    const url = await freshTestDatabase('crisol_test_mcp_campanas')
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

  const at = (path: string) => `${BASE}${path}`
  const rpc = (path: string, token: string | null, method: string, params: object = {}) =>
    fetch(new URL(path, BASE), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2025-06-18',
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    })

  /** Una jugadora que entra en una campaña con su enlace */
  const join = async (masterCookie: string, campaignId: string, person: { cookie: string }) => {
    const link = await api<{ url: string }>(masterCookie, 'getInvitation', { campaignId })
    const joined = await fetch(new URL('/api/join', BASE), {
      method: 'POST',
      headers: { cookie: person.cookie, origin: BASE, 'content-type': 'application/json' },
      body: JSON.stringify({ secret: link.url.split('/unirse/')[1] })
    })
    expect(joined.ok).toBe(true)
  }

  it('Better Auth emite y acepta un token cuyo recurso es la dirección de la campaña, y solo vale ahí', async () => {
    const { cookie, call } = await connected()
    const world = (await call<World>('crear_mundo', { name: 'Eana' })).data
    const campaign = (await call<Campaign>('crear_campana', { worldId: world.id, name: 'La Marca' })).data
    const path = `/mcp/campanas/${campaign.id}`

    // Sin token: 401 con sus metadatos, que dicen su dirección y el mismo servidor de autorización
    const bare = await rpc(path, null, 'tools/list')
    expect(bare.status).toBe(401)
    expect(bare.headers.get('www-authenticate')).toContain(
      `resource_metadata="${at(`/.well-known/oauth-protected-resource${path}`)}"`
    )
    const metadata = await (await fetch(at(`/.well-known/oauth-protected-resource${path}`))).json()
    expect(metadata).toMatchObject({
      resource: at(path),
      resource_name: 'Crisol · La Marca',
      authorization_servers: [`${BASE}/api/auth`]
    })
    expect((await fetch(at(`/.well-known/oauth-protected-resource/mcp/campanas/${crypto.randomUUID()}`))).status).toBe(
      404
    )

    // El token de la campaña lleva su dirección como audiencia: vale en ella y no en Mundos
    const client = await oauthClient(cookie)
    const token = await accessToken(cookie, client, at(path))
    expect(JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()).aud).toContain(at(path))
    expect((await rpc(path, token, 'tools/list')).status).toBe(200)
    expect((await rpc('/mcp', token, 'tools/list')).status).toBe(401)
    // Ni el de Mundos en la campaña, ni el de una campaña en otra
    const worlds = await accessToken(cookie, client, at('/mcp'))
    expect((await rpc(path, worlds, 'tools/list')).status).toBe(401)
    const other = (await call<Campaign>('crear_campana', { worldId: world.id, name: 'Los Cuervos' })).data
    expect((await rpc(`/mcp/campanas/${other.id}`, token, 'tools/list')).status).toBe(401)
    // Una dirección que no es la de una campaña no existe
    expect((await rpc('/mcp/campanas/nada', token, 'tools/list')).status).toBe(404)
  })

  it('quien no está en la campaña no conecta su IA a ella', async () => {
    const { cookie, call } = await connected()
    const world = (await call<World>('crear_mundo', { name: 'Eana' })).data
    const campaign = (await call<Campaign>('crear_campana', { worldId: world.id, name: 'La Marca' })).data
    const other = await account('owner')
    await expect(
      accessToken(other.cookie, await oauthClient(cookie), at(`/mcp/campanas/${campaign.id}`))
    ).rejects.toThrow('Permiso rechazado: 403')
  })

  it('una jugadora en dos campañas del mismo mundo: cada dirección ve solo la suya, con las herramientas de su papel', async () => {
    const master = await connected()
    const { cookie } = master
    const five = (await api<{ system: { id: string } }>(cookie, 'importSystem', { file: exampleFile('5e') })).system.id
    const world = (await master.call<World>('crear_mundo', { name: 'Valdren' })).data
    const marca = await api<Campaign>(cookie, 'createCampaign', { worldId: world.id, name: 'La Marca', system: five })
    const cuervos = await api<Campaign>(cookie, 'createCampaign', {
      worldId: world.id,
      name: 'Los Cuervos',
      system: five
    })
    const created = await api<{ pages: { id: string; title: string }[] }>(cookie, 'createPages', {
      worldId: world.id,
      parentId: null,
      pages: [
        { key: 'a', title: 'Aldoria', markdown: 'Un reino.' },
        { key: 'v', title: 'Varn', markdown: 'Una ciudad.' }
      ]
    })
    const page = (title: string) => created.pages.find((p) => p.title === title)?.id ?? ''
    // La Marca conoce Aldoria; Los Cuervos, Varn
    for (const [campaign, title] of [
      [marca, 'Aldoria'],
      [cuervos, 'Varn']
    ] as const)
      await api(cookie, 'setKnowledge', {
        worldId: world.id,
        campaignId: campaign.id,
        kind: 'page',
        targetId: page(title),
        known: true
      })

    const ana = await signUpTestUser(server.auth, { name: 'Ana', email: `ana-${Date.now()}@crisol.test` })
    await join(cookie, marca.id, ana)
    await join(cookie, cuervos.id, ana)
    const inCuervos = await api<{ character: { id: string } }>(ana.cookie, 'createCharacter', {
      campaignId: cuervos.id,
      name: 'Corvina'
    })

    const player = await connectAs(ana, cookie, `/mcp/campanas/${marca.id}`)
    // Sus herramientas, las de jugadora; ninguna pide la campaña ni el mundo
    const tools = await player.tools()
    expect(tools.map((t) => t.name).sort()).toEqual([...CAMPAIGN_PLAYER_TOOLS].sort())
    for (const tool of tools) {
      expect(Object.keys(tool.inputSchema.properties ?? {}), tool.name).not.toContain('campaignId')
      expect(Object.keys(tool.inputSchema.properties ?? {}), tool.name).not.toContain('worldId')
    }
    // Lo que sabe La Marca, aunque Ana también juegue en Los Cuervos (sin decir la campaña)
    const tree = await player.call<{ pages: { title: string }[] }>('ver_arbol', {})
    expect(tree.data.pages.map((p) => p.title)).toEqual(['Aldoria'])
    expect((await player.call('leer_pagina', { pageId: page('Varn') })).text).toMatch(/^NOT_FOUND/)
    expect((await player.call('ver_personaje', { characterId: inCuervos.character.id })).text).toMatch(/^NOT_FOUND/)
    expect((await player.call<{ characters: unknown[] }>('listar_personajes', {})).data.characters).toEqual([])

    // Crea su personaje en La Marca, tira por él y en el registro, y escribe sus notas
    const made = await player.call<{ character: { id: string; name: string } }>('crear_personaje', { name: 'Brisa' })
    expect(made.isError, made.text).toBeFalsy()
    expect(made.data.character.name).toBe('Brisa')
    const mine = await player.call<{ characters: { name: string }[] }>('listar_personajes', {})
    expect(mine.data.characters.map((c) => c.name)).toEqual(['Brisa'])
    const rolled = await player.call<{ roll: { visibility: string; campaignId: string } }>('tirar_dados', {
      formula: '1d20+2'
    })
    expect(rolled.isError, rolled.text).toBeFalsy()
    expect(rolled.data.roll).toMatchObject({ visibility: 'all', campaignId: marca.id })
    expect((await player.call('escribir_en_registro', { text: 'Brisa entra en la taberna' })).isError).toBeFalsy()
    const note = await player.call('escribir_nota', { title: 'Pistas', markdown: 'El tabernero miente.' })
    expect(note.isError, note.text).toBeFalsy()
    // Lo del máster no está: revelar no es una de sus herramientas
    await expect(player.client.callTool({ name: 'revelar', arguments: {} })).rejects.toThrow(/revelar/)

    // Sus instrucciones: la campaña, el mundo, el sistema, su papel y su personaje
    const instructions = player.client.getInstructions() ?? ''
    expect(instructions).toContain('«La Marca» del mundo «Valdren»')
    expect(instructions).toContain('juega en ella')
    expect(player.client.getServerVersion()).toMatchObject({ title: 'Crisol · La Marca' })

    // El máster en la misma campaña: las suyas, también sin campaña ni mundo, y lo que hizo Ana es de La Marca
    const gm = await connectAs(master, cookie, `/mcp/campanas/${marca.id}`)
    expect((await gm.tools()).map((t) => t.name).sort()).toEqual([...CAMPAIGN_MASTER_TOOLS].sort())
    const log = await gm.call<{ messages: { text: string }[] }>('ver_registro', {})
    expect(log.text).toContain('Brisa entra en la taberna')
    expect(
      (await gm.call<{ characters: { name: string }[] }>('listar_personajes', {})).data.characters.map((c) => c.name)
    ).toEqual(['Brisa'])
    expect(gm.client.getInstructions()).toContain('Quien te conecta es su máster. Sus personajes: Brisa (Ana).')
    // Importa el 5e y hace muchas llamadas: con la máquina cargada pasa de los 20 s
  }, 60_000)

  it('tus conexiones: cada conector con su app y su último uso; quitar una la deja sin acceso al momento', async () => {
    const master = await connected()
    const world = (await master.call<World>('crear_mundo', { name: 'Eana' })).data
    const campaign = (await master.call<Campaign>('crear_campana', { worldId: world.id, name: 'La Marca' })).data
    const path = `/mcp/campanas/${campaign.id}`
    const gm = await connectAs(master, master.cookie, path)
    expect((await gm.call('fecha_de_hoy')).isError).toBeFalsy()

    type Listed = { connections: Array<{ clientId: string; clientName: string; url: string; connector: object }> }
    const { connections } = await api<Listed>(master.cookie, 'listAiConnections', {})
    expect(connections).toHaveLength(2)
    expect(connections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ clientName: 'Pruebas', url: at('/mcp'), connector: { kind: 'worlds' } }),
        expect.objectContaining({
          url: at(path),
          connector: { kind: 'campaign', campaignId: campaign.id, campaign: { name: 'La Marca', worldId: world.id } }
        })
      ])
    )
    const theCampaign = connections.find((c) => c.url === at(path))
    // La de la campaña es la que se usó la última
    expect(connections[0]?.url).toBe(at(path))

    const left = await api<Listed>(master.cookie, 'removeAiConnection', {
      clientId: theCampaign?.clientId,
      url: at(path)
    })
    expect(left.connections.map((c) => c.url)).toEqual([at('/mcp')])
    // Su token de acceso deja de valer al momento (vuelve a pedir permiso); Mundos sigue
    const after = await rpc(path, gm.token, 'tools/list')
    expect(after.status).toBe(401)
    expect(after.headers.get('www-authenticate')).toContain('invalid_token')
    expect((await master.call('listar_mundos')).isError).toBeFalsy()
    // Otra cuenta no ve ni quita las de nadie
    const other = await account('owner')
    expect(await api<Listed>(other.cookie, 'listAiConnections', {})).toEqual({ connections: [] })
  })

  it('Mundos sigue igual para quien crea mundos; quien solo juega ve las de leer', async () => {
    const master = await connected()
    const world = (await master.call<World>('crear_mundo', { name: 'Eana' })).data
    const campaign = (await master.call<Campaign>('crear_campana', { worldId: world.id, name: 'La Marca' })).data
    const all = (await master.tools()).map((t) => t.name)
    expect(all).toContain('crear_paginas')
    expect(all).toContain('revelar')
    expect(master.client.getServerVersion()).toMatchObject({ name: 'crisol', title: 'Crisol · Mundos' })

    const ana = await signUpTestUser(server.auth, { name: 'Ana M', email: `ana-m-${Date.now()}@crisol.test` })
    await join(master.cookie, campaign.id, ana)
    const reader = await connectAs(ana, master.cookie)
    const names = (await reader.tools()).map((t) => t.name)
    expect(names).toContain('leer_pagina')
    expect(names).toContain('ver_arbol')
    for (const write of ['crear_paginas', 'revelar', 'crear_personaje', 'tirar_dados', 'escribir_nota'])
      expect(names).not.toContain(write)
    expect(names.length).toBeLessThan(all.length)
  })
})
