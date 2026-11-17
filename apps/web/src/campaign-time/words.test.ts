import { describe, expect, it } from 'vitest'
import { i18next } from '../i18n.ts'
import { clockText, daylightText, latitudeText, relativeDays, temperatureText, windText } from './words.ts'

const t = i18next.t

describe('cómo se lee el tiempo de la campaña', () => {
  it('las horas y la luz del día', () => {
    expect(clockText(387)).toBe('6:27')
    expect(clockText(1053)).toBe('17:33')
    expect(clockText(0)).toBe('0:00')
    expect(daylightText(t, 666)).toBe('11 h 06 min de luz')
  })

  it('el viento en palabras con su rumbo; en calma, sin él', () => {
    expect(windText(t, { wind: 'strong', windDirection: 'N' })).toBe('Viento fuerte del norte')
    expect(windText(t, { wind: 'gentle', windDirection: 'NE' })).toBe('Brisa del nordeste')
    expect(windText(t, { wind: 'calm', windDirection: 'SW' })).toBe('Calma')
  })

  it('los grados y la latitud', () => {
    expect(temperatureText({ low: -3, high: 8 })).toBe('-3° / 8°')
    expect(latitudeText(t, 45)).toBe('45° N')
    expect(latitudeText(t, -12.5)).toBe('12,5° S')
  })

  it('hace y dentro de N días; lejos, en años', () => {
    expect(relativeDays(t, 100, 13, 364)).toBe('hace 87 días')
    expect(relativeDays(t, 100, 103, 364)).toBe('dentro de 3 días')
    expect(relativeDays(t, 100, 101, 364)).toBe('dentro de 1 día')
    expect(relativeDays(t, 100, 100, 364)).toBe('hoy')
    expect(relativeDays(t, 4000, 4000 - 9 * 364, 364)).toBe('hace 9 años')
  })
})
