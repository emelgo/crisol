import { describe, expect, it } from 'vitest'
import { i18next } from './i18n.ts'
import { requestSummary, summaryOf } from './summaries.ts'

const t = i18next.t.bind(i18next)
const say = (action: string, details: Record<string, unknown>) => summaryOf(t, { action, details })

describe('las frases del historial: las escenas y la mesa', () => {
  it('añadir una escena a una página', () => {
    expect(say('createPageTab', { kind: 'scene', name: 'Escena', title: 'Cripta de Varn' })).toBe(
      'añadió la escena «Escena» a «Cripta de Varn»'
    )
  })

  it('su rejilla, su vista inicial y su mapa', () => {
    expect(say('updateScene', { name: 'Escena', title: 'Cripta de Varn', grid: true })).toBe(
      'cambió la rejilla de la escena «Escena» de «Cripta de Varn»'
    )
    expect(say('updateScene', { name: 'Escena', title: 'Cripta de Varn', view: true })).toBe(
      'cambió la vista inicial de la escena «Escena» de «Cripta de Varn»'
    )
    expect(say('setSceneImage', { name: 'Escena', title: 'Cripta de Varn' })).toBe(
      'puso el mapa de la escena «Escena» de «Cripta de Varn»'
    )
  })

  it('abrirla en la mesa de una campaña', () => {
    expect(say('openScene', { name: 'Escena', campaign: 'La Marca', title: 'Cripta de Varn' })).toBe(
      'abrió la escena «Escena» en la mesa de «La Marca»'
    )
  })

  it('lo que pide la IA en la mesa', () => {
    const ask = (action: string, input: Record<string, unknown>) =>
      requestSummary(t, { action, input, details: {} } as never)
    expect(ask('presentScene', { campaignId: 'c' })).toBe('enseñar la escena abierta en la pantalla')
    expect(ask('hideScreen', { campaignId: 'c', hidden: true })).toBe('ocultar la pantalla')
    expect(ask('hideScreen', { campaignId: 'c', hidden: false })).toBe('destapar la pantalla')
    expect(ask('openScene', { campaignId: 'c', sceneId: 's', name: 'Escena' })).toBe(
      'abrir la escena «Escena» en la mesa'
    )
  })
})
