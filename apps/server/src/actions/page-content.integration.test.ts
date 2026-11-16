import { connect, documentsRepo, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { BODY_FIELD } from '@crisol/editor'
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, seedExampleTemplates, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

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
  '%%Preguntar por Maela.%%',
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
  let tpl: Record<string, string>

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
    tpl = await seedExampleTemplates(call)
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

  it('una tirada escrita (`dice: …`) es texto en código y vuelve igual al leerla (los dados salieron de la wiki)', async () => {
    const markdown = 'La trampa hace `dice: 2d6+3 # Trampa del almacén` de daño; el resorte, `dice: 1d20+3`.\n'
    const { pages } = await ok200('createPages', {
      worldId,
      parentId: null,
      pages: [{ key: 'a', title: 'Almacén 7', markdown }]
    })
    expect((await ok200('readPage', { pageId: pages[0].id })).markdown).toBe(markdown)
  })

  it('escribir en el texto o en un secreto pone al día la fecha de la página, sin subir su versión', async () => {
    const { pages } = await ok200('createPages', {
      worldId,
      parentId: null,
      pages: [{ key: 'p', title: 'Fecha al día', markdown: 'Uno.\n\n> [!secreto]\n> Dentro.' }]
    })
    const pageId = pages[0].id
    const row = async () => {
      const [found] = await conn.db.select().from(schema.pages).where(eq(schema.pages.id, pageId))
      return { updatedAt: found?.updatedAt.getTime() ?? 0, version: found?.version }
    }
    const first = await row()
    await ok200('editPage', { pageId, body: { mode: 'append', markdown: 'Dos.' } })
    const second = await row()
    expect(second.updatedAt).toBeGreaterThan(first.updatedAt)
    expect(second.version).toBe(first.version)
    const secretId = /\^s-([a-z0-9]{8})/.exec((await ok200('readPage', { pageId, ids: true })).markdown)?.[1]
    await ok200('editPage', {
      pageId,
      body: { mode: 'block', blockId: secretId, markdown: '> [!secreto]\n> Otra cosa.' }
    })
    const third = await row()
    expect(third.updatedAt).toBeGreaterThan(second.updatedAt)
    expect(third.version).toBe(first.version)
  })

  it('un secreto cambiado por bloque sin su ^s-id conserva su id y su documento', async () => {
    const { pages } = await ok200('createPages', {
      worldId,
      parentId: null,
      pages: [{ key: 'p', title: 'Torre Gris', markdown: '> [!secreto]\n> Primera versión.' }]
    })
    const pageId = pages[0].id
    const idOf = async () => /\^s-([a-z0-9]{8})/.exec((await ok200('readPage', { pageId, ids: true })).markdown)?.[1]
    const secretId = await idOf()
    const before = (await documentsOf(pageId)).filter((d) => d.kind === 'secret')
    await ok200('editPage', {
      pageId,
      body: { mode: 'block', blockId: secretId, markdown: '> [!secreto]\n> Segunda versión.' }
    })
    expect(await idOf()).toBe(secretId)
    const after = (await documentsOf(pageId)).filter((d) => d.kind === 'secret')
    expect(after.map((d) => d.id)).toEqual(before.map((d) => d.id))
    expect(await storedText(before[0]?.id ?? '')).toContain('Segunda versión.')
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

  it('los campos de plantilla: se guardan, se leen en Markdown y la IA los reescribe sin perder su campo ni su forma', async () => {
    const raqisa = await ok200('createPage', { worldId, title: 'La Raqisa' })
    const gris = await ok200('createPage', { worldId, title: 'Mamá Gris' })
    const fields = [
      { name: 'Facción', field: 'faccion', type: 'pages', single: true, targets: ['faccion'], value: [raqisa.id] },
      { name: 'Estado', field: 'estado', type: 'choice', value: 'Vive', options: ['Vive', 'Ha muerto'] },
      { name: 'Reloj', field: 'reloj', type: 'clock', value: 3, segments: 8 }
    ]
    expect((await ok200('setPageProperties', { pageId: gris.id, properties: fields })).properties).toEqual(fields)
    const { markdown } = await ok200('readPage', { pageId: gris.id })
    expect(markdown).toContain('Facción: "[[La Raqisa]]"\nEstado: Vive\nReloj: "3/8"')

    // Al cambiar el cuerpo entero con su YAML, cada valor vuelve a su campo
    const yaml = '---\nFacción: "[[La Raqisa]]"\nEstado: Ha muerto\nReloj: "5/8"\n---\nOtra vida.\n'
    const replaced = await ok200('editPage', { pageId: gris.id, body: { mode: 'replace', markdown: yaml } })
    expect(replaced.page.properties).toEqual([
      fields[0],
      { ...fields[1], value: 'Ha muerto' },
      { ...fields[2], value: 5 }
    ])
    // Y con las propiedades sueltas: sin opciones ni segmentos, se quedan los que tenía
    const loose = await ok200('editPage', {
      pageId: gris.id,
      properties: [
        { name: 'Estado', type: 'choice', value: 'Vive' },
        { name: 'Reloj', type: 'clock', value: 1 },
        { name: 'Facción', type: 'pages', value: ['La Raqisa'] }
      ]
    })
    expect(loose.page.properties).toEqual([{ ...fields[1], value: 'Vive' }, { ...fields[2], value: 1 }, fields[0]])
  })

  it('los campos que no valen: un reloj pasado, dos páginas en un enlace solo, una página de otro mundo', async () => {
    const gris = await ok200('createPage', { worldId, title: 'Mamá Gris' })
    const set = (property: object) => call('setPageProperties', { pageId: gris.id, properties: [property] })
    expect((await set({ name: 'Reloj', type: 'clock', value: 9, segments: 8 })).json()).toMatchObject({
      code: 'BAD_CLOCK'
    })
    const a = await ok200('createPage', { worldId, title: 'A' })
    const b = await ok200('createPage', { worldId, title: 'B' })
    expect((await set({ name: 'Facción', type: 'pages', single: true, value: [a.id, b.id] })).json()).toMatchObject({
      code: 'BAD_PROPERTY'
    })
    const otherWorld = (await call('createWorld', { name: 'Otro' })).json().id
    const far = await ok200('createPage', { worldId: otherWorld, title: 'Lejos' })
    expect((await set({ name: 'Facción', type: 'pages', single: true, value: [far.id] })).json()).toMatchObject({
      code: 'BAD_PROPERTY'
    })
    // Por la IA, un reloj nuevo sin segmentos tiene 4
    const clock = await ok200('editPage', { pageId: gris.id, properties: [{ name: 'Reloj', type: 'clock', value: 2 }] })
    expect(clock.page.properties).toEqual([{ name: 'Reloj', type: 'clock', value: 2, segments: 4 }])
  })

  it('crear desde plantilla: sus campos, su panel y su texto, en una sola operación que se deshace entera', async () => {
    const page = await ok200('createPage', { worldId, title: 'Mamá Gris', template: 'pnj' })
    expect(page.template).toBe(tpl.pnj)
    expect(page.properties.map((p: { name: string; field?: string }) => [p.name, p.field])).toEqual([
      ['Especie', 'especie'],
      ['Rol', 'rol'],
      ['Facción', 'faccion'],
      ['Lugar', 'lugar'],
      ['Estado', 'estado'],
      ['Padres', 'padres'],
      ['Pareja', 'pareja']
    ])
    expect(page.panel).toEqual([
      { id: expect.stringMatching(/^[a-z0-9]{12}$/), type: 'image', fileId: null, caption: '' },
      {
        id: expect.stringMatching(/^[a-z0-9]{12}$/),
        type: 'related',
        title: 'Lleva encima',
        template: tpl.objeto,
        field: 'portador',
        columns: ['tipo', 'rareza'],
        sort: 'title'
      }
    ])
    const { markdown } = await ok200('readPage', { pageId: page.id })
    expect(markdown).toContain('## Quién es\n\n## Cómo interpretarlo\n\n## Ganchos')
    // Una sola operación del historial: deshacerla quita la página con todo
    const { entries } = await ok200('listHistory', { worldId })
    expect(entries[0]).toMatchObject({ action: 'createPage', details: { title: 'Mamá Gris' } })
    expect((await ok200('undoOperation', { operationId: entries[0].id })).status).toBe('undone')
    expect((await call('getPage', { pageId: page.id })).statusCode).toBe(404)
  })

  // Su ritmo (menos de 3 s), en la prueba de escala (CRISOL_ESCALA=1): con todo a la vez en el VPS, el tiempo no dice nada
  it('la IA crea 50 páginas desde plantilla, enlazadas entre sí en cualquier orden', async () => {
    const pages = [
      // Los PNJ van antes que sus facciones: los enlaces se resuelven igual
      ...Array.from({ length: 25 }, (_, i) => ({
        key: `pnj${i}`,
        title: `PNJ ${i}`,
        template: i % 2 ? 'PNJ' : 'pnj',
        markdown: `---\nfaccion: "[[Facción ${i}]]"\nestado: Vive\nRol: Contable\n---\n`
      })),
      ...Array.from({ length: 25 }, (_, i) => ({ key: `f${i}`, title: `Facción ${i}`, template: 'faccion' }))
    ]
    const created = await ok200('createPages', { worldId, parentId: null, pages })
    expect(created.pages).toHaveLength(50)
    const gris = await ok200('getPage', { pageId: created.pages[3].id })
    const faction = created.pages.find((p: { key: string }) => p.key === 'f3')
    expect(gris.template).toBe(tpl.pnj)
    expect(gris.properties.find((p: { field?: string }) => p.field === 'faccion')).toEqual({
      name: 'Facción',
      field: 'faccion',
      type: 'pages',
      single: true,
      targets: [tpl.faccion],
      // Su papel en las relaciones (módulo 10) pasa a la página
      role: 'member-of',
      inverseName: 'Miembros',
      value: [faction.id]
    })
    expect(gris.properties.find((p: { field?: string }) => p.field === 'estado')).toMatchObject({
      type: 'choice',
      value: 'Vive'
    })
    // Con cuerpo, el suyo; sin él, el esqueleto
    expect((await ok200('readPage', { pageId: faction.id })).markdown).toContain('## Quiénes son')
  })

  it('con plantilla, lo que no vale: una que no existe, un valor que no cabe en su campo; y el cuerpo dado se queda', async () => {
    const missing = await call('createPages', {
      worldId,
      parentId: null,
      pages: [{ key: 'a', title: 'A', template: 'frente' }]
    })
    expect(missing.json()).toMatchObject({ code: 'TEMPLATE_NOT_FOUND' })
    const bad = await call('createPages', {
      worldId,
      parentId: null,
      pages: [{ key: 'a', title: 'A', template: 'pnj', markdown: '---\nFacción: 7\n---\n' }]
    })
    expect(bad.json()).toMatchObject({ code: 'BAD_FIELD' })
    const own = await ok200('createPages', {
      worldId,
      parentId: null,
      pages: [{ key: 'a', title: 'A', template: 'lugar', markdown: '---\nPoblación: 12000\n---\nMi propio texto.\n' }]
    })
    const read = await ok200('readPage', { pageId: own.pages[0].id })
    expect(read.markdown).toContain('Mi propio texto.')
    expect(read.markdown).not.toContain('## Descripción')
    expect(read.page.properties.find((p: { field?: string }) => p.field === 'poblacion')).toMatchObject({
      type: 'number',
      value: 12000
    })
  })

  it('aplicar una plantilla a una página ya hecha: añade lo que falta, sin borrar nada, en una operación', async () => {
    const { pages } = await ok200('createPages', {
      worldId,
      parentId: null,
      pages: [
        {
          key: 'ciudad',
          title: 'Ciudad Libre',
          markdown: '---\nPoblación: 12000\nClima: Niebla\n---\n## Descripción\n\nPuerto franco.\n'
        }
      ]
    })
    const pageId = pages[0].id
    const applied = await ok200('editPage', { pageId, template: 'Lugar' })
    expect(applied.page.template).toBe(tpl.lugar)
    expect(applied.page.properties.map((p: { name: string; field?: string }) => [p.name, p.field])).toEqual([
      ['Población', 'poblacion'],
      ['Clima', undefined],
      ['Tipo', 'tipo'],
      ['Dentro de', 'dentro-de'],
      ['Gobierna', 'gobierna']
    ])
    expect(applied.page.panel.map((b: { type: string }) => b.type)).toEqual(['image', 'related', 'related'])
    const { markdown } = await ok200('readPage', { pageId })
    // Lo suyo se queda; el apartado que no tenía, al final
    expect(markdown).toContain('## Descripción\n\nPuerto franco.')
    expect(markdown.trimEnd().endsWith('## Ganchos')).toBe(true)
    expect(markdown.match(/## Descripción/g)).toHaveLength(1)
    // Una sola operación del historial, que dice qué plantilla
    const { entries } = await ok200('listHistory', { worldId })
    expect(entries[0]).toMatchObject({ action: 'editPage', details: { template: 'Lugar' } })
    // Con body no va
    expect(
      (await call('editPage', { pageId, template: 'lugar', body: { mode: 'append', markdown: 'x' } })).statusCode
    ).toBe(400)
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
