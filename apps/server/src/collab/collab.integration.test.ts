import { connect, documentsRepo, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { editorSchema } from '@crisol/editor'
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider'
import { prosemirrorJSONToYXmlFragment } from '@tiptap/y-tiptap'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined

/** Hasta que se cumpla, o falla a los 5 s */
async function until(check: () => boolean | Promise<boolean>, what: string) {
  const deadline = Date.now() + 5000
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(`No llegó: ${what}`)
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

describe('la edición en vivo (/api/collab)', () => {
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

  /** Un cliente de Hocuspocus como el de la web: con la cookie de la sesión y nuestro origen */
  const client = (name: string, cookie = owner.cookie, origin = BASE_URL) => {
    const document = new Y.Doc()
    const events = { synced: false, failed: '' as string, closed: 0 }
    class WithSession extends WebSocket {
      constructor(address: string | URL, protocols?: string | string[]) {
        super(address, { headers: { cookie, origin }, ...(protocols ? { protocols } : {}) } as never)
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
      },
      onAuthenticationFailed: ({ reason }) => {
        events.failed = reason
      },
      onClose: () => {
        events.closed++
      }
    })
    // Con el WebSocket compartido (como en la web, un solo socket para todos los documentos), cada uno se engancha
    provider.attach()
    const handle = {
      document,
      provider,
      events,
      text: () => document.getText('texto').toString(),
      destroy: () => {
        provider.destroy()
        socket.destroy()
      }
    }
    open.push(handle)
    return handle
  }
  const stored = async (pageId: string) => {
    const body = await documentsRepo.findBody(conn.db, pageId)
    if (!body) return ''
    const document = new Y.Doc()
    Y.applyUpdate(document, body.state)
    return document.getText('texto').toString()
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_collab'), { max: 4 })
  })

  beforeEach(async () => {
    await resetDatabase(conn.sql)
    auth = createTestAuth(conn.db, BASE_URL)
    app = buildApp({
      checks: { postgres: ok, valkey: ok },
      accounts: { auth, db: conn.db, publicUrl: BASE_URL, sealKey: TEST_SEAL_KEY }
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

  it('dos pestañas del máster editan el mismo cuerpo y convergen; al cerrarlas queda guardado', async () => {
    const page = await call('createPage', { worldId, title: 'Puerto Ceniza' })
    const a = client(`page:${page.id}`)
    const b = client(`page:${page.id}`)
    await until(() => a.events.synced && b.events.synced, 'la sincronización')
    a.document.getText('texto').insert(0, 'Puerto Ceniza es la última ciudad libre.')
    await until(() => b.text().includes('última ciudad'), 'el cambio en la otra pestaña')
    b.document.getText('texto').insert(b.text().length, ' La gobierna el Consejo.')
    await until(() => a.text().endsWith('Consejo.'), 'el cambio de vuelta')
    a.destroy()
    b.destroy()
    await until(async () => (await stored(page.id)) === a.text(), 'el guardado al cerrar')

    const again = client(`page:${page.id}`)
    await until(() => again.events.synced, 'volver a abrirla')
    expect(again.text()).toBe('Puerto Ceniza es la última ciudad libre. La gobierna el Consejo.')
  })

  it('guardar es fusionar: lo que ya estaba guardado no se pierde aunque el editor no lo tuviera', async () => {
    const page = await call('createPage', { worldId, title: 'Puerto Ceniza' })
    const editor = client(`page:${page.id}`)
    await until(() => editor.events.synced, 'la sincronización')
    // Otro cambio guardado por fuera mientras tanto (como lo que aplica el servidor por Claude)
    const outside = new Y.Doc()
    outside.getText('texto').insert(0, '[de fuera] ')
    await documentsRepo.mergeBody(conn.db, { pageId: page.id, worldId, userId: owner.userId }, (state) =>
      state ? Y.mergeUpdates([state, Y.encodeStateAsUpdate(outside)]) : Y.encodeStateAsUpdate(outside)
    )
    editor.document.getText('texto').insert(0, 'Del editor.')
    editor.destroy()
    await until(async () => (await stored(page.id)).includes('Del editor.'), 'el guardado')
    expect(await stored(page.id)).toContain('[de fuera]')
  })

  it('un jugador no abre ningún documento de la wiki', async () => {
    const page = await call('createPage', { worldId, title: 'Puerto Ceniza' })
    const campaign = await call('createCampaign', { worldId, name: 'La Marca' })
    const player = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: player.userId, role: 'member' })
    await conn.db
      .insert(schema.campaignMembers)
      .values({ campaignId: campaign.id, userId: player.userId, role: 'player' })
    const writer = client(`page:${page.id}`)
    await until(() => writer.events.synced, 'la sincronización del máster')
    writer.document.getText('texto').insert(0, 'El secreto del faro.')

    const spy = client(`page:${page.id}`, player.cookie)
    await until(() => spy.events.failed !== '', 'el rechazo')
    expect(spy.events.synced).toBe(false)
    expect(spy.text()).toBe('')
  })

  it('una jugadora escribe en vivo en la página que su campaña puede editar (y en otra, no; ni tras quitárselo)', async () => {
    const diary = await call('createPage', { worldId, title: 'Diario de la compañía' })
    const other = await call('createPage', { worldId, title: 'Puerto Ceniza' })
    const campaign = await call('createCampaign', { worldId, name: 'La Marca' })
    const player = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: player.userId, role: 'member' })
    await conn.db
      .insert(schema.campaignMembers)
      .values({ campaignId: campaign.id, userId: player.userId, role: 'player' })
    await call('setPageEditors', { worldId, campaignId: campaign.id, pageId: diary.id, editors: 'all' })

    const master = client(`page:${diary.id}`)
    const writer = client(`page:${diary.id}`, player.cookie)
    await until(() => writer.events.synced && master.events.synced, 'las dos sincronizaciones')
    writer.document.getText('texto').insert(0, 'Día 1: llegamos al faro.')
    await until(() => master.text() === 'Día 1: llegamos al faro.', 'lo de la jugadora, en vivo')

    const elsewhere = client(`page:${other.id}`, player.cookie)
    await until(() => elsewhere.events.failed !== '', 'el rechazo en otra página')
    expect(elsewhere.events.synced).toBe(false)

    // Sin permiso, se le cierra; al volver, no entra
    await call('setPageEditors', { worldId, campaignId: campaign.id, pageId: diary.id, editors: null })
    await until(() => writer.events.closed > 0, 'el cierre')
    const again = client(`page:${diary.id}`, player.cookie)
    await until(() => again.events.failed !== '', 'el rechazo al volver')
  })

  it('si se le oculta la página o sale de la campaña, se le cierra y no vuelve a entrar', async () => {
    const diary = await call('createPage', { worldId, title: 'Diario' })
    const campaign = await call('createCampaign', { worldId, name: 'La Marca' })
    const player = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: player.userId, role: 'member' })
    await conn.db
      .insert(schema.campaignMembers)
      .values({ campaignId: campaign.id, userId: player.userId, role: 'player' })
    await call('setPageEditors', { worldId, campaignId: campaign.id, pageId: diary.id, editors: 'all' })
    const first = client(`page:${diary.id}`, player.cookie)
    await until(() => first.events.synced, 'la primera conexión')
    await call('hide', { campaignId: campaign.id, kind: 'page', targetId: diary.id })
    await until(() => first.events.closed > 0, 'el cierre al ocultarla')
    const hidden = client(`page:${diary.id}`, player.cookie)
    await until(() => hidden.events.failed !== '', 'el rechazo con la página oculta')

    await call('setKnowledge', { worldId, campaignId: campaign.id, kind: 'page', targetId: diary.id, known: true })
    const second = client(`page:${diary.id}`, player.cookie)
    await until(() => second.events.synced, 'la segunda conexión')
    await call('removeMember', { campaignId: campaign.id, userId: player.userId })
    await until(() => second.events.closed > 0, 'el cierre al sacarla')
    const gone = client(`page:${diary.id}`, player.cookie)
    await until(() => gone.events.failed !== '', 'el rechazo fuera de la campaña')
  })

  it('un nombre que no es de ningún documento, o una página que no existe, no se abren', async () => {
    const unknown = client(`page:${crypto.randomUUID()}`)
    await until(() => unknown.events.failed !== '', 'el rechazo')
    expect(unknown.events.synced).toBe(false)
  })

  it('desde otro origen no se conecta, aunque traiga la cookie', async () => {
    const page = await call('createPage', { worldId, title: 'Puerto Ceniza' })
    const foreign = client(`page:${page.id}`, owner.cookie, 'https://otra.test')
    await until(() => foreign.events.closed > 0, 'el cierre')
    expect(foreign.events.synced).toBe(false)
  })

  it('un cambio de más de 1 MB corta la conexión y no se guarda', async () => {
    const page = await call('createPage', { worldId, title: 'Puerto Ceniza' })
    const editor = client(`page:${page.id}`)
    await until(() => editor.events.synced, 'la sincronización')
    editor.document.getText('texto').insert(0, 'x'.repeat(1_200_000))
    await until(() => editor.events.closed > 0, 'el cierre')
    editor.destroy()
    expect(await stored(page.id)).toBe('')
  })

  it('al mandar la página a la papelera se cierra quien la edita, y ya no se abre', async () => {
    const page = await call('createPage', { worldId, title: 'Puerto Ceniza' })
    const editor = client(`page:${page.id}`)
    await until(() => editor.events.synced, 'la sincronización')
    await call('deletePage', { pageId: page.id })
    await until(() => editor.events.closed > 0, 'el cierre')
    const again = client(`page:${page.id}`)
    await until(() => again.events.failed !== '', 'el rechazo al volver')
  })

  it('lo que escribe Claude entra en vivo en la página abierta, con los bloques que hay que resaltar', async () => {
    const page = await call('createPage', { worldId, title: 'Puerto Ceniza' })
    const editor = client(`page:${page.id}`)
    const stateless: string[] = []
    editor.provider.on('stateless', ({ payload }: { payload: string }) => stateless.push(payload))
    await until(() => editor.events.synced, 'la sincronización')
    const result = await call('editPage', {
      pageId: page.id,
      body: { mode: 'append', markdown: 'Escrito por Claude.\n\n> [!secreto]\n> Solo para el máster.' }
    })
    expect(result.changedBlocks, JSON.stringify(result)).toHaveLength(2)
    const fragment = () => editor.document.getXmlFragment('default').toString()
    await until(() => fragment().includes('Escrito por Claude.'), 'el cambio en vivo')
    // El secreto, aparte: en el cuerpo vivo solo su bloque
    expect(fragment()).not.toContain('Solo para el máster')
    await until(() => stateless.length > 0, 'el aviso para resaltar')
    expect(JSON.parse(stateless[0] ?? '{}')).toEqual({ type: 'ai', blocks: result.changedBlocks })
  })

  describe('secretos y notas ocultas', () => {
    const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
    /** Escribe un contenido de ProseMirror en el fragmento del documento (como hace el editor) */
    const write = (document: Y.Doc, content: object[], nested = false) =>
      prosemirrorJSONToYXmlFragment(
        editorSchema({ nested }),
        { type: 'doc', content },
        document.getXmlFragment('default')
      )
    const raw = async (name: 'body' | string, pageId: string) => {
      const row =
        name === 'body'
          ? await documentsRepo.findBody(conn.db, pageId)
          : await documentsRepo.findSeparate(conn.db, name)
      return Buffer.from(row?.state ?? new Uint8Array())
    }

    it('el texto de un secreto se guarda en su documento y nunca en el del cuerpo', async () => {
      const page = await call('createPage', { worldId, title: 'Puerto Ceniza' })
      const { id } = await call('createPageDocument', { pageId: page.id, kind: 'secret' })
      const secret = client(`doc:${id}`)
      const body = client(`page:${page.id}`)
      await until(() => secret.events.synced && body.events.synced, 'la sincronización')
      write(secret.document, [paragraph('El faro lo quemó la Hermandad.')], true)
      write(body.document, [
        paragraph('Puerto Ceniza es la última ciudad libre.'),
        { type: 'secret', attrs: { documentId: id } },
        paragraph('La gobierna el Consejo.')
      ])
      secret.destroy()
      body.destroy()
      await until(async () => (await raw(id, page.id)).includes('Hermandad'), 'el guardado del secreto')
      await until(async () => (await raw('body', page.id)).includes('Consejo'), 'el guardado del cuerpo')
      const stored = await raw('body', page.id)
      expect(stored.includes('Hermandad')).toBe(false)
      expect(stored.includes(id)).toBe(true)
    })

    it('dos secretos y otra pestaña escribiendo a la vez: todo converge y cada texto queda en su sitio', async () => {
      const page = await call('createPage', { worldId, title: 'Puerto Ceniza' })
      const one = (await call('createPageDocument', { pageId: page.id, kind: 'secret' })).id
      const two = (await call('createPageDocument', { pageId: page.id, kind: 'note' })).id
      const a = [client(`page:${page.id}`), client(`doc:${one}`), client(`doc:${two}`)]
      const b = [client(`page:${page.id}`), client(`doc:${one}`), client(`doc:${two}`)]
      await until(() => [...a, ...b].every((c) => c.events.synced), 'la sincronización')
      write(a[0]?.document as Y.Doc, [
        { type: 'secret', attrs: { documentId: one } },
        { type: 'note', attrs: { documentId: two } }
      ])
      // Mientras, la otra pestaña escribe en los dos secretos y añade al cuerpo
      write(b[1]?.document as Y.Doc, [paragraph('Primer secreto.')], true)
      write(b[2]?.document as Y.Doc, [paragraph('Nota para el máster.')], true)
      b[0]?.document.getXmlFragment('default').insert(0, [new Y.XmlElement('paragraph')])
      const fragment = (doc: Y.Doc | undefined) => doc?.getXmlFragment('default').toString() ?? ''
      await until(() => fragment(a[1]?.document).includes('Primer secreto.'), 'el primer secreto')
      await until(() => fragment(a[2]?.document).includes('Nota para el máster.'), 'la nota')
      await until(() => fragment(a[0]?.document) === fragment(b[0]?.document), 'el cuerpo igual en las dos')
      expect(fragment(a[0]?.document)).toContain(`documentId="${one}"`)
      for (const c of [...a, ...b]) c.destroy()
      await until(async () => (await raw(one, page.id)).includes('Primer secreto.'), 'el guardado')
      expect((await raw('body', page.id)).includes('Primer secreto.')).toBe(false)
    })

    it('copiar un secreto crea otro documento con el mismo texto; de otra organización, no', async () => {
      const page = await call('createPage', { worldId, title: 'Puerto Ceniza' })
      const other = await call('createPage', { worldId, title: 'Velaria' })
      const { id } = await call('createPageDocument', { pageId: page.id, kind: 'secret' })
      const secret = client(`doc:${id}`)
      await until(() => secret.events.synced, 'la sincronización')
      write(secret.document, [paragraph('El mapa de las corrientes.')], true)
      secret.destroy()
      await until(async () => (await raw(id, page.id)).includes('corrientes'), 'el guardado')
      const copy = await call('createPageDocument', { pageId: other.id, kind: 'secret', copyOf: id })
      expect(copy.id).not.toBe(id)
      expect((await raw(copy.id, other.id)).includes('corrientes')).toBe(true)

      const stranger = await signUpTestUser(auth, { name: 'Otra', email: 'otra@crisol.test' })
      const [org] = await conn.db.insert(schema.organizations).values({ name: 'Otra' }).returning()
      await conn.db
        .insert(schema.organizationMembers)
        .values({ organizationId: org?.id ?? '', userId: stranger.userId, role: 'owner' })
      const theirWorld = await call('createWorld', { name: 'Suyo' }, stranger.cookie)
      const theirPage = await call('createPage', { worldId: theirWorld.id, title: 'Suya' }, stranger.cookie)
      expect(
        await call('createPageDocument', { pageId: theirPage.id, kind: 'secret', copyOf: id }, stranger.cookie)
      ).toEqual({ code: 'NOT_FOUND' })
    })

    it('un jugador no abre un secreto, y al borrar la página se cierra también el secreto', async () => {
      const page = await call('createPage', { worldId, title: 'Puerto Ceniza' })
      const { id } = await call('createPageDocument', { pageId: page.id, kind: 'secret' })
      const campaign = await call('createCampaign', { worldId, name: 'La Marca' })
      const player = await signUpTestUser(auth, { name: 'Jugadora', email: 'jugadora@crisol.test' })
      await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: player.userId, role: 'member' })
      await conn.db
        .insert(schema.campaignMembers)
        .values({ campaignId: campaign.id, userId: player.userId, role: 'player' })
      const spy = client(`doc:${id}`, player.cookie)
      await until(() => spy.events.failed !== '', 'el rechazo')
      expect(await call('createPageDocument', { pageId: page.id, kind: 'secret' }, player.cookie)).toEqual({
        code: 'NOT_FOUND'
      })

      const secret = client(`doc:${id}`)
      await until(() => secret.events.synced, 'la sincronización')
      await call('deletePage', { pageId: page.id })
      await until(() => secret.events.closed > 0, 'el cierre del secreto')
    })
  })
})
