/**
 * Las propiedades «Fecha» (módulo 8, docs/specs/fechas.md): ponerlas, cambiarlas y borrarlas por la API y con la forma
 * de la IA (`1250-Siega-18`), BAD_DATE, un calendario de otro mundo, la búsqueda con fechas, lo que no le llega a una
 * jugadora (un campo «Oculto»), copiar y deshacer, las tablas por fecha y las fechas en uso de un calendario
 */
import { connect, loadMemberships, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { actorFrom } from '@crisol/domain'
import { desc, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import { errorText } from '../mcp/approvals.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'
import { implementationsByName } from './implementations.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

const month = (name: string, days = 28) => ({ name, days })
/** Uno pequeño como el de Eana: una fiesta fuera de la semana y una era solo del máster que cuenta desde su inicio */
const DEFINITION = {
  yearSuffix: 'RC',
  weekdays: ['Herrero', 'Hacedor', 'Muerte', 'Frostelle', 'Flora', 'Eternidad', 'Melancolía'],
  months: [
    month('Cierzo'),
    { name: 'Semana del Yunque', days: 7, festival: true, outsideWeek: true },
    month('Siega'),
    month('Trilla')
  ],
  eras: [
    { name: 'Era de la República', start: '0' },
    { name: 'Era del Eclipse', abbreviation: 'EE', start: '1300-Siega-1', countsFromStart: true, hidden: true }
  ]
}

interface DateProperty {
  name: string
  type: 'date'
  value: {
    calendarId: string
    start: { year: number; month?: string; day?: number }
    end?: object
    yearly?: true
  } | null
  text?: string
  hidden?: true
  field?: string
}

describe('las propiedades «Fecha» (módulo 8)', () => {
  let conn: ReturnType<typeof connect>
  let auth: ReturnType<typeof createTestAuth>
  let app: ReturnType<typeof buildApp>
  let master: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let worldId: string
  let marca: string
  let calendar: { id: string; definition: { months: { id: string; name: string; days: number }[] } }
  let siega: string

  const call = (name: string, payload: object, cookie = master.cookie) =>
    app.inject({ method: 'POST', url: `/api/actions/${name}`, payload, headers: { origin: BASE_URL, cookie } })
  const ok200 = async (name: string, payload: object, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }
  const fails = async (name: string, payload: object, code: string, cookie = master.cookie) => {
    const response = await call(name, payload, cookie)
    expect(response.json().code, response.body).toBe(code)
  }
  /** Lo que lee la IA del máster cuando falla (la web solo recibe el código): el código con su motivo */
  const aiError = async (name: string, input: object) => {
    const ctx = {
      db: conn.db,
      actor: actorFrom(master.userId, await loadMemberships(conn.db, master.userId)),
      via: 'ai',
      realtime: { publish() {} }
    }
    try {
      await implementationsByName.get(name)?.handler(ctx as never, input as never)
    } catch (error) {
      return errorText(error)
    }
    throw new Error(`${name} no falló`)
  }
  const undo = async (action: string) => {
    const [op] = await conn.db
      .select()
      .from(schema.operations)
      .where(eq(schema.operations.action, action))
      .orderBy(desc(schema.operations.createdAt))
    expect((await ok200('undoOperation', { operationId: op?.id })).status).toBe('undone')
  }
  const newPage = async (title: string) => (await ok200('createPage', { worldId, title })).id as string
  const dateOf = async (pageId: string, name: string, cookie = master.cookie) =>
    ((await ok200('getPage', { pageId }, cookie)).properties as DateProperty[]).find((p) => p.name === name)
  const search = async (query: string, cookie = master.cookie) =>
    ((await ok200('searchWiki', { worldId, query }, cookie)).results as { title: string }[]).map((r) => r.title)

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_dates'), { max: 4 })
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
    worldId = (await ok200('createWorld', { name: 'Eana' })).id
    marca = (await ok200('createCampaign', { worldId, name: 'La Marca' })).id
    ana = await signUpTestUser(auth, { name: 'Ana', email: 'ana@crisol.test' })
    const url = (await ok200('getInvitation', { campaignId: marca })).url as string
    await app.inject({
      method: 'POST',
      url: '/api/join',
      payload: { secret: url.split('/unirse/')[1] },
      headers: { origin: BASE_URL, cookie: ana.cookie }
    })
    calendar = await ok200('createCalendar', { worldId, name: 'Eana', from: { definition: DEFINITION } })
    siega = calendar.definition.months.find((m) => m.name === 'Siega')?.id ?? ''
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('poner, cambiar y borrar una fecha por la API: se guarda con cómo se lee y se deshace', async () => {
    const puerto = await newPage('Puerto Ceniza')
    const value = { calendarId: calendar.id, start: { year: 412, month: siega, day: 12 } }
    await ok200('setPageProperties', {
      pageId: puerto,
      // Lo que diga la web de cómo se lee no vale: lo pone el servidor
      properties: [{ name: 'Fundación', type: 'date', value, text: 'cualquier cosa' }]
    })
    expect(await dateOf(puerto, 'Fundación')).toEqual({
      name: 'Fundación',
      type: 'date',
      value,
      text: '12 de Siega de 412 RC'
    })
    const range = { ...value, end: { year: 412, month: siega, day: 20 }, yearly: true }
    await ok200('setPageProperties', {
      pageId: puerto,
      properties: [{ name: 'Fundación', type: 'date', value: range }]
    })
    expect((await dateOf(puerto, 'Fundación'))?.text).toBe('12–20 de Siega de 412 RC')
    await ok200('setPageProperties', { pageId: puerto, properties: [{ name: 'Fundación', type: 'date', value: null }] })
    expect(await dateOf(puerto, 'Fundación')).toEqual({ name: 'Fundación', type: 'date', value: null })
    await undo('setPageProperties')
    expect((await dateOf(puerto, 'Fundación'))?.value).toEqual(range)
  })

  it('BAD_DATE: un día que no cabe, el fin antes, un mes que no existe o un calendario de otro mundo', async () => {
    const puerto = await newPage('Puerto Ceniza')
    const set = async (value: object) => {
      const input = { pageId: puerto, properties: [{ name: 'Fundación', type: 'date', value }] }
      await fails('setPageProperties', input, 'BAD_DATE')
      return { message: await aiError('setPageProperties', input) }
    }
    const start = { year: 412, month: siega, day: 12 }
    expect((await set({ calendarId: calendar.id, start: { ...start, day: 29 } })).message).toMatch(/28 días/)
    expect((await set({ calendarId: calendar.id, start, end: { ...start, day: 3 } })).message).toMatch(/antes/)
    expect((await set({ calendarId: calendar.id, start: { year: 1, month: 'nada' } })).message).toMatch(/mes/)
    const other = (await ok200('createWorld', { name: 'Otro' })).id
    const foreign = await ok200('createCalendar', { worldId: other, name: 'Ajeno' })
    expect((await set({ calendarId: foreign.id, start: { year: 1 } })).message).toMatch(/no es de este mundo/)
  })

  it('la IA escribe la fecha como 1250-Siega-18 (o periodo, o cada año) y la lee legible; mal escrita, dice por qué', async () => {
    const gris = await newPage('Mamá Gris')
    const edited = await ok200('editPage', {
      pageId: gris,
      properties: [
        { name: 'Nacimiento', type: 'date', value: '-34-Siega-3' },
        { name: 'Viaje', type: 'date', value: '412-Siega-12', end: '412-Trilla-3' },
        { name: 'Fiesta', type: 'date', value: '1-Semana del Yunque (cada año)', calendar: 'eana' },
        { name: 'Muerte', type: 'date', value: null }
      ]
    })
    const byName = new Map((edited.page.properties as DateProperty[]).map((p) => [p.name, p]))
    expect(byName.get('Nacimiento')?.value).toEqual({
      calendarId: calendar.id,
      start: { year: -34, month: siega, day: 3 }
    })
    expect(byName.get('Viaje')?.text).toBe('12 de Siega – 3 de Trilla de 412 RC')
    expect(byName.get('Fiesta')?.value?.yearly).toBe(true)
    expect(byName.get('Muerte')?.value).toBeNull()
    const read = await ok200('readPage', { pageId: gris })
    expect(read.markdown).toContain('Viaje: "412-Siega-12/412-Trilla-3"')
    expect(read.markdown).toContain('Fiesta: "1-Semana del Yunque (cada año)"')
    expect(read.dates).toEqual([
      { name: 'Nacimiento', calendar: 'Eana', text: '3 de Siega de -34 RC', form: '-34-Siega-3', primary: null },
      {
        name: 'Viaje',
        calendar: 'Eana',
        text: '12 de Siega – 3 de Trilla de 412 RC',
        form: '412-Siega-12/412-Trilla-3',
        primary: null
      },
      {
        name: 'Fiesta',
        calendar: 'Eana',
        text: 'Semana del Yunque de 1 RC',
        form: '1-Semana del Yunque (cada año)',
        primary: null
      }
    ])
    const wrong = { pageId: gris, properties: [{ name: 'Nacimiento', type: 'date', value: '412-Nada-3' }] }
    await fails('editPage', wrong, 'BAD_DATE')
    expect(await aiError('editPage', wrong)).toMatch(/^BAD_DATE.*Nacimiento.*Nada/)
    await fails(
      'editPage',
      { pageId: gris, properties: [{ name: 'Nacimiento', type: 'date', value: '412', calendar: 'Élfico' }] },
      'BAD_DATE'
    )
    // Un mundo sin calendario: lo dice
    const other = (await ok200('createWorld', { name: 'Sin tiempo' })).id
    const lone = (await ok200('createPage', { worldId: other, title: 'Sola' })).id
    await fails('editPage', { pageId: lone, properties: [{ name: 'Fecha', type: 'date', value: '1' }] }, 'NO_CALENDAR')
  })

  it('en el YAML, la fecha va en su forma: reescribir el cuerpo la conserva como fecha, y una plantilla la recibe', async () => {
    const gris = await newPage('Mamá Gris')
    await ok200('editPage', { pageId: gris, properties: [{ name: 'Nacimiento', type: 'date', value: '-34-Siega-3' }] })
    await ok200('editPage', {
      pageId: gris,
      body: { mode: 'replace', markdown: '---\nNacimiento: -30-Siega-4\n---\nUna bruja.' }
    })
    expect((await dateOf(gris, 'Nacimiento'))?.text).toBe('4 de Siega de -30 RC')
    // Una plantilla «Personaje» con Nacimiento y Muerte (Fecha): la IA los rellena al crear
    const personaje = await ok200('createTemplate', { name: 'Personaje' })
    await ok200('updateTemplate', {
      templateId: personaje.id,
      fields: [
        { name: 'Nacimiento', type: 'date', value: null },
        { name: 'Muerte', type: 'date', value: null, offTimeline: true }
      ]
    })
    await fails(
      'updateTemplate',
      {
        templateId: personaje.id,
        fields: [{ name: 'Nacimiento', type: 'date', value: { calendarId: calendar.id, start: { year: 1 } } }]
      },
      'BAD_FIELD'
    )
    const created = await ok200('createPages', {
      worldId,
      parentId: null,
      pages: [{ key: 'v', title: 'Varn', template: 'Personaje', markdown: '---\nnacimiento: 380-Siega-1\n---\n' }]
    })
    const varn = created.pages[0].id
    const properties = (await ok200('getPage', { pageId: varn })).properties as DateProperty[]
    expect(properties.map((p) => [p.name, p.text ?? null, p.field !== undefined])).toEqual([
      ['Nacimiento', '1 de Siega de 380 RC', true],
      ['Muerte', null, true]
    ])
    expect(properties[1]).toMatchObject({ offTimeline: true, value: null })
    // Y con createPage desde la plantilla: sus campos de fecha, vacíos
    const blank = await ok200('createPage', { worldId, title: 'Ilsa', template: personaje.id })
    expect((blank.properties as DateProperty[]).map((p) => p.value)).toEqual([null, null])
  })

  it('la búsqueda sigue funcionando con fechas: encuentra por cómo se leen, no por sus ids', async () => {
    const puerto = await newPage('Puerto Ceniza')
    await newPage('Kharum')
    await ok200('editPage', {
      pageId: puerto,
      properties: [{ name: 'Fundación', type: 'date', value: '412-Siega-12' }]
    })
    expect(await search('Siega')).toEqual(['Puerto Ceniza'])
    expect(await search('Kharum')).toEqual(['Kharum'])
    expect(await search(calendar.id.slice(0, 8))).toEqual([])
    expect(await search('calendarid')).toEqual([])
  })

  it('un campo «Oculto» de tipo fecha no le llega a la jugadora (página, lectura de la IA, búsqueda); el visible, sí', async () => {
    const puerto = await newPage('Puerto Ceniza')
    const trilla = calendar.definition.months.find((m) => m.name === 'Trilla')?.id ?? ''
    await ok200('setKnowledge', { worldId, campaignId: marca, kind: 'page', targetId: puerto, known: true })
    await ok200('setPageProperties', {
      pageId: puerto,
      properties: [
        {
          name: 'Fundación',
          type: 'date',
          value: { calendarId: calendar.id, start: { year: 412, month: siega, day: 12 } }
        },
        {
          name: 'Coronación secreta',
          type: 'date',
          hidden: true,
          value: { calendarId: calendar.id, start: { year: 1305, month: trilla, day: 5 } }
        }
      ]
    })
    // Lo que se guarda para buscar no lleva la era solo del máster (que cuenta desde su inicio)
    expect((await dateOf(puerto, 'Coronación secreta'))?.text).toBe('5 de Trilla de 1305 RC')
    // El máster la lee con su era
    const masterRead = await ok200('readPage', { pageId: puerto })
    expect(masterRead.dates.map((d: { text: string }) => d.text)).toContain('5 de Trilla de 6 EE')
    const asked = { campaignId: marca }
    const page = await ok200('getPage', { pageId: puerto, ...asked }, ana.cookie)
    const read = await ok200('readPage', { pageId: puerto, ...asked }, ana.cookie)
    const everything = JSON.stringify([page, read])
    expect(everything).toContain('12 de Siega de 412 RC')
    for (const leak of ['Coronación', '1305', 'Trilla', 'EE']) expect(everything).not.toContain(leak)
    expect(await search('Trilla')).toEqual(['Puerto Ceniza'])
    expect(await search('Trilla', ana.cookie)).toEqual([])
    expect(await search('Siega', ana.cookie)).toEqual(['Puerto Ceniza'])
  })

  it('copiar una página copia sus fechas tal cual', async () => {
    const puerto = await newPage('Puerto Ceniza')
    await ok200('editPage', {
      pageId: puerto,
      properties: [{ name: 'Fundación', type: 'date', value: '412-Siega-12/412-Siega-20 (cada año)' }]
    })
    const copy = await ok200('copyPage', { pageId: puerto })
    expect(await dateOf(copy.id, 'Fundación')).toEqual(await dateOf(puerto, 'Fundación'))
  })

  it('las tablas que se llenan solas ordenan por fecha (por su día, no por su texto)', async () => {
    const faccion = await ok200('createTemplate', { name: 'Facción' })
    const pnj = await ok200('createTemplate', { name: 'PNJ' })
    const fields = await ok200('updateTemplate', {
      templateId: pnj.id,
      fields: [
        { name: 'Facción', field: 'faccion', type: 'pages', value: [] },
        { name: 'Nacimiento', field: 'nacimiento', type: 'date', value: null }
      ]
    })
    expect(fields.fields).toHaveLength(2)
    const casa = await ok200('createPage', { worldId, title: 'Casa Orm', template: faccion.id })
    await ok200('setPagePanel', {
      pageId: casa.id,
      blocks: [
        {
          id: 'miembros',
          type: 'related',
          title: 'Miembros',
          template: pnj.id,
          field: 'faccion',
          columns: ['nacimiento'],
          sort: 'nacimiento'
        }
      ]
    })
    // «2 de Siega» va antes que «10 de Cierzo» por texto, pero después por fecha (Cierzo es el primer mes)
    for (const [title, born] of [
      ['Aldren', '400-Siega-2'],
      ['Ilsa', '400-Cierzo-10'],
      ['Doran', null]
    ] as const) {
      await ok200('createPages', {
        worldId,
        parentId: null,
        pages: [
          {
            key: title,
            title,
            template: 'PNJ',
            markdown: `---\nFacción: "[[Casa Orm]]"\n${born ? `Nacimiento: ${born}\n` : ''}---\n`
          }
        ]
      })
    }
    const { tables } = await ok200('getPageTables', { pageId: casa.id })
    expect(tables[0].rows.map((r: { title: string }) => r.title)).toEqual(['Ilsa', 'Aldren', 'Doran'])
  })

  it('un calendario con fechas: quitar su mes o borrarlo se impide (dice cuántas); acortarlo avisa; renombrar las relee', async () => {
    const puerto = await newPage('Puerto Ceniza')
    const kharum = await newPage('Kharum')
    await ok200('editPage', {
      pageId: puerto,
      properties: [{ name: 'Fundación', type: 'date', value: '412-Siega-27' }]
    })
    await ok200('editPage', { pageId: kharum, properties: [{ name: 'Fundación', type: 'date', value: '380-Siega' }] })
    const months = calendar.definition.months
    const removing = {
      calendarId: calendar.id,
      definition: { ...DEFINITION, months: months.filter((m) => m.id !== siega) }
    }
    await fails('updateCalendar', removing, 'CALENDAR_MONTH_IN_USE')
    expect(await aiError('updateCalendar', removing)).toMatch(/^CALENDAR_MONTH_IN_USE: 2 fechas/)
    await fails('deleteCalendar', { calendarId: calendar.id }, 'CALENDAR_IN_USE')
    expect(await aiError('deleteCalendar', { calendarId: calendar.id })).toMatch(/2 fechas/)
    // Acortar Siega a 20 días: la del 27 se lee en el 20, y se dice
    const shorter = months.map((m) => (m.id === siega ? { ...m, days: 20 } : m))
    const saved = await ok200('updateCalendar', {
      calendarId: calendar.id,
      definition: { ...DEFINITION, months: shorter }
    })
    expect(saved.clipped).toBe(1)
    expect((await dateOf(puerto, 'Fundación'))?.value?.start.day).toBe(27)
    expect((await dateOf(puerto, 'Fundación'))?.text).toBe('20 de Siega de 412 RC')
    // Renombrar el mes: cómo se leen (y se buscan) sus fechas cambia en la misma operación, que se deshace
    const renamed = shorter.map((m) => (m.id === siega ? { ...m, name: 'Cosecha' } : m))
    // (la era que empezaba en Siega, ahora en Cosecha: se escribe por el nombre)
    const eras = DEFINITION.eras.map((era) => ({ ...era, start: era.start.replace('Siega', 'Cosecha') }))
    await ok200('updateCalendar', { calendarId: calendar.id, definition: { ...DEFINITION, months: renamed, eras } })
    expect((await dateOf(kharum, 'Fundación'))?.text).toBe('Cosecha de 380 RC')
    expect(await search('Cosecha')).toEqual(expect.arrayContaining(['Puerto Ceniza', 'Kharum']))
    await undo('updateCalendar')
    expect((await dateOf(kharum, 'Fundación'))?.text).toBe('Siega de 380 RC')
  })
})
