import { describe, expect, it } from 'vitest'
import { blankCalendar, type CalendarDefinition, gregorianCalendar } from './definition.ts'
import { EANA } from './fixtures.ts'
import { validateCalendar } from './validate.ts'

const codes = (def: CalendarDefinition, options = {}) =>
  validateCalendar(def, options).map((p) => [p.section, p.code, p.index ?? null])

describe('validar un calendario', () => {
  it('los de ejemplo y el de Eana no tienen problemas', () => {
    expect(validateCalendar(blankCalendar())).toEqual([])
    expect(validateCalendar(gregorianCalendar())).toEqual([])
    expect(validateCalendar(EANA)).toEqual([])
  })

  it('la semana', () => {
    expect(codes({ ...EANA, weekdays: [] })).toEqual([['week', 'weekdaysEmpty', null]])
    expect(codes({ ...EANA, weekdays: ['Uno', ' '], firstWeekday: 0 })).toEqual([['week', 'weekdayUnnamed', 1]])
    expect(codes({ ...EANA, firstWeekday: 7 })).toEqual([['week', 'firstWeekday', null]])
  })

  it('los meses, cada problema con su índice', () => {
    const months = EANA.months.map((m, i) => (i === 2 ? { ...m, name: '' } : i === 3 ? { ...m, days: 0 } : m))
    expect(codes({ ...EANA, months })).toEqual([
      ['months', 'monthUnnamed', 2],
      ['months', 'monthDays', 3]
    ])
    expect(codes({ ...EANA, months: [] })).toEqual([['months', 'monthsEmpty', null]])
    const twice = [...EANA.months, { ...EANA.months[0], id: 'siega', name: 'Otra' } as (typeof EANA.months)[number]]
    expect(codes({ ...EANA, months: twice })).toEqual([['months', 'duplicateId', 16]])
  })

  it('los bisiestos: su mes y sus múltiplos', () => {
    const rule = { monthId: 'siega', days: 1, every: 4 }
    expect(codes({ ...EANA, leapRules: [{ ...rule, monthId: 'nada' }] })).toEqual([['leap', 'leapMonth', 0]])
    expect(codes({ ...EANA, leapRules: [{ ...rule, unless: 10 }] })).toEqual([['leap', 'leapUnless', 0]])
    expect(codes({ ...EANA, leapRules: [{ ...rule, unless: 100, but: 250 }] })).toEqual([['leap', 'leapBut', 0]])
    expect(codes({ ...EANA, leapRules: [{ ...rule, every: 0 }] })).toContainEqual(['leap', 'leapEvery', 0])
  })

  it('las estaciones: dentro del año y sin pisarse (también las que cruzan el fin de año)', () => {
    const seasons = [
      { id: 'a', name: 'Otoño', startDay: 244, endDay: 334 },
      { id: 'b', name: 'Invierno', startDay: 330, endDay: 60 }
    ]
    const problems = validateCalendar({ ...EANA, seasons })
    expect(problems).toEqual([
      expect.objectContaining({
        section: 'seasons',
        code: 'seasonOverlap',
        index: 1,
        params: { name: 'Otoño', other: 'Invierno', from: 330, to: 334 },
        message: 'Otoño e Invierno se pisan (días 330 a 334).'
      })
    ])
    expect(codes({ ...EANA, seasons: [{ id: 'a', name: 'Larga', startDay: 1, endDay: 400 }] })).toEqual([
      ['seasons', 'seasonRange', 0]
    ])
  })

  it('las lunas', () => {
    const moon = { id: 'l', name: 'Luna', cycleDays: 0, offsetDays: 0, color: '#fff', phases: ['Nueva'] }
    expect(codes({ ...EANA, moons: [moon] })).toEqual([
      ['moons', 'moonCycle', 0],
      ['moons', 'moonPhases', 0]
    ])
  })

  it('las eras: sus fechas, su orden y la abreviatura de la que cuenta desde su inicio', () => {
    const eras = [
      { id: 'a', name: 'Rota', start: { year: 1, month: 'nada' } },
      { id: 'b', name: 'Al revés', start: { year: 10 }, end: { year: 5 } },
      { id: 'c', name: 'Propia', start: { year: 10 }, countsFromStart: true },
      { id: 'd', name: 'Día 30', start: { year: 1, month: 'siega', day: 30 } }
    ]
    expect(codes({ ...EANA, eras })).toEqual([
      ['eras', 'eraStart', 0],
      ['eras', 'eraOrder', 1],
      ['eras', 'eraAbbreviation', 2],
      ['eras', 'eraStart', 3]
    ])
  })

  it('la correspondencia: un día del calendario al que apunta, si es del mundo', () => {
    const def = { ...blankCalendar(), correspondence: { calendarId: 'x', date: { year: 1, month: 'siega', day: 29 } } }
    expect(codes(def, { anchor: EANA })).toEqual([['correspondence', 'correspondenceDate', null]])
    expect(codes(def, { anchor: null })).toEqual([['correspondence', 'correspondenceCalendar', null]])
    expect(
      codes(
        { ...def, correspondence: { ...def.correspondence, date: { year: 1, month: 'siega', day: 28 } } },
        { anchor: EANA }
      )
    ).toEqual([])
  })
})
