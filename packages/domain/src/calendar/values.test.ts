import { describe, expect, it } from 'vitest'
import type { WorldCalendar } from './convert.ts'
import { EANA, HARPTOS_LIKE } from './fixtures.ts'
import {
  type DateValue,
  dateValueDay,
  dateValueForm,
  dateValueProblem,
  formatDateValue,
  parseDateValue,
  sameDateValue
} from './values.ts'

const at = (start: DateValue['start'], extra: Partial<DateValue> = {}): DateValue => ({
  calendarId: 'eana',
  start,
  ...extra
})

describe('el valor de una fecha', () => {
  it('vale con su mes y su día, y dice por qué no', () => {
    expect(dateValueProblem(EANA, at({ year: 1250, month: 'siega', day: 18 }))).toBeNull()
    expect(dateValueProblem(EANA, at({ year: -34 }))).toBeNull()
    expect(dateValueProblem(EANA, at({ year: 1250, month: 'nada' }))).toMatch(/mes/)
    expect(dateValueProblem(EANA, at({ year: 1250, month: 'siega', day: 29 }))).toMatch(/28 días/)
    expect(dateValueProblem(EANA, at({ year: 1250, day: 3 }))).toMatch(/sin mes/)
  })

  it('el fin, después del inicio y con la misma precisión; cada año, solo con mes', () => {
    const start = { year: 1250, month: 'siega', day: 12 }
    expect(dateValueProblem(EANA, at(start, { end: { year: 1250, month: 'trilla', day: 3 } }))).toBeNull()
    expect(dateValueProblem(EANA, at(start, { end: { year: 1250, month: 'siega', day: 12 } }))).toBeNull()
    expect(dateValueProblem(EANA, at(start, { end: { year: 1250, month: 'siega', day: 2 } }))).toMatch(/antes/)
    expect(dateValueProblem(EANA, at(start, { end: { year: 1251 } }))).toMatch(/precisión/)
    expect(dateValueProblem(EANA, at({ year: 1250 }, { yearly: true }))).toMatch(/cada año/)
    expect(dateValueProblem(EANA, at({ year: 1250, month: 'siega' }, { yearly: true }))).toBeNull()
  })

  it('se lee sin repetir lo que comparten inicio y fin', () => {
    expect(formatDateValue(EANA, at({ year: 1250, month: 'siega', day: 18 }))).toBe('18 de Siega del año 1250 RC')
    expect(
      formatDateValue(
        EANA,
        at({ year: 1250, month: 'siega', day: 12 }, { end: { year: 1250, month: 'trilla', day: 3 } })
      )
    ).toBe('12 de Siega – 3 de Trilla del año 1250 RC')
    expect(formatDateValue(EANA, at({ year: 1250 }, { end: { year: 1262 } }))).toBe('Años 1250–1262 RC')
  })

  it('la forma de la IA, con el fin tras «/» y «cada año» al final; y se lee de vuelta', () => {
    const value = at(
      { year: 1250, month: 'siega', day: 12 },
      { end: { year: 1250, month: 'trilla', day: 3 }, yearly: true }
    )
    const form = dateValueForm(EANA, value)
    expect(form).toBe('1250-Siega-12/1250-Trilla-3 (cada año)')
    expect(parseDateValue(EANA, form)).toEqual({
      ok: true,
      value: { start: value.start, end: value.end, yearly: true }
    })
    expect(parseDateValue(EANA, '-34-Siega-3')).toEqual({
      ok: true,
      value: { start: { year: -34, month: 'siega', day: 3 } }
    })
    expect(parseDateValue(EANA, '1250-Semana del Yunque')).toEqual({
      ok: true,
      value: { start: { year: 1250, month: 'yunque' } }
    })
    // El fin y «cada año» también por separado (como los da la IA)
    expect(parseDateValue(EANA, '1250-Siega-12', { end: '1250-Siega-18', yearly: true })).toEqual({
      ok: true,
      value: {
        start: { year: 1250, month: 'siega', day: 12 },
        end: { year: 1250, month: 'siega', day: 18 },
        yearly: true
      }
    })
  })

  it('al leer la forma, dice qué falla', () => {
    expect(parseDateValue(EANA, '1250-Nada-3')).toMatchObject({ ok: false, message: expect.stringMatching(/Nada/) })
    expect(parseDateValue(EANA, '1250-Siega-30')).toMatchObject({ ok: false, message: expect.stringMatching(/28/) })
    expect(parseDateValue(EANA, '1250-Siega-12/1250-Siega-2')).toMatchObject({
      ok: false,
      message: expect.stringMatching(/antes/)
    })
    expect(parseDateValue(EANA, '1250 (cada año)')).toMatchObject({ ok: false, message: expect.stringMatching(/mes/) })
  })

  it('su día para ordenar: en el principal si se puede convertir; si no, en el suyo', () => {
    const calendars: WorldCalendar[] = [
      { id: 'eana', primary: true, definition: EANA },
      {
        id: 'harptos',
        primary: false,
        definition: {
          ...HARPTOS_LIKE,
          correspondence: { calendarId: 'eana', date: { year: 1000, month: 'cierzo', day: 1 } }
        }
      },
      { id: 'suelto', primary: false, definition: HARPTOS_LIKE }
    ]
    const eana = dateValueDay(calendars, at({ year: 1000, month: 'cierzo', day: 1 }))
    const harptos = dateValueDay(calendars, { calendarId: 'harptos', start: { year: 0, month: 'm1', day: 1 } })
    expect(harptos).toBe(eana)
    expect(dateValueDay(calendars, { calendarId: 'suelto', start: { year: 0, month: 'm1', day: 2 } })).toBe(1)
    expect(dateValueDay(calendars, { calendarId: 'otro', start: { year: 0 } })).toBeNull()
  })

  it('compara dos valores', () => {
    const a = at({ year: 1250, month: 'siega', day: 18 })
    expect(sameDateValue(a, { ...a, start: { ...a.start } })).toBe(true)
    expect(sameDateValue(a, { ...a, yearly: true })).toBe(false)
    expect(sameDateValue(null, null)).toBe(true)
  })
})
