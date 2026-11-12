import type { Field, FieldKind } from '@crisol/systems'
import { describe, expect, it } from 'vitest'
import { blankField, keyFor, MAIN_KINDS, MORE_KINDS, summaryOf, withText } from './kinds.ts'

/** Las palabras de la interfaz, a la vista: la clave y sus valores */
const words = (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key)

describe('withText: un texto en el idioma del editor', () => {
  it('uno de un solo idioma (o ninguno) se cambia entero', () => {
    expect(withText(undefined, 'Vigor', 'es')).toBe('Vigor')
    expect(withText('Fuerza', 'Brío', 'es')).toBe('Brío')
  })

  it('uno de dos idiomas cambia solo el suyo', () => {
    expect(withText({ es: 'Fuerza', en: 'Strength' }, 'Brío', 'es')).toEqual({ es: 'Brío', en: 'Strength' })
  })
})

describe('keyFor: la clave a partir de un nombre', () => {
  it('sin tildes, en minúsculas y con «_» en vez de espacios y signos', () => {
    expect(keyFor('Puntos de Vida', [])).toBe('puntos_de_vida')
    expect(keyFor('Acción ¡rápida!', [])).toBe('accion_rapida')
    expect(keyFor('  Señal  ', [])).toBe('senal')
  })

  it('sin repetir las que ya hay: fuerza, fuerza_2, fuerza_3', () => {
    expect(keyFor('Fuerza', ['fuerza'])).toBe('fuerza_2')
    expect(keyFor('Fuerza', ['fuerza', 'fuerza_2'])).toBe('fuerza_3')
    expect(keyFor('Fuerza', new Set(['fuerza_2']))).toBe('fuerza')
  })

  it('una que empezaría por número lleva delante «c_»; sin letras, «campo»', () => {
    expect(keyFor('3 deseos', [])).toBe('c_3_deseos')
    expect(keyFor('¿?', [])).toBe('campo')
    expect(keyFor('', ['campo'])).toBe('campo_2')
  })
})

describe('blankField: lo que se pone al añadir uno de cada clase', () => {
  it('cada clase que se ofrece sale con su clase y su nombre', () => {
    for (const kind of [...MAIN_KINDS, ...MORE_KINDS, 'items'] as FieldKind[]) {
      const field = blankField(kind, 'Nuevo')
      expect(field.kind).toBe(kind)
      expect(field.label).toBe('Nuevo')
    }
  })

  it('con algo dentro, para que se vea en la ficha', () => {
    expect(blankField('number', 'N')).toEqual({ kind: 'number', label: 'N', default: 0 })
    expect(blankField('resource', 'Vida')).toMatchObject({ max: 10, default: 10 })
    expect(blankField('derived', 'C')).toMatchObject({ formula: '0' })
    expect(blankField('boolean', 'B')).toMatchObject({ default: false })
    expect(blankField('dice', 'D')).toMatchObject({ default: '1d6' })
    expect(blankField('clock', 'R')).toMatchObject({ segments: 4 })
    expect(blankField('group', 'G')).toMatchObject({ fields: {} })
    expect(blankField('link', 'E')).toMatchObject({ to: '' })
    expect(blankField('items', 'I')).toMatchObject({ of: [] })
    const set = blankField('set', 'Características')
    expect(set.kind === 'set' && set.elements.map((e) => e.key)).toEqual(['uno', 'dos'])
    expect(set.kind === 'set' && Object.keys(set.fields)).toEqual(['valor'])
    const choice = blankField('choice', 'O')
    expect(choice.kind === 'choice' && choice.options.map((o) => o.value)).toEqual(['una', 'otra'])
    const table = blankField('table', 'T')
    expect(table.kind === 'table' && Object.keys(table.columns)).toEqual(['nombre'])
  })
})

describe('summaryOf: el resumen de su fila', () => {
  const of = (field: Field) => summaryOf(field, 'es', words)

  it('una cifra: su rango si lo tiene; si no, dónde empieza; sin nada, vacío', () => {
    expect(of({ kind: 'number', label: 'V', min: 1, max: 20, default: 10 })).toBe(
      'rules.summary.range {"min":1,"max":20}'
    )
    expect(of({ kind: 'number', label: 'V', min: 1, default: 3 })).toBe('rules.summary.starts {"value":3}')
    expect(of({ kind: 'number', label: 'V' })).toBe('')
  })

  it('varias a la vez y una opción: sus nombres, en su idioma', () => {
    expect(
      summaryOf(
        {
          kind: 'set',
          label: 'C',
          elements: [
            { key: 'fue', label: { es: 'Fuerza', en: 'Strength' } },
            { key: 'des', label: 'Destreza' }
          ],
          fields: {}
        },
        'en',
        words
      )
    ).toBe('Strength, Destreza')
    expect(
      of({
        kind: 'choice',
        label: 'O',
        options: [
          { value: 'a', label: 'Una' },
          { value: 'b', label: 'Otra' }
        ]
      })
    ).toBe('Una, Otra')
  })

  it('algo que se gasta: su máximo, si lo tiene', () => {
    expect(of({ kind: 'resource', label: 'Vida', max: 10 })).toBe('rules.summary.max {"value":10}')
    expect(of({ kind: 'resource', label: 'Vida' })).toBe('')
  })

  it('unos dados, un reloj, un apartado y una tabla: lo suyo en corto', () => {
    expect(of({ kind: 'dice', label: 'D', default: '2d6' })).toBe('2d6')
    expect(of({ kind: 'dice', label: 'D' })).toBe('')
    expect(of({ kind: 'clock', label: 'R', segments: 6 })).toBe('rules.summary.segments {"count":6}')
    expect(of({ kind: 'group', label: 'G', fields: { a: { kind: 'text', label: 'A' } } })).toBe(
      'rules.summary.inside {"count":1}'
    )
    expect(
      of({
        kind: 'table',
        label: 'T',
        columns: { a: { kind: 'text', label: 'A' }, b: { kind: 'text', label: 'B' } }
      })
    ).toBe('rules.summary.columns {"count":2}')
  })

  it('las demás (un texto, sí o no…) no llevan resumen', () => {
    expect(of({ kind: 'text', label: 'T' })).toBe('')
    expect(of({ kind: 'boolean', label: 'B' })).toBe('')
  })
})
