import { Readable } from 'node:stream'
import { connect, schema, trashRepo } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import type { FastifyInstance } from 'fastify'
import { unzipSync } from 'fflate'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { sweepStorage } from '../jobs/purges.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY, testDataDir } from '../testing.ts'
import { diskStorage, type Storage } from './storage.ts'

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined
const DAY = 24 * 60 * 60 * 1000
const LIMIT = 64 * 1024

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('un mapa')])
const PDF = Buffer.from('%PDF-1.7\nun libro')
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')

describe('los archivos del mundo', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let storage: Storage
  let owner: { userId: string; cookie: string }
  let organizationId: string
  let worldId: string

  const call = async (name: string, payload: object, cookie = owner.cookie) =>
    (
      await app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
    ).json()
  const upload = (name: string, body: Buffer | Readable, cookie = owner.cookie, world = worldId) =>
    app.inject({
      method: 'POST',
      url: `/api/files?worldId=${world}&name=${encodeURIComponent(name)}`,
      payload: body,
      headers: { origin: BASE_URL, cookie, 'content-type': 'application/octet-stream' }
    })
  const uploadCommon = (name: string, body: Buffer, cookie = owner.cookie) =>
    app.inject({
      method: 'POST',
      url: `/api/files?organizationId=${organizationId}&name=${encodeURIComponent(name)}`,
      payload: body,
      headers: { origin: BASE_URL, cookie, 'content-type': 'application/octet-stream' }
    })
  const download = (id: string, headers: Record<string, string> = {}, cookie = owner.cookie) =>
    app.inject({ method: 'GET', url: `/api/files/${id}`, headers: { cookie, ...headers } })

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_files'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    storage = diskStorage(testDataDir())
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY },
      storage,
      maxFileBytes: LIMIT
    })
    owner = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Fateforge' }).returning()
    organizationId = org?.id ?? ''
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: owner.userId, role: 'owner' })
    worldId = (await call('createWorld', { name: 'Eana' })).id
  })

  afterEach(async () => {
    await app.close()
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('subir: el tipo sale de los bytes, el nombre repetido lleva número y se sirve igual que se subió', async () => {
    const first = await upload('Mapa de Eana.png', PNG)
    expect(first.statusCode).toBe(201)
    expect(first.json()).toMatchObject({ name: 'Mapa de Eana.png', kind: 'image', mime: 'image/png', size: PNG.length })
    const again = await upload('mapa de eana.png', PNG)
    expect(again.json().name).toBe('mapa de eana (2).png')
    await upload('Bestiario.pdf', PDF)
    const { files } = await call('listFiles', { worldId })
    expect(files.map((f: { name: string }) => f.name).sort()).toEqual([
      'Bestiario.pdf',
      'Mapa de Eana.png',
      'mapa de eana (2).png'
    ])
    const served = await download(first.json().id)
    expect(served.statusCode).toBe(200)
    expect(served.rawPayload.equals(PNG)).toBe(true)
    expect(served.headers).toMatchObject({
      'content-type': 'image/png',
      'cache-control': 'private, max-age=0, stale-while-revalidate=604800',
      'x-content-type-options': 'nosniff'
    })
    expect(served.headers['content-disposition']).toContain('inline')
    // Con su versión en la dirección (la de la lista), se guarda sin volver a preguntar
    const listed = (await call('listFiles', { worldId })).files.find((f: { id: string }) => f.id === first.json().id)
    const cached = await app.inject({ method: 'GET', url: listed.url, headers: { cookie: owner.cookie } })
    expect(cached.headers['cache-control']).toBe('private, max-age=31536000, immutable')
    // Con la misma huella, no se vuelve a mandar
    expect((await download(first.json().id, { 'if-none-match': String(served.headers.etag) })).statusCode).toBe(304)
    // Y queda en el historial
    const { entries } = await call('listHistory', { worldId })
    expect(entries.map((e: { action: string }) => e.action)).toContain('uploadFile')
  })

  it('un trozo con Range (el visor de PDF lo usa)', async () => {
    const { id } = (await upload('Bestiario.pdf', PDF)).json()
    const part = await download(id, { range: 'bytes=0-4' })
    expect(part.statusCode).toBe(206)
    expect(part.body).toBe('%PDF-')
    expect(part.headers['content-range']).toBe(`bytes 0-4/${PDF.length}`)
    expect((await download(id, { range: 'bytes=-5' })).body).toBe('libro')
    expect((await download(id, { range: `bytes=${PDF.length}-` })).statusCode).toBe(416)
  })

  it('el SVG va con una CSP que no deja ejecutar nada; lo que no se admite (programas, scripts, páginas) no se sube', async () => {
    const svg = (await upload('Escudo.svg', SVG)).json()
    expect(svg).toMatchObject({ kind: 'image', mime: 'image/svg+xml' })
    const served = await download(svg.id)
    expect(served.headers['content-security-policy']).toContain('sandbox')
    expect(served.headers['content-security-policy']).toContain("default-src 'none'")
    // Un .png que es HTML, un programa o un script: no entran, ni queda nada de ellos
    for (const [name, body] of [
      ['trampa.png', Buffer.from('<html><script>alert(1)</script>')],
      ['instalar.exe', Buffer.from('MZ\x90\x00programa')],
      ['hola.js', Buffer.from('alert(1)')],
      ['notas.txt', Buffer.from([0x00, 0x01, 0x02])]
    ] as const) {
      const response = await upload(name, body)
      expect(response.statusCode, name).toBe(415)
      expect(response.json()).toEqual({ code: 'BAD_TYPE' })
    }
    expect((await call('listFiles', { worldId })).files.map((f: { name: string }) => f.name)).toEqual(['Escudo.svg'])
    // Texto, audio y vídeo, sí, con su tipo
    expect((await upload('notas.md', Buffer.from('# Sesión 3\nLos PJ llegan a Puerto Ceniza'))).json()).toMatchObject({
      kind: 'other',
      mime: 'text/markdown; charset=utf-8'
    })
    expect((await upload('tema.mp3', Buffer.from('ID3\x04\x00musica'))).json()).toMatchObject({ mime: 'audio/mpeg' })
  })

  it('un cuerpo que no es el archivo en crudo (JSON, texto) da 415 y no deja nada', async () => {
    const json = await app.inject({
      method: 'POST',
      url: `/api/files?worldId=${worldId}&name=a.png`,
      payload: { a: 1 },
      headers: { origin: BASE_URL, cookie: owner.cookie, 'content-type': 'application/json' }
    })
    expect(json.statusCode).toBe(415)
    expect(await storage.keys()).toEqual([])
  })

  it('el límite: si pasa, 413 y no queda nada, ni con el tamaño dicho ni sin él', async () => {
    const big = Buffer.alloc(LIMIT + 1, 1)
    expect((await upload('grande.bin', big)).statusCode).toBe(413)
    // Sin Content-Length (en streaming): se corta al pasarlo
    expect((await upload('grande.bin', Readable.from([big.subarray(0, LIMIT), big.subarray(LIMIT)]))).statusCode).toBe(
      413
    )
    expect(await storage.keys()).toEqual([])
    expect((await call('listFiles', { worldId })).files).toEqual([])
    // Justo en el límite, sí (un texto, de lo que se admite)
    expect((await upload('justo.txt', Buffer.alloc(LIMIT, 'a'))).statusCode).toBe(201)
  })

  it('con permiso: sin sesión 401; quien no ve la wiki ni sube ni descarga (404)', async () => {
    const { id } = (await upload('Mapa.png', PNG)).json()
    expect((await app.inject({ method: 'GET', url: `/api/files/${id}` })).statusCode).toBe(401)
    const outsider = await signUpTestUser(auth, { name: 'Otro', email: 'otro@crisol.test' })
    const [other] = await conn.db.insert(schema.organizations).values({ name: 'Otra' }).returning()
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: other?.id ?? '', userId: outsider.userId, role: 'owner' })
    expect((await download(id, {}, outsider.cookie)).statusCode).toBe(404)
    expect((await upload('Intruso.png', PNG, outsider.cookie)).statusCode).toBe(404)
    expect((await call('renameFile', { fileId: id, name: 'X.png' }, outsider.cookie)).code).toBe('NOT_FOUND')
    // Un jugador de una campaña del mundo tampoco ve la wiki (hasta el módulo 5)
    const player = await signUpTestUser(auth, { name: 'Lía', email: 'lia@crisol.test' })
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: player.userId, role: 'member' })
    const campaign = await call('createCampaign', { worldId, name: 'La Costa' })
    await conn.db
      .insert(schema.campaignMembers)
      .values({ campaignId: campaign.id, userId: player.userId, role: 'player' })
    expect((await download(id, {}, player.cookie)).statusCode).toBe(404)
  })

  it('reemplazar cambia los bytes y deshacerlo vuelve a los de antes', async () => {
    const { id } = (await upload('Mapa.png', PNG)).json()
    const replaced = await app.inject({
      method: 'PUT',
      url: `/api/files/${id}`,
      payload: PDF,
      headers: { origin: BASE_URL, cookie: owner.cookie, 'content-type': 'application/octet-stream' }
    })
    expect(replaced.json()).toMatchObject({ id, name: 'Mapa.png', kind: 'pdf', size: PDF.length })
    expect((await download(id)).rawPayload.equals(PDF)).toBe(true)
    const [last] = (await call('listHistory', { worldId })).entries
    expect(last.action).toBe('replaceFile')
    expect((await call('undoOperation', { operationId: last.id })).status).toBe('undone')
    expect((await download(id)).rawPayload.equals(PNG)).toBe(true)
  })

  it('renombrar: no se repite el nombre en el mundo', async () => {
    const map = (await upload('Mapa.png', PNG)).json()
    await upload('Bestiario.pdf', PDF)
    expect(await call('renameFile', { fileId: map.id, name: 'BESTIARIO.pdf' })).toMatchObject({ code: 'NAME_TAKEN' })
    expect(await call('renameFile', { fileId: map.id, name: 'Mapa del norte.png' })).toMatchObject({
      name: 'Mapa del norte.png'
    })
    expect(await call('renameFile', { fileId: map.id, name: 'otra/carpeta.png' })).toMatchObject({
      code: 'INVALID_INPUT'
    })
  })

  it('carpetas: se crean (también dentro de otra), se sube a una, se mueve un archivo y borrarla sube lo que tenía', async () => {
    const maps = await call('createFolder', { worldId, name: 'Mapas' })
    expect(maps).toMatchObject({ name: 'Mapas', parentId: null, worldId })
    const north = await call('createFolder', { worldId, parentId: maps.id, name: 'Norte' })
    expect(await call('createFolder', { worldId, parentId: maps.id, name: 'NORTE' })).toMatchObject({
      code: 'NAME_TAKEN'
    })
    // Subir a una carpeta
    const response = await app.inject({
      method: 'POST',
      url: `/api/files?worldId=${worldId}&folderId=${north.id}&name=Costa.png`,
      payload: PNG,
      headers: { origin: BASE_URL, cookie: owner.cookie, 'content-type': 'application/octet-stream' }
    })
    expect(response.json()).toMatchObject({ name: 'Costa.png', folderId: north.id })
    const shield = (await upload('Escudo.png', PNG)).json()
    expect(await call('moveFile', { fileId: shield.id, folderId: maps.id })).toMatchObject({ folderId: maps.id })
    // Ni dentro de sí misma, ni una carpeta de otro ámbito
    expect(await call('updateFolder', { folderId: maps.id, parentId: north.id })).toMatchObject({ code: 'CYCLE' })
    const common = await call('createFolder', { organizationId, name: 'Comunes' })
    expect(await call('moveFile', { fileId: shield.id, folderId: common.id })).toMatchObject({ code: 'BAD_FOLDER' })
    const listed = await call('listFiles', { worldId })
    expect(listed.folders.map((f: { name: string }) => f.name).sort()).toEqual(['Comunes', 'Mapas', 'Norte'])
    // Borrar «Mapas»: «Norte» y «Escudo.png» suben a lo más alto; se deshace con el historial
    expect(await call('deleteFolder', { folderId: maps.id })).toMatchObject({ name: 'Mapas' })
    const after = await call('listFiles', { worldId })
    expect(after.folders.find((f: { name: string }) => f.name === 'Norte')).toMatchObject({ parentId: null })
    expect(after.files.find((f: { name: string }) => f.name === 'Escudo.png')).toMatchObject({ folderId: null })
    const [last] = (await call('listHistory', { worldId })).entries
    expect(last).toMatchObject({ action: 'deleteFolder' })
    await call('undoOperation', { operationId: last.id })
    const undone = await call('listFiles', { worldId })
    expect(undone.files.find((f: { name: string }) => f.name === 'Escudo.png')).toMatchObject({ folderId: maps.id })
  })

  it('la papelera: borrado no se sirve, sale en la del mundo y vuelve; si su nombre ya está, con número', async () => {
    const { id } = (await upload('Mapa.png', PNG)).json()
    await call('deleteFile', { fileId: id })
    expect((await download(id)).statusCode).toBe(404)
    expect((await call('listTrash', { worldId })).items).toMatchObject([{ kind: 'file', id, name: 'Mapa.png' }])
    // Otro ocupa su nombre mientras tanto
    await upload('Mapa.png', PDF)
    expect(await call('restoreFile', { fileId: id })).toEqual({ id, name: 'Mapa (2).png' })
    expect((await download(id)).rawPayload.equals(PNG)).toBe(true)
    expect((await call('listTrash', { worldId })).items).toEqual([])
  })

  it('la purga: a los 30 días se va la fila; los bytes, cuando ni el historial los nombra', async () => {
    const { id } = (await upload('Mapa.png', PNG)).json()
    await call('deleteFile', { fileId: id })
    const [key] = await storage.keys()
    // A los 31 días se va la fila, pero el historial aún lo nombra (deshacer lo necesitaría)
    const in31 = new Date(Date.now() + 31 * DAY)
    expect(await trashRepo.purge(conn.db, in31)).toMatchObject({ files: 1 })
    expect(await sweepStorage(conn.db, storage, in31)).toBe(0)
    // A los 91, ya no: se van los bytes
    const in91 = new Date(Date.now() + 91 * DAY)
    await trashRepo.purge(conn.db, in91)
    expect(await sweepStorage(conn.db, storage, in91)).toBe(1)
    expect((await storage.keys()).map((k) => k.key)).not.toContain(key?.key)
  })

  it('en las páginas: lo que espera a un archivo por su nombre se resuelve al subirlo; renombrarlo no lo rompe', async () => {
    // Claude escribe antes de que esté el archivo
    const [page] = (
      await call('createPages', {
        worldId,
        parentId: null,
        pages: [{ key: 'a', title: 'Eana', markdown: 'El mapa:\n\n![[Mapa de Eana.png|El continente|300]]\n*Eana*' }]
      })
    ).pages
    const embeds = () => conn.sql`select file_id, name from file_embeds where source_page_id = ${page.id}`
    expect(await embeds()).toMatchObject([{ file_id: null, name: 'Mapa de Eana.png' }])
    // Al subirlo (con otras mayúsculas), se resuelve: en la tabla y en el texto
    const { id } = (await upload('mapa de eana.png', PNG)).json()
    expect(await embeds()).toMatchObject([{ file_id: id }])
    expect((await call('listFiles', { worldId })).files).toMatchObject([{ id, usedBy: 1 }])
    // Renombrarlo: la página lo sigue usando y su Markdown dice el nombre nuevo
    await call('renameFile', { fileId: id, name: 'Mapa del continente.png' })
    const read = await call('readPage', { pageId: page.id })
    expect(read.markdown).toContain('![[Mapa del continente.png|El continente|300]]\n*Eana*')
    // Lo que escribe Claude después, con el archivo ya subido, va resuelto desde el principio
    await call('editPage', { pageId: page.id, body: { mode: 'append', markdown: '![[MAPA DEL CONTINENTE.png]]' } })
    expect((await embeds()).map((row) => row.file_id)).toEqual([id, id])
    expect((await call('listFiles', { worldId })).files[0].usedBy).toBe(1)
    // Una página en la papelera no cuenta
    await call('deletePage', { pageId: page.id })
    expect((await call('listFiles', { worldId })).files[0].usedBy).toBe(0)
  })

  it('exportar lleva los archivos en _archivos/: el mundo, todos; una página, los que usa', async () => {
    await upload('Mapa.png', PNG)
    await upload('Bestiario.pdf', PDF)
    const [page] = (
      await call('createPages', {
        worldId,
        parentId: null,
        pages: [{ key: 'a', title: 'Eana', markdown: '![[Mapa.png|300]]' }]
      })
    ).pages
    const exported = async (payload: object) => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/export',
        payload,
        headers: { origin: BASE_URL, cookie: owner.cookie }
      })
      expect(response.statusCode).toBe(200)
      return unzipSync(new Uint8Array(response.rawPayload))
    }
    const world = await exported({ worldId })
    expect(Object.keys(world).sort()).toEqual(['Eana.md', '_archivos/Bestiario.pdf', '_archivos/Mapa.png'])
    expect(Buffer.from(world['_archivos/Mapa.png'] ?? []).equals(PNG)).toBe(true)
    expect(Buffer.from(world['Eana.md'] ?? []).toString()).toContain('![[Mapa.png|300]]')
    const one = await exported({ worldId, pageId: page.id })
    expect(Object.keys(one).sort()).toEqual(['Eana.md', '_archivos/Mapa.png'])
  })

  it('la portada: una imagen del mundo con su encuadre; cuenta como uso, se deshace y no vale otra cosa', async () => {
    const map = (await upload('Mapa.png', PNG)).json()
    const book = (await upload('Bestiario.pdf', PDF)).json()
    const page = await call('createPage', { worldId, title: 'Puerto Ceniza' })
    const cover = { fileId: map.id, x: 50, y: 20 }
    expect(await call('updatePage', { pageId: page.id, cover })).toMatchObject({ cover })
    expect((await call('listFiles', { worldId })).files.find((f: { id: string }) => f.id === map.id).usedBy).toBe(1)
    expect(await call('updatePage', { pageId: page.id, cover: { ...cover, fileId: book.id } })).toMatchObject({
      code: 'BAD_COVER'
    })
    const [last] = (await call('listHistory', { worldId })).entries
    expect(last).toMatchObject({ action: 'updatePage', details: { cover: true } })
    await call('undoOperation', { operationId: last.id })
    expect((await call('getPage', { pageId: page.id })).cover).toBeNull()
  })

  describe('los comunes de la cuenta (ADR-0005)', () => {
    it('se suben a la organización y los ven todos sus mundos, marcados; el nombre no se repite entre ellos', async () => {
      const common = await uploadCommon('Escudo.png', PNG)
      expect(common.statusCode).toBe(201)
      expect(common.json()).toMatchObject({ name: 'Escudo.png', worldId: null, organizationId })
      expect((await uploadCommon('escudo.png', PNG)).json().name).toBe('escudo (2).png')
      // Un archivo del mundo puede llamarse igual: es otro ámbito
      expect((await upload('Escudo.png', PDF)).json().name).toBe('Escudo.png')
      const zafiro = (await call('createWorld', { name: 'Zafiro' })).id
      const inZafiro = (await call('listFiles', { worldId: zafiro })).files
      expect(inZafiro.map((f: { name: string; worldId: string | null }) => [f.name, f.worldId]).sort()).toEqual([
        ['Escudo.png', null],
        ['escudo (2).png', null]
      ])
      // En Eana, el suyo y los dos comunes
      const inEana = (await call('listFiles', { worldId })).files
      expect(inEana.filter((f: { worldId: string | null }) => f.worldId === null)).toHaveLength(2)
      expect(inEana.filter((f: { worldId: string | null }) => f.worldId === worldId)).toHaveLength(1)
      expect((await call('listCommonFiles', {})).files).toHaveLength(2)
      expect((await download(common.json().id)).rawPayload.equals(PNG)).toBe(true)
    })

    it('`![[nombre]]` usa el común si el mundo no tiene uno así; si lo tiene, el del mundo', async () => {
      const zafiro = (await call('createWorld', { name: 'Zafiro' })).id
      const [waiting] = (
        await call('createPages', {
          worldId: zafiro,
          parentId: null,
          pages: [{ key: 'a', title: 'Zafiro', markdown: '![[Escudo.png]]' }]
        })
      ).pages
      // Subir el común resuelve lo que lo esperaba en cualquier mundo de la organización
      const common = (await uploadCommon('Escudo.png', PNG)).json()
      const embedOf = async (pageId: string) =>
        (await conn.sql`select file_id from file_embeds where source_page_id = ${pageId}`)[0]?.file_id
      expect(await embedOf(waiting.id)).toBe(common.id)
      // En Eana hay uno del mundo con el mismo nombre: gana el del mundo
      const own = (await upload('Escudo.png', PDF)).json()
      const [page] = (
        await call('createPages', {
          worldId,
          parentId: null,
          pages: [{ key: 'a', title: 'Eana', markdown: '![[Escudo.png]]' }]
        })
      ).pages
      expect(await embedOf(page.id)).toBe(own.id)
      // Sus usos se cuentan en todos los mundos
      expect((await call('listCommonFiles', {})).files).toMatchObject([{ id: common.id, usedBy: 1 }])
    })

    it('una portada (de un mundo o de una página) puede ser común', async () => {
      const common = (await uploadCommon('Escudo.png', PNG)).json()
      const cover = { fileId: common.id, x: 40, y: 60, zoom: 1.5 }
      expect(await call('updateWorld', { worldId, cover })).toMatchObject({ cover })
      const page = await call('createPage', { worldId, title: 'Puerto Ceniza' })
      expect(await call('updatePage', { pageId: page.id, cover })).toMatchObject({ cover })
    })

    it('el máster de un mundo los ve pero no los sube; nadie de otra organización los ve', async () => {
      const common = (await uploadCommon('Escudo.png', PNG)).json()
      const master = await signUpTestUser(auth, { name: 'Iria', email: 'iria@crisol.test' })
      await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: master.userId, role: 'member' })
      await conn.db.insert(schema.worldMembers).values({ worldId, userId: master.userId, role: 'master' })
      expect((await download(common.id, {}, master.cookie)).statusCode).toBe(200)
      expect((await uploadCommon('Otro.png', PNG, master.cookie)).statusCode).toBe(403)
      const outsider = await signUpTestUser(auth, { name: 'Otro', email: 'otro@crisol.test' })
      expect((await download(common.id, {}, outsider.cookie)).statusCode).toBe(404)
      expect((await uploadCommon('Intruso.png', PNG, outsider.cookie)).statusCode).toBe(404)
    })

    it('borrado va a la papelera de la cuenta, sin mundo, y vuelve', async () => {
      const { id } = (await uploadCommon('Escudo.png', PNG)).json()
      await call('deleteFile', { fileId: id })
      expect((await call('listTrash', {})).items).toMatchObject([
        { kind: 'file', id, name: 'Escudo.png', worldId: null, worldName: null }
      ])
      expect((await call('listTrash', { worldId })).items).toEqual([])
      expect(await call('restoreFile', { fileId: id })).toEqual({ id, name: 'Escudo.png' })
      expect((await call('listCommonFiles', {})).files).toHaveLength(1)
    })

    it('exportar un mundo lleva los comunes que usa (con el mismo nombre, el del mundo)', async () => {
      await uploadCommon('Escudo.png', PNG)
      await uploadCommon('Sin usar.png', PNG)
      await call('createPages', {
        worldId,
        parentId: null,
        pages: [{ key: 'a', title: 'Eana', markdown: '![[Escudo.png]]' }]
      })
      const response = await app.inject({
        method: 'POST',
        url: '/api/export',
        payload: { worldId },
        headers: { origin: BASE_URL, cookie: owner.cookie }
      })
      const zip = unzipSync(new Uint8Array(response.rawPayload))
      expect(Object.keys(zip).sort()).toEqual(['Eana.md', '_archivos/Escudo.png'])
    })
  })

  it('el nombre que viene del disco con lo que rompe `![[…]]` se sube con «-»', async () => {
    expect((await upload('mapa [v2] #1.png', PNG)).json().name).toBe('mapa -v2- -1.png')
  })

  it('lo recién escrito sin fila (una subida a medias) no se toca', async () => {
    await storage.write(worldId, Readable.from([PNG]), LIMIT)
    expect(await sweepStorage(conn.db, storage, new Date())).toBe(0)
  })
})
