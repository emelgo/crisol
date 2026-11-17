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

describe('las frases del historial de las cronologías (módulo 8)', () => {
  it('cronologías, grupos y eventos', () => {
    expect(say('createChronology', { name: 'Historia' })).toBe('creó la cronología «Historia»')
    expect(say('updateChronology', { name: 'Historia', from: 'Historia', to: 'Antigua' })).toBe(
      'renombró la cronología «Historia» a «Antigua»'
    )
    expect(say('updateChronology', { name: 'Antigua', moved: true })).toBe('movió la cronología «Antigua»')
    expect(say('deleteChronology', { name: 'Antigua' })).toBe('borró la cronología «Antigua»')
    expect(say('updateTimelineGroups', {})).toBe('cambió los grupos de eventos')
    expect(say('createTimelineEvents', { count: 1, titles: ['Boda'] })).toBe('creó el evento «Boda»')
    expect(say('createTimelineEvents', { count: 80, titles: ['Boda'] }, 'requested')).toBe('crear 80 eventos')
    expect(say('updateTimelineEvent', { title: 'Boda' })).toBe('cambió el evento «Boda»')
    expect(say('convertEventToPage', { title: 'Boda' })).toBe('convirtió el evento «Boda» en página')
    expect(say('setKnowledge', { kind: 'chronology', name: 'Historia', campaign: 'La Marca', known: true })).toBe(
      say('setKnowledge', { kind: 'page', name: 'x', campaign: 'La Marca', known: true }).replace(
        '«x»',
        'la cronología «Historia»'
      )
    )
  })
})
