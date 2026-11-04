import { describe, expect, it } from 'vitest'
import { defaultChoices, normalizeChoices } from './choices.ts'
import { editionOf, resolveConcept, visibleContent } from './content.ts'
import { evaluate } from './evaluate.ts'
import type { ContentItem } from './file.ts'
import type { System } from './format.ts'
import { tryFormula } from './try.ts'
import { validateSystem } from './validate.ts'

/** Dos ediciones (la de 2014 con dos fuentes) y unas reglas que cambian entre ellas */
const system = {
  format: 1,
  id: 'prueba',
  name: 'Prueba',
  version: '1',
  languages: ['es'],
  types: {
    personaje: {
      document: 'actor',
      label: 'Personaje',
      fields: {
        nivel: { kind: 'number', label: 'Nivel', default: 1 },
        descanso: {
          kind: 'derived',
          label: 'Dados al descansar',
          formula: '@ajustes.reglas == "e2024" ? @nivel : floor(@nivel / 2)'
        }
      }
    },
    clase: { document: 'item', label: 'Clase', fields: {} },
    conjuro: { document: 'item', label: 'Conjuro', fields: {} },
    armadura: { document: 'item', label: 'Armadura', fields: {} }
  },
  sources: [
    {
      key: 'viejo',
      name: 'Reglas de 2014',
      license: 'CC BY 4.0',
      attribution: 'A',
      edition: '2014',
      released: '2016-01-12'
    },
    {
      key: 'libro',
      name: 'Otro libro de 2014',
      license: 'Propia',
      attribution: 'B',
      edition: '2014',
      released: '2017-11-07'
    },
    {
      key: 'nuevo',
      name: 'Reglas de 2024',
      license: 'CC BY 4.0',
      attribution: 'C',
      edition: '2024',
      released: '2025-04-22'
    }
  ],
  settings: {
    reglas: {
      label: 'Reglas generales',
      kind: 'choice',
      options: [
        { value: 'e2024', label: '2024' },
        { value: 'e2014', label: '2014' }
      ],
      default: 'e2024'
    }
  }
} as unknown as System

const doc = (type: string, key: string, source: string | null, concept?: string): ContentItem => ({
  type,
  key,
  source,
  data: { name: key },
  ...(concept ? { concept } : {})
})

const content = [
  doc('clase', 'guerrero_2014', 'viejo', 'guerrero'),
  doc('clase', 'guerrero_2024', 'nuevo', 'guerrero'),
  doc('clase', 'monje_2014', 'viejo', 'monje'),
  doc('clase', 'mago_2024', 'nuevo', 'mago'),
  doc('clase', 'artifice', 'libro', 'artifice'),
  doc('conjuro', 'escudo_2014', 'viejo', 'escudo'),
  doc('conjuro', 'escudo_2024', 'nuevo', 'escudo'),
  doc('armadura', 'escudo', 'viejo', 'escudo'),
  doc('armadura', 'cuerda', 'viejo'),
  doc('armadura', 'propio', null)
]

const seen = (choices: { sources: string[]; duplicates: 'newest' | 'both' }) =>
  visibleContent(system, content, choices).map(({ item, legacy }) => (legacy ? `${item.key} (legado)` : item.key))

describe('lo que se ve del contenido con lo que eligió la campaña', () => {
  it('las dos ediciones con las dos versiones: lo de 2014 que tiene versión de 2024, marcado «Legado»', () => {
    expect(seen({ sources: ['viejo', 'libro', 'nuevo'], duplicates: 'both' })).toEqual([
      'guerrero_2014 (legado)',
      'guerrero_2024',
      'monje_2014',
      'mago_2024',
      'artifice',
      'escudo_2014 (legado)',
      'escudo_2024',
      'escudo',
      'cuerda',
      'propio'
    ])
  })

  it('las dos ediciones con solo lo más nuevo: lo de 2014 que tiene versión de 2024 no sale', () => {
    expect(seen({ sources: ['viejo', 'libro', 'nuevo'], duplicates: 'newest' })).toEqual([
      'guerrero_2024',
      'monje_2014',
      'mago_2024',
      'artifice',
      'escudo_2024',
      'escudo',
      'cuerda',
      'propio'
    ])
  })

  it('una sola edición: lo suyo y lo que no tiene fuente, sin marcas', () => {
    const only2014 = ['guerrero_2014', 'monje_2014', 'artifice', 'escudo_2014', 'escudo', 'cuerda', 'propio']
    expect(seen({ sources: ['viejo', 'libro'], duplicates: 'newest' })).toEqual(only2014)
    expect(seen({ sources: ['viejo', 'libro'], duplicates: 'both' })).toEqual(only2014)
    expect(seen({ sources: ['nuevo'], duplicates: 'both' })).toEqual([
      'guerrero_2024',
      'mago_2024',
      'escudo_2024',
      'propio'
    ])
    expect(seen({ sources: ['viejo'], duplicates: 'both' })).not.toContain('artifice')
    expect(seen({ sources: [], duplicates: 'both' })).toEqual(['propio'])
  })
})

describe('las referencias por concepto', () => {
  const both = visibleContent(system, content, { sources: ['viejo', 'libro', 'nuevo'], duplicates: 'both' })
  const newest = visibleContent(system, content, { sources: ['viejo', 'libro', 'nuevo'], duplicates: 'newest' })
  const key = (found: ContentItem | null) => found?.key ?? null

  it('se resuelven con la edición de quien las pide; si no la hay, con la más nueva que se vea', () => {
    expect(key(resolveConcept(system, both, 'escudo', { type: 'conjuro', edition: '2014' }))).toBe('escudo_2014')
    expect(key(resolveConcept(system, both, 'escudo', { type: 'conjuro', edition: '2024' }))).toBe('escudo_2024')
    expect(key(resolveConcept(system, newest, 'escudo', { type: 'conjuro', edition: '2014' }))).toBe('escudo_2024')
    expect(key(resolveConcept(system, both, 'monje', { edition: '2024' }))).toBe('monje_2014')
    expect(key(resolveConcept(system, both, 'guerrero'))).toBe('guerrero_2024')
  })

  it('sin tipo, si el concepto es de varios tipos, no se sabe cuál; lo que no existe, tampoco', () => {
    expect(resolveConcept(system, both, 'escudo')).toBeNull()
    expect(key(resolveConcept(system, both, 'escudo', { type: 'armadura' }))).toBe('escudo')
    expect(resolveConcept(system, both, 'nada')).toBeNull()
  })

  it('la edición de un documento es la de su fuente', () => {
    expect(editionOf(system, content[0] as ContentItem)).toBe('2014')
    expect(editionOf(system, content[1] as ContentItem)).toBe('2024')
    expect(editionOf(system, content[9] as ContentItem)).toBeUndefined()
  })
})

describe('lo que elige la campaña: lo que está en las dos ediciones', () => {
  it('por defecto, solo lo más nuevo; lo que no vale se dice', () => {
    expect(defaultChoices(system).duplicates).toBe('newest')
    expect(normalizeChoices(system, { duplicates: 'both' }).choices.duplicates).toBe('both')
    expect(normalizeChoices(system, { duplicates: 'otra' as never })).toMatchObject({
      choices: { duplicates: 'newest' },
      problems: ['«otra» no vale para lo que está en las dos ediciones']
    })
  })
})

describe('los ajustes de la campaña en las fórmulas del sistema', () => {
  it('@ajustes valida y se calcula con lo elegido o, si no, con su valor inicial', () => {
    expect(validateSystem(system).problems).toEqual([])
    expect(evaluate(system, 'personaje', { data: { nivel: 5 } }).values.descanso).toBe(5)
    expect(
      evaluate(system, 'personaje', { data: { nivel: 5 } }, { settings: { reglas: 'e2014' } }).values.descanso
    ).toBe(2)
    expect(evaluate(system, 'personaje', { data: {} }).values).not.toHaveProperty('ajustes')
    expect(tryFormula(system, 'personaje', '@ajustes.reglas')).toMatchObject({ value: 'e2024', problems: [] })
  })

  it('un ajuste que no existe se dice; «ajustes» no vale como nombre de un campo', () => {
    const bad = structuredClone(system) as System
    const fields = bad.types.personaje?.fields as Record<string, unknown>
    fields.descanso = { kind: 'derived', label: 'D', formula: '@ajustes.regla' }
    fields.ajustes = { kind: 'number', label: 'Ajustes' }
    expect(validateSystem(bad).problems.map((p) => `${p.path}: ${p.message}`)).toEqual([
      'types.personaje.fields.ajustes: «ajustes» es un nombre que ponen las fórmulas: usa otro',
      'types.personaje.fields.descanso.formula: «regla» no existe en «@ajustes». ¿Quizás «reglas»?'
    ])
  })
})
