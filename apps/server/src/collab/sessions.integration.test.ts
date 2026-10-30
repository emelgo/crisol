import { connect, documentsRepo, schema, versionsRepo } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { BODY_FIELD, editorSchema } from '@crisol/editor'
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider'
import { prosemirrorJSONToYDoc } from '@tiptap/y-tiptap'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined

/** Hasta que se cumpla, o falla a los 8 s */
async function until<T>(check: () => Promise<T> | T, done: (value: T) => boolean, what: string): Promise<T> {
  const deadline = Date.now() + 8000
  for (;;) {
    const value = await check()
    if (done(value)) return value
    if (Date.now() > deadline) throw new Error(`No llegó: ${what} (${JSON.stringify(value)})`)
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

type Entry = { id: string; action: string; actor: { name: string } | null; details: Record<string, unknown> }

describe('las sesiones de edición y las versiones', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let url: string
  let owner: { userId: string; cookie: string }
  let organizationId: string
  let worldId: string
  const open: Array<{ destroy(): void }> = []

  const call = async (name: string, payload: object, cookie = owner.cookie) =>
    (
      await app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
    ).json()
  const edits = async () =>
    ((await call('listHistory', { worldId })).entries as Entry[]).filter((e) => e.action === 'editPage')

  /** Un cliente de Hocuspocus como el de la web, con la sesión de una cuenta */
  const client = (name: string, cookie = owner.cookie) => {
    const document = new Y.Doc()
    const events = { synced: false }
    class WithSession extends WebSocket {
      constructor(address: string | URL, protocols?: string | string[]) {
        super(address, { headers: { cookie, origin: BASE_URL }, ...(protocols ? { protocols } : {}) } as never)
      }
    }
    const socket = new HocuspocusProviderWebsocket({ url, WebSocketPolyfill: WithSession, maxAttempts: 1 })
    const provider = new HocuspocusProvider({
      websocketProvider: socket,
      name,
      document,
      token: 'sesion',
      onSynced: () => {
        events.synced = true
      }
    })
    provider.attach()
    const handle = {
      document,
      events,
      /** Escribe un párrafo al final, como el editor */
      write: (text: string) =>
        document.transact(() => {
          const paragraph = new Y.XmlElement('paragraph')
          paragraph.insert(0, [new Y.XmlText(text)])
          document.getXmlFragment(BODY_FIELD).push([paragraph])
        }),
      text: () => document.getXmlFragment(BODY_FIELD).toString(),
      destroy: () => {
        provider.destroy()
        socket.destroy()
      }
    }
    open.push(handle)
    return handle
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_sessions'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY },
      sessionTimes: { idleMs: 400, maxMs: 5000 }
    })
    await app.listen({ host: '127.0.0.1', port: 0 })
    const address = app.server.address()
    url = `ws://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/collab`
    owner = await signUpTestUser(auth, { name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(schema.organizations).values({ name: 'Fateforge' }).returning()
    organizationId = org?.id ?? ''
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: owner.userId, role: 'owner' })
    worldId = (await call('createWorld', { name: 'Eana' })).id
  })

  afterEach(async () => {
    for (const handle of open.splice(0)) handle.destroy()
    await app.close()
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('los cambios de una cuenta se agrupan en una sesión: al quedarse quieta, una entrada editPage y una versión', async () => {
    const page = await call('createPage', { worldId, title: 'Puerto Ceniza' })
    const editor = client(`page:${page.id}`)
    await until(() => editor.events.synced, Boolean, 'la sincronización')
    editor.write('Uno.')
    editor.write('Dos.')
    editor.write('Tres.')
    const entries = await until(edits, (e) => e.length > 0, 'la sesión cerrada')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ actor: { name: 'Enrique' }, details: { title: 'Puerto Ceniza' } })
    expect(await versionsRepo.listVersions(conn.db, page.id)).toHaveLength(1)
    const body = await versionsRepo.pageBody(conn.db, page.id)
    expect(body?.versionId).toBeTruthy()
    // En el historial solo hay ids y huellas, nunca el texto
    const changes = await conn.sql`select before, after from changes where table_name = 'page_bodies'`
    expect(JSON.stringify(changes)).not.toContain('Uno.')
  })

  it('dos cuentas a la vez, cada una su sesión; Claude cierra antes las abiertas y deja la suya', async () => {
    const other = await signUpTestUser(auth, { name: 'Lía', email: 'lia@crisol.test' })
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: other.userId, role: 'member' })
    await conn.db.insert(schema.worldMembers).values({ worldId, userId: other.userId, role: 'master' })
    const page = await call('createPage', { worldId, title: 'Puerto Ceniza' })
    const mine = client(`page:${page.id}`)
    const hers = client(`page:${page.id}`, other.cookie)
    await until(() => mine.events.synced && hers.events.synced, Boolean, 'la sincronización')
    mine.write('Del máster.')
    hers.write('De Lía.')
    // Antes de que se queden quietas, escribe Claude: primero se cierran las dos
    await call('editPage', { pageId: page.id, body: { mode: 'append', markdown: 'De Claude.' } })
    // Del más reciente al más antiguo: lo de Claude, y antes la sesión que se cerró primero. Una versión es de toda
    // la página: esa lleva lo de las dos cuentas, y la otra ya no tiene nada nuevo que apuntar
    const entries = await edits()
    expect(entries[0]?.details).toMatchObject({ body: 'append' })
    const sessions = entries.slice(1)
    expect(sessions.length).toBeGreaterThanOrEqual(1)
    for (const entry of sessions) expect(['Enrique', 'Lía']).toContain(entry.actor?.name)
    // Nada se pierde: lo de los tres está en el texto y en la última versión
    const read = (await call('readPage', { pageId: page.id })).markdown as string
    for (const text of ['Del máster.', 'De Lía.', 'De Claude.']) expect(read).toContain(text)
    expect((await versionsRepo.listVersions(conn.db, page.id)).length).toBe(entries.length)
  })

  it('deshacer lo de Claude con un editor abierto: vuelve lo de antes, hacia delante, y lo viejo no reaparece', async () => {
    const page = await call('createPage', { worldId, title: 'Puerto Ceniza' })
    const editor = client(`page:${page.id}`)
    await until(() => editor.events.synced, Boolean, 'la sincronización')
    editor.write('Antes.')
    await until(edits, (e) => e.length === 1, 'la sesión del máster')
    await call('editPage', { pageId: page.id, body: { mode: 'replace', markdown: 'Después.' } })
    await until(
      () => editor.text(),
      (t) => t.includes('Después.') && !t.includes('Antes.'),
      'lo de Claude en vivo'
    )
    const [claude] = await edits()
    expect((await call('undoOperation', { operationId: claude?.id })).status).toBe('undone')
    await until(
      () => editor.text(),
      (t) => t.includes('Antes.') && !t.includes('Después.'),
      'lo de antes en vivo'
    )
    // Un rato después sigue así (el editor abierto no lo vuelve atrás) y así se guarda
    await new Promise((resolve) => setTimeout(resolve, 2600))
    expect(editor.text()).toContain('Antes.')
    expect(editor.text()).not.toContain('Después.')
    const stored = await documentsRepo.findBody(conn.db, page.id)
    const doc = new Y.Doc()
    if (stored) Y.applyUpdate(doc, stored.state)
    expect(doc.getXmlFragment(BODY_FIELD).toString()).toContain('Antes.')
    expect(doc.getXmlFragment(BODY_FIELD).toString()).not.toContain('Después.')
  })

  it('si alguien escribió después, deshacer dice quién y no toca nada', async () => {
    const page = await call('createPage', { worldId, title: 'Puerto Ceniza' })
    await call('editPage', { pageId: page.id, body: { mode: 'append', markdown: 'De Claude.' } })
    const [claude] = await edits()
    const editor = client(`page:${page.id}`)
    await until(() => editor.events.synced, Boolean, 'la sincronización')
    editor.write('Del máster, después.')
    await until(edits, (e) => e.length === 2, 'la sesión del máster')
    const undo = await call('undoOperation', { operationId: claude?.id })
    expect(undo).toMatchObject({ status: 'conflict', by: { action: 'editPage', actor: { name: 'Enrique' } } })
    expect(editor.text()).toContain('De Claude.')
  })

  it('si el servidor se paró con una sesión abierta, al volver a abrir la página se cierra a nombre del último', async () => {
    const page = await call('createPage', { worldId, title: 'Puerto Ceniza' })
    // Lo guardado sin versión: como si se hubiera parado antes de cerrar la sesión
    const json = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sin versión.' }] }] }
    const state = Y.encodeStateAsUpdate(prosemirrorJSONToYDoc(editorSchema(), json, BODY_FIELD))
    await documentsRepo.mergeBody(conn.db, { pageId: page.id, worldId, userId: owner.userId }, () => state)
    const editor = client(`page:${page.id}`)
    await until(() => editor.events.synced, Boolean, 'la sincronización')
    const entries = await until(edits, (e) => e.length === 1, 'la sesión recuperada')
    expect(entries[0]?.actor?.name).toBe('Enrique')
    // Al volver a abrirla, ya no hay nada que recuperar
    editor.destroy()
    const again = client(`page:${page.id}`)
    await until(() => again.events.synced, Boolean, 'la sincronización')
    await new Promise((resolve) => setTimeout(resolve, 500))
    expect(await edits()).toHaveLength(1)
  })
})
