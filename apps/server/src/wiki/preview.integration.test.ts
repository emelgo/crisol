import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined

describe('la vista previa y los incrustados', () => {
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
  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_preview'), { max: 4 })
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

  it('la vista previa: título, ruta, resumen y los primeros bloques; con ancla, la sección o el bloque', async () => {
    const [lugares] = await create([{ key: 'l', title: 'Lugares' }])
    const puerto = (
      await ok200('createPages', {
        worldId,
        parentId: lugares?.id,
        pages: [
          {
            key: 'p',
            title: 'Puerto Ceniza',
            markdown:
              '---\nresumen: La última ciudad libre.\n---\nUno.\n\nDos.\n\n## Historia\n\nArdió.\n\n### Detalle\n\nDe noche.\n\n## Barrios\n\nLos Muelles. ^muelles1\n\nCinco.'
          }
        ]
      })
    ).pages[0]
    const preview = await ok200('getPageContent', { pageId: puerto.id, preview: true })
    expect(preview.page).toEqual({
      id: puerto.id,
      title: 'Puerto Ceniza',
      icon: null,
      path: [
        { id: lugares?.id, title: 'Lugares' },
        { id: puerto.id, title: 'Puerto Ceniza' }
      ],
      summary: 'La última ciudad libre.'
    })
    expect(preview.blocks).toHaveLength(4)
    expect(preview.truncated).toBe(true)
    const section = await ok200('getPageContent', { pageId: puerto.id, anchor: 'historia' })
    expect(section.blocks.map((b: { type: string }) => b.type)).toEqual([
      'heading',
      'paragraph',
      'heading',
      'paragraph'
    ])
    const block = await ok200('getPageContent', { pageId: puerto.id, anchor: '^muelles1' })
    expect(block.blocks).toMatchObject([{ type: 'paragraph', content: [{ text: 'Los Muelles.' }] }])
  })

  it('los incrustados se abren hasta tres niveles, y un ciclo se corta; los secretos van con lo suyo', async () => {
    const pages = await create([
      { key: 'a', title: 'A', markdown: 'Soy A.\n\n![[B]]' },
      { key: 'b', title: 'B', markdown: 'Soy B.\n\n> [!secreto]\n> Lo que sabe B.\n\n![[C]]' },
      { key: 'c', title: 'C', markdown: 'Soy C.\n\n![[D]]\n\n![[A]]' },
      { key: 'd', title: 'D', markdown: 'Soy D.\n\n![[E]]' },
      { key: 'e', title: 'E', markdown: 'Soy E.' }
    ])
    const [a] = pages
    const content = await ok200('getPageContent', { pageId: a?.id })
    const embedB = content.blocks[1]
    expect(embedB).toMatchObject({ type: 'pageEmbed', attrs: { title: 'B' } })
    // B lleva su secreto con lo de dentro (es el máster)
    expect(JSON.stringify(embedB.content)).toContain('Lo que sabe B.')
    const embedC = embedB.content.find((b: { type: string }) => b.type === 'pageEmbed')
    const embedD = embedC.content.find((b: { attrs?: { title?: string } }) => b.attrs?.title === 'D')
    const backToA = embedC.content.find((b: { attrs?: { title?: string } }) => b.attrs?.title === 'A')
    expect(backToA.attrs.cycle).toBe(true)
    // D es el tercer nivel: su incrustado (E) ya no se abre
    const embedE = embedD.content.find((b: { type: string }) => b.type === 'pageEmbed')
    expect(embedE.attrs.tooDeep).toBe(true)
    expect(embedE.content).toBeUndefined()
  })

  it('quien no es máster no ve el contenido; un incrustado de otro mundo sale como que no está', async () => {
    const [page] = await create([{ key: 'p', title: 'Puerto Ceniza', markdown: 'Texto.' }])
    const player = await signUpTestUser(auth, { name: 'Lía', email: 'lia@crisol.test' })
    const [org] = await conn.db.select().from(schema.organizations)
    await conn.db
      .insert(schema.organizationMembers)
      .values({ organizationId: org?.id ?? '', userId: player.userId, role: 'member' })
    const response = await app.inject({
      method: 'POST',
      url: '/api/actions/getPageContent',
      payload: { pageId: page?.id },
      headers: { origin: BASE_URL, cookie: player.cookie }
    })
    expect(response.statusCode).toBe(404)
  })
})
