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

const PUERTO = [
  '---',
  'alias:',
  '  - Puerto',
  'etiquetas:',
  '  - lugar/ciudad',
  'Región:',
  '  - "[[Costa Gris]]"',
  'Población: 12000',
  '---',
  '# Puerto Ceniza',
  '',
  'La última ciudad libre.',
  '',
  '> [!secreto]',
  '> La Hermandad quemó el faro.',
  '',
  '%%',
  'Preguntar por Maela.',
  '%%',
  '',
  '## Barrios',
  '',
  'Los Muelles.',
  ''
].join('\n')

describe('Claude lee y escribe páginas en Markdown', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }
  let organizationId: string
  let worldId: string

  const call = (name: string, payload: object, cookie = owner.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object) => {
    const response = await call(name, payload)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  /** El texto de un documento guardado (cuerpo o secreto), en crudo: lo que hay en la base de datos */
  const storedText = async (documentId: string) => {
    const [row] = await conn.db.select().from(schema.documents).where(eq(schema.documents.id, documentId))
    if (!row) return ''
    const doc = new Y.Doc()
    Y.applyUpdate(doc, row.state)
    return doc.getXmlFragment(BODY_FIELD).toString()
  }
  const documentsOf = (pageId: string) =>
    conn.db.select().from(schema.documents).where(eq(schema.documents.pageId, pageId))

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_page_content'), { max: 4 })
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
    organizationId = org.id
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: owner.userId, role: 'owner' })
    worldId = (await call('createWorld', { name: 'Eana' })).json().id
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('crea varias páginas anidadas con cuerpo, propiedades y secretos en una sola operación', async () => {
    const maela = await ok200('createPage', { worldId, title: 'Maela Varn' })
    const { pages } = await ok200('createPages', {
      worldId,
      parentId: null,
      pages: [
        { key: 'puerto', parent: 'costa', title: 'Puerto Ceniza', markdown: PUERTO },
        { key: 'lugares', title: 'Lugares', markdown: 'Los sitios de Eana.' },
        {
          key: 'costa',
          parent: 'lugares',
          title: 'Costa Gris',
          markdown: '---\njefa: "[[maela varn]]"\n---\nLa costa.'
        }
      ]
    })
    expect(pages.map((p: { key: string }) => p.key)).toEqual(['puerto', 'lugares', 'costa'])
    const id = (key: string) => pages.find((p: { key: string; id: string }) => p.key === key).id
    expect(pages.find((p: { key: string }) => p.key === 'puerto').parentId).toBe(id('costa'))
    expect(pages.find((p: { key: string }) => p.key === 'costa').parentId).toBe(id('lugares'))

    // Las propiedades, con las páginas por su id (también una de la misma tanda)
    const puerto = await ok200('getPage', { pageId: id('puerto') })
    expect(puerto.properties).toEqual([
      { name: 'alias', type: 'list', value: ['Puerto'] },
      { name: 'etiquetas', type: 'list', value: ['lugar/ciudad'] },
      { name: 'Región', type: 'pages', value: [id('costa')] },
      { name: 'Población', type: 'number', value: 12000 }
    ])
    expect((await ok200('getPage', { pageId: id('costa') })).properties).toEqual([
      { name: 'jefa', type: 'pages', value: [maela.id] }
    ])

    // El texto del secreto nunca está en el cuerpo: va en su documento
    const docs = await documentsOf(id('puerto'))
    const body = docs.find((d) => d.kind === 'body')
    const secret = docs.find((d) => d.kind === 'secret')
    const note = docs.find((d) => d.kind === 'note')
    if (!body || !secret || !note) throw new Error('faltan documentos')
    const bodyText = await storedText(body.id)
    expect(bodyText).toContain('La última ciudad libre.')
    expect(bodyText).not.toContain('Hermandad')
    expect(bodyText).not.toContain('Maela')
    expect(await storedText(secret.id)).toContain('La Hermandad quemó el faro.')
    expect(await storedText(note.id)).toContain('Preguntar por Maela.')

    // Una sola operación en el historial, que se puede deshacer
    const entries = (await ok200('listHistory', { worldId })).entries as {
      id: string
      action: string
      details: object
    }[]
    const created = entries.filter((e) => e.action === 'createPages')
    expect(created).toHaveLength(1)
    expect(created[0]?.details).toMatchObject({ count: 3, parent: null })
    expect((await ok200('undoOperation', { operationId: created[0]?.id })).status).toBe('undone')
    expect((await call('getPage', { pageId: id('puerto') })).statusCode).toBe(404)
  })

  it('lee una página en Markdown, con sus secretos dentro y sus ids si se piden', async () => {
    const { pages } = await ok200('createPages', {
      worldId,
      parentId: null,
      pages: [
        { key: 'costa', title: 'Costa Gris' },
        { key: 'puerto', title: 'Puerto Ceniza', markdown: PUERTO }
      ]
    })
    const { markdown } = await ok200('readPage', { pageId: pages[1].id })
    expect(markdown).toBe(PUERTO)
    const withIds = (await ok200('readPage', { pageId: pages[1].id, ids: true })).markdown as string
    expect(withIds).toMatch(/^La última ciudad libre\. \^[a-z0-9]{8}$/m)
    expect(withIds).toMatch(/^\^s-[a-z0-9]{8}$/m)
  })

  it('cambia un bloque por su id, una sección por su título, añade al final y cambia el cuerpo entero', async () => {
    const { pages } = await ok200('createPages', {
      worldId,
      parentId: null,
      pages: [
        { key: 'p', title: 'Puerto Ceniza', markdown: 'Uno.\n\n## Historia\n\nEl faro.\n\n## Barrios\n\nLos Muelles.' }
      ]
    })
    const pageId = pages[0].id
    const ids = (await ok200('readPage', { pageId, ids: true })).markdown as string
    const firstId = /^Uno\. \^([a-z0-9]{8})$/m.exec(ids)?.[1]
    const block = await ok200('editPage', {
      pageId,
      body: { mode: 'block', blockId: firstId, markdown: 'Uno y medio.' }
    })
    expect(block.changedBlocks).toHaveLength(1)
    await ok200('editPage', { pageId, body: { mode: 'section', section: 'historia', markdown: 'Ardió en una noche.' } })
    await ok200('editPage', { pageId, body: { mode: 'append', markdown: '> [!aviso]\n> Cuidado con la marea.' } })
    expect((await ok200('readPage', { pageId })).markdown).toBe(
      [
        'Uno y medio.',
        '',
        '## Historia',
        '',
        'Ardió en una noche.',
        '',
        '## Barrios',
        '',
        'Los Muelles.',
        '',
        '> [!aviso]',
        '> Cuidado con la marea.',
        ''
      ].join('\n')
    )
    // Los demás bloques conservan su id
    const after = (await ok200('readPage', { pageId, ids: true })).markdown as string
    expect(after).toContain(`Uno y medio. ^${firstId}`)

    // Entero, con su YAML: también las propiedades
    await ok200('editPage', {
      pageId,
      body: { mode: 'replace', markdown: '---\nresumen: Puerto libre\n---\nTodo nuevo.' }
    })
    const read = await ok200('readPage', { pageId })
    expect(read.markdown).toBe('---\nresumen: Puerto libre\n---\nTodo nuevo.\n')
    expect(read.page.properties).toEqual([{ name: 'resumen', type: 'text', value: 'Puerto libre' }])

    const missing = await call('editPage', { pageId, body: { mode: 'block', blockId: 'zzzzzzzz', markdown: 'x' } })
    expect(missing.json()).toMatchObject({ code: 'BLOCK_NOT_FOUND' })
    const noSection = await call('editPage', { pageId, body: { mode: 'section', section: 'Nada', markdown: 'x' } })
    expect(noSection.json()).toMatchObject({ code: 'SECTION_NOT_FOUND' })

    // Cada cambio, en el historial
    const entries = (await ok200('listHistory', { worldId })).entries as { action: string; details: object }[]
    // Con el id de la página, para que el historial lleve a sus versiones
    expect(entries.filter((e) => e.action === 'editPage').map((e) => e.details)).toContainEqual({
      title: 'Puerto Ceniza',
      pageId,
      body: 'section'
    })
  })

  it('un secreto que ya estaba (mismo ^s-id) cambia su documento; uno nuevo crea otro; nunca entra en el cuerpo', async () => {
    const { pages } = await ok200('createPages', {
      worldId,
      parentId: null,
      pages: [{ key: 'p', title: 'Puerto Ceniza', markdown: '> [!secreto]\n> Primera versión.' }]
    })
    const pageId = pages[0].id
    const withIds = (await ok200('readPage', { pageId, ids: true })).markdown as string
    const secretId = /\^s-([a-z0-9]{8})/.exec(withIds)?.[1]
    const before = (await documentsOf(pageId)).filter((d) => d.kind === 'secret')
    await ok200('editPage', {
      pageId,
      body: { mode: 'block', blockId: secretId, markdown: `> [!secreto]\n> Segunda versión.\n\n^s-${secretId}` }
    })
    await ok200('editPage', { pageId, body: { mode: 'append', markdown: '> [!secreto]\n> Otro distinto.' } })
    const after = (await documentsOf(pageId)).filter((d) => d.kind === 'secret')
    expect(after).toHaveLength(2)
    expect(after.map((d) => d.id)).toContain(before[0]?.id)
    expect(await storedText(before[0]?.id ?? '')).toContain('Segunda versión.')
    const body = (await documentsRepo.findBody(conn.db, pageId))?.state
    const doc = new Y.Doc()
    if (body) Y.applyUpdate(doc, body)
    const bodyText = doc.getXmlFragment(BODY_FIELD).toString()
    expect(bodyText).not.toContain('versión')
    expect(bodyText).not.toContain('Otro distinto')
    expect((await ok200('readPage', { pageId })).markdown).toBe(
      '> [!secreto]\n> Segunda versión.\n\n> [!secreto]\n> Otro distinto.\n'
    )
  })

  it('lo que no se puede: una madre que no está, una página enlazada que no existe, un YAML roto, y nada queda a medias', async () => {
    const badParent = await call('createPages', {
      worldId,
      parentId: null,
      pages: [{ key: 'a', parent: 'nadie', title: 'A' }]
    })
    expect(badParent.json()).toMatchObject({ code: 'BAD_PARENT' })
    const unknown = await call('createPages', {
      worldId,
      parentId: null,
      pages: [
        { key: 'a', title: 'A' },
        { key: 'b', title: 'B', markdown: '---\nvecina: "[[Nadie]]"\n---\nTexto' }
      ]
    })
    expect(unknown.json()).toMatchObject({ code: 'PAGE_NOT_FOUND' })
    expect((await ok200('listPageChildren', { worldId, parentId: null })).pages).toEqual([])
    const yaml = await call('createPages', {
      worldId,
      parentId: null,
      pages: [{ key: 'a', title: 'A', markdown: '---\nalias: [roto\n---\n' }]
    })
    expect(yaml.json()).toMatchObject({ code: 'BAD_YAML' })
    const tooMany = await call('createPages', {
      worldId,
      parentId: null,
      pages: Array.from({ length: 51 }, (_, i) => ({ key: `p${i}`, title: `P${i}` }))
    })
    expect(tooMany.statusCode).toBe(400)
  })

  it('dos páginas con el mismo nombre: Claude recibe las candidatas', async () => {
    await ok200('createPage', { worldId, title: 'Maela' })
    await ok200('createPages', {
      worldId,
      parentId: null,
      pages: [{ key: 'otra', title: 'Otra', markdown: '---\nalias: [Maela]\n---\n' }]
    })
    const ambiguous = await call('createPages', {
      worldId,
      parentId: null,
      pages: [{ key: 'x', title: 'X', markdown: '---\nquien: "[[maela]]"\n---\n' }]
    })
    expect(ambiguous.json()).toMatchObject({ code: 'AMBIGUOUS_PAGE' })
  })

  it('quien no es máster del mundo no lee ni escribe', async () => {
    const page = await ok200('createPage', { worldId, title: 'Puerto Ceniza' })
    const player = await signUpTestUser(auth, { name: 'Lía', email: 'lia@crisol.test' })
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: player.userId, role: 'member' })
    expect((await call('readPage', { pageId: page.id }, player.cookie)).statusCode).toBe(404)
    const edit = await call('editPage', { pageId: page.id, body: { mode: 'append', markdown: 'x' } }, player.cookie)
    expect(edit.statusCode).toBe(404)
  })
})
