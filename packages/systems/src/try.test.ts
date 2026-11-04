import { describe, expect, it } from 'vitest'
import { cinco, fronteras } from './fixtures/index.ts'
import { tryFormula } from './try.ts'

describe('probar una fórmula', () => {
  it('con los valores del documento de prueba, y su desglose', () => {
    const tried = tryFormula(fronteras, 'personaje', '7 + @vigor', { data: { vigor: 2 } })
    expect(tried).toMatchObject({ type: 'number', value: 9, problems: [] })
    expect(tried.terms.map((t) => [t.label, t.value])).toEqual([
      ['Base', 7],
      ['Vigor', 2]
    ])
  })

  it('con lo que lleva: los bonos de un objeto equipado', () => {
    const doc = {
      data: { vigor: 1 },
      items: [{ id: 'escudo', type: 'objeto', name: 'Escudo', data: { equipado: true, defensa: 2 } }]
    }
    expect(tryFormula(fronteras, 'personaje', '@defensa', doc).value).toBe(10)
  })

  it('lo de un conjunto, y sí o no', () => {
    const doc = { data: { caracteristicas: { des: { puntuacion: 14 } } } }
    expect(tryFormula(cinco, 'personaje', '@caracteristicas.des.mod', doc).value).toBe(2)
    expect(tryFormula(fronteras, 'personaje', '@vigor >= 1', { data: { vigor: 2 } })).toMatchObject({
      type: 'boolean',
      value: true
    })
  })

  it('lo que no cuadra dice por qué y dónde; los dados, como tirada', () => {
    const tried = tryFormula(fronteras, 'personaje', '7 + @vigr')
    expect(tried.problems[0]).toMatchObject({ message: 'No existe «@vigr» en Personaje. ¿Quizás «@vigor»?', start: 4 })
    expect(tryFormula(fronteras, 'personaje', '2d6 + @vigor').problems[0]?.message).toMatch(/dados/)
    expect(tryFormula(fronteras, 'nada', '1').problems[0]?.message).toBe('No existe el tipo «nada»')
  })
})
