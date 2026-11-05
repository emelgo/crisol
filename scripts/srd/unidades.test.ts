import { describe, expect, it } from 'vitest'
import { imperialTexts, toImperial } from './unidades.ts'

describe('las medidas del SRD en español, en las de D&D', () => {
  it('distancias: metros a pies y kilómetros a millas, con su singular', () => {
    expect(toImperial('a un objetivo que esté a 1,5 m o menos')).toBe('a un objetivo que esté a 5 pies o menos')
    expect(toImperial('una esfera de 6 m de radio; alcance 45 m')).toBe(
      'una esfera de 20 pies de radio; alcance 150 pies'
    )
    expect(toImperial('**Velocidad** 9 m, volar 18 m')).toBe('**Velocidad** 30 pies, volar 60 pies')
    expect(toImperial('lanzándolo por los aires 6 metros')).toBe('lanzándolo por los aires 20 pies')
    expect(toImperial('a 1,5 km o menos (o a 9 km si estás')).toBe('a 1 milla o menos (o a 6 millas si estás')
    expect(toImperial('0,3 m')).toBe('1 pie')
  })

  it('dos números con su unidad: intervalos y alcances dobles', () => {
    expect(toImperial('entre 1,5 y 3 m')).toBe('entre 5 y 10 pies')
    expect(toImperial('distancia 24/96 m')).toBe('distancia 80/320 pies')
    expect(toImperial('de 3 a 6 m')).toBe('de 10 a 20 pies')
  })

  it('pesos, pulgadas y volúmenes, con sus fracciones', () => {
    expect(toImperial('Creas 22,5 kg de comida y 120 l de agua')).toBe('Creas 45 lb de comida y 30 galones de agua')
    expect(toImperial('pesa 0,25 kg')).toBe('pesa 1/2 lb')
    expect(toImperial('La bolsa pesa 250 g más 125 g')).toBe('La bolsa pesa 1/2 lb más 1/4 lb')
    expect(toImperial('una abertura de 2,5 cm; a los 30 cm')).toBe('una abertura de 1 pulgada; a los 1 pie')
    expect(toImperial('por cada 4 litros de agua')).toBe('por cada 1 galón de agua')
    expect(toImperial('0,8 m² de lona')).toBe('9 pies cuadrados de lona')
  })

  it('lo que no es una medida, igual; y en un documento, solo lo de español', () => {
    expect(toImperial('5 monstruos y 3 magos; 1d6 + 2')).toBe('5 monstruos y 3 magos; 1d6 + 2')
    expect(
      imperialTexts({
        name: { es: 'Bola', en: 'Ball' },
        alcance: { es: '45 m', en: '150 feet' },
        nivel: 3,
        list: [{ es: '3 m' }]
      })
    ).toEqual({
      name: { es: 'Bola', en: 'Ball' },
      alcance: { es: '150 pies', en: '150 feet' },
      nivel: 3,
      list: [{ es: '10 pies' }]
    })
  })
})
