import { connect, documentsRepo, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { BODY_FIELD } from '@crisol/editor'
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined

/** Hasta que se cumpla, o falla a los 5 s */
async function until<T>(check: () => Promise<T>, done: (value: T) => boolean, what: string): Promise<T> {
  const deadline = Date.now() + 5000
  for (;;) {
    const value = await check()
    if (done(value)) return value
    if (Date.now() > deadline) throw new Error(`No llegó: ${what} (${JSON.stringify(value)})`)
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

describe('los enlaces entre páginas', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }
  let worldId: string

  const call = (name: string, payload: object) =>
    app.inject({
      method: 'POST',
      url: `/api/actions/${name}`,
      payload,
      headers: { origin: BASE_URL, cookie: owner.cookie }
    })
  const ok200 = async (name: string, payload: object) => {
    const response = await call(name, payload)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const create = async (pages: object[]) =>
    (await ok200('createPages', { worldId, parentId: null, pages })).pages as { key: string; id: string }[]
  /** Los enlaces que salen de una página, por la tabla */
  const linksFrom = (pageId: string) =>
    conn.db
      .select({ title: schema.pageLinks.targetTitle, target: schema.pageLinks.targetPageId })
      .from(schema.pageLinks)
      .where(eq(schema.pageLinks.sourcePageId, pageId))
  /** Los enlaces del cuerpo guardado, con su página */
  const storedLinks = async (pageId: string) => {
    const body = await documentsRepo.findBody(conn.db, pageId)
    if (!body) return []
    const doc = new Y.Doc()
    Y.applyUpdate(doc, body.state)
    const found: { title: string; pageId: string | null }[] = []
    const walk = (node: Y.XmlElement | Y.XmlFragment) => {
      for (const child of node.toArray()) {
        if (!(child instanceof Y.XmlElement)) continue
        if (child.nodeName === 'pageLink') {
          found.push({
            title: String(child.getAttribute('title')),
            pageId: (child.getAttribute('pageId') as string) ?? null
          })
        }
        walk(child)
      }
    }
    walk(doc.getXmlFragment(BODY_FIELD))
    return found
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_links'), { max: 4 })
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
    if (!org) throw new Error('sin organización')
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org.id, userId: owner.userId, role: 'owner' })
    worldId = (await call('createWorld', { name: 'Eana' })).json().id
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('en cualquier orden: un enlace a lo que no existe espera y se resuelve al crearlo, también en el texto', async () => {
    const [puerto] = await create([{ key: 'p', title: 'Puerto Ceniza', markdown: 'Lo gobierna [[Maela Varn]].' }])
    const pageId = puerto?.id ?? ''
    expect(await linksFrom(pageId)).toEqual([{ title: 'Maela Varn', target: null }])
    expect(await storedLinks(pageId)).toEqual([{ title: 'Maela Varn', pageId: null }])

    const maela = await ok200('createPage', { worldId, title: 'Maela Varn' })
    expect(await linksFrom(pageId)).toEqual([{ title: 'Maela Varn', target: maela.id }])
    expect(
      await until(
        () => storedLinks(pageId),
        (l) => l[0]?.pageId === maela.id,
        'el id en el texto'
      )
    ).toEqual([{ title: 'Maela Varn', pageId: maela.id }])

    // Por id: al renombrarla, el enlace la sigue y se escribe con el título de ahora
    await ok200('updatePage', { pageId: maela.id, title: 'Maela la Maestre' })
    expect((await ok200('readPage', { pageId })).markdown).toBe('Lo gobierna [[Maela la Maestre]].\n')
  })

  it('en una misma tanda, unas enlazan a otras; y un alias nuevo resuelve lo que lo esperaba', async () => {
    const pages = await create([
      { key: 'a', title: 'Puerto Ceniza', markdown: 'Ver [[Costa Gris]] y [[La Maestre]].' },
      { key: 'b', title: 'Costa Gris', markdown: 'Su puerto: [[Puerto Ceniza]].' }
    ])
    const [a, b] = pages
    expect(await linksFrom(a?.id ?? '')).toEqual([
      { title: 'Costa Gris', target: b?.id },
      { title: 'La Maestre', target: null }
    ])
    expect(await linksFrom(b?.id ?? '')).toEqual([{ title: 'Puerto Ceniza', target: a?.id }])
    const maela = await ok200('createPage', { worldId, title: 'Maela Varn' })
    await ok200('setPageProperties', {
      pageId: maela.id,
      properties: [{ name: 'alias', type: 'list', value: ['La Maestre'] }]
    })
    expect((await linksFrom(a?.id ?? '')).find((l) => l.title === 'La Maestre')?.target).toBe(maela.id)
  })

  it('si un nombre lleva a varias páginas, Claude recibe las candidatas; con la ruta, se resuelve', async () => {
    const [lugares, personajes] = await create([
      { key: 'l', title: 'Lugares' },
      { key: 'p', title: 'Personajes' }
    ])
    const notas = await create([{ key: 'n', title: 'Notas', markdown: 'De lugares.' }])
    await ok200('movePage', { pageId: notas[0]?.id, parentId: lugares?.id })
    const otras = await ok200('createPage', { worldId, title: 'Notas', parentId: personajes?.id })
    const [page] = await create([{ key: 'x', title: 'Índice' }])
    const ambiguous = await call('editPage', { pageId: page?.id, body: { mode: 'append', markdown: 'Ver [[Notas]].' } })
    expect(ambiguous.json()).toMatchObject({ code: 'AMBIGUOUS_PAGE' })
    await ok200('editPage', { pageId: page?.id, body: { mode: 'append', markdown: 'Ver [[Personajes/Notas]].' } })
    const links = await until(
      () => linksFrom(page?.id ?? ''),
      (l) => l.length > 0,
      'el enlace guardado'
    )
    expect(links).toEqual([{ title: 'Personajes/Notas', target: otras.id }])
    // Al leer, con su ruta: hay dos «Notas»
    expect((await ok200('readPage', { pageId: page?.id })).markdown).toBe('Ver [[Personajes/Notas]].\n')
  })

  it('lo que está en la papelera sigue enlazado por su id (la web lo enseña roto); al restaurarlo, vuelve', async () => {
    const [maela] = await create([{ key: 'm', title: 'Maela Varn' }])
    const [puerto] = await create([{ key: 'p', title: 'Puerto Ceniza', markdown: 'Ver [[Maela Varn]].' }])
    await ok200('deletePage', { pageId: maela?.id })
    expect(await linksFrom(puerto?.id ?? '')).toEqual([{ title: 'Maela Varn', target: maela?.id }])
    await ok200('restorePage', { pageId: maela?.id })
    expect((await ok200('readPage', { pageId: puerto?.id })).markdown).toBe('Ver [[Maela Varn]].\n')
  })

  it('los entrantes con su trozo (también desde un secreto), los salientes y las menciones sin enlazar', async () => {
    const [maela, puerto, faro, notas] = await create([
      {
        key: 'm',
        title: 'Maela Varn',
        markdown: '---\nalias: [La Maestre]\n---\nVer [[Puerto Ceniza]], [[Por crear]] y [[El Faro]].'
      },
      { key: 'p', title: 'Puerto Ceniza', markdown: 'Lo gobierna [[Maela Varn]] desde la lonja.' },
      { key: 'f', title: 'El Faro', markdown: '> [!secreto]\n> Lo quemó gente de [[Maela Varn]].' },
      { key: 'n', title: 'Notas', markdown: 'Hablar con la maestre. Y con Maela Varnes, que no es ella.' }
    ])
    await ok200('deletePage', { pageId: faro?.id })
    const links = await ok200('getPageLinks', { pageId: maela?.id })
    expect(links.incoming).toEqual([
      {
        pageId: puerto?.id,
        title: 'Puerto Ceniza',
        path: [],
        fragment: 'Lo gobierna Maela Varn desde la lonja.',
        inSecret: false
      }
    ])
    expect(links.outgoing).toEqual([
      { pageId: puerto?.id, title: 'Puerto Ceniza', anchor: null, state: 'ok' },
      { pageId: null, title: 'Por crear', anchor: null, state: 'missing' },
      { pageId: faro?.id, title: 'El Faro', anchor: null, state: 'broken' }
    ])
    // «la maestre» es un alias (sin mayúsculas); «Maela Varnes» no cuenta: no es la palabra entera
    expect(links.mentions).toEqual([
      {
        pageId: notas?.id,
        title: 'Notas',
        path: [],
        fragment: 'Hablar con la maestre. Y con Maela Varnes, que no es ella.',
        inSecret: false
      }
    ])

    // «Enlazar»: la mención pasa a ser un enlace, y ya sale entre los entrantes
    expect(await ok200('linkMention', { sourcePageId: notas?.id, targetPageId: maela?.id })).toEqual({ linked: true })
    expect((await ok200('readPage', { pageId: notas?.id })).markdown).toBe(
      'Hablar con [[Maela Varn|la maestre]]. Y con Maela Varnes, que no es ella.\n'
    )
    const after = await until(
      () => ok200('getPageLinks', { pageId: maela?.id }),
      (l) => l.incoming.length === 2,
      'el entrante nuevo'
    )
    expect(after.mentions).toEqual([])

    // Los sin resolver del mundo
    expect((await ok200('listUnresolvedLinks', { worldId })).links).toEqual([
      { title: 'Por crear', count: 1, pages: [{ id: maela?.id, title: 'Maela Varn' }] }
    ])
  })

  it('las páginas que la apuntan desde un campo, con el nombre del campo; las de la papelera, no', async () => {
    const [raqisa, maela, faro] = await create([
      { key: 'r', title: 'Raqisa' },
      {
        key: 'm',
        title: 'Maela Varn',
        markdown: '---\nFacción: "[[Raqisa]]"\nAliados:\n  - "[[Raqisa]]"\n---\nTexto.'
      },
      { key: 'f', title: 'El Faro', markdown: '---\nDueños: "[[Raqisa]]"\n---\nSin más.' }
    ])
    const links = await ok200('getPageLinks', { pageId: raqisa?.id })
    expect(links.incoming).toEqual([])
    expect(links.fields).toEqual([
      { pageId: faro?.id, title: 'El Faro', path: [], fields: ['Dueños'] },
      { pageId: maela?.id, title: 'Maela Varn', path: [], fields: ['Facción', 'Aliados'] }
    ])
    await ok200('deletePage', { pageId: faro?.id })
    expect((await ok200('getPageLinks', { pageId: raqisa?.id })).fields.map((p: { title: string }) => p.title)).toEqual(
      ['Maela Varn']
    )
  })

  it('desde un secreto, el entrante lo dice', async () => {
    const [maela, faro] = await create([
      { key: 'm', title: 'Maela Varn' },
      { key: 'f', title: 'El Faro', markdown: '> [!secreto]\n> Lo quemó gente de [[Maela Varn]].' }
    ])
    const links = await ok200('getPageLinks', { pageId: maela?.id })
    expect(links.incoming).toEqual([
      { pageId: faro?.id, title: 'El Faro', path: [], fragment: 'Lo quemó gente de Maela Varn.', inSecret: true }
    ])
  })
})
