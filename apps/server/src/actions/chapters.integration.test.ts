import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { markdownWithoutSecrets as withoutSecrets } from '@crisol/editor/markdown'
import { exampleFile } from '@crisol/systems/examples'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { diskStorage } from '../files/storage.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY, testDataDir } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

const COMBATE = `# El combate

Cada asalto dura seis segundos.

> [!secreto] Para el máster
> Los goblins huyen al caer la mitad.

## La iniciativa

Tira 1d20 y suma tu Destreza.`

describe('los capítulos de los libros (ADR-0025)', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }

  const call = (name: string, payload: object, cookie = owner.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = owner.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const code = async (name: string, payload: object, cookie = owner.cookie) => {
    const response = await call(name, payload, cookie)
    return { status: response.statusCode, code: response.json().code as string }
  }
  const import5e = async (): Promise<string> => (await ok200('importSystem', { file: exampleFile('5e') })).system.id
  const titles = async (systemId: string, source: string, extra: object = {}, cookie = owner.cookie) =>
    (await ok200('listBookChapters', { systemId, source, ...extra }, cookie)).chapters.map(
      (c: { title: string }) => c.title
    )
  const history = async () => (await ok200('listHistory', {})).entries as { id: string; action: string }[]

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_chapters'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY },
      storage: diskStorage(testDataDir())
    })
    owner = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Mesa' }).returning()
    if (!org) throw new Error('sin organización')
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org.id, userId: owner.userId, role: 'owner' })
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('quitar los secretos se lleva el bloque entero y nada más', () => {
    expect(withoutSecrets(COMBATE)).toBe(
      '# El combate\n\nCada asalto dura seis segundos.\n\n## La iniciativa\n\nTira 1d20 y suma tu Destreza.'
    )
    expect(withoutSecrets('> [!nota]\n> Se queda')).toBe('> [!nota]\n> Se queda')
    expect(withoutSecrets('Antes\n\n%%\nSolo el máster\n%%\n\nDespués')).toBe('Antes\n\nDespués')
    // Dentro de un recuadro, también
    expect(withoutSecrets('> [!nota]\n> Visible\n>\n> > [!secreto]\n> > Oculto')).not.toContain('Oculto')
  })

  it('crear, cambiar con su versión, ordenar, borrar y deshacer', async () => {
    const five = await import5e()
    const first = await ok200('saveChapter', {
      systemId: five,
      source: 'srd51',
      title: 'El combate',
      markdown: COMBATE
    })
    expect(first).toMatchObject({ title: 'El combate', position: 0, version: 1, markdown: COMBATE })
    const second = await ok200('saveChapter', { systemId: five, source: 'srd51', title: 'La magia' })
    expect(second).toMatchObject({ position: 1, markdown: '' })
    expect(await titles(five, 'srd51')).toEqual(['El combate', 'La magia'])
    expect((await ok200('listBookChapters', { systemId: five, source: 'srd51' })).editable).toBe(true)

    // Cambiarlo: con la versión que se tenía; con una vieja, CHAPTER_CHANGED
    const changed = await ok200('saveChapter', {
      systemId: five,
      source: 'srd51',
      chapterId: second.id,
      version: 1,
      markdown: 'Los conjuros gastan espacios.'
    })
    expect(changed).toMatchObject({ title: 'La magia', version: 2, markdown: 'Los conjuros gastan espacios.' })
    expect(
      await code('saveChapter', { systemId: five, source: 'srd51', chapterId: second.id, version: 1, title: 'Otra' })
    ).toEqual({ status: 400, code: 'CHAPTER_CHANGED' })
    expect(await code('saveChapter', { systemId: five, source: 'srd51', chapterId: second.id, title: 'Otra' })).toEqual(
      { status: 400, code: 'VERSION_REQUIRED' }
    )
    // Un libro que no existe, o uno nuevo sin título
    expect(await code('saveChapter', { systemId: five, source: 'nada', title: 'X' })).toEqual({
      status: 400,
      code: 'BAD_BOOK'
    })
    expect(await code('saveChapter', { systemId: five, source: 'srd51' })).toEqual({
      status: 400,
      code: 'TITLE_REQUIRED'
    })

    // Ordenar: los nombrados delante
    expect(
      (await ok200('orderChapters', { systemId: five, source: 'srd51', chapterIds: [second.id] })).chapterIds
    ).toEqual([second.id, first.id])
    expect(await titles(five, 'srd51')).toEqual(['La magia', 'El combate'])

    // Borrar y deshacer desde el historial
    await ok200('deleteChapter', { chapterId: first.id })
    expect(await titles(five, 'srd51')).toEqual(['La magia'])
    expect(await code('getChapter', { chapterId: first.id })).toEqual({ status: 404, code: 'NOT_FOUND' })
    const entries = await history()
    expect(entries.slice(0, 5).map((e) => e.action)).toEqual([
      'deleteChapter',
      'orderChapters',
      'updateChapter',
      'createChapter',
      'createChapter'
    ])
    await ok200('undoOperation', { operationId: entries[0]?.id })
    expect((await ok200('getChapter', { chapterId: first.id })).markdown).toBe(COMBATE)

    // Borrar el libro se lleva sus capítulos
    const { version } = await ok200('getSystem', { systemId: five })
    await ok200('deleteBook', { systemId: five, version, key: 'srd51' })
    expect(await code('getChapter', { chapterId: second.id })).toEqual({ status: 404, code: 'NOT_FOUND' })
  })

  it('los de serie no traen capítulos ni se escriben', async () => {
    expect((await ok200('listBookChapters', { systemId: 'blank', source: 'x' })).chapters).toEqual([])
    expect((await code('saveChapter', { systemId: crypto.randomUUID(), source: 'x', title: 'X' })).status).toBe(404)
  })

  it('en la campaña: sus jugadores leen los de sus libros, sin los secretos; el máster, enteros', async () => {
    const five = await import5e()
    const combat = await ok200('saveChapter', {
      systemId: five,
      source: 'srd51',
      title: 'El combate',
      markdown: COMBATE
    })
    const newer = await ok200('saveChapter', {
      systemId: five,
      source: 'srd521',
      title: 'Novedades',
      markdown: 'Nuevo.'
    })
    const worldId = (await ok200('createWorld', { name: 'Valdren' })).id
    const campaignId = (await ok200('createCampaign', { worldId, name: 'La Marca', system: five })).id
    await ok200('updateCampaign', { campaignId, systemChoices: { sources: ['srd51'], duplicates: 'both' } })
    const ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    const url = (await ok200('getInvitation', { campaignId })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: ana.cookie }
    })

    // La jugadora: los capítulos de su libro, sin poder escribirlos y sin el secreto
    const listed = await ok200('listBookChapters', { systemId: five, source: 'srd51', campaignId }, ana.cookie)
    expect(listed).toMatchObject({ editable: false, chapters: [{ title: 'El combate' }] })
    const read = await ok200('getChapter', { chapterId: combat.id, campaignId }, ana.cookie)
    expect(read.markdown).not.toContain('goblins')
    expect(read.markdown).toContain('La iniciativa')
    // El máster, desde la campaña, lo lee entero
    expect((await ok200('getChapter', { chapterId: combat.id, campaignId })).markdown).toContain('goblins')

    // Un libro que la campaña no eligió, ni la lista ni el capítulo
    expect((await code('listBookChapters', { systemId: five, source: 'srd521', campaignId }, ana.cookie)).status).toBe(
      404
    )
    expect((await code('getChapter', { chapterId: newer.id, campaignId }, ana.cookie)).status).toBe(404)
    // Sin campaña, la jugadora no lee los del sistema; ni escribe ni borra
    expect((await code('getChapter', { chapterId: combat.id }, ana.cookie)).status).toBe(404)
    expect(
      (await code('saveChapter', { systemId: five, source: 'srd51', title: 'Mío' }, ana.cookie)).status
    ).toBeGreaterThanOrEqual(403)
    expect((await code('deleteChapter', { chapterId: combat.id }, ana.cookie)).status).toBeGreaterThanOrEqual(403)
    // Ni desde una campaña ajena
    expect(
      (await code('getChapter', { chapterId: combat.id, campaignId: crypto.randomUUID() }, ana.cookie)).status
    ).toBe(404)
  })

  it('solo para el máster (ADR-0033): un capítulo o un libro entero; sus entradas siguen llegando', async () => {
    const five = await import5e()
    const open = await ok200('saveChapter', {
      systemId: five,
      source: 'srd51',
      title: 'Abierto',
      markdown: 'Para todos.'
    })
    const hidden = await ok200('saveChapter', {
      systemId: five,
      source: 'srd51',
      title: 'La aventura',
      markdown: 'El villano es el alcalde.',
      master: true
    })
    expect(hidden.master).toBe(true)
    const worldId = (await ok200('createWorld', { name: 'Valdren' })).id
    const campaignId = (await ok200('createCampaign', { worldId, name: 'La Marca', system: five })).id
    const ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    const url = (await ok200('getInvitation', { campaignId })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: ana.cookie }
    })
    const chaptersOf = async (cookie: string) =>
      (await ok200('getCampaignCompendium', { campaignId }, cookie)).sources.find(
        (s: { key: string }) => s.key === 'srd51'
      ).chapters

    // La jugadora no ve el capítulo del máster, ni en la lista, ni al pedirlo, ni en la cuenta del libro
    expect(await titles(five, 'srd51', { campaignId }, ana.cookie)).toEqual(['Abierto'])
    expect((await code('getChapter', { chapterId: hidden.id, campaignId }, ana.cookie)).status).toBe(404)
    expect(await chaptersOf(ana.cookie)).toBe(1)
    // El máster, todo
    expect(await titles(five, 'srd51', { campaignId })).toEqual(['Abierto', 'La aventura'])
    expect(await chaptersOf(owner.cookie)).toBe(2)

    // El libro entero, solo para el máster: a la jugadora no le llega ningún capítulo, pero sí sus entradas
    const { version } = await ok200('getSystem', { systemId: five })
    await ok200('updateBook', { systemId: five, version, key: 'srd51', master: true })
    expect(
      (await ok200('getSystemBooks', { systemId: five })).books.find((b: { key: string }) => b.key === 'srd51')
    ).toMatchObject({
      master: true
    })
    expect(await titles(five, 'srd51', { campaignId }, ana.cookie)).toEqual([])
    expect((await code('getChapter', { chapterId: open.id, campaignId }, ana.cookie)).status).toBe(404)
    expect(await chaptersOf(ana.cookie)).toBe(0)
    const found = await ok200('searchCampaignContent', { campaignId, query: 'bola de fuego' }, ana.cookie)
    expect(found.items.length).toBeGreaterThan(0)

    // Y viaja con el archivo del sistema
    const exported = (await ok200('exportSystem', { systemId: five })).file
    expect(exported.chapters.find((c: { title: string }) => c.title === 'La aventura').master).toBe(true)
    expect(exported.chapters.find((c: { title: string }) => c.title === 'Abierto').master).toBeUndefined()
    expect(exported.system.sources.find((s: { key: string }) => s.key === 'srd51').master).toBe(true)
  })

  it('sus enlaces a otro capítulo, otro libro o una sección, y el crédito de sus imágenes (ADR-0033)', async () => {
    const five = await import5e()
    const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 una mesa')])
    await ok200('putSystemImages', {
      systemId: five,
      images: [{ path: 'book/mesa.webp', data: WEBP.toString('base64'), license: 'unknown', credit: 'Luca Bancone' }]
    })
    const other = await ok200('saveChapter', {
      systemId: five,
      source: 'srd521',
      title: 'Capítulo 1: Cómo jugar',
      markdown: 'Uno.'
    })
    const fourth = await ok200('saveChapter', {
      systemId: five,
      source: 'srd51',
      title: 'Capítulo 4: Crear aventuras',
      markdown: '## Encuentros\n\nAlgo.'
    })
    const books = (await ok200('getSystemBooks', { systemId: five })).books as { key: string; name: string }[]
    const newer = books.find((b) => b.key === 'srd521')?.name ?? ''
    const intro = await ok200('saveChapter', {
      systemId: five,
      source: 'srd51',
      title: 'Introducción',
      markdown: `![[book/mesa.webp]]\n*Una mesa mágica*\n\nLee [[Capítulo 4]], [[Capítulo 4#Encuentros|sus encuentros]], [[${newer}]], [[${newer}#Capítulo 1]], [[#Arriba]], [[No existe]] y [[@Goblin]].\n\n| Dónde |\n| --- |\n| [[Capítulo 4: Crear aventuras\\|el cuarto]] |`
    })
    const read = await ok200('getChapter', { chapterId: intro.id })
    expect(read.credits).toEqual({ 'book/mesa.webp': 'Luca Bancone' })
    const to = (target: string) => read.links.find((l: { target: string }) => l.target === target)
    expect(to('Capítulo 4')).toEqual({
      target: 'Capítulo 4',
      chapter: { id: fourth.id, source: 'srd51' },
      section: null
    })
    expect(to('Capítulo 4#Encuentros')).toMatchObject({ chapter: { id: fourth.id }, section: 'Encuentros' })
    expect(to(newer)).toMatchObject({ chapter: { id: other.id, source: 'srd521' }, section: null })
    expect(to(`${newer}#Capítulo 1`)).toMatchObject({ chapter: { id: other.id }, section: null })
    expect(to('#Arriba')).toMatchObject({ chapter: { id: intro.id }, section: 'Arriba' })
    expect(to('No existe')).toEqual({ target: 'No existe', chapter: null, section: null })
    // En una tabla, sin la barra escapada en el destino
    expect(to('Capítulo 4: Crear aventuras')).toMatchObject({ chapter: { id: fourth.id } })
    expect(read.links.some((l: { target: string }) => l.target.startsWith('@'))).toBe(false)

    // Desde una campaña que no tiene el otro libro, ese enlace no lleva a ningún sitio
    const worldId = (await ok200('createWorld', { name: 'Valdren' })).id
    const campaignId = (await ok200('createCampaign', { worldId, name: 'La Marca', system: five })).id
    await ok200('updateCampaign', { campaignId, systemChoices: { sources: ['srd51'], duplicates: 'both' } })
    const fromCampaign = await ok200('getChapter', { chapterId: intro.id, campaignId })
    expect(fromCampaign.links.find((l: { target: string }) => l.target === newer).chapter).toBeNull()
  })

  it('viajan con el sistema: exportar, importar, copiar y reemplazar', async () => {
    const five = await import5e()
    await ok200('saveChapter', { systemId: five, source: 'srd51', title: 'Uno', markdown: 'Primero.' })
    await ok200('saveChapter', { systemId: five, source: 'srd51', title: 'Dos', markdown: 'Segundo.' })
    await ok200('saveChapter', { systemId: five, source: 'srd521', title: 'Tres', markdown: 'Tercero.' })

    const exported = await ok200('exportSystem', { systemId: five })
    expect(exported.file.chapters).toEqual([
      { source: 'srd51', title: 'Uno', markdown: 'Primero.' },
      { source: 'srd51', title: 'Dos', markdown: 'Segundo.' },
      { source: 'srd521', title: 'Tres', markdown: 'Tercero.' }
    ])

    const imported = (await ok200('importSystem', { file: exported.file })).system.id
    expect(await titles(imported, 'srd51')).toEqual(['Uno', 'Dos'])
    expect(await titles(imported, 'srd521')).toEqual(['Tres'])

    const copy = (await ok200('createSystem', { name: 'Copia', from: five })).id
    expect(await titles(copy, 'srd51')).toEqual(['Uno', 'Dos'])

    // Importar encima de uno: sus capítulos pasan a ser los del archivo
    await ok200('importSystem', {
      file: { ...exported.file, chapters: [{ source: 'srd51', title: 'Solo', markdown: '' }] },
      into: { systemId: imported, version: (await ok200('getSystem', { systemId: imported })).version }
    })
    expect(await titles(imported, 'srd51')).toEqual(['Solo'])
    expect(await titles(imported, 'srd521')).toEqual([])

    // Un capítulo de un libro que no está en el archivo no vale
    expect(
      await code('importSystem', {
        file: { ...exported.file, chapters: [{ source: 'nada', title: 'X', markdown: '' }] }
      })
    ).toEqual({ status: 400, code: 'SYSTEM_INVALID' })
  }, 90_000)
})
