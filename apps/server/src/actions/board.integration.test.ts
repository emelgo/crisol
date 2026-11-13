/**
 * La pizarra (módulo 9, docs/specs/pizarra.md): la pestaña nace con su documento; el máster la recibe entera y una
 * jugadora, solo si se le revela y sin lo que no puede ver (tarjetas de páginas que no conoce, lo oculto, lo atado)
 */
import { connect, documentsRepo, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { buildApp } from '../app.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'
import { BOARD_ELEMENTS } from '../wiki/board.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

describe('la pizarra (módulo 9)', () => {
  let conn: ReturnType<typeof connect>
  let auth: ReturnType<typeof createTestAuth>
  let app: ReturnType<typeof buildApp>
  let master: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let worldId: string
  let marca: string
  let robo: string
  let doran: string
  let madre: string

  const call = (name: string, payload: object, cookie = master.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_board'), { max: 4 })
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
    marca = (await ok200('createCampaign', { worldId, name: 'La Marca' })).id
    ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    const url = (await ok200('getInvitation', { campaignId: marca })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: ana.cookie }
    })
    robo = (await ok200('createPage', { worldId, title: 'El robo del relicario' })).id
    doran = (await ok200('createPage', { worldId, title: 'Doran el Cojo' })).id
    madre = (await ok200('createPage', { worldId, title: 'La Madre Ceniza' })).id
    for (const pageId of [robo, doran])
      await ok200('setKnowledge', { worldId, campaignId: marca, kind: 'page', targetId: pageId, known: true })
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  /** Pone en la pizarra lo que haría el editor (cada elemento de Excalidraw, por su id) */
  const draw = async (documentId: string, elements: Record<string, unknown>[]) => {
    await documentsRepo.mergeSeparate(conn.db, documentId, master.userId, (stored) => {
      const doc = new Y.Doc()
      Y.applyUpdate(doc, stored)
      const map = doc.getMap(BOARD_ELEMENTS)
      for (const element of elements) map.set(String(element.id), element)
      return Y.encodeStateAsUpdate(doc)
    })
  }

  it('«Pizarra» nace con su documento; el máster la recibe entera, con sus lápidas fuera', async () => {
    const tab = await ok200('createPageTab', { pageId: robo, kind: 'board' })
    expect(tab).toMatchObject({ kind: 'board', name: 'Pizarra' })
    expect(tab.documentId).toBeTruthy()
    expect(await ok200('getBoard', { tabId: tab.id })).toEqual({ elements: [] })
    await draw(tab.documentId, [
      { id: 'doran', type: 'embeddable', customData: { pageId: doran, title: 'Doran el Cojo' } },
      { id: 'borrada', type: 'rectangle', isDeleted: true }
    ])
    expect((await ok200('getBoard', { tabId: tab.id })).elements).toEqual([
      { id: 'doran', type: 'embeddable', customData: { pageId: doran, title: 'Doran el Cojo' } }
    ])
    // De otra clase de pestaña, no
    const map = await ok200('createPageTab', { pageId: robo, kind: 'map' })
    expect((await call('getBoard', { tabId: map.id })).statusCode).toBe(404)
  })

  it('la jugadora: sin revelarla, nada; revelada, sin lo oculto ni lo que no conoce ni lo atado a ello', async () => {
    const tab = await ok200('createPageTab', { pageId: robo, kind: 'board' })
    await ok200('updatePageTab', { tabId: tab.id, hidden: true })
    await draw(tab.documentId, [
      { id: 'doran', type: 'embeddable', customData: { pageId: doran, title: 'Doran el Cojo' } },
      { id: 'madre', type: 'embeddable', customData: { pageId: madre, title: 'La Madre Ceniza' } },
      { id: 'flecha', type: 'arrow', startBinding: { elementId: 'doran' }, endBinding: { elementId: 'madre' } },
      { id: 'nota', type: 'text', text: 'Sesión 4: que lo descubran', customData: { hidden: true } },
      { id: 'pista', type: 'text', text: 'le debe dinero' }
    ])
    expect((await call('getBoard', { tabId: tab.id }, ana.cookie)).statusCode).toBe(404)
    await ok200('setKnowledge', { worldId, campaignId: marca, kind: 'tab', targetId: tab.id, known: true })
    const seen = await ok200('getBoard', { tabId: tab.id }, ana.cookie)
    expect(seen.elements.map((e: { id: string }) => e.id)).toEqual(['doran', 'pista'])
    expect(JSON.stringify(seen)).not.toMatch(/Madre|Sesión|flecha/)
  })
})
