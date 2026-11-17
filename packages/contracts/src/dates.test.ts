import { describe, expect, it } from 'vitest'
import { pageProperty } from './pages.ts'

const calendarId = '7f3c2a10-5b1e-4d2a-9c3b-0a1b2c3d4e5f'
const date = (value: unknown) => pageProperty.safeParse({ name: 'Nacimiento', type: 'date', value }).success

describe('la propiedad «Fecha»', () => {
  it('vale vacía, con año, mes o día y con fin', () => {
    expect(date(null)).toBe(true)
    expect(date({ calendarId, start: { year: -34 } })).toBe(true)
    expect(date({ calendarId, start: { year: 1250, month: 'siega', day: 18 } })).toBe(true)
    expect(date({ calendarId, start: { year: 1250, month: 'siega' }, end: { year: 1251, month: 'siega' } })).toBe(true)
  })

  it('no vale un día sin mes, cada año sin mes ni un calendario que no es un id', () => {
    expect(date({ calendarId, start: { year: 1250, day: 3 } })).toBe(false)
    expect(date({ calendarId, start: { year: 1250 }, yearly: true })).toBe(false)
    expect(date({ calendarId: 'eana', start: { year: 1250 } })).toBe(false)
    expect(date({ calendarId, start: { year: 1.5 } })).toBe(false)
  })
})
