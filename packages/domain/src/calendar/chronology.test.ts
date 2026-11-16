import { describe, expect, it } from 'vitest'
import {
  type ChronologyEvent,
  type ChronologyPage,
  chronologyEntries,
  DEFAULT_CHRONOLOGY_FILTER,
  entryOccurrences,
  packRows,
  shiftDate,
  timeBands,
  timeColumns
} from './chronology.ts'
import type { WorldCalendar } from './convert.ts'
import { dateSpan, dayNumber } from './dates.ts'
import { EANA, HARPTOS_LIKE } from './fixtures.ts'

const calendars: WorldCalendar[] = [
  { id: 'eana', primary: true, definition: EANA },
  // El 1 de Luna 1 del año 0 de este cae el 1 de Cierzo de 1000 de Eana
  {
    id: 'varn',
    primary: false,
    definition: {
      ...HARPTOS_LIKE,
      correspondence: { calendarId: 'eana', date: { year: 1000, month: 'cierzo', day: 1 } }
    }
  },
  { id: 'suelto', primary: false, definition: HARPTOS_LIKE }
]

const event = (id: string, extra: Partial<ChronologyEvent> = {}): ChronologyEvent => ({
  id,
  title: id,
  date: { calendarId: 'eana', start: { year: 1250, month: 'siega', day: 18 } },
  color: null,
  image: null,
  icon: null,
  description: '',
  groupId: null,
  page: null,
  hidden: false,
  ...extra
})

const page = (id: string, extra: Partial<ChronologyPage> = {}): ChronologyPage => ({
  id,
  title: id,
  icon: null,
  cover: null,
  templates: [],
  tags: [],
  dates: [{ name: 'Fecha', value: { calendarId: 'eana', start: { year: 1250 } } }],
  ...extra
})

const run = (input: Partial<Parameters<typeof chronologyEntries>[0]>) =>
  chronologyEntries({
    calendars,
    calendarId: 'eana',
    events: [],
    pages: [],
    filter: DEFAULT_CHRONOLOGY_FILTER,
    ...input
  })

describe('las entradas de una cronología', () => {
  it('junta eventos y páginas con fecha, ordenados por el primer día y, a igualdad, por título', () => {
    const { entries, outside } = run({
      events: [
        event('Boda', { date: { calendarId: 'eana', start: { year: 1250, month: 'siega', day: 18 } } }),
        event('Asedio', { date: { calendarId: 'eana', start: { year: 1250, month: 'siega', day: 18 } } }),
        event('Caída', { date: { calendarId: 'eana', start: { year: -312 } } })
      ],
      pages: [page('Puerto Ceniza')]
    })
    expect(entries.map((e) => e.title)).toEqual(['Caída', 'Puerto Ceniza', 'Asedio', 'Boda'])
    expect(outside).toBe(0)
    // Una fecha de solo año va al principio de su año
    expect(entries[1]?.startDay).toBe(dayNumber(EANA, { year: 1250 }))
    expect(entries[1]?.endDay).toBe(dateSpan(EANA, { year: 1250 })[1])
  })

  it('un rango abarca hasta el último día de su fin; cada año se queda en su primera fecha', () => {
    const { entries } = run({
      events: [
        event('Campaña', {
          date: {
            calendarId: 'eana',
            start: { year: 1250, month: 'siega', day: 20 },
            end: { year: 1250, month: 'trilla', day: 3 }
          }
        }),
        event('Feria', { date: { calendarId: 'eana', start: { year: 413, month: 'vendimia', day: 1 }, yearly: true } })
      ]
    })
    const campaign = entries.find((e) => e.title === 'Campaña')
    expect(campaign?.endDay).toBe(dayNumber(EANA, { year: 1250, month: 'trilla', day: 3 }))
    expect(entries.find((e) => e.title === 'Feria')?.yearly).toBe(true)
  })

  it('una página con varias fechas sale una vez por fecha, con el nombre del campo', () => {
    const { entries } = run({
      pages: [
        page('Aldren IV', {
          dates: [
            { name: 'Nacimiento', value: { calendarId: 'eana', start: { year: 1190 } } },
            { name: 'Muerte', value: { calendarId: 'eana', start: { year: 1247, month: 'siega', day: 27 } } }
          ]
        }),
        page('Puerto')
      ]
    })
    expect(entries.map((e) => [e.title, e.field])).toEqual([
      ['Aldren IV', 'Nacimiento'],
      ['Aldren IV', 'Muerte'],
      ['Puerto', null]
    ])
    expect(new Set(entries.map((e) => e.key)).size).toBe(3)
    expect(entries[0]?.kind).toBe('page')
    expect(entries[0]?.pageId).toBe('Aldren IV')
  })

  it('el título de un evento enlazado sin el suyo es el de su página; sin ninguno, no sale', () => {
    const { entries } = run({
      events: [
        event('a', { title: '', page: { id: 'p1', title: 'Ilsa de Varn', icon: '🌹' } }),
        event('b', { title: '', page: null }),
        event('c', { title: 'Propio', page: { id: 'p1', title: 'Ilsa de Varn', icon: null } })
      ]
    })
    expect(entries.map((e) => e.title)).toEqual(['Ilsa de Varn', 'Propio'])
    expect(entries[0]?.untitled).toBe(true)
    expect(entries[1]?.untitled).toBe(false)
    expect(entries[0]?.page).toEqual({ id: 'p1', title: 'Ilsa de Varn', icon: '🌹' })
  })

  it('las fechas de otro calendario con correspondencia se convierten; sin ella, quedan fuera y se cuentan', () => {
    const { entries, outside } = run({
      events: [
        event('Llegada', { date: { calendarId: 'varn', start: { year: 0, month: 'm1', day: 1 } } }),
        event('Perdido', { date: { calendarId: 'suelto', start: { year: 3 } } }),
        event('Fiesta', { date: { calendarId: 'varn', start: { year: 2, month: 'm1', day: 4 }, yearly: true } })
      ],
      pages: [page('Sin calendario', { dates: [{ name: 'Fecha', value: { calendarId: 'otro', start: { year: 1 } } }] })]
    })
    expect(outside).toBe(2)
    const arrival = entries.find((e) => e.title === 'Llegada')
    expect(arrival?.start).toEqual({ year: 1000, month: 'cierzo', day: 1 })
    expect(arrival?.converted).toEqual({ calendarId: 'varn' })
    // Convertida, ya no se repite (un año de un calendario no es un año del otro)
    expect(entries.find((e) => e.title === 'Fiesta')?.yearly).toBe(false)
  })

  it('un mes de otro calendario se convierte en el periodo de días que abarca', () => {
    const { entries } = run({
      events: [event('Mes', { date: { calendarId: 'varn', start: { year: 0, month: 'm1' } } })]
    })
    const [only] = entries
    expect(only?.start).toEqual({ year: 1000, month: 'cierzo', day: 1 })
    expect(only?.end).not.toBeNull()
    expect((only?.endDay ?? 0) - (only?.startDay ?? 0)).toBe(35)
  })

  it('el filtro: sin páginas, por plantilla y etiqueta (también las de dentro), y por grupos', () => {
    const pages = [
      page('PNJ', { templates: ['pnj'], tags: ['casa/valmont'] }),
      page('Lugar', { templates: ['lugar'], tags: ['viajes'] })
    ]
    const events = [event('Uno', { groupId: 'g1' }), event('Dos', { groupId: 'g2' }), event('Tres')]
    const titles = (filter: Partial<typeof DEFAULT_CHRONOLOGY_FILTER>) =>
      run({ pages, events, filter: { ...DEFAULT_CHRONOLOGY_FILTER, ...filter } }).entries.map((e) => e.title)
    expect(titles({})).toHaveLength(5)
    expect(titles({ pages: false })).toEqual(['Dos', 'Tres', 'Uno'])
    expect(titles({ templates: ['pnj'] })).toContain('PNJ')
    expect(titles({ templates: ['pnj'] })).not.toContain('Lugar')
    expect(titles({ tags: ['casa'] })).toContain('PNJ')
    expect(titles({ tags: ['Casa/Valmont'] })).not.toContain('Lugar')
    expect(titles({ groups: ['g1'] })).toEqual(['Lugar', 'PNJ', 'Uno'])
  })

  it('una fecha que ya no cabe en su calendario (su mes se quitó) queda fuera', () => {
    const { entries, outside } = run({
      events: [event('Roto', { date: { calendarId: 'eana', start: { year: 1, month: 'nada', day: 1 } } })]
    })
    expect(entries).toEqual([])
    expect(outside).toBe(1)
  })

  it('2.000 eventos y 5.000 páginas con fecha, en poco tiempo', () => {
    const events = Array.from({ length: 2000 }, (_, i) =>
      event(`e${i}`, {
        date:
          i % 3 === 0
            ? { calendarId: 'varn', start: { year: i, month: 'm2', day: 1 + (i % 36) } }
            : { calendarId: 'eana', start: { year: i - 1000, month: 'siega', day: 1 + (i % 28) } }
      })
    )
    const pages = Array.from({ length: 5000 }, (_, i) =>
      page(`p${i}`, { dates: [{ name: 'Fecha', value: { calendarId: 'eana', start: { year: i - 2500 } } }] })
    )
    const started = performance.now()
    const { entries } = run({ events, pages })
    expect(entries).toHaveLength(7000)
    expect(performance.now() - started).toBeLessThan(250)
  })
})

describe('las repeticiones al pintar', () => {
  it('una que se repite cada año sale una vez por año en la ventana, y una sin repetir solo si la toca', () => {
    const { entries } = run({
      events: [
        event('Feria', {
          date: { calendarId: 'eana', start: { year: 1240, month: 'vendimia', day: 1 }, yearly: true }
        }),
        event('Una', { date: { calendarId: 'eana', start: { year: 1300 } } })
      ]
    })
    const from = dayNumber(EANA, { year: 1250 })
    const to = dayNumber(EANA, { year: 1252, month: 'nochelarga', day: 28 })
    const feria = entries.find((e) => e.title === 'Feria')
    const una = entries.find((e) => e.title === 'Una')
    if (!feria || !una) throw new Error('faltan')
    expect(entryOccurrences(EANA, feria, from, to).map((o) => o.start.year)).toEqual([1250, 1251, 1252])
    expect(entryOccurrences(EANA, una, from, to)).toEqual([])
  })
})

describe('las columnas de la vista de meses', () => {
  it('en meses, una por mes con las festividades marcadas; en años, una por año; en días, una por día', () => {
    const from = dayNumber(EANA, { year: 1250 })
    const to = dayNumber(EANA, { year: 1250, month: 'nochelarga', day: 28 })
    const months = timeColumns(EANA, 'months', from, to)
    expect(months).toHaveLength(16)
    expect(months[0]).toMatchObject({ label: 'Alba Triste', festival: true, start: from })
    expect(months[1]).toMatchObject({ label: 'Cierzo', festival: false, start: from + 7, end: from + 34 })
    const years = timeColumns(EANA, 'years', from, dayNumber(EANA, { year: 1259 }))
    expect(years.map((c) => c.label)).toEqual([
      '1250',
      '1251',
      '1252',
      '1253',
      '1254',
      '1255',
      '1256',
      '1257',
      '1258',
      '1259'
    ])
    const days = timeColumns(EANA, 'days', from + 7, from + 40)
    expect(days).toHaveLength(34)
    expect(days[0]).toMatchObject({ label: '1', start: from + 7, end: from + 7 })
  })

  it('las bandas de encima: el año en meses, el mes en días y la era en años (sin las que falten)', () => {
    const from = dayNumber(EANA, { year: 1250 })
    const months = timeColumns(EANA, 'months', from, dayNumber(EANA, { year: 1251, month: 'siega', day: 1 }))
    expect(timeBands(EANA, 'months', months).map((b) => [b.label, b.span])).toEqual([
      ['1250 RC', 16],
      ['1251 RC', 10]
    ])
    const years = timeColumns(EANA, 'years', dayNumber(EANA, { year: -2 }), dayNumber(EANA, { year: 1 }))
    expect(timeBands(EANA, 'years', years).map((b) => [b.label, b.span])).toEqual([
      ['Era de los Nuevos Reinos', 2],
      ['Era de la República', 2]
    ])
    const days = timeColumns(EANA, 'days', from + 30, from + 40)
    expect(timeBands(EANA, 'days', days).map((b) => [b.label, b.span])).toEqual([
      ['Cierzo de 1250 RC', 5],
      ['Escarcha de 1250 RC', 6]
    ])
  })
})

describe('repartir en filas', () => {
  it('lo que se solapa baja de fila; lo que no, se queda arriba', () => {
    expect(
      packRows([
        { start: 0, end: 10 },
        { start: 5, end: 12 },
        { start: 11, end: 20 },
        { start: 13, end: 14 }
      ])
    ).toEqual([0, 1, 0, 1])
  })
})

describe('mover una fecha al arrastrarla', () => {
  it('por días, por meses (una de mes, a otro mes) o por años, con su fin; lo que no tiene esa precisión, no', () => {
    const day = { start: { year: 1250, month: 'siega', day: 27 }, end: { year: 1250, month: 'trilla', day: 2 } }
    expect(shiftDate(EANA, day, 'days', 3)).toEqual({
      start: { year: 1250, month: 'trilla', day: 2 },
      end: { year: 1250, month: 'trilla', day: 5 }
    })
    expect(shiftDate(EANA, { start: { year: 1250, month: 'nochelarga' } }, 'months', 2)).toEqual({
      start: { year: 1251, month: 'cierzo' }
    })
    expect(shiftDate(EANA, { start: { year: 1250 }, yearly: true }, 'years', -10)).toEqual({
      start: { year: 1240 },
      yearly: true
    })
    expect(shiftDate(EANA, { start: { year: 1250, month: 'siega' } }, 'days', 1)).toBeNull()
    expect(shiftDate(EANA, { start: { year: 1250 } }, 'months', 1)).toBeNull()
    expect(shiftDate(EANA, day, 'days', 0)).toBeNull()
  })
})
