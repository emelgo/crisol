import { describe, expect, it } from 'vitest'
import { clampYear, gregorianCalendar, yearBounds, yearProblem } from './definition.ts'
import { EANA } from './fixtures.ts'
import { parseDate } from './format.ts'
import { normalizeCalendar } from './normalize.ts'
import { validateCalendar } from './validate.ts'
import { dateValueProblem, parseDateValue } from './values.ts'

const ranged = { ...EANA, yearRange: { min: -12_000, max: 2000 } }

describe('los años de un calendario', () => {
  it('sin rango, el tope general: de -99.999 a 99.999', () => {
    expect(yearBounds(gregorianCalendar())).toEqual({ min: -99_999, max: 99_999 })
    expect(yearBounds({ yearRange: null })).toEqual({ min: -99_999, max: 99_999 })
  })

  it('con rango, el suyo; lo que falta, del tope general', () => {
    expect(yearBounds(ranged)).toEqual({ min: -12_000, max: 2000 })
    expect(yearBounds({ yearRange: { min: 0 } })).toEqual({ min: 0, max: 99_999 })
    expect(yearBounds({ yearRange: { max: 500, min: null } })).toEqual({ min: -99_999, max: 500 })
  })

  it('un rango que se pasa del tope se recorta; uno al revés no cuenta', () => {
    expect(yearBounds({ yearRange: { min: -5_000_000, max: 5_000_000 } })).toEqual({ min: -99_999, max: 99_999 })
    expect(yearBounds({ yearRange: { min: 10, max: 5 } })).toEqual({ min: -99_999, max: 99_999 })
  })

  it('llevar un año al rango se para en el borde', () => {
    expect(clampYear(ranged, -2_345_656)).toBe(-12_000)
    expect(clampYear(ranged, 3000)).toBe(2000)
    expect(clampYear(ranged, 1250)).toBe(1250)
    expect(clampYear(gregorianCalendar(), -2_345_656)).toBe(-99_999)
  })

  it('el problema de un año, en español para la IA', () => {
    expect(yearProblem(ranged, 1250)).toBeNull()
    expect(yearProblem(ranged, 2001)).toBe('el año 2001 se sale del calendario, que va del año -12000 al 2000')
  })
})

describe('las fechas fuera del rango no valen', () => {
  it('al leerlas escritas o como objeto', () => {
    expect(parseDate(ranged, '2001-Siega-3')).toMatchObject({ ok: false, reason: 'YEAR' })
    expect(parseDate(ranged, { year: -12_001 })).toMatchObject({ ok: false, reason: 'YEAR' })
    expect(parseDate(ranged, '2000')).toEqual({ ok: true, date: { year: 2000 } })
    expect(parseDate(EANA, '-2345656')).toMatchObject({
      ok: false,
      reason: 'YEAR',
      message: 'el año -2345656 se sale del calendario, que va del año -99999 al 99999'
    })
  })

  it('en el valor de una fecha (inicio y fin)', () => {
    expect(dateValueProblem(ranged, { start: { year: 2500 } })).toMatch(/se sale del calendario/)
    expect(dateValueProblem(ranged, { start: { year: 1000 }, end: { year: 2500 } })).toMatch(/^el fin: el año 2500/)
    expect(dateValueProblem(ranged, { start: { year: 1000 }, end: { year: 2000 } })).toBeNull()
    expect(parseDateValue(ranged, '1999/2001')).toMatchObject({ ok: false, reason: 'YEAR' })
  })
})

describe('el rango en la definición', () => {
  it('se guarda solo con lo que trae', () => {
    const base = { weekdays: ['Uno'], months: [{ name: 'Mes', days: 30 }] }
    expect(normalizeCalendar(base).definition.yearRange).toBeUndefined()
    expect(normalizeCalendar({ ...base, yearRange: { min: null, max: null } }).definition.yearRange).toBeUndefined()
    expect(normalizeCalendar({ ...base, yearRange: { min: -500 } }).definition.yearRange).toEqual({ min: -500 })
  })

  it('una era escrita fuera del rango no se lee', () => {
    const { problems } = normalizeCalendar({
      weekdays: ['Uno'],
      months: [{ name: 'Mes', days: 30 }],
      yearRange: { min: 0, max: 100 },
      eras: [{ name: 'Antes', start: '-50' }]
    })
    expect(problems.map((p) => p.code)).toEqual(['eraStart'])
  })

  it('validar: el primero después del último, uno que se pasa del tope y una era que empieza fuera', () => {
    const codes = (def: typeof EANA) => validateCalendar(def).map((p) => [p.section, p.code, p.index ?? null])
    expect(codes(ranged)).toEqual([])
    expect(codes({ ...EANA, yearRange: { min: 10, max: 5 } })).toEqual([['general', 'yearOrder', null]])
    expect(codes({ ...EANA, yearRange: { min: -200_000 } })).toEqual([['general', 'yearLimit', null]])
    expect(codes({ ...EANA, yearRange: { min: -5000 } })).toEqual([
      ['eras', 'eraOutside', 0],
      ['eras', 'eraOutside', 1]
    ])
  })
})
