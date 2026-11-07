import { describe, expect, it } from 'vitest'
import { i18next } from './i18n.ts'
import { requestSummary, summaryOf } from './summaries.ts'

const t = i18next.t.bind(i18next)
const say = (action: string, details: Record<string, unknown>) => summaryOf(t, { action, details })
const ask = (action: string, input: Record<string, unknown>) =>
  requestSummary(t, { action, input, details: {} } as never)

describe('las frases del historial: la visión de la mesa', () => {
  const scene = { name: 'Escena', title: 'Cripta de Varn' }

  it('los muros, las luces y lo que trae el mapa', () => {
    expect(say('changeWalls', { ...scene, walls: 3 })).toBe(
      'cambió los muros de la escena «Escena» de «Cripta de Varn»'
    )
    expect(say('changeWalls', { ...scene, walls: 0, lights: true })).toBe(
      'cambió las luces de la escena «Escena» de «Cripta de Varn»'
    )
    expect(say('placeImportedWalls', scene)).toBe('puso los muros del mapa en la escena «Escena» de «Cripta de Varn»')
  })

  it('la oscuridad y la visión automática', () => {
    expect(say('updateSceneVision', { ...scene, darkness: 0.5 })).toBe(
      'cambió la oscuridad de la escena «Escena» de «Cripta de Varn»'
    )
    expect(say('updateSceneVision', { ...scene, automaticVision: false })).toBe(
      'quitó la visión automática de la escena «Escena» de «Cripta de Varn»'
    )
  })

  it('las puertas y la niebla de una campaña', () => {
    expect(say('openDoor', { name: 'Escena', campaign: 'La Marca' })).toBe(
      'abrió una puerta de «Escena» en la mesa de «La Marca»'
    )
    expect(say('coverFog', { campaign: 'La Marca' })).toBe('tapó parte de la niebla en la mesa de «La Marca»')
    expect(say('resetFog', { name: 'Escena', campaign: 'La Marca' })).toBe(
      'reinició la niebla de «Escena» en la mesa de «La Marca»'
    )
  })

  it('lo que pide la IA', () => {
    expect(ask('setDoor', { campaignId: 'c', wallId: 'w', open: false })).toBe('cerrar una puerta en la mesa')
    expect(ask('changeFog', { campaignId: 'c', mode: 'reveal', shape: 'cells' })).toBe('destapar parte de la niebla')
    expect(ask('changeWalls', { sceneId: 's', walls: { add: [] } })).toBe('cambiar los muros de una escena')
    expect(ask('setTileFit', { campaignId: 'c', tileFit: 'cropped' })).toBe('cambiar los bordes de la tele')
  })
})
