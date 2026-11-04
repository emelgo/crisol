import { describe, expect, it } from 'vitest'
import { defaultChoices, normalizeChoices } from './choices.ts'
import { cinco } from './fixtures/cinco.ts'
import { fronteras } from './fixtures/fronteras.ts'

describe('lo que una campaña elige de su sistema', () => {
  it('sin elegir nada: todas las fuentes, el primer idioma y el valor inicial de cada ajuste', () => {
    expect(defaultChoices(cinco)).toEqual({
      sources: ['srd51', 'srd52'],
      duplicates: 'newest',
      language: 'es',
      settings: { metodos: ['estandar', 'compra'] }
    })
    expect(defaultChoices(fronteras)).toEqual({
      sources: [],
      duplicates: 'newest',
      language: 'es',
      settings: { avance: 8 }
    })
  })

  it('lo elegido se completa con lo que falta', () => {
    expect(normalizeChoices(cinco, { sources: ['srd52'], language: 'en' })).toEqual({
      choices: {
        sources: ['srd52'],
        duplicates: 'newest',
        language: 'en',
        settings: { metodos: ['estandar', 'compra'] }
      },
      problems: []
    })
    expect(normalizeChoices(cinco, { settings: { metodos: ['tiradas', 'a_mano'] } }).choices.settings).toEqual({
      metodos: ['tiradas', 'a_mano']
    })
    expect(normalizeChoices(fronteras, null).choices).toEqual(defaultChoices(fronteras))
  })

  it('lo que no vale se dice', () => {
    expect(
      normalizeChoices(cinco, {
        sources: ['srd99'],
        language: 'fr' as never,
        settings: { metodos: ['dados'], otro: true }
      }).problems
    ).toEqual([
      'No existe la fuente «srd99»',
      'El sistema no trae el idioma «fr»',
      '«Métodos de características» no vale así',
      'No existe el ajuste «otro»'
    ])
    expect(normalizeChoices(fronteras, { language: 'en' }).problems).toEqual(['El sistema no trae el idioma «en»'])
    expect(normalizeChoices(fronteras, { settings: { avance: 'ocho' } }).problems).toEqual([
      '«Marcas de experiencia para avanzar» no vale así'
    ])
  })
})
