import { connect, schema, trashRepo } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, seedExampleTemplates, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

describe('las tablas que se llenan solas', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }
  let worldId: string
  let tpl: Record<string, string>

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
  /** Una facción y tres PNJ de ella (y uno de otra), creados como lo haría la IA */
  const raqisa = async () => {
    const yaml = (faction: string, rol: string, estado: string) =>
      `---\nFacción: "[[${faction}]]"\nRol: ${rol}\nEstado: ${estado}\n---\n`
    const { pages } = await ok200('createPages', {
      worldId,
      parentId: null,
      pages: [
        { key: 'raqisa', title: 'La Raqisa', template: 'faccion' },
        { key: 'vellard', title: 'Casa Vellard', template: 'faccion' },
        { key: 'gris', title: 'Mamá Gris', template: 'pnj', markdown: yaml('La Raqisa', 'Jefa', 'Vive') },
        { key: 'gyles', title: 'El Viejo Gyles', template: 'pnj', markdown: yaml('La Raqisa', 'Mano derecha', 'Vive') },
        { key: 'tarrin', title: 'Tarrin Seda', template: 'pnj', markdown: yaml('La Raqisa', 'Contable', 'Ha muerto') },
        { key: 'otro', title: 'Lord Vellard', template: 'pnj', markdown: yaml('Casa Vellard', 'Señor', 'Vive') }
      ]
    })
    return Object.fromEntries(pages.map((p: { key: string; id: string }) => [p.key, p.id])) as Record<string, string>
  }

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_tables'), { max: 4 })
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
    // Las plantillas de ejemplo (las que fueron de serie): se nombran por su nombre, o aquí por su id
    tpl = await seedExampleTemplates(call)
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('«Miembros» de una facción: sus PNJ, por título, con sus columnas; sin los de otra', async () => {
    const ids = await raqisa()
    const { tables } = await ok200('getPageTables', { pageId: ids.raqisa })
    expect(tables).toHaveLength(1)
    const [members] = tables
    expect(members).toMatchObject({ title: 'Miembros', problem: null, more: false })
    expect(members.columns).toEqual([
      { field: 'rol', name: 'Rol' },
      { field: 'estado', name: 'Estado' }
    ])
    expect(members.rows.map((r: { title: string }) => r.title)).toEqual(['El Viejo Gyles', 'Mamá Gris', 'Tarrin Seda'])
    expect(members.rows[2].cells).toEqual([
      { name: 'Rol', field: 'rol', type: 'text', value: 'Contable' },
      {
        name: 'Estado',
        field: 'estado',
        type: 'choice',
        value: 'Ha muerto',
        options: ['Vive', 'Ha muerto', 'En paradero desconocido', 'No se sabe']
      }
    ])
    // La IA las recibe ya hechas al leer la página
    const read = await ok200('readPage', { pageId: ids.raqisa })
    expect(read.tables[0].rows).toHaveLength(3)
  })

  it('cuentan las copias de la plantilla y el campo renombrado; no las de la papelera', async () => {
    const ids = await raqisa()
    // Una página hecha con una copia de PNJ («PNJ de Eana»): su linaje lleva a PNJ
    await conn.db
      .update(schema.pages)
      .set({ template: crypto.randomUUID(), templateLine: ['pnj-de-eana', tpl.pnj as string] })
      .where(eq(schema.pages.id, ids.gyles as string))
    // A Mamá Gris le cambian el nombre al campo: sigue siendo el mismo
    const gris = await ok200('getPage', { pageId: ids.gris })
    const renamed = gris.properties.map((p: { field?: string; name: string }) =>
      p.field === 'faccion' ? { ...p, name: 'Banda' } : p
    )
    await ok200('setPageProperties', { pageId: ids.gris, properties: renamed })
    await ok200('deletePage', { pageId: ids.tarrin })
    const { tables } = await ok200('getPageTables', { pageId: ids.raqisa })
    expect(tables[0].rows.map((r: { title: string }) => r.title)).toEqual(['El Viejo Gyles', 'Mamá Gris'])
  })

  it('una tabla a mano: con desplegables que tienen que ser de la plantilla; y por una columna', async () => {
    const ids = await raqisa()
    const lugar = await ok200('createPage', { worldId, title: 'Ciudad Libre', template: 'lugar' })
    const panel = (block: object) => call('setPagePanel', { pageId: ids.raqisa, blocks: [block] })
    const table = { id: 'estados', type: 'related', title: 'Por estado', template: tpl.pnj, field: 'faccion' }
    // Recién puesta, sin configurar: se guarda así y dice que falta elegir (Enrique, 2026-11-16)
    expect((await panel({ ...table, template: '', field: '', columns: [], sort: 'title' })).statusCode).toBe(200)
    const unset = await ok200('getPageTables', { pageId: ids.raqisa })
    expect(unset.tables[0]).toMatchObject({ problem: 'unset', rows: [] })
    // Un campo que no es de enlace, una columna que no es de la plantilla, un orden que no es columna
    expect((await panel({ ...table, field: 'rol', columns: [], sort: 'title' })).json()).toMatchObject({
      code: 'BAD_PAGE_TABLE'
    })
    expect((await panel({ ...table, columns: ['poblacion'], sort: 'title' })).json()).toMatchObject({
      code: 'BAD_PAGE_TABLE'
    })
    expect((await panel({ ...table, columns: ['rol'], sort: 'estado' })).json()).toMatchObject({
      code: 'BAD_PAGE_TABLE'
    })
    expect((await panel({ ...table, template: 'frente', columns: [], sort: 'title' })).json()).toMatchObject({
      code: 'BAD_PAGE_TABLE'
    })
    expect((await panel({ ...table, columns: ['estado', 'rol'], sort: 'estado' })).statusCode).toBe(200)
    const { tables } = await ok200('getPageTables', { pageId: ids.raqisa })
    // Por Estado: «Ha muerto» antes que «Vive»; y dentro, por título
    expect(tables[0].rows.map((r: { title: string }) => r.title)).toEqual([
      'Tarrin Seda',
      'El Viejo Gyles',
      'Mamá Gris'
    ])
    // Sin páginas que la apunten, vacía
    const empty = await ok200('getPageTables', { pageId: lugar.id })
    expect(empty.tables.map((t: { title: string; rows: unknown[] }) => [t.title, t.rows.length])).toEqual([
      ['Lugares dentro', 0],
      ['Habitantes', 0]
    ])
  })

  it('una tabla cuyo campo ya no está en su plantilla lo dice, en vez de salir vacía', async () => {
    const ids = await raqisa()
    const broken = [
      { id: 'rota01', type: 'related', title: 'Rota', template: tpl.pnj, field: 'frentes', columns: [], sort: 'title' }
    ]
    await conn.db
      .update(schema.pages)
      .set({ panel: broken })
      .where(eq(schema.pages.id, ids.raqisa as string))
    const { tables } = await ok200('getPageTables', { pageId: ids.raqisa })
    expect(tables[0]).toMatchObject({ title: 'Rota', problem: 'field', rows: [] })
    // Guardar otro cambio del panel no la rechaza: ya estaba
    expect(
      (
        await call('setPagePanel', {
          pageId: ids.raqisa,
          blocks: [...broken, { id: 'nota01', type: 'text', title: 'Nota', text: '' }]
        })
      ).statusCode
    ).toBe(200)
  })

  it('al purgar una página, se quita de los campos que la apuntaban', async () => {
    const ids = await raqisa()
    await ok200('deletePage', { pageId: ids.raqisa })
    const later = new Date(Date.now() + 31 * 24 * 3600 * 1000)
    await trashRepo.purge(conn.db, later)
    const gris = await ok200('getPage', { pageId: ids.gris })
    expect(gris.properties.find((p: { field?: string }) => p.field === 'faccion')).toMatchObject({
      field: 'faccion',
      single: true,
      value: []
    })
    // Lo demás, igual
    expect(gris.properties.find((p: { field?: string }) => p.field === 'rol')).toMatchObject({ value: 'Jefa' })
  })

  it('buscar_paginas: las de una plantilla y un campo («PNJ cuyo Facción es La Raqisa»), con o sin texto', async () => {
    await raqisa()
    const members = await ok200('searchWiki', {
      worldId,
      template: 'PNJ',
      field: { name: 'faccion', page: 'La Raqisa' }
    })
    expect(members.results.map((r: { title: string }) => r.title)).toEqual([
      'El Viejo Gyles',
      'Mamá Gris',
      'Tarrin Seda'
    ])
    const facciones = await ok200('searchWiki', { worldId, template: 'faccion' })
    expect(facciones.total).toBe(2)
    const bad = await call('searchWiki', { worldId, template: 'pnj', field: { name: 'Rol', page: 'La Raqisa' } })
    expect(bad.json()).toMatchObject({ code: 'BAD_FIELD' })
    expect((await call('searchWiki', { worldId })).statusCode).toBe(400)
  })
})
