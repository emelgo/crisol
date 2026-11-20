import { describe, expect, it } from 'vitest'
import { entryCard, fillTemplate } from './card.ts'
import { cardKeys, parseTemplate, templateKeys } from './card-template.ts'
import { compendiumTypes } from './compendium.ts'
import { fiveE } from './examples/5e/system.ts'
import type { Field } from './format.ts'
import { validateSystem } from './validate.ts'

const fields: Record<string, Field> = {
  tipo: { kind: 'text', label: 'Tipo' },
  rareza: {
    kind: 'choice',
    label: 'Rareza',
    options: [
      { value: 'rara', label: { es: 'rara', en: 'rare' } },
      { value: 'comun', label: 'común' }
    ]
  },
  sintonia: { kind: 'boolean', label: 'Sintonía' },
  sintonia_por: { kind: 'text', label: 'Por quién' },
  nivel: { kind: 'number', label: 'Nivel' },
  escuela: { kind: 'text', label: 'Escuela' },
  dano: { kind: 'dice', label: 'Daño' }
}

describe('las plantillas de la ficha', () => {
  it('leen campos, condiciones y negaciones, también unas dentro de otras', () => {
    expect(templateKeys('{tipo}, {rareza}{sintonia: (requiere sintonización {sintonia_por})}')).toEqual([
      'tipo',
      'rareza',
      'sintonia',
      'sintonia_por'
    ])
    expect(parseTemplate('a {b} c')).toEqual(['a ', { key: 'b', negate: false, inner: null }, ' c'])
    expect(parseTemplate('{b: x}')).toEqual([{ key: 'b', negate: false, inner: [' x'] }])
    // Una llave que no es de un campo se queda como texto
    expect(parseTemplate('{no es} x')).toEqual(['{no es} x'])
  })

  it('escriben los valores en su idioma, con lo de dentro solo si lo tiene, y sin separadores sueltos', () => {
    const line = '{tipo}, {rareza}{sintonia: (requiere sintonización {sintonia_por})}'
    expect(
      fillTemplate(line, fields, { tipo: 'Anillo', rareza: 'rara', sintonia: true, sintonia_por: 'un mago' }, 'es')
    ).toBe('Anillo, rara (requiere sintonización un mago)')
    expect(fillTemplate(line, fields, { tipo: 'Anillo' }, 'es')).toBe('Anillo')
    expect(fillTemplate(line, fields, { tipo: 'Ring', rareza: 'rara' }, 'en')).toBe('Ring, rare')
    const spell = '{!nivel: Truco de {escuela}}{nivel: Conjuro de nivel {nivel} de {escuela}}'
    expect(fillTemplate(spell, fields, { nivel: 0, escuela: 'evocación' }, 'es')).toBe('Truco de evocación')
    expect(fillTemplate(spell, fields, { nivel: 3, escuela: 'evocación' }, 'es')).toBe(
      'Conjuro de nivel 3 de evocación'
    )
    // Sin ningún valor de lo que nombra, nada (no «Maestría:»)
    expect(fillTemplate('Maestría: {rareza}', fields, {}, 'es')).toBe('')
    // Los dados, para tirarlos
    expect(fillTemplate('{dano} cortante', fields, { dano: '1d8' }, 'es')).toBe('`dice: 1d8` cortante')
  })
})

describe('la ficha de una entrada', () => {
  const sword = {
    type: 'arma',
    data: {
      name: 'Espada larga',
      categoria: 'marcial',
      propiedades: ['versatil'],
      maestria: 'derribar',
      dano: '1d8',
      dano_versatil: '1d10',
      tipo_dano: 'cortante',
      peso: 3,
      coste: 15,
      equipado: true,
      cantidad: 1,
      bono: 1
    }
  }

  it('la del arma del ejemplo: su línea, sus dos lados y lo demás debajo, sin lo de la hoja', () => {
    const listed = compendiumTypes(fiveE, [], { sources: [], duplicates: 'both', excluded: [] }, true)
      .find((t) => t.key === 'arma')
      ?.fields.map((f) => f.key)
    expect(
      compendiumTypes(fiveE, [], { sources: [], duplicates: 'both', excluded: [] }, true)
        .find((t) => t.key === 'arma')
        ?.fields.find((f) => f.key === 'dano')?.inCard
    ).toBe(true)
    expect(listed).not.toContain('equipado')
    // Lo de la ficha se sigue escribiendo, pero no se repite en la lista
    expect(listed).toContain('dano')
    const card = entryCard(fiveE, sword, 'es')
    expect(card?.line).toBe('Arma Marcial')
    expect(card?.left).toEqual(['3 lb., 15 po'])
    expect(card?.right[0]).toBe('`dice: 1d8` Cortante (a dos manos, `dice: 1d10`)')
    expect(card?.right).toContain('Maestría: Derribar')
    expect(card?.right).toContain('**Bono mágico** 1')
    expect(card?.fields.map((f) => f.label)).not.toContain('Equipada')
  })

  it('sin ficha en su tipo, ninguna', () => {
    expect(entryCard(fiveE, { type: 'conjuro', data: {} }, 'es')).toBeNull()
  })

  it('lo que nombra son campos de su tipo', () => {
    expect(cardKeys({ left: ['peso'], hidden: ['equipado'] })).toEqual(new Set(['equipado', 'peso']))
    const broken = structuredClone(fiveE) as unknown as { types: Record<string, { card?: unknown }> }
    const arma = broken.types.arma
    if (arma) arma.card = { line: '{no_existe}', hidden: ['tampoco'] }
    const problems = validateSystem(broken).problems
    expect(problems.some((p) => p.message.includes('«no_existe»') && p.severity === 'error')).toBe(true)
    expect(problems.some((p) => p.message.includes('«tampoco»') && p.severity === 'warning')).toBe(true)
  })
})
