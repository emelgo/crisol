/**
 * Probar una fórmula con un documento de prueba de un tipo (la IA, con probar_formula): se comprueba con los nombres
 * del tipo y se calcula como un valor calculado más, con su desglose. Sin dados: lo que lleva dados se prueba como
 * tirada
 */
import { type Computed, evaluate, type SystemDocument } from './evaluate.ts'
import type { System } from './format.ts'
import { checkFormula, type FormulaProblem, scopeOf } from './formulas/check.ts'
import type { ValueType } from './formulas/functions.ts'
import { type Language, textOf } from './text.ts'

export interface TriedFormula {
  /** Lo que da: un número, sí o no, un texto… */
  type: ValueType
  value: Computed['value']
  terms: Computed['terms']
  /** Lo que no cuadra: en la fórmula (con su sitio) o al calcularla */
  problems: { message: string; start?: number; end?: number }[]
}

const TRIED = '__formula'

const typeOfValue = (value: Computed['value']): ValueType =>
  value === null
    ? 'null'
    : Array.isArray(value)
      ? 'list'
      : typeof value === 'object'
        ? 'object'
        : (typeof value as 'number' | 'string' | 'boolean')

export function tryFormula(
  system: System,
  typeKey: string,
  formula: string,
  doc: SystemDocument = { data: {} },
  language: Language = 'es'
): TriedFormula {
  const type = system.types[typeKey]
  if (!type) return { type: 'any', value: null, terms: [], problems: [{ message: `No existe el tipo «${typeKey}»` }] }
  const owner = textOf(type.label, language) || typeKey
  const checked = checkFormula(formula, {
    scope: scopeOf(type.fields, '', owner, system, language),
    dice: false,
    owner
  })
  if (checked.problems.length > 0)
    return { type: checked.type, value: null, terms: [], problems: checked.problems.map((p: FormulaProblem) => p) }
  // Se calcula como un valor calculado más del tipo: así lleva su desglose y los bonos de lo que lleva
  const withFormula: System = {
    ...system,
    types: {
      ...system.types,
      [typeKey]: { ...type, fields: { ...type.fields, [TRIED]: { kind: 'derived', label: 'Fórmula', formula } } }
    }
  }
  const computed = evaluate(withFormula, typeKey, doc, { language }).computed[TRIED]
  const value = computed?.value ?? null
  return {
    // Con un valor calculado de por medio, lo que da se sabe al calcularla
    type: checked.type === 'any' ? typeOfValue(value) : checked.type,
    value,
    terms: computed?.terms ?? [],
    problems: computed?.error ? [{ message: computed.error }] : []
  }
}
