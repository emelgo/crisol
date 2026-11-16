import { describe, expect, it } from 'vitest'
import { dayNumber } from './dates.ts'
import { EANA } from './fixtures.ts'
import { normalizeCalendar } from './normalize.ts'
import { validateCalendar } from './validate.ts'

describe('de lo escrito a la definición', () => {
  it('el calendario de Eana de una vez: ids nuevos, meses por nombre y fechas como texto', () => {
    const { definition, problems } = normalizeCalendar({
      yearSuffix: 'RC',
      weekdays: EANA.weekdays,
      months: EANA.months.map(({ id: _, ...m }) => m),
      leapRules: [{ monthId: 'semana del yunque', days: 1, every: 4 }],
      moons: [{ name: 'Melancolía', cycleDays: 28, offsetDays: -1.25 }],
      eras: [
        { name: 'Era de los Nuevos Reinos', start: '-980', end: '-1', hidden: true },
        { name: 'Era de la República', abbreviation: 'ER', start: { year: 0, month: 'Cierzo', day: 1 } }
      ]
    })
    expect(problems).toEqual([])
    expect(validateCalendar(definition)).toEqual([])
    const yunque = definition.months.find((m) => m.name === 'Semana del Yunque')
    expect(definition.leapRules[0]?.monthId).toBe(yunque?.id)
    expect(definition.moons[0]?.phases).toHaveLength(8)
    expect(definition.eras[1]?.start.month).toBe(definition.months[1]?.id)
    expect(new Set([...definition.months, ...definition.moons, ...definition.eras].map((x) => x.id)).size).toBe(19)
    expect(definition.firstWeekday).toBe(0)
    expect(definition.weekMode).toBe('continuous')
  })

  it('una fecha que no se entiende es un problema de su sección', () => {
    const { problems } = normalizeCalendar({
      weekdays: ['Uno'],
      months: [{ name: 'Único', days: 10 }],
      eras: [{ name: 'Rota', start: '12-Siega-3' }]
    })
    expect(problems).toEqual([expect.objectContaining({ section: 'eras', code: 'eraStart', index: 0 })])
  })

  it('la correspondencia, con el principal si no dice otro, y su fecha contra aquel', () => {
    const eana = { id: 'eana-id', definition: EANA }
    const { definition, problems } = normalizeCalendar(
      { weekdays: ['Uno'], months: [{ name: 'Único', days: 10 }], correspondence: { date: '-300-Cierzo-1' } },
      { calendars: [eana], primaryId: 'eana-id' }
    )
    expect(problems).toEqual([])
    expect(definition.correspondence).toEqual({ calendarId: 'eana-id', date: { year: -300, month: 'cierzo', day: 1 } })
    expect(dayNumber(EANA, definition.correspondence?.date ?? { year: 0 })).toBe(-300 * 364 + 7)
    const missing = normalizeCalendar({
      weekdays: ['Uno'],
      months: [{ name: 'Único', days: 10 }],
      correspondence: { date: '1' }
    })
    expect(missing.problems).toEqual([expect.objectContaining({ code: 'correspondenceCalendar' })])
    const yearOnly = normalizeCalendar(
      { weekdays: ['Uno'], months: [{ name: 'Único', days: 10 }], correspondence: { date: '-300' } },
      { calendars: [eana], primaryId: 'eana-id' }
    )
    expect(yearOnly.problems).toEqual([expect.objectContaining({ code: 'correspondenceDate' })])
  })
})
