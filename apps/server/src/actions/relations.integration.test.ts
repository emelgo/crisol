/**
 * Las relaciones del mundo (módulo 10, capacidad `relaciones`): las de una página en sus tres modos (enlaces, familia y
 * organigrama), el grafo del mundo con sus filtros, lo que ve una jugadora (ADR-0017) y lo que tarda con 5.000 páginas
 * y 20.000 aristas (aparte, con CRISOL_RENDIMIENTO)
 */
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { keyBetween } from '@crisol/domain'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import { createTestAuth, seedExampleTemplates, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

type Edge = { source: string; target: string; kind?: string; key: string; name?: string; role?: string; secret?: true }
type Node = { id: string; title: string; generation?: number }

describe('las relaciones del mundo (módulo 10)', () => {
  let conn: ReturnType<typeof connect>
  let auth: ReturnType<typeof createTestAuth>
  let app: ReturnType<typeof buildApp>
  let master: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let worldId: string
  let marca: string
  const id: Record<string, string> = {}

  const call = (name: string, payload: object, cookie = master.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const join = async (campaignId: string, who: { cookie: string }) => {
    const url = (await ok200('getInvitation', { campaignId })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: who.cookie }
    })
  }
  const known = (targetId: string) =>
    ok200('setKnowledge', { worldId, campaignId: marca, kind: 'page', targetId, known: true })
  /** Las aristas como «Origen > Destino (nombre)», para leerlas (las del grafo del mundo, con el nombre en relations) */
  const read = (result: { nodes: Node[]; edges: Edge[]; relations?: { key: string; name: string }[] }) => {
    const title = new Map(result.nodes.map((n) => [n.id, n.title]))
    const name = (e: Edge) =>
      e.key === 'mention' ? 'menciona' : (e.name ?? result.relations?.find((r) => r.key === e.key)?.name)
    return result.edges.map((e) => `${title.get(e.source)} > ${title.get(e.target)} (${name(e)})`)
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_relations'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY }
    })
    master = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Mesa' }).returning()
    if (!org) throw new Error('sin organización')
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org.id, userId: master.userId, role: 'owner' })
    worldId = (await ok200('createWorld', { name: 'Valdren' })).id
    await seedExampleTemplates(call)
    marca = (await ok200('createCampaign', { worldId, name: 'La Marca' })).id
    ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    await join(marca, ana)
    const yaml = (lines: string[]) => `---\n${lines.join('\n')}\n---\n`
    const created = await ok200('createPages', {
      worldId,
      parentId: null,
      pages: [
        { key: 'liga', title: 'La Liga', template: 'faccion', markdown: yaml(['Líder: "[[Varn]]"']) },
        { key: 'aldoria', title: 'Aldoria', template: 'lugar' },
        {
          key: 'ilsa',
          title: 'Ilsa',
          template: 'pnj',
          markdown: [
            yaml([
              'Facción: "[[La Liga]]"',
              'Lugar: "[[Aldoria]]"',
              'Padres:',
              '  - "[[Oren]]"',
              '  - "[[Mara]]"',
              'Pareja:',
              '  - "[[Bruno]]"'
            ]),
            // La Liga ya está en un campo: no repite «menciona»
            'Espía de [[La Liga]] en [[El puerto]].',
            '',
            '> [!secreto]',
            '> Trabaja para [[Topo]].',
            '',
            '%%Su contacto es [[Nadia]]%%'
          ].join('\n')
        },
        { key: 'varn', title: 'Varn', template: 'pnj', markdown: yaml(['Facción: "[[La Liga]]"']) },
        { key: 'topo', title: 'Topo', template: 'pnj', markdown: yaml(['Facción: "[[La Liga]]"']) },
        { key: 'oren', title: 'Oren', template: 'pnj', markdown: yaml(['Pareja:', '  - "[[Mara]]"']) },
        { key: 'mara', title: 'Mara', template: 'pnj' },
        { key: 'bruno', title: 'Bruno', template: 'pnj' },
        { key: 'hija', title: 'Lena', template: 'pnj', markdown: yaml(['Padres:', '  - "[[Ilsa]]"']) },
        { key: 'puerto', title: 'El puerto' },
        { key: 'nadia', title: 'Nadia' },
        { key: 'suelta', title: 'Suelta', markdown: yaml(['etiquetas:', '  - lugar/isla']) }
      ]
    })
    for (const page of created.pages as { key: string; id: string }[]) id[page.key] = page.id
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('un PNJ con Facción y Padres: tiene los tres modos; Enlaces, su vecindario sin repetir «menciona»', async () => {
    const links = await ok200('getRelations', { pageId: id.ilsa })
    expect(links.modes).toEqual(['links', 'family', 'org'])
    expect(links.mode).toBe('links')
    expect(read(links).sort()).toEqual(
      [
        'Ilsa > La Liga (Facción)',
        'Ilsa > Aldoria (Lugar)',
        'Ilsa > Oren (Padres)',
        'Ilsa > Mara (Padres)',
        'Ilsa > Bruno (Pareja)',
        'Ilsa > El puerto (menciona)',
        'Ilsa > Topo (menciona)',
        'Ilsa > Nadia (menciona)',
        'Lena > Ilsa (Padres)',
        // Y lo que hay entre las que salen
        'Oren > Mara (Pareja)',
        'Topo > La Liga (Facción)'
      ].sort()
    )
    // Lo de un secreto y lo de una nota oculta, marcados para el máster
    const secret = (links.edges as Edge[]).filter((e) => e.secret).map((e) => e.target)
    expect(secret.sort()).toEqual([id.topo, id.nadia].sort())
    const faccion = (links.edges as Edge[]).find((e) => e.target === id.liga)
    expect(faccion).toMatchObject({ kind: 'field', role: 'member-of', inverseName: 'Miembros' })
    // Solo campos
    const fields = await ok200('getRelations', { pageId: id.ilsa, fieldsOnly: true })
    expect((fields.edges as Edge[]).every((e) => e.kind === 'field')).toBe(true)
    // Dos saltos: también Varn y Topo por la Liga
    const two = await ok200('getRelations', { pageId: id.ilsa, depth: 2 })
    expect((two.nodes as Node[]).map((n) => n.title)).toContain('Varn')
  })

  it('Familia: padres arriba, hija abajo y la pareja a su lado', async () => {
    const family = await ok200('getRelations', { pageId: id.ilsa, mode: 'family' })
    const generation = Object.fromEntries((family.nodes as Node[]).map((n) => [n.title, n.generation]))
    expect(generation).toEqual({ Ilsa: 0, Oren: -1, Mara: -1, Lena: 1, Bruno: 0 })
    expect(read(family)).toContain('Oren > Mara (Pareja)')
  })

  it('Organigrama: desde un miembro salta a su grupo, con el líder y los miembros', async () => {
    const org = await ok200('getRelations', { pageId: id.ilsa, mode: 'org' })
    expect(org.groups).toEqual([id.liga])
    expect(read(org).sort()).toEqual(
      [
        'La Liga > Varn (Líder)',
        'Ilsa > La Liga (Facción)',
        'Varn > La Liga (Facción)',
        'Topo > La Liga (Facción)'
      ].sort()
    )
    const leader = (org.edges as Edge[]).find((e) => e.target === id.varn)
    expect(leader?.role).toBe('leads')
    // Una página sin esos papeles no tiene organigrama: solo ella
    const puerto = await ok200('getRelations', { pageId: id.puerto, mode: 'org' })
    expect(puerto.modes).toEqual(['links'])
    expect(puerto.nodes).toHaveLength(1)
    expect(puerto.edges).toEqual([])
  })

  it('el grafo del mundo: sin páginas sueltas salvo que se pidan, y con filtros', async () => {
    const all = await ok200('getWorldGraph', { worldId })
    const titles = (graph: { nodes: Node[] }) => graph.nodes.map((n) => n.title).sort()
    expect(titles(all)).not.toContain('Suelta')
    expect(titles(await ok200('getWorldGraph', { worldId, orphans: true }))).toContain('Suelta')
    const mention = (all.relations as { key: string; count: number }[]).find((r) => r.key === 'mention')
    expect(mention?.count).toBe(3)
    // Por plantilla (su nombre), por relación y por etiqueta
    const pnjs = await ok200('getWorldGraph', { worldId, templates: ['PNJ'], relations: ['mention'] })
    expect(read(pnjs)).toEqual(['Ilsa > Topo (menciona)'])
    const padres = (all.relations as { key: string; name: string }[]).find((r) => r.name === 'Padres')
    const family = await ok200('getWorldGraph', { worldId, relations: [padres?.key] })
    expect(titles(family)).toEqual(['Ilsa', 'Lena', 'Mara', 'Oren'])
    const tagged = await ok200('getWorldGraph', { worldId, tags: ['LUGAR'], orphans: true })
    expect(titles(tagged)).toEqual(['Suelta'])
    const missing = await call('getWorldGraph', { worldId, templates: ['Dragón'] })
    expect(missing.json().code).toBe('TEMPLATE_NOT_FOUND')
  })

  it('la jugadora: solo lo que ve; ni secretos, ni notas, ni campos ocultos, ni destinos que no ve', async () => {
    for (const key of ['ilsa', 'liga', 'aldoria', 'oren', 'puerto', 'topo', 'nadia']) await known(id[key] ?? '')
    // El campo Pareja, oculto
    const ilsa = await ok200('getPage', { pageId: id.ilsa })
    await ok200('setPageProperties', {
      pageId: id.ilsa,
      properties: ilsa.properties.map((p: { name: string }) => (p.name === 'Lugar' ? { ...p, hidden: true } : p))
    })
    const seen = await ok200('getRelations', { pageId: id.ilsa }, ana.cookie)
    expect(read(seen).sort()).toEqual(
      ['Ilsa > La Liga (Facción)', 'Ilsa > Oren (Padres)', 'Ilsa > El puerto (menciona)'].sort()
    )
    expect(JSON.stringify(seen)).not.toContain(id.mara)
    expect(seen.modes).toEqual(['links', 'family', 'org'])
    // El máster leyendo como la campaña ve lo mismo
    const asCampaign = await ok200('getRelations', { pageId: id.ilsa, campaignId: marca, asCharacterId: 'campaign' })
    expect(read(asCampaign).sort()).toEqual(read(seen).sort())
    // Una página que no ve: como si no existiera
    expect((await call('getRelations', { pageId: id.mara }, ana.cookie)).statusCode).toBe(404)
    const graph = await ok200('getWorldGraph', { worldId, orphans: true }, ana.cookie)
    const text = JSON.stringify(graph)
    for (const hidden of ['mara', 'bruno', 'varn', 'hija', 'suelta']) expect(text).not.toContain(id[hidden])
    expect((graph.edges as Edge[]).some((e) => e.secret)).toBe(false)
  })
})

// Se mide sola (CRISOL_RENDIMIENTO=1, su paso en la CI y `pnpm --filter @crisol/server test:rendimiento`): con las
// demás pruebas a la vez, lo que se mide es la carga de la máquina
describe.skipIf(!process.env.CRISOL_RENDIMIENTO)('rendimiento de las relaciones (módulo 10)', () => {
  let conn: ReturnType<typeof connect>
  let app: ReturnType<typeof buildApp>
  let master: { userId: string; cookie: string }
  let worldId: string

  const call = (name: string, payload: object) =>
    app.inject({
      method: 'POST',
      url: `/api/actions/${name}`,
      payload,
      headers: { origin: BASE_URL, cookie: master.cookie }
    })
  const ok200 = async (name: string, payload: object) => {
    const response = await call(name, payload)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_relations_scale'), { max: 4 })
    await resetDatabase(conn.sql)
    const auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY }
    })
    master = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Mesa' }).returning()
    if (!org) throw new Error('sin organización')
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org.id, userId: master.userId, role: 'owner' })
    worldId = (await ok200('createWorld', { name: 'Valdren' })).id
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('5.000 páginas y 20.000 aristas responden en menos de 300 ms', async () => {
    const pnj = crypto.randomUUID()
    let position: string | null = null
    const ids = Array.from({ length: 5000 }, () => crypto.randomUUID())
    const pages = ids.map((pageId, i) => {
      position = keyBetween(position, null)
      const near = (step: number) => ids[(i + step) % ids.length] as string
      return {
        id: pageId,
        worldId,
        position,
        title: `Página ${i}`,
        template: pnj,
        templateLine: [pnj],
        properties: [
          { name: 'Facción', field: 'faccion', type: 'pages', value: [near(1)], role: 'member-of' },
          { name: 'Padres', field: 'padres', type: 'pages', value: [near(2)], role: 'parent' },
          { name: 'etiquetas', type: 'list', value: ['pnj'] }
        ]
      }
    })
    for (let i = 0; i < pages.length; i += 1000) await conn.db.insert(schema.pages).values(pages.slice(i, i + 1000))
    // Un cuerpo por página con dos enlaces: 10.000 aristas de campos y 10.000 «menciona»
    const bodies = await conn.db
      .insert(schema.documents)
      .values(ids.map((pageId) => ({ worldId, pageId, kind: 'body' as const, state: new Uint8Array() })))
      .returning({ id: schema.documents.id, pageId: schema.documents.pageId })
    const links = bodies.flatMap((doc, i) =>
      [4, 5].map((step) => ({
        worldId,
        sourcePageId: doc.pageId,
        sourceDocumentId: doc.id,
        targetPageId: ids[(i + step) % ids.length] as string,
        targetTitle: 'x',
        targetKey: 'x'
      }))
    )
    for (let i = 0; i < links.length; i += 2000) await conn.db.insert(schema.pageLinks).values(links.slice(i, i + 2000))
    // Con las estadísticas al día, como en producción. La primera calienta; se mide la mediana de tres (el VPS de
    // pruebas es compartido: un pico suelto no dice nada del cálculo)
    await conn.sql`analyze`
    const median = async (name: string, payload: object) => {
      await ok200(name, payload)
      const times: number[] = []
      let body: unknown
      for (let i = 0; i < 3; i++) {
        const started = performance.now()
        const response = await call(name, payload)
        times.push(performance.now() - started)
        expect(response.statusCode).toBe(200)
        body = response.json()
      }
      return { took: times.sort((a, b) => a - b)[1] ?? 0, body: body as { edges: unknown[] } }
    }
    const world = await median('getWorldGraph', { worldId })
    expect(world.body.edges).toHaveLength(20_000)
    const relations = await median('getRelations', { pageId: ids[0], depth: 3 })
    process.stdout.write(
      `relaciones: 5.000 páginas y 20.000 aristas, grafo ${Math.round(world.took)} ms, página ${Math.round(relations.took)} ms\n`
    )
    expect(world.took).toBeLessThan(300)
    expect(relations.took).toBeLessThan(300)
  }, 120_000)
})
