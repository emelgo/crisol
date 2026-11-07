import { describe, expect, it } from 'vitest'
import { characterView } from './builder.ts'
import { fiveE } from './examples/5e/system.ts'
import { exampleContent } from './examples/content.ts'
import type { System } from './format.ts'
import { parseSenses, sensesOf } from './senses.ts'
import { validateSystem } from './validate.ts'

describe('los sentidos de un personaje (docs/specs/vision.md)', () => {
  it('de una lista escrita, en español o en inglés, con su alcance', () => {
    expect(parseSenses(['Visión en la oscuridad 60 pies', 'Vista ciega 10 pies'])).toEqual({
      darkvision: 60,
      blindsight: 10
    })
    expect(parseSenses(['darkvision 120 ft., tremorsense 30 ft.; truesight 18 m'])).toEqual({
      darkvision: 120,
      tremorsense: 30,
      truesight: 18
    })
    // El número delante del nombre también vale; lo que no dice alcance, no
    expect(parseSenses(['60 pies de visión en la oscuridad', 'Visión verdadera', 3, null])).toEqual({ darkvision: 60 })
    expect(parseSenses(['Visión en la oscuridad 60 pies', 'Visión en la oscuridad 120 pies'])).toEqual({
      darkvision: 120
    })
  })

  it('de los campos que dice el sistema: la lista y los numéricos (gana el mayor); sin decirlo, ninguno', () => {
    const system = { senses: { list: 'sentidos', darkvision: 'vision' } } as Pick<System, 'senses'>
    expect(sensesOf(system, { sentidos: ['Visión en la oscuridad 60 pies'], vision: 90 })).toEqual({ darkvision: 90 })
    expect(sensesOf(system, { sentidos: 'Vista ciega 10 pies', vision: 0 })).toEqual({ blindsight: 10 })
    expect(sensesOf({}, { sentidos: ['Visión en la oscuridad 60 pies'] })).toEqual({})
  })

  it('el 5e de ejemplo los lee de «Sentidos» en la hoja del personaje', () => {
    const { view } = characterView(
      fiveE,
      exampleContent('5e'),
      { sources: ['srd51'], duplicates: 'newest', language: 'es' },
      { values: { sentidos: ['Visión en la oscuridad 60 pies'] } }
    )
    expect(sensesOf(fiveE, view.sheet as Record<string, unknown>)).toEqual({ darkvision: 60 })
  })

  it('al validar, el campo tiene que existir y ser del tipo que toca', () => {
    const check = (senses: System['senses']) =>
      validateSystem({ ...fiveE, senses } as unknown)
        .problems.filter((p) => String(p.path).startsWith('senses'))
        .map((p) => p.message)
    expect(check({ list: 'sentidos' })).toEqual([])
    expect(check({ list: 'nada' })).toEqual(['No existe el campo «nada»'])
    expect(check({ darkvision: 'sentidos' })).toEqual(['«sentidos» no es un número'])
    expect(check({ list: 'iniciativa' })).toEqual(['«iniciativa» no es de lista'])
  })
})
