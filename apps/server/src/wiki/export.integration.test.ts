import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { pageFromMarkdown } from '@crisol/editor/markdown'
import type { FastifyInstance } from 'fastify'
import { strFromU8, unzipSync } from 'fflate'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'https://crisol.test'
const ok = async () => undefined

describe('exportar la wiki en Markdown', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }
  let organizationId: string
  let worldId: string

  const call = (name: string, payload: object, cookie = owner.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const exported = async (payload: object, cookie = owner.cookie) => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload,
      headers: { origin: BASE_URL, cookie }
    })
    return response
  }
  const unzip = (body: Buffer) =>
    Object.fromEntries(Object.entries(unzipSync(new Uint8Array(body))).map(([path, data]) => [path, strFromU8(data)]))

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_export'), { max: 4 })
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

  /** Eana: Lugares > Costa Gris > Puerto Ceniza (con secreto) y Notas; Personajes > Maela Varn y otras Notas */
  async function eana() {
    const response = await call('createPages', {
      worldId,
      parentId: null,
      pages: [
        { key: 'lugares', title: 'Lugares', markdown: 'Los sitios de Eana.' },
        { key: 'costa', parent: 'lugares', title: 'Costa Gris', markdown: 'La costa.' },
        {
          key: 'puerto',
          parent: 'costa',
          title: 'Puerto Ceniza',
          markdown:
            '---\nRegión:\n  - "[[Costa Gris]]"\n---\nLa última ciudad libre.\n\n> [!secreto]\n> La Hermandad quemó el faro.'
        },
        { key: 'notas1', parent: 'lugares', title: 'Notas', markdown: 'De los lugares.' },
        { key: 'personajes', title: 'Personajes' },
        { key: 'maela', parent: 'personajes', title: 'Maela Varn', markdown: '%%\nPreguntar por su familia.\n%%' },
        { key: 'notas2', parent: 'personajes', title: 'Notas', markdown: 'De los personajes.' },
        { key: 'raro', title: 'Mapa: norte/sur?', markdown: 'Con un nombre difícil.' }
      ]
    })
    expect(response.statusCode, response.body).toBe(200)
    const pages = response.json().pages as { key: string; id: string }[]
    return Object.fromEntries(pages.map((page) => [page.key, page.id])) as Record<string, string>
  }

  it('el mundo entero: carpetas para las páginas con hijas, y leer lo exportado da lo mismo que leer la página', async () => {
    const ids = await eana()
    // Una propiedad que enlaza a una de las dos «Notas»: va con su sitio en el .zip
    await call('editPage', {
      pageId: ids.maela,
      properties: [{ name: 'Apuntes', type: 'pages', value: [ids.notas2 ?? ''] }]
    })
    const response = await exported({ worldId })
    expect(response.statusCode, response.body).toBe(200)
    expect(response.headers['content-type']).toBe('application/zip')
    expect(response.headers['content-disposition']).toBe(`attachment; filename="Eana.zip"; filename*=UTF-8''Eana.zip`)
    const files = unzip(response.rawPayload)
    expect(Object.keys(files).sort()).toEqual(
      [
        'Lugares/Lugares.md',
        'Lugares/Costa Gris/Costa Gris.md',
        'Lugares/Costa Gris/Puerto Ceniza.md',
        'Lugares/Notas.md',
        'Personajes/Personajes.md',
        'Personajes/Maela Varn.md',
        'Personajes/Notas.md',
        'Mapa- norte-sur-.md'
      ].sort()
    )
    // Con sus secretos (es el máster)
    expect(files['Lugares/Costa Gris/Puerto Ceniza.md']).toContain('> [!secreto]\n> La Hermandad quemó el faro.')
    expect(files['Lugares/Costa Gris/Puerto Ceniza.md']).toContain('  - "[[Costa Gris]]"')
    expect(files['Personajes/Maela Varn.md']).toContain('  - "[[Personajes/Notas]]"')
    // Ida y vuelta: cada archivo es lo que da leer la página (salvo el enlace a la «Notas» repetida)
    for (const [key, file] of [
      ['puerto', 'Lugares/Costa Gris/Puerto Ceniza.md'],
      ['costa', 'Lugares/Costa Gris/Costa Gris.md'],
      ['notas1', 'Lugares/Notas.md']
    ] as const) {
      const read = (await call('readPage', { pageId: ids[key] })).json().markdown
      expect(files[file]).toBe(read)
      const again = pageFromMarkdown(files[file] ?? '')
      expect(again.body.content?.length).toBeGreaterThan(0)
    }
  })

  it('una rama, desde su carpeta; una página sola, su nota', async () => {
    const ids = await eana()
    const branch = unzip((await exported({ worldId, pageId: ids.costa, children: true })).rawPayload)
    expect(Object.keys(branch).sort()).toEqual(['Costa Gris/Costa Gris.md', 'Costa Gris/Puerto Ceniza.md'])
    const single = await exported({ worldId, pageId: ids.costa })
    expect(single.headers['content-disposition']).toContain(`filename*=UTF-8''Costa%20Gris.zip`)
    expect(Object.keys(unzip(single.rawPayload))).toEqual(['Costa Gris.md'])
  })

  it('una página de plantilla lleva su plantilla primero en el YAML, y sus campos con su forma', async () => {
    const raqisa = (await call('createPage', { worldId, title: 'La Raqisa', template: 'faccion' })).json()
    const gris = (await call('createPage', { worldId, title: 'Mamá Gris', template: 'pnj' })).json()
    await call('setPageProperties', {
      pageId: gris.id,
      properties: gris.properties.map((p: { field?: string }) =>
        p.field === 'faccion' ? { ...p, value: [raqisa.id] } : p.field === 'estado' ? { ...p, value: 'Vive' } : p
      )
    })
    const files = unzip((await exported({ worldId, pageId: gris.id })).rawPayload)
    const markdown = files['Mamá Gris.md'] ?? ''
    expect(markdown.startsWith('---\nplantilla: PNJ\n')).toBe(true)
    expect(markdown).toContain('Facción: "[[La Raqisa]]"')
    expect(markdown).toContain('Estado: Vive')
  })

  it('quien no es máster no exporta, ni una página de otro mundo pasa por este', async () => {
    const ids = await eana()
    const player = await signUpTestUser(auth, { name: 'Lía', email: 'lia@crisol.test' })
    await conn.db.insert(schema.organizationMembers).values({ organizationId, userId: player.userId, role: 'member' })
    expect((await exported({ worldId }, player.cookie)).statusCode).toBe(404)
    expect((await exported({ worldId, pageId: ids.puerto }, player.cookie)).statusCode).toBe(404)
    const other = (await call('createWorld', { name: 'Otro' })).json().id
    expect((await exported({ worldId: other, pageId: ids.puerto })).statusCode).toBe(404)
    const noSession = await app.inject({ method: 'POST', url: '/api/export', payload: { worldId } })
    expect(noSession.statusCode).toBe(401)
  })
})
