import { describe, expect, it } from 'vitest'
import { i18next } from './i18n.ts'
import { summaryOf } from './summaries.ts'

const t = i18next.t.bind(i18next)
const say = (action: string, details: Record<string, unknown>) => summaryOf(t, { action, details })
const ask = (action: string, details: Record<string, unknown>) => summaryOf(t, { action, details }, 'requested')

describe('las frases del historial: el tiempo de la campaña (8 · campaña)', () => {
  it('el hoy, los viajes, la zona y el clima a mano', () => {
    expect(say('setCampaignToday', { campaign: 'La Marca', to: 'Solen, 6 de Brumas de 1247 RV' })).toBe(
      'cambió la fecha de «La Marca» a Solen, 6 de Brumas de 1247 RV'
    )
    expect(ask('setCampaignToday', { campaign: 'La Marca', to: 'Solen, 6 de Brumas de 1247 RV' })).toBe(
      'cambiar la fecha de «La Marca» a Solen, 6 de Brumas de 1247 RV'
    )
    expect(say('travel', { campaign: 'La Marca', to: 'Tordan, 10 de Brumas de 1247 RV', days: 4 })).toBe(
      'hizo un viaje de 4 días con «La Marca»: llegó el Tordan, 10 de Brumas de 1247 RV'
    )
    expect(say('setCampaignClimate', { campaign: 'La Marca', weatherZone: 'coast' })).toBe(
      'cambió la zona o la latitud de «La Marca»'
    )
    expect(say('setDayWeather', { campaign: 'La Marca', date: 'Lunden, 7 de Brumas de 1247 RV' })).toBe(
      'cambió a mano el clima del Lunden, 7 de Brumas de 1247 RV en «La Marca»'
    )
    expect(say('setGmScreen', { campaign: 'La Marca', name: 'El vado' })).toBe(
      'cambió la pantalla del máster de «El vado» en «La Marca»'
    )
  })

  it('una escena interior', () => {
    expect(say('updateScene', { name: 'Taberna', title: 'Taberna', interior: true })).toBe(
      'marcó la escena «Taberna» como interior'
    )
    expect(say('updateScene', { name: 'Taberna', title: 'Taberna', interior: false })).toBe(
      'quitó «interior» a la escena «Taberna»'
    )
  })
})
