import type { LogEvent } from '@crisol/contracts'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../i18n.ts'
import { LogEventEntry, withoutYear } from './log-event.tsx'

const date = (text: string) => ({
  calendarId: crypto.randomUUID(),
  date: { year: 1247, month: 'brumas', day: 6 },
  text
})
const entry = (event: LogEvent['event'], whisper: LogEvent['whisper'] = null): LogEvent => ({
  kind: 'event',
  id: crypto.randomUUID(),
  campaignId: crypto.randomUUID(),
  by: { userId: 'u1', name: 'Enrique', color: null },
  ai: false,
  event,
  whisper,
  deleted: false,
  createdAt: new Date().toISOString()
})
const show = (event: LogEvent) =>
  render(
    <ul>
      <LogEventEntry entry={event} time={<time>21:10</time>} remove={null} />
    </ul>
  )

describe('las entradas del sistema en el registro (8 · campaña)', () => {
  it('la fecha sin el año, para los días de un viaje', () => {
    expect(withoutYear('Lunden, 7 de Brumas del año 1247 RV')).toBe('Lunden, 7 de Brumas')
    expect(withoutYear('Noche Larga, día 1 de 1247 RV')).toBe('Noche Larga, día 1')
  })

  it('un cambio de fecha y su deshacer', () => {
    show(entry({ type: 'date', from: null, to: date('Solen, 6 de Brumas del año 1247 RV'), days: 1 }))
    expect(screen.getByRole('listitem').textContent).toContain('La fecha pasa a Solen, 6 de Brumas del año 1247 RV')
  })

  it('un viaje con su resumen, el clima de cada día y la llegada con su zona', () => {
    show(
      entry({
        type: 'travel',
        from: date('Solen, 6 de Brumas del año 1247 RV'),
        to: date('Tordan, 10 de Brumas del año 1247 RV'),
        distance: 118,
        unit: 'millas',
        medium: 'horse',
        pace: 'fast',
        restDays: 1,
        days: 4,
        route: 'Camino real',
        zone: 'coast',
        weather: [
          {
            date: date('Lunden, 7 de Brumas del año 1247 RV'),
            condition: 'rain',
            low: 11,
            high: 17,
            wind: 'strong',
            rest: false
          },
          {
            date: date('Ardan, 8 de Brumas del año 1247 RV'),
            condition: 'partly-cloudy',
            low: 9,
            high: 18,
            wind: 'gentle',
            rest: true
          }
        ]
      })
    )
    const item = screen.getAllByRole('listitem')[0]?.textContent ?? ''
    expect(item).toContain('Viaje por «Camino real»')
    expect(item).toContain('118 millas a caballo, ritmo rápido · 3 días y 1 de descanso')
    expect(item).toContain('Lunden, 7 de Brumas')
    expect(item).toContain('Nubes y claros · descanso')
    expect(item).toContain('La fecha pasa a Tordan, 10 de Brumas del año 1247 RV · zona De costa')
  })

  it('el clima a mano, «Solo tú»', () => {
    show(
      entry(
        {
          type: 'weather',
          date: date('Lunden, 7 de Brumas del año 1247 RV'),
          weather: { condition: 'snow', low: -1, high: 3, wind: 'calm' }
        },
        [{ id: 'master', name: 'Máster' }]
      )
    )
    const item = screen.getByRole('listitem').textContent ?? ''
    expect(item).toContain('Clima del Lunden, 7 de Brumas a mano: Nieve, -1° / 3°')
    expect(item).toContain('Solo tú')
  })
})
