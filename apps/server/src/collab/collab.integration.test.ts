import { connect, documentsRepo, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider'
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
  const client = (pageId: string, cookie = owner.cookie, origin = BASE_URL) => {
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
      name: `page:${pageId}`,
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
    const a = client(page.id)
    const b = client(page.id)
    await until(() => a.events.synced && b.events.synced, 'la sincronización')
    a.document.getText('texto').insert(0, 'Puerto Ceniza es la última ciudad libre.')
    await until(() => b.text().includes('última ciudad'), 'el cambio en la otra pestaña')
    b.document.getText('texto').insert(b.text().length, ' La gobierna el Consejo.')
    await until(() => a.text().endsWith('Consejo.'), 'el cambio de vuelta')
    a.destroy()
    b.destroy()
    await until(async () => (await stored(page.id)) === a.text(), 'el guardado al cerrar')

    const again = client(page.id)
    await until(() => again.events.synced, 'volver a abrirla')
    expect(again.text()).toBe('Puerto Ceniza es la última ciudad libre. La gobierna el Consejo.')
  })

  it('guardar es fusionar: lo que ya estaba guardado no se pierde aunque el editor no lo tuviera', async () => {
    const page = await call('createPage', { worldId, title: 'Puerto Ceniza' })
    const editor = client(page.id)
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
    const writer = client(page.id)
    await until(() => writer.events.synced, 'la sincronización del máster')
    writer.document.getText('texto').insert(0, 'El secreto del faro.')

    const spy = client(page.id, player.cookie)
    await until(() => spy.events.failed !== '', 'el rechazo')
    expect(spy.events.synced).toBe(false)
    expect(spy.text()).toBe('')
  })

  it('un nombre que no es de ningún documento, o una página que no existe, no se abren', async () => {
    const unknown = client(crypto.randomUUID())
    await until(() => unknown.events.failed !== '', 'el rechazo')
    expect(unknown.events.synced).toBe(false)
  })

  it('desde otro origen no se conecta, aunque traiga la cookie', async () => {
    const page = await call('createPage', { worldId, title: 'Puerto Ceniza' })
    const foreign = client(page.id, owner.cookie, 'https://otra.test')
    await until(() => foreign.events.closed > 0, 'el cierre')
    expect(foreign.events.synced).toBe(false)
  })

  it('un cambio de más de 1 MB corta la conexión y no se guarda', async () => {
    const page = await call('createPage', { worldId, title: 'Puerto Ceniza' })
    const editor = client(page.id)
    await until(() => editor.events.synced, 'la sincronización')
    editor.document.getText('texto').insert(0, 'x'.repeat(1_200_000))
    await until(() => editor.events.closed > 0, 'el cierre')
    editor.destroy()
    expect(await stored(page.id)).toBe('')
  })

  it('al mandar la página a la papelera se cierra quien la edita, y ya no se abre', async () => {
    const page = await call('createPage', { worldId, title: 'Puerto Ceniza' })
    const editor = client(page.id)
    await until(() => editor.events.synced, 'la sincronización')
    await call('deletePage', { pageId: page.id })
    await until(() => editor.events.closed > 0, 'el cierre')
    const again = client(page.id)
    await until(() => again.events.failed !== '', 'el rechazo al volver')
  })
})
