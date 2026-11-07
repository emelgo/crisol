import { describe, expect, it } from 'vitest'
import { i18next } from './i18n.ts'
import { summaryOf } from './summaries.ts'

const t = i18next.t.bind(i18next)
const say = (action: string, details: Record<string, unknown>) => summaryOf(t, { action, details })

describe('las frases del historial: las escenas traídas de un zip', () => {
  it('traer una escena y, al abrirla una campaña, sus pines', () => {
    expect(say('importFoundryScene', { name: 'Escena', title: 'Cripta' })).toBe('trajo la escena «Cripta»')
    expect(say('placeScenePins', { campaign: 'La Marca', count: 2 })).toBe(
      'puso los pines de una escena en la mesa de «La Marca»'
    )
  })
})
