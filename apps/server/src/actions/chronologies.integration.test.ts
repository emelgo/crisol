/**
 * Las cronologías de un mundo (módulo 8, capacidad `cronologias`): crearlas con su calendario y su filtro, los eventos
 * sueltos (en lote, con la forma de la IA, con grupo y página), las páginas con fecha que salen solas, convertir entre
 * calendarios, convertir un evento en página, los grupos, deshacer, las fechas en uso y lo que ve una jugadora
 * (ADR-0017: solo lo revelado y lo que conoce su campaña)
 */
import { connect, schema } from '@crisol/db'
import { freshTestDatabase, resetDatabase } from '@crisol/db/testing'
import { keyBetween } from '@crisol/domain'
import { desc, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import { createTestAuth, signUpTestUser, TEST_SEAL_KEY } from '../testing.ts'

const BASE_URL = 'http://localhost:5173'
const ok = async () => undefined

const fest = (name: string) => ({ name, days: 7, festival: true })
const month = (name: string) => ({ name, days: 28 })
const EANA = {
  yearSuffix: 'RC',
  weekdays: ['Herrero', 'Hacedor', 'Muerte', 'Frostelle', 'Flora', 'Eternidad', 'Melancolía'],
  months: [
    fest('Alba Triste'),
    month('Cierzo'),
    month('Escarcha'),
    month('Deshielo'),
    fest('Carnaval'),
    month('Siembra'),
    month('Florida'),
    month('Pastos'),
    fest('Semana del Yunque'),
    month('Siega'),
    month('Trilla'),
    month('Vendimia'),
    fest('Semana de las Hermanas'),
    month('Hojarasca'),
    month('Brumas'),
    month('Nochelarga')
  ],
  eras: [
    { name: 'Era del Eclipse', abbreviation: 'EE', start: '1300-Siega-1', hidden: true },
    { name: 'Era de la República', abbreviation: 'ER', start: '0' }
  ]
}

type Entry = {
  key: string
  kind: 'event' | 'page'
  title: string
  field?: string
  text: string
  form: string
  yearly?: true
  pageId?: string
  eventId?: string
  converted?: { name: string; text: string }
  page?: { id: string; title: string }
  hidden?: true
}

describe('las cronologías de un mundo (módulo 8)', () => {
  let conn: ReturnType<typeof connect>
  let auth: ReturnType<typeof createTestAuth>
  let app: ReturnType<typeof buildApp>
  let master: { userId: string; cookie: string }
  let ana: { userId: string; cookie: string }
  let worldId: string
  let marca: string
  let eana: { id: string; definition: { months: Array<{ id: string; name: string }> } }

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
    return response.json()
  }
  const undo = async (action: string) => {
    const [op] = await conn.db
      .select()
      .from(schema.operations)
      .where(eq(schema.operations.action, action))
      .orderBy(desc(schema.operations.createdAt))
    expect((await ok200('undoOperation', { operationId: op?.id })).status).toBe('undone')
  }
  const entries = async (chronologyId: string, extra: object = {}, cookie = master.cookie) =>
    (await ok200('getChronology', { chronologyId, ...extra }, cookie)).entries as Entry[]
  const titles = async (chronologyId: string, extra: object = {}, cookie = master.cookie) =>
    (await entries(chronologyId, extra, cookie)).map((e) => (e.field ? `${e.title} · ${e.field}` : e.title))
  const newPage = async (title: string, parentId: string | null = null) =>
    (await ok200('createPage', { worldId, title, parentId })).id as string
  const dated = async (pageId: string, properties: object[]) => ok200('editPage', { pageId, properties })
  const historia = () => ok200('createChronology', { worldId, name: 'Historia antigua' })

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_chronologies'), { max: 4 })
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
    eana = await ok200('createCalendar', { worldId, name: 'Eana', from: { definition: EANA } })
  })

  afterAll(async () => {
    await app?.close()
    await conn?.close()
  })

  it('una cronología necesita un calendario; nace con el principal y todo dentro; se cambia, se ordena y se borra', async () => {
    const lone = (await ok200('createWorld', { name: 'Vacío' })).id
    await fails('createChronology', { worldId: lone, name: 'Nada' }, 'NO_CALENDAR')
    const first = await historia()
    expect(first).toMatchObject({ calendarId: null, filter: { pages: true, templates: [], tags: [], groups: [] } })
    const second = await ok200('createChronology', { worldId, name: 'La campaña', calendarId: eana.id })
    let listed = (await ok200('listChronologies', { worldId })).chronologies
    expect(listed.map((c: { name: string }) => c.name)).toEqual(['Historia antigua', 'La campaña'])
    expect(listed[0]).toMatchObject({ calendarName: 'Eana', entries: 0, span: null })
    await ok200('updateChronology', { chronologyId: second.id, after: null, name: 'Campaña', filter: { pages: false } })
    listed = (await ok200('listChronologies', { worldId })).chronologies
    expect(listed.map((c: { name: string }) => c.name)).toEqual(['Campaña', 'Historia antigua'])
    expect(listed[0].filter).toEqual({ pages: false, templates: [], tags: [], groups: [] })
    await fails('updateChronology', { chronologyId: first.id, filter: { groups: [crypto.randomUUID()] } }, 'BAD_GROUP')
    await ok200('deleteChronology', { chronologyId: first.id })
    expect((await ok200('listChronologies', { worldId })).chronologies).toHaveLength(1)
    await undo('deleteChronology')
    expect((await ok200('listChronologies', { worldId })).chronologies).toHaveLength(2)
    const { entries: history } = await ok200('listHistory', { worldId })
    expect(history.some((e: { action: string }) => e.action === 'createChronology')).toBe(true)
  })

  it('eventos en lote con la forma de la IA: un día, un rango que cruza dos meses y uno de cada año, con grupo y página', async () => {
    const ilsa = await newPage('Ilsa de Varn')
    const { events } = await ok200('createTimelineEvents', {
      worldId,
      events: [
        { title: 'Boda de Ilsa y Doran', date: '1247-Siega-18', group: 'La Corona', pageId: ilsa, icon: '💍' },
        { title: 'Campaña de los Pasos', date: '1247-Siega-20/1247-Trilla-3', group: 'Guerras', color: 'ochre' },
        { title: 'Feria de Vendimia', date: '413-Vendimia-1 (cada año)', group: 'La Corona' },
        { date: '312', newPage: { title: 'La Caída de los Gigantes' } }
      ]
    })
    expect(events).toHaveLength(4)
    const { groups } = await ok200('listChronologies', { worldId })
    expect(groups.map((g: { name: string }) => g.name)).toEqual(['La Corona', 'Guerras'])
    const chronology = await historia()
    const list = await entries(chronology.id)
    expect(list.map((e) => [e.title, e.text])).toEqual([
      ['La Caída de los Gigantes', '312 RC'],
      ['Feria de Vendimia', '1 de Vendimia de 413 RC'],
      ['Boda de Ilsa y Doran', '18 de Siega de 1247 RC'],
      ['Campaña de los Pasos', '20 de Siega – 3 de Trilla de 1247 RC']
    ])
    expect(list[1]).toMatchObject({ yearly: true, form: '413-Vendimia-1 (cada año)' })
    expect(list[2]?.page).toMatchObject({ id: ilsa, title: 'Ilsa de Varn' })
    // La página nueva existe, con su título; el evento, sin el suyo (lee el de la página)
    expect(list[0]?.page?.title).toBe('La Caída de los Gigantes')
    expect(list[0]?.kind).toBe('event')
    // Una fecha mala: dice cuál y no crea ninguno
    await fails(
      'createTimelineEvents',
      {
        worldId,
        events: [
          { title: 'Bien', date: '1250' },
          { title: 'Mal', date: '1250-Nada-3' }
        ]
      },
      'BAD_DATE'
    )
    expect(await entries(chronology.id)).toHaveLength(4)
    await fails('createTimelineEvents', { worldId, events: [{ date: '1250' }] }, 'INVALID_INPUT')
  })

  it('las páginas con fecha salen solas (una vez por fecha, sin las de fuera de las cronologías); el filtro', async () => {
    const puerto = await newPage('Puerto Ceniza')
    await dated(puerto, [
      { name: 'Fundación', type: 'date', value: '412-Siega-12' },
      { name: 'etiquetas', type: 'list', value: ['lugar/ciudad'] }
    ])
    const aldren = await newPage('Aldren IV')
    await dated(aldren, [
      { name: 'Nacimiento', type: 'date', value: '1190' },
      { name: 'Muerte', type: 'date', value: '1247-Siega-27' }
    ])
    await ok200('setPageProperties', {
      pageId: (await newPage('Diario')) as string,
      properties: [
        {
          name: 'Última visita',
          type: 'date',
          value: { calendarId: eana.id, start: { year: 1250 } },
          offTimeline: true
        }
      ]
    })
    await ok200('createTimelineEvents', {
      worldId,
      events: [{ title: 'Asedio', date: '1248-Escarcha-2', group: 'Guerras' }]
    })
    const chronology = await historia()
    expect(await titles(chronology.id)).toEqual([
      'Puerto Ceniza',
      'Aldren IV · Nacimiento',
      'Aldren IV · Muerte',
      'Asedio'
    ])
    const [guerras] = (await ok200('listChronologies', { worldId })).groups
    await ok200('updateChronology', { chronologyId: chronology.id, filter: { tags: ['lugar'] } })
    expect(await titles(chronology.id)).toEqual(['Puerto Ceniza', 'Asedio'])
    await ok200('updateChronology', { chronologyId: chronology.id, filter: { pages: false, groups: [guerras.id] } })
    expect(await titles(chronology.id)).toEqual(['Asedio'])
    // Buscar: por intervalo y por texto
    await ok200('updateChronology', { chronologyId: chronology.id, filter: { pages: true, tags: [], groups: [] } })
    expect(await titles(chronology.id, { from: '1247', to: '1247-Nochelarga-28' })).toEqual(['Aldren IV · Muerte'])
    expect(await titles(chronology.id, { text: 'asedio' })).toEqual(['Asedio'])
    // Y las cuenta la lista
    const [listed] = (await ok200('listChronologies', { worldId })).chronologies
    expect(listed).toMatchObject({
      entries: 4,
      span: { from: '12 de Siega de 412 RC', to: '2 de Escarcha de 1248 RC' }
    })
  })

  it('lo de otro calendario se convierte con su correspondencia; sin ella, queda fuera y se cuenta', async () => {
    const varn = await ok200('createCalendar', { worldId, name: 'Cuenta de Varn', from: 'gregorian' })
    await ok200('updateCalendar', {
      calendarId: varn.id,
      definition: { ...varn.definition, correspondence: { date: '1000-Cierzo-1' } }
    })
    const kharum = await ok200('createCalendar', { worldId, name: 'Kharum', from: 'blank' })
    await ok200('createTimelineEvents', {
      worldId,
      events: [
        { title: 'Llegada', date: '0-1-1', calendar: 'Cuenta de Varn' },
        { title: 'Perdido', date: '3', calendar: 'Kharum' }
      ]
    })
    const chronology = await historia()
    const { entries: list, outside } = await ok200('getChronology', { chronologyId: chronology.id })
    expect(outside).toBe(1)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      title: 'Llegada',
      text: '1 de Cierzo de 1000 RC',
      converted: { name: 'Cuenta de Varn' }
    })
    // En una cronología con ese otro calendario, lo de Eana se pasa a él
    await ok200('createTimelineEvents', { worldId, events: [{ title: 'En Eana', date: '1000-Cierzo-2' }] })
    const other = await ok200('createChronology', { worldId, name: 'Varn', calendarId: varn.id })
    expect((await entries(other.id)).map((e) => e.text)).toEqual(['1 de Enero de 0', '2 de Enero de 0'])
    expect(kharum.id).toBeTruthy()
  })

  it('cambiar un evento (la fecha, al arrastrarlo; desenlazarlo), borrarlo y deshacerlo', async () => {
    const chronology = await historia()
    const [boda] = (
      await ok200('createTimelineEvents', { worldId, events: [{ title: 'Boda', date: '1247-Siega-18' }] })
    ).events
    const moved = await ok200('updateTimelineEvent', { eventId: boda.id, date: '1247-Siega-21' })
    expect(moved.date.start).toMatchObject({ year: 1247, day: 21 })
    await ok200('updateTimelineEvent', {
      eventId: boda.id,
      date: { calendarId: eana.id, start: { year: 1247, month: eana.definition.months[9]?.id, day: 22 } }
    })
    expect((await entries(chronology.id))[0]?.text).toBe('22 de Siega de 1247 RC')
    await fails('updateTimelineEvent', { eventId: boda.id, title: '' }, 'EVENT_NEEDS_TITLE')
    await undo('updateTimelineEvent')
    expect((await entries(chronology.id))[0]?.text).toBe('21 de Siega de 1247 RC')
    await ok200('deleteTimelineEvent', { eventId: boda.id })
    expect(await entries(chronology.id)).toEqual([])
    await undo('deleteTimelineEvent')
    expect(await titles(chronology.id)).toEqual(['Boda'])
  })

  it('convertir un evento en página: con su texto y su portada; el evento queda enlazado, y se deshace', async () => {
    const parent = await newPage('Historia')
    const [org] = await conn.db.select().from(schema.organizations)
    const [file] = await conn.db
      .insert(schema.files)
      .values({
        organizationId: org?.id ?? '',
        worldId,
        name: 'castillo.webp',
        kind: 'image',
        mime: 'image/webp',
        size: 10,
        hash: 'x',
        storageKey: 'test/castillo'
      })
      .returning()
    if (!file) throw new Error('sin archivo')
    const [boda] = (
      await ok200('createTimelineEvents', {
        worldId,
        events: [
          {
            title: 'Boda de Ilsa',
            date: '1247-Siega-18',
            icon: '💍',
            description: 'En el Salón de las Velas.',
            image: { fileId: file.id, x: 50, y: 30 }
          }
        ]
      })
    ).events
    const { pageId, event } = await ok200('convertEventToPage', { eventId: boda.id, parentId: parent })
    expect(event).toMatchObject({ title: '', description: '', pageId })
    const page = await ok200('getPage', { pageId })
    expect(page).toMatchObject({ title: 'Boda de Ilsa', icon: '💍', parentId: parent })
    expect(page.cover).toMatchObject({ fileId: file.id })
    const read = await ok200('readPage', { pageId })
    expect(read.markdown).toContain('En el Salón de las Velas.')
    const chronology = await historia()
    expect((await entries(chronology.id))[0]).toMatchObject({ title: 'Boda de Ilsa', page: { id: pageId } })
    // La página dice, discreta, que la enlaza un evento (al máster)
    expect((await ok200('getPageLinks', { pageId })).events).toEqual([
      { id: boda.id, title: 'Boda de Ilsa', text: '18 de Siega de 1247 RC' }
    ])
    await undo('convertEventToPage')
    expect((await entries(chronology.id))[0]?.page).toBeUndefined()
  })

  it('los grupos: la lista entera; quitar uno deja sus eventos sin grupo y lo saca de los filtros; se deshace', async () => {
    let { groups } = await ok200('updateTimelineGroups', {
      worldId,
      groups: [
        { name: 'La Corona', color: 'wine' },
        { name: 'Magia', color: '#8a6cd1' }
      ]
    })
    const [corona, magia] = groups
    await ok200('createTimelineEvents', { worldId, events: [{ title: 'Coronación', date: '0', groupId: corona.id }] })
    const chronology = await ok200('createChronology', { worldId, name: 'Corona', filter: { groups: [corona.id] } })
    ;({ groups } = await ok200('updateTimelineGroups', {
      worldId,
      groups: [{ id: magia.id, name: 'Magia y portentos', color: null }]
    }))
    expect(groups.map((g: { name: string }) => g.name)).toEqual(['Magia y portentos'])
    const [event] = await entries(chronology.id)
    expect(event).toMatchObject({ title: 'Coronación' })
    expect((await ok200('getChronology', { chronologyId: chronology.id })).chronology.filter.groups).toEqual([])
    await undo('updateTimelineGroups')
    const back = await ok200('listChronologies', { worldId })
    expect(back.groups.map((g: { name: string }) => g.name)).toEqual(['La Corona', 'Magia'])
    expect(back.chronologies[0].filter.groups).toEqual([corona.id])
  })

  it('las fechas de los eventos están en uso: no se borra su calendario ni se quita su mes; sin fechas, la cronología pasa al principal', async () => {
    const otro = await ok200('createCalendar', { worldId, name: 'Otro', from: 'blank' })
    await ok200('createTimelineEvents', { worldId, events: [{ title: 'Siega', date: '1250-Siega-1' }] })
    await fails(
      'updateCalendar',
      {
        calendarId: eana.id,
        definition: { ...EANA, months: EANA.months.filter((m) => m.name !== 'Siega') }
      },
      'CALENDAR_MONTH_IN_USE'
    )
    const chronology = await ok200('createChronology', { worldId, name: 'Otra', calendarId: otro.id })
    await ok200('deleteCalendar', { calendarId: otro.id })
    expect((await ok200('getChronology', { chronologyId: chronology.id })).chronology.calendarId).toBeNull()
    await undo('deleteCalendar')
    expect((await ok200('getChronology', { chronologyId: chronology.id })).chronology.calendarId).toBe(otro.id)
    await ok200('updateCalendar', { calendarId: otro.id, primary: true })
    await fails('deleteCalendar', { calendarId: eana.id }, 'CALENDAR_IN_USE')
  })

  it('la jugadora: solo las cronologías reveladas y, dentro, lo que sabe su campaña; sin eras ocultas ni escribir', async () => {
    const conocida = await newPage('Puerto Ceniza')
    const secreta = await newPage('La Torre')
    const campos = await newPage('Aldren')
    await dated(conocida, [{ name: 'Fundación', type: 'date', value: '412' }])
    await dated(secreta, [{ name: 'Fundación', type: 'date', value: '413' }])
    await ok200('setPageProperties', {
      pageId: campos,
      properties: [
        { name: 'Nacimiento', type: 'date', value: { calendarId: eana.id, start: { year: 1190 } } },
        { name: 'Defunción', type: 'date', value: { calendarId: eana.id, start: { year: 1247 } }, hidden: true }
      ]
    })
    for (const pageId of [conocida, campos])
      await ok200('setKnowledge', { worldId, campaignId: marca, kind: 'page', targetId: pageId, known: true })
    const { events } = await ok200('createTimelineEvents', {
      worldId,
      events: [
        { title: 'Visible', date: '1000' },
        { title: 'Oculto', date: '1001', hidden: true },
        { title: 'Revelado', date: '1002', hidden: true },
        { title: 'Con su título', date: '1003', pageId: secreta },
        { date: '1004', pageId: secreta },
        { date: '1005', pageId: conocida },
        { title: 'Tras el eclipse', date: '1301' }
      ]
    })
    const chronology = await historia()
    // Sin revelar, no la ve ni la encuentra
    expect((await ok200('listChronologies', { worldId }, ana.cookie)).chronologies).toEqual([])
    await fails('getChronology', { chronologyId: chronology.id }, 'NOT_FOUND', ana.cookie)
    await ok200('setKnowledge', {
      worldId,
      campaignId: marca,
      kind: 'chronology',
      targetId: chronology.id,
      known: true
    })
    await ok200('setKnowledge', { worldId, campaignId: marca, kind: 'event', targetId: events[2].id, known: true })
    const seen = await entries(chronology.id, {}, ana.cookie)
    expect(seen.map((e) => (e.field ? `${e.title} · ${e.field}` : e.title))).toEqual([
      'Puerto Ceniza',
      'Visible',
      'Revelado',
      'Con su título',
      'Puerto Ceniza',
      'Aldren',
      'Tras el eclipse'
    ])
    // Sin enlace a la página que no conoce; ninguna marca de oculto; sin el nombre del campo oculto
    expect(seen.find((e) => e.title === 'Con su título')?.page).toBeUndefined()
    expect(seen.find((e) => e.title === 'Con su título')?.pageId).toBeUndefined()
    expect(seen.every((e) => !e.hidden)).toBe(true)
    const body = JSON.stringify(await ok200('getChronology', { chronologyId: chronology.id }, ana.cookie))
    for (const word of ['Oculto', 'La Torre', 'Defunción', 'Eclipse', secreta]) expect(body).not.toContain(word)
    expect(JSON.stringify(await ok200('listChronologies', { worldId }, ana.cookie))).not.toContain('Torre')
    // La ficha de quién la conoce, para el máster
    const knows = await ok200('getItemKnowledge', { worldId, kind: 'event', targetId: events[1].id })
    expect(knows.campaigns).toEqual([{ campaignId: marca, name: 'La Marca', knows: false, seesPage: true }])
    // No escribe
    for (const [name, input] of [
      ['createChronology', { worldId, name: 'Mía' }],
      ['createTimelineEvents', { worldId, events: [{ title: 'x', date: '1' }] }],
      ['updateTimelineEvent', { eventId: events[0].id, title: 'y' }],
      ['deleteTimelineEvent', { eventId: events[0].id }]
    ] as const) {
      const response = await call(name, input, ana.cookie)
      expect([403, 404]).toContain(response.statusCode)
    }
  })

  /** 5.000 páginas con fecha y 2.000 eventos sueltos en el mundo; la cronología que los junta */
  const bigWorld = async () => {
    const [world] = await conn.db.select().from(schema.worlds).where(eq(schema.worlds.id, worldId))
    if (!world) throw new Error('sin mundo')
    const siega = eana.definition.months[9]?.id ?? ''
    let position: string | null = null
    const pages = Array.from({ length: 5000 }, (_, i) => {
      position = keyBetween(position, null)
      return {
        worldId,
        position,
        title: `Página ${i}`,
        properties: [
          {
            name: 'Fecha',
            type: 'date',
            value: { calendarId: eana.id, start: { year: i - 2500, month: siega, day: 1 + (i % 28) } }
          }
        ]
      }
    })
    for (let i = 0; i < pages.length; i += 1000) await conn.db.insert(schema.pages).values(pages.slice(i, i + 1000))
    const events = Array.from({ length: 2000 }, (_, i) => ({
      worldId,
      title: `Evento ${i}`,
      date: { calendarId: eana.id, start: { year: i - 1000 } }
    }))
    await conn.db.insert(schema.timelineEvents).values(events)
    return historia()
  }

  it('2.000 eventos y 5.000 páginas con fecha salen todos', async () => {
    const chronology = await bigWorld()
    expect((await ok200('getChronology', { chronologyId: chronology.id })).entries).toHaveLength(7000)
  })

  // Se mide sola (CRISOL_RENDIMIENTO=1, su paso en la CI y `pnpm --filter @crisol/server test:rendimiento`): con las
  // demás pruebas a la vez, lo que se mide es la carga de la máquina
  it.skipIf(!process.env.CRISOL_RENDIMIENTO)(
    'rendimiento: 2.000 eventos y 5.000 páginas con fecha responden en menos de 300 ms',
    async () => {
      const chronology = await bigWorld()
      // Con las estadísticas al día, como en producción. La primera calienta; se mide la mediana de tres, como en las
      // relaciones (el VPS de pruebas es compartido: un pico suelto no dice nada del cálculo)
      await conn.sql`analyze`
      await ok200('getChronology', { chronologyId: chronology.id })
      const times: number[] = []
      for (let i = 0; i < 3; i++) {
        // Lo que tarda en responder (sin leer luego la respuesta aquí)
        const started = performance.now()
        const response = await call('getChronology', { chronologyId: chronology.id })
        times.push(performance.now() - started)
        expect(response.json().entries).toHaveLength(7000)
      }
      const took = times.sort((a, b) => a - b)[1] ?? 0
      process.stdout.write(`cronología: 2.000 eventos y 5.000 páginas, ${Math.round(took)} ms\n`)
      expect(took).toBeLessThan(300)
    },
    120_000
  )
})
