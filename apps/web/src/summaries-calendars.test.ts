import { describe, expect, it } from 'vitest'
import { i18next } from './i18n.ts'
import { summaryOf } from './summaries.ts'

const t = i18next.t.bind(i18next)
const say = (action: string, details: Record<string, unknown>, tense: 'done' | 'requested' = 'done') =>
  summaryOf(t, { action, details }, tense)

describe('las frases del historial de los calendarios (módulo 8)', () => {
  it('crear, renombrar, hacer principal, mover, cambiar y borrar', () => {
    expect(say('createCalendar', { name: 'Eana' })).toBe('creó el calendario «Eana»')
    expect(say('updateCalendar', { name: 'Eana', from: 'Eana', to: 'Varn' })).toBe(
      'renombró el calendario «Eana» a «Varn»'
    )
    expect(say('updateCalendar', { name: 'Varn', primary: true })).toBe('hizo principal el calendario «Varn»')
    expect(say('updateCalendar', { name: 'Varn', moved: true })).toBe('movió el calendario «Varn»')
    expect(say('updateCalendar', { name: 'Varn' })).toBe('cambió el calendario «Varn»')
    expect(say('deleteCalendar', { name: 'Varn' })).toBe('borró el calendario «Varn»')
    expect(say('createCalendar', { name: 'Eana' }, 'requested')).toBe('crear el calendario «Eana»')
  })
})
