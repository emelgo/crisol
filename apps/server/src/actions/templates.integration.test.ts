import { TEMPLATE_ICONS as CONTRACT_ICONS, pageTemplate } from '@crisol/contracts'
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { BUILT_IN_TEMPLATES, TEMPLATE_ICONS } from '@crisol/domain'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Auth } from '../auth/auth.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

describe('las plantillas de serie', () => {
  let conn: ReturnType<typeof connect>
  let auth: Auth
  let app: FastifyInstance
  let owner: { userId: string; cookie: string }

  const call = (name: string, payload: object, cookie = owner.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_templates'), { max: 4 })
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
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('cada una cumple el contrato de la API, también su panel, y los iconos son los mismos', () => {
    expect([...CONTRACT_ICONS]).toEqual([...TEMPLATE_ICONS])
    for (const template of BUILT_IN_TEMPLATES) expect(pageTemplate.safeParse(template).success, template.id).toBe(true)
  })

  it('se ven las seis, y una entera por su id', async () => {
    const list = await call('listTemplates', {})
    expect(list.statusCode, list.body).toBe(200)
    expect(list.json().templates.map((t: { id: string }) => t.id)).toEqual([
      'pnj',
      'lugar',
      'faccion',
      'objeto',
      'mision',
      'sesion'
    ])
    const pnj = await call('getTemplate', { templateId: 'pnj' })
    expect(pnj.statusCode).toBe(200)
    expect(pnj.json()).toMatchObject({ id: 'pnj', name: 'PNJ', builtIn: true, line: ['pnj'] })
    expect((await call('getTemplate', { templateId: 'frente' })).statusCode).toBe(404)
  })

  it('sin cuenta no se ven', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/actions/listTemplates',
      payload: {},
      headers: { origin: BASE_URL }
    })
    expect(response.statusCode).toBe(401)
  })

  describe('las de la cuenta', () => {
    let worldId: string
    const ok200 = async (name: string, payload: object) => {
      const response = await call(name, payload)
      expect(response.statusCode, response.body).toBe(200)
      return response.json()
    }

    beforeEach(async () => {
      worldId = (await ok200('createWorld', { name: 'Eana' })).id
    })

    it('copiar PNJ conserva los ids de sus campos y su linaje; sus páginas salen en «Miembros»', async () => {
      const copy = await ok200('createTemplate', { name: 'PNJ de Eana', icon: 'user', copyOf: 'PNJ' })
      expect(copy).toMatchObject({ builtIn: false, basedOn: 'pnj', line: [copy.id, 'pnj'] })
      expect(copy.fields.map((f: { field: string }) => f.field)).toEqual([
        'especie',
        'rol',
        'faccion',
        'lugar',
        'estado',
        'padres',
        'pareja'
      ])
      // Un campo nuevo, sin id: recibe el suyo
      const withFrentes = await ok200('updateTemplate', {
        templateId: copy.id,
        fields: [...copy.fields, { name: 'Frentes', type: 'pages', targets: [], value: [] }]
      })
      const frentes = withFrentes.fields.at(-1)
      expect(frentes).toMatchObject({ name: 'Frentes', type: 'pages' })
      expect(frentes.field).toMatch(/^[a-z0-9]{10}$/)
      // Una página de la copia, en la tabla de PNJ de la facción
      const raqisa = await ok200('createPage', { worldId, title: 'La Raqisa', template: 'faccion' })
      const gris = await ok200('createPage', { worldId, title: 'Mamá Gris', template: copy.id })
      expect(gris.template).toBe(copy.id)
      await ok200('setPageProperties', {
        pageId: gris.id,
        properties: gris.properties.map((p: { field?: string }) =>
          p.field === 'faccion' ? { ...p, value: [raqisa.id] } : p
        )
      })
      const { tables } = await ok200('getPageTables', { pageId: raqisa.id })
      expect(tables[0].rows.map((r: { title: string }) => r.title)).toEqual(['Mamá Gris'])
      // Y sale en la lista, detrás de las de serie
      const { templates } = await ok200('listTemplates', {})
      expect(templates.map((t: { name: string }) => t.name).slice(-1)).toEqual(['PNJ de Eana'])
    })

    it('«Frente» desde cero, con un reloj y una tabla que nombra a otra plantilla propia', async () => {
      const pnj = await ok200('createTemplate', { name: 'PNJ de Eana', copyOf: 'pnj' })
      const withFrentes = await ok200('updateTemplate', {
        templateId: pnj.id,
        fields: [...pnj.fields, { name: 'Frentes', field: 'frentes', type: 'pages', value: [] }]
      })
      const frente = await ok200('createTemplate', { name: 'Frente', icon: 'hourglass' })
      expect(frente).toMatchObject({ fields: [], panel: [], skeleton: '', line: [frente.id] })
      const changed = await ok200('updateTemplate', {
        templateId: frente.id,
        fields: [
          { name: 'Nivel', type: 'choice', value: '', options: ['Local', 'Regional', 'Del mundo'] },
          { name: 'Reloj', type: 'clock', value: 0, segments: 8 },
          { name: 'Regiones', type: 'pages', targets: ['lugar'], value: [] }
        ],
        panel: [
          {
            id: 'pnjdelfrente',
            type: 'related',
            title: 'PNJ del frente',
            template: withFrentes.id,
            field: 'frentes',
            columns: ['rol'],
            sort: 'title'
          }
        ],
        skeleton: '## En una frase\n\n## La verdad\n'
      })
      expect(changed.fields.map((f: { name: string; type: string }) => [f.name, f.type])).toEqual([
        ['Nivel', 'choice'],
        ['Reloj', 'clock'],
        ['Regiones', 'pages']
      ])
      // Un frente y dos PNJ con él: salen en su tabla
      const muelles = await ok200('createPage', { worldId, title: 'Los muelles en llamas', template: frente.id })
      expect(muelles.properties.find((p: { name: string }) => p.name === 'Reloj')).toMatchObject({ segments: 8 })
      const { markdown } = await ok200('readPage', { pageId: muelles.id })
      expect(markdown).toContain('## En una frase')
      const { pages } = await ok200('createPages', {
        worldId,
        parentId: null,
        pages: ['Mamá Gris', 'El Viejo Gyles'].map((title, i) => ({
          key: `p${i}`,
          title,
          template: 'PNJ de Eana',
          markdown: '---\nFrentes:\n  - "[[Los muelles en llamas]]"\n---\n'
        }))
      })
      expect(pages).toHaveLength(2)
      const { tables } = await ok200('getPageTables', { pageId: muelles.id })
      expect(tables[0].rows.map((r: { title: string }) => r.title)).toEqual(['El Viejo Gyles', 'Mamá Gris'])
    })

    it('cambiarla o borrarla no toca sus páginas; borrarla se deshace', async () => {
      const frente = await ok200('createTemplate', { name: 'Frente' })
      await ok200('updateTemplate', {
        templateId: frente.id,
        fields: [{ name: 'Nivel', field: 'nivel', type: 'text', value: '' }]
      })
      const page = await ok200('createPage', { worldId, title: 'Un frente', template: frente.id })
      await ok200('updateTemplate', { templateId: frente.id, fields: [] })
      expect((await ok200('getPage', { pageId: page.id })).properties.map((p: { name: string }) => p.name)).toEqual([
        'Nivel'
      ])
      await ok200('deleteTemplate', { templateId: frente.id })
      const listed = await ok200('listTemplates', {})
      expect(listed.templates.some((t: { id: string }) => t.id === frente.id)).toBe(false)
      expect(listed.deleted).toEqual([{ id: frente.id, name: 'Frente', icon: 'template' }])
      expect((await ok200('getPage', { pageId: page.id })).template).toBe(frente.id)
      // Ya no se puede crear con ella; deshacerlo la devuelve
      expect((await call('createPage', { worldId, title: 'Otro', template: frente.id })).json()).toMatchObject({
        code: 'TEMPLATE_NOT_FOUND'
      })
      const { entries } = await ok200('listHistory', {})
      const deletion = entries.find((e: { action: string }) => e.action === 'deleteTemplate')
      expect((await ok200('undoOperation', { operationId: deletion.id })).status).toBe('undone')
      expect((await ok200('listTemplates', {})).templates.some((t: { id: string }) => t.id === frente.id)).toBe(true)
    })

    it('lo que no vale: un nombre que ya está, un enlace a una página, cambiar una de serie', async () => {
      expect((await call('createTemplate', { name: 'pnj' })).json()).toMatchObject({ code: 'TEMPLATE_TAKEN' })
      const frente = await ok200('createTemplate', { name: 'Frente' })
      const page = await ok200('createPage', { worldId, title: 'Ciudad Libre' })
      expect(
        (
          await call('updateTemplate', {
            templateId: frente.id,
            fields: [{ name: 'Sede', type: 'pages', value: [page.id] }]
          })
        ).json()
      ).toMatchObject({ code: 'BAD_FIELD' })
      expect((await call('updateTemplate', { templateId: 'pnj', name: 'Otro' })).statusCode).toBe(400)
      expect((await call('deleteTemplate', { templateId: crypto.randomUUID() })).statusCode).toBe(404)
    })

    it('quien no es de la cuenta no las ve ni las cambia', async () => {
      const frente = await ok200('createTemplate', { name: 'Frente' })
      const other = await signUpTestUser(auth, { name: 'Otra', email: 'otra@crisol.test' })
      const as = (name: string, payload: object) =>
        app.inject({
          method: 'POST',
          url: `/api/actions/${name}`,
          payload,
          headers: { origin: BASE_URL, cookie: other.cookie }
        })
      expect((await as('updateTemplate', { templateId: frente.id, name: 'Mío' })).statusCode).toBe(404)
      expect((await as('deleteTemplate', { templateId: frente.id })).statusCode).toBe(404)
    })
  })
})
