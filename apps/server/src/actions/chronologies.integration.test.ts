/**
 * Las cronologías de un mundo (módulo 8, capacidad `cronologias`; ADR-0031: cada una, una pestaña de una página;
 * ADR-0032: cada evento, de una): crearlas con su calendario y su filtro (en una página nueva o como pestaña de otra), sus
 * eventos (en lote, con la forma de la IA, con grupo y página; solo en la suya), las páginas con fecha si se piden, convertir entre
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
  groupId?: string
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
  const historia = (filter: object = {}) => ok200('createChronology', { worldId, name: 'Historia antigua', filter })
  /** Una cronología con las páginas con fecha del mundo (por defecto no salen) */
  const withPages = () => historia({ pages: true })
  const addEvents = async (chronologyId: string, events: object[]) =>
    (await ok200('createTimelineEvents', { chronologyId, events })).events

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

  it('una cronología es una pestaña: en una página nueva o en otra; nace con el principal y todo dentro; se cambia y se borra', async () => {
    const lone = (await ok200('createWorld', { name: 'Vacío' })).id
    await fails('createChronology', { worldId: lone, name: 'Nada' }, 'NO_CALENDAR')
    const first = await historia()
    // Sin eventos y sin las páginas con fecha (ADR-0032)
    expect(first).toMatchObject({ calendarId: null, filter: { pages: false, templates: [], tags: [] } })
    // Sin página, una nueva con su nombre y su pestaña «Cronología»
    const page = await ok200('getPage', { pageId: first.pageId })
    expect(page.title).toBe('Historia antigua')
    const { tabs } = await ok200('listPageTabs', { pageId: first.pageId })
    expect(tabs.map((tab: { kind: string; name: string }) => [tab.kind, tab.name])).toEqual([
      ['chronology', 'Cronología']
    ])
    expect(tabs[0].id).toBe(first.tabId)
    // Se lee también por su pestaña
    expect((await ok200('getChronology', { tabId: first.tabId })).chronology.id).toBe(first.id)
    // En una página que ya hay: una pestaña más, con su nombre
    const reino = await newPage('El reino')
    const second = await ok200('createChronology', { worldId, name: 'La campaña', pageId: reino, calendarId: eana.id })
    expect(second.pageId).toBe(reino)
    let listed = (await ok200('listChronologies', { worldId })).chronologies
    expect(listed.map((c: { name: string }) => c.name)).toEqual(['El reino · La campaña', 'Historia antigua'])
    expect(listed[1]).toMatchObject({ calendarName: 'Eana', entries: 0, span: null, groups: [] })
    // Cambiar su nombre es cambiar el de su pestaña
    await ok200('updateChronology', { chronologyId: second.id, name: 'Campaña', filter: { pages: true } })
    listed = (await ok200('listChronologies', { worldId })).chronologies
    expect(listed.map((c: { name: string }) => c.name)).toEqual(['El reino · Campaña', 'Historia antigua'])
    expect(listed[0].filter).toEqual({ pages: true, templates: [], tags: [] })
    expect((await ok200('listPageTabs', { pageId: reino })).tabs[0].name).toBe('Campaña')
    // «Pestaña nueva» de tipo cronología también la crea, con el principal
    const tab = await ok200('createPageTab', { pageId: reino, kind: 'chronology' })
    // La segunda de la página, con su número
    expect(tab.name).toBe('Cronología 2')
    expect((await ok200('getChronology', { tabId: tab.id })).chronology.calendarId).toBeNull()
    await ok200('deletePageTab', { tabId: tab.id })
    // Borrarla se lleva su pestaña, sus eventos y sus grupos; su página se queda. Deshacer lo devuelve todo
    await addEvents(first.id, [{ title: 'Fundación', date: '0', group: 'Orígenes' }])
    await ok200('deleteChronology', { chronologyId: first.id })
    expect((await ok200('listChronologies', { worldId })).chronologies).toHaveLength(1)
    expect((await ok200('listPageTabs', { pageId: first.pageId })).tabs).toEqual([])
    expect(await conn.db.select().from(schema.timelineEvents)).toEqual([])
    await undo('deleteChronology')
    expect((await ok200('listChronologies', { worldId })).chronologies).toHaveLength(2)
    const back = await ok200('getChronology', { chronologyId: first.id })
    expect(back.entries.map((e: Entry) => e.title)).toEqual(['Fundación'])
    expect(back.groups.map((g: { name: string }) => g.name)).toEqual(['Orígenes'])
    // La de una página en la papelera no sale
    await ok200('deletePage', { pageId: first.pageId })
    expect((await ok200('listChronologies', { worldId })).chronologies).toHaveLength(1)
    const { entries: history } = await ok200('listHistory', { worldId })
    expect(history.some((e: { action: string }) => e.action === 'createChronology')).toBe(true)
  })

  it('eventos en lote con la forma de la IA: un día, un rango que cruza dos meses y uno de cada año, con grupo y página', async () => {
    const ilsa = await newPage('Ilsa de Varn')
    const chronology = await historia()
    const { events } = await ok200('createTimelineEvents', {
      chronologyId: chronology.id,
      events: [
        { title: 'Boda de Ilsa y Doran', date: '1247-Siega-18', group: 'La Corona', pageId: ilsa, icon: '💍' },
        { title: 'Campaña de los Pasos', date: '1247-Siega-20/1247-Trilla-3', group: 'Guerras', color: 'ochre' },
        { title: 'Feria de Vendimia', date: '413-Vendimia-1 (cada año)', group: 'La Corona' },
        { date: '312', newPage: { title: 'La Caída de los Gigantes' } }
      ]
    })
    expect(events).toHaveLength(4)
    expect(events[0]).toMatchObject({ chronologyId: chronology.id })
    const [listed] = (await ok200('listChronologies', { worldId })).chronologies
    expect(listed.groups.map((g: { name: string }) => g.name)).toEqual(['La Corona', 'Guerras'])
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
        chronologyId: chronology.id,
        events: [
          { title: 'Bien', date: '1250' },
          { title: 'Mal', date: '1250-Nada-3' }
        ]
      },
      'BAD_DATE'
    )
    expect(await entries(chronology.id)).toHaveLength(4)
    await fails('createTimelineEvents', { chronologyId: chronology.id, events: [{ date: '1250' }] }, 'INVALID_INPUT')
  })

  it('cada evento es de su cronología (como en Everlore): no sale en las demás; se pasa a otra y se lleva sin su grupo', async () => {
    const reino = await historia()
    const guerras = await ok200('createChronology', { worldId, name: 'Las guerras' })
    const [coronacion] = await addEvents(reino.id, [{ title: 'Coronación', date: '1249', group: 'Reyes' }])
    const [asedio] = await addEvents(guerras.id, [{ title: 'Asedio de Kord', date: '1250', group: 'Asedios' }])
    expect(await titles(reino.id)).toEqual(['Coronación'])
    expect(await titles(guerras.id)).toEqual(['Asedio de Kord'])
    // Cada una, con sus grupos (un grupo de otra no vale)
    const [reyes] = (await ok200('getChronology', { chronologyId: reino.id })).groups
    await fails('updateTimelineEvent', { eventId: asedio.id, groupId: reyes.id }, 'NOT_FOUND')
    // Pasarlo a otra: sale allí, sin su grupo (o con uno de allí, por su nombre)
    const moved = await ok200('updateTimelineEvent', { eventId: coronacion.id, chronologyId: guerras.id })
    expect(moved).toMatchObject({ chronologyId: guerras.id, groupId: null })
    expect(await titles(reino.id)).toEqual([])
    expect(await titles(guerras.id)).toEqual(['Coronación', 'Asedio de Kord'])
    await ok200('updateTimelineEvent', { eventId: coronacion.id, chronologyId: reino.id, group: 'Reyes' })
    expect((await entries(reino.id))[0]).toMatchObject({ title: 'Coronación', groupId: reyes.id })
    // La vista grande del calendario los junta todos, cada uno con su cronología
    const all = await ok200('listCalendarEntries', { calendarId: eana.id })
    expect(all.entries.map((e: Entry & { chronologyId?: string }) => [e.title, e.chronologyId])).toEqual([
      ['Coronación', reino.id],
      ['Asedio de Kord', guerras.id]
    ])
    expect(all.groups.map((g: { name: string }) => g.name).sort()).toEqual(['Asedios', 'Reyes'])
  })

  it('duplicar su página duplica la cronología con sus grupos y sus eventos, aparte (y deshacerlo los quita)', async () => {
    const reino = await historia()
    await addEvents(reino.id, [{ title: 'Coronación', date: '1249', group: 'Reyes' }])
    const copy = await ok200('copyPage', { pageId: reino.pageId })
    const { tabs } = await ok200('listPageTabs', { pageId: copy.id })
    const twin = await ok200('getChronology', { tabId: tabs[0].id })
    expect(twin.chronology.id).not.toBe(reino.id)
    expect(twin.entries.map((e: Entry) => e.title)).toEqual(['Coronación'])
    expect(twin.groups.map((g: { id: string; name: string }) => g.name)).toEqual(['Reyes'])
    expect(twin.entries[0].groupId).toBe(twin.groups[0].id)
    // Cambiar la copia no toca la original
    await ok200('updateTimelineEvent', { eventId: twin.entries[0].eventId, title: 'Otra coronación' })
    expect(await titles(reino.id)).toEqual(['Coronación'])
    await undo('updateTimelineEvent')
    await undo('copyPage')
    expect(await conn.db.select().from(schema.timelineEvents)).toHaveLength(1)
  })

  it('las páginas con fecha, si se piden (una vez por fecha, sin las de fuera de las cronologías); el filtro', async () => {
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
    const chronology = await withPages()
    await addEvents(chronology.id, [{ title: 'Asedio', date: '1248-Escarcha-2', group: 'Guerras' }])
    expect(await titles(chronology.id)).toEqual([
      'Puerto Ceniza',
      'Aldren IV · Nacimiento',
      'Aldren IV · Muerte',
      'Asedio'
    ])
    await ok200('updateChronology', { chronologyId: chronology.id, filter: { tags: ['lugar'] } })
    expect(await titles(chronology.id)).toEqual(['Puerto Ceniza', 'Asedio'])
    // Sin las páginas, solo sus eventos (como nace)
    await ok200('updateChronology', { chronologyId: chronology.id, filter: { pages: false } })
    expect(await titles(chronology.id)).toEqual(['Asedio'])
    // Buscar: por intervalo y por texto
    await ok200('updateChronology', { chronologyId: chronology.id, filter: { pages: true, tags: [] } })
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
    const chronology = await historia()
    await addEvents(chronology.id, [
      { title: 'Llegada', date: '0-1-1', calendar: 'Cuenta de Varn' },
      { title: 'Perdido', date: '3', calendar: 'Kharum' }
    ])
    const { entries: list, outside } = await ok200('getChronology', { chronologyId: chronology.id })
    expect(outside).toBe(1)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      title: 'Llegada',
      text: '1 de Cierzo de 1000 RC',
      converted: { name: 'Cuenta de Varn' }
    })
    // En una cronología con ese otro calendario, lo de Eana se pasa a él
    const other = await ok200('createChronology', { worldId, name: 'Varn', calendarId: varn.id })
    await addEvents(other.id, [
      { title: 'Desde Varn', date: '0-1-1', calendar: 'Cuenta de Varn' },
      { title: 'En Eana', date: '1000-Cierzo-2' }
    ])
    expect((await entries(other.id)).map((e) => e.text)).toEqual(['1 de Enero de 0', '2 de Enero de 0'])
    expect(kharum.id).toBeTruthy()
  })

  it('cambiar un evento (la fecha, al arrastrarlo; desenlazarlo), borrarlo y deshacerlo', async () => {
    const chronology = await historia()
    const [boda] = await addEvents(chronology.id, [{ title: 'Boda', date: '1247-Siega-18' }])
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
    const chronology = await historia()
    const [boda] = await addEvents(chronology.id, [
      {
        title: 'Boda de Ilsa',
        date: '1247-Siega-18',
        icon: '💍',
        description: 'En el Salón de las Velas.',
        image: { fileId: file.id, x: 50, y: 30 }
      }
    ])
    const { pageId, event } = await ok200('convertEventToPage', { eventId: boda.id, parentId: parent })
    expect(event).toMatchObject({ title: '', description: '', pageId })
    const page = await ok200('getPage', { pageId })
    expect(page).toMatchObject({ title: 'Boda de Ilsa', icon: '💍', parentId: parent })
    expect(page.cover).toMatchObject({ fileId: file.id })
    const read = await ok200('readPage', { pageId })
    expect(read.markdown).toContain('En el Salón de las Velas.')
    expect((await entries(chronology.id))[0]).toMatchObject({ title: 'Boda de Ilsa', page: { id: pageId } })
    // La página dice, discreta, que la enlaza un evento (al máster)
    expect((await ok200('getPageLinks', { pageId })).events).toEqual([
      { id: boda.id, title: 'Boda de Ilsa', text: '18 de Siega de 1247 RC' }
    ])
    await undo('convertEventToPage')
    expect((await entries(chronology.id))[0]?.page).toBeUndefined()
  })

  it('los grupos, de cada cronología: la lista entera; quitar uno deja sus eventos sin grupo; se deshace', async () => {
    const chronology = await ok200('createChronology', { worldId, name: 'Corona' })
    const other = await ok200('createChronology', { worldId, name: 'Otra' })
    let { groups } = await ok200('updateTimelineGroups', {
      chronologyId: chronology.id,
      groups: [
        { name: 'La Corona', color: 'wine' },
        { name: 'Magia', color: '#8a6cd1' }
      ]
    })
    const [corona, magia] = groups
    expect(corona).toMatchObject({ chronologyId: chronology.id })
    await addEvents(chronology.id, [{ title: 'Coronación', date: '0', groupId: corona.id }])
    // Un grupo de otra cronología no vale
    await fails(
      'createTimelineEvents',
      { chronologyId: other.id, events: [{ title: 'x', date: '0', groupId: corona.id }] },
      'NOT_FOUND'
    )
    ;({ groups } = await ok200('updateTimelineGroups', {
      chronologyId: chronology.id,
      groups: [{ id: magia.id, name: 'Magia y portentos', color: null }]
    }))
    expect(groups.map((g: { name: string }) => g.name)).toEqual(['Magia y portentos'])
    const [event] = await entries(chronology.id)
    expect(event).toMatchObject({ title: 'Coronación' })
    expect(event?.groupId).toBeUndefined()
    // La otra no tiene grupos
    expect((await ok200('getChronology', { chronologyId: other.id })).groups).toEqual([])
    await undo('updateTimelineGroups')
    const back = await ok200('getChronology', { chronologyId: chronology.id })
    expect(back.groups.map((g: { name: string }) => g.name)).toEqual(['La Corona', 'Magia'])
    expect(back.entries[0]).toMatchObject({ groupId: corona.id })
  })

  it('las fechas de los eventos están en uso: no se borra su calendario ni se quita su mes; sin fechas, la cronología pasa al principal', async () => {
    const otro = await ok200('createCalendar', { worldId, name: 'Otro', from: 'blank' })
    const reino = await historia()
    await addEvents(reino.id, [{ title: 'Siega', date: '1250-Siega-1' }])
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

  it('la jugadora: las cronologías de las pestañas que ve y, dentro, lo que sabe su campaña; sin eras ocultas ni escribir', async () => {
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
    const chronology = await withPages()
    const { events } = await ok200('createTimelineEvents', {
      chronologyId: chronology.id,
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
    // Sin conocer su página, no la ve ni la encuentra (ni por su pestaña)
    expect((await ok200('listChronologies', { worldId }, ana.cookie)).chronologies).toEqual([])
    await fails('getChronology', { chronologyId: chronology.id }, 'NOT_FOUND', ana.cookie)
    await fails('getChronology', { tabId: chronology.tabId }, 'NOT_FOUND', ana.cookie)
    await ok200('setKnowledge', { worldId, campaignId: marca, kind: 'page', targetId: chronology.pageId, known: true })
    // Con la pestaña oculta, tampoco
    await ok200('updatePageTab', { tabId: chronology.tabId, hidden: true })
    await fails('getChronology', { chronologyId: chronology.id }, 'NOT_FOUND', ana.cookie)
    await ok200('updatePageTab', { tabId: chronology.tabId, hidden: false })
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
      ['createTimelineEvents', { chronologyId: chronology.id, events: [{ title: 'x', date: '1' }] }],
      ['updateTimelineGroups', { chronologyId: chronology.id, groups: [] }],
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
    const chronology = await withPages()
    const events = Array.from({ length: 2000 }, (_, i) => ({
      worldId,
      chronologyId: chronology.id,
      title: `Evento ${i}`,
      date: { calendarId: eana.id, start: { year: i - 1000 } }
    }))
    await conn.db.insert(schema.timelineEvents).values(events)
    return chronology
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
