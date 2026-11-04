import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined

type Result = { id: string; title: string; sections: { heading: string | null; secret: boolean; excerpt: string }[] }

describe('buscar en la wiki, en español', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }
  let organizationId: string
  let worldId: string
  let ids: Record<string, string>

  const call = async (name: string, payload: object, cookie = owner.cookie) =>
    (
      await app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
    ).json()
  const search = async (query: string, extra: object = {}) =>
    (await call('searchWiki', { worldId, query, ...extra })) as { total: number; results: Result[] }
  const titles = async (query: string, extra: object = {}) => (await search(query, extra)).results.map((r) => r.title)

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_search'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY }
    })
    owner = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Fateforge' }).returning()
    organizationId = org?.id ?? ''
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: owner.userId, role: 'owner' })
    worldId = (await call('createWorld', { name: 'Eana' })).id
    const created = await call('createPages', {
      worldId,
      parentId: null,
      pages: [
        { key: 'bestias', title: 'Bestiario', markdown: 'Las criaturas de Eana.' },
        {
          key: 'dragon',
          parent: 'bestias',
          title: 'Dragón rojo',
          markdown: '---\netiquetas:\n  - criatura/dragon\n---\nEl más temido.'
        },
        {
          key: 'montana',
          title: 'La Montaña Gris',
          markdown:
            'Un pico al norte.\n\n## Guaridas\n\nLos dragones viven en sus cuevas.\n\n> [!secreto]\n> El dragón de la cima duerme desde hace un siglo.'
        },
        { key: 'puerto', title: 'Puerto Ceniza', markdown: 'La última ciudad libre.' }
      ]
    })
    ids = Object.fromEntries(
      (created.pages as { key: string; id: string }[]).map((page, i) => [
        ['bestias', 'dragon', 'montana', 'puerto'][i] ?? page.key,
        page.id
      ])
    )
  })

  afterEach(async () => {
    await app.close()
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('sin tildes, por la raíz y con erratas: «dragon», «dragones» y «dargón» encuentran «Dragón»', async () => {
    for (const query of ['dragon', 'DRAGONES', 'dargón', 'dragón']) {
      expect(await titles(query), query).toEqual(expect.arrayContaining(['Dragón rojo', 'La Montaña Gris']))
    }
    // Mientras se escribe: por el principio
    expect(await titles('drag')).toEqual(expect.arrayContaining(['Dragón rojo']))
    expect(await titles('ciudad libre')).toEqual(['Puerto Ceniza'])
    expect(await titles('nada parecido')).toEqual([])
  })

  it('agrupa por página, con las secciones y su extracto; lo de un secreto, marcado', async () => {
    const { results } = await search('dragones')
    const mountain = results.find((r) => r.title === 'La Montaña Gris')
    expect(mountain?.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          heading: 'Guaridas',
          secret: false,
          excerpt: expect.stringContaining('**dragones**')
        }),
        // Lo de un secreto, con el título de la sección del cuerpo donde está
        expect.objectContaining({
          heading: 'Guaridas',
          secret: true,
          excerpt: expect.stringContaining('**dragón**')
        })
      ])
    )
    // El título cuenta más que el texto
    expect(results[0]?.title).toBe('Dragón rojo')
  })

  it('por etiqueta (con sus hijas) y por rama', async () => {
    expect(await titles('dragon', { tag: 'criatura' })).toEqual(['Dragón rojo'])
    expect(await titles('dragon', { tag: 'criatura/dragon' })).toEqual(['Dragón rojo'])
    expect(await titles('dragon', { tag: 'lugar' })).toEqual([])
    expect(await titles('criaturas dragon', { branchId: ids.bestias })).toEqual([])
    expect(await titles('dragon', { branchId: ids.bestias })).toEqual(['Dragón rojo'])
  })

  it('lo de la papelera no sale; lo cambiado se busca al momento', async () => {
    await call('deletePage', { pageId: ids.dragon })
    expect(await titles('dragon')).toEqual(['La Montaña Gris'])
    await call('editPage', { pageId: ids.puerto, body: { mode: 'append', markdown: 'Un dragón la quemó.' } })
    expect(await titles('dragon')).toEqual(expect.arrayContaining(['Puerto Ceniza']))
    await call('updatePage', { pageId: ids.puerto, title: 'Puerto Quemado' })
    expect(await titles('quemado')).toEqual(['Puerto Quemado'])
  })

  it('lo que había antes de la búsqueda se indexa al buscar', async () => {
    await conn.sql`delete from search_sections`
    expect(await titles('cuevas')).toEqual(['La Montaña Gris'])
  })

  it('paginada, de 20 en 20, con el total', async () => {
    await call('createPages', {
      worldId,
      parentId: null,
      pages: Array.from({ length: 25 }, (_, i) => ({ key: `n${i}`, title: `Nota ${i}`, markdown: 'Sobre el faro.' }))
    })
    const first = await search('faro')
    expect(first).toMatchObject({ total: 25, page: 1, pageSize: 20 })
    expect(first.results).toHaveLength(20)
    expect((await search('faro', { page: 2 })).results).toHaveLength(5)
  })

  it('quien no ve la wiki no busca en ella', async () => {
    const outsider = await signUpTestUser(auth, { name: 'Otro', email: 'otro@crisol.test' })
    expect(await call('searchWiki', { worldId, query: 'dragon' }, outsider.cookie)).toMatchObject({ code: 'NOT_FOUND' })
  })

  it('rendimiento: con 5.000 páginas, el 95 % de las búsquedas tarda menos de 300 ms', async () => {
    // Páginas, documentos y secciones sintéticos, de golpe
    const words = ['faro', 'puerto', 'dragón', 'montaña', 'ciudad', 'guerra', 'elfos', 'barco', 'cueva', 'reina']
    await conn.sql`
      with p as (
        insert into pages (world_id, position, title, properties)
        select ${worldId}, lpad(i::text, 6, '0'), 'Página ' || i || ' de ' || (${conn.sql.array(words)}::text[])[1 + i % 10], '[]'::jsonb
        from generate_series(1, 5000) i returning id, title
      ), d as (
        insert into documents (world_id, page_id, kind, state, text)
        select ${worldId}, p.id, 'body', '\\x'::bytea, '' from p returning id, page_id
      )
      insert into search_sections (world_id, page_id, document_id, kind, position, heading, body)
      select ${worldId}, d.page_id, d.id, 'body', s, 'Sección ' || s,
        repeat((${conn.sql.array(words)}::text[])[1 + (s * 7 + length(d.id::text)) % 10] || ' en la costa del norte ', 20)
      from d, generate_series(0, 2) s`
    // Como haría el autovacuum con tablas de este tamaño
    await conn.sql`analyze`
    const queries = ['faro', 'dargon', 'montana norte', 'cueva', 'reina guerra', 'elfos', 'barco', 'puerto costa']
    const times: number[] = []
    for (let round = 0; round < 3; round++) {
      for (const query of queries) {
        const start = performance.now()
        await search(query)
        times.push(performance.now() - start)
      }
    }
    times.sort((a, b) => a - b)
    const p95 = times[Math.floor(times.length * 0.95)] ?? 0
    expect(p95).toBeLessThan(300)
  }, 120_000)
})
