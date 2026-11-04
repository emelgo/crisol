/**
 * Las fórmulas de un sistema entero, al validarlo: cada una en su contexto (un valor calculado con los campos de su
 * tipo; una tirada con los del personaje, @este y, en sus franjas, @total, @natural y @objetivo), y los ciclos entre
 * valores calculados
 */
import type { Field, Roll, System, SystemType } from '../format.ts'
import { type Language, textOf } from '../text.ts'
import {
  type Checked,
  type Context,
  checkFormula,
  RESERVED,
  type Scope,
  type Shape,
  scopeOf,
  shapeOf
} from './check.ts'
import type { ValueType } from './functions.ts'

type Segment = string | number
export type Report = (path: Segment[], message: string, range?: { start: number; end: number }) => void

interface Derived {
  id: string
  label: string
  path: Segment[]
  formula: string
  context: Context
}

/** Pone a los valores calculados el tipo que dan sus fórmulas (para la segunda pasada) */
function fill(scope: Scope, types: Map<string, ValueType>) {
  const visit = (shape: Shape) => {
    if (shape.type === 'any' && shape.dep && types.has(shape.dep))
      (shape as { type: ValueType }).type = types.get(shape.dep) as ValueType
    if (shape.type === 'object') {
      Object.values(shape.fields).forEach(visit)
      if (shape.element) visit(shape.element)
    }
    if (shape.type === 'list') visit(shape.of)
  }
  Object.values(scope).forEach(visit)
}

/** Los valores calculados de un tipo, cada uno con su contexto (con @este dentro de un conjunto o una lista) */
function derivedOf(
  typeKey: string,
  type: SystemType,
  scope: Scope,
  owner: string,
  system: System,
  language: Language
): Derived[] {
  const found: Derived[] = []
  const walk = (fields: Record<string, Field>, path: Segment[], prefix: string, context: Context) => {
    for (const [key, field] of Object.entries(fields)) {
      const id = `${prefix}${key}`
      const here = [...path, key]
      const label = textOf(field.label, language)
      if (field.kind === 'derived')
        found.push({ id, label, path: [...here, 'formula'], formula: field.formula, context })
      if (field.kind === 'resource' && typeof field.max === 'string')
        found.push({ id: `${id}.max`, label, path: [...here, 'max'], formula: field.max, context })
      if (field.kind === 'group') walk(field.fields, [...here, 'fields'], `${id}.`, context)
      if (field.kind === 'set' || field.kind === 'table') {
        const shape = shapeOf(field, id, owner, system, language)
        const este = shape.type === 'object' ? shape.element : shape.type === 'list' ? shape.of : undefined
        const inner: Context = { ...context, scope: { ...context.scope, ...(este ? { este } : {}) } }
        const children = field.kind === 'set' ? field.fields : field.columns
        walk(children as Record<string, Field>, [...here, field.kind === 'set' ? 'fields' : 'columns'], `${id}.`, inner)
      }
    }
  }
  walk(type.fields, ['types', typeKey, 'fields'], '', { scope, dice: false, owner })
  return found
}

export function checkFormulas(system: System, report: Report, language: Language = 'es') {
  const types = Object.entries(system.types)
  const scopes = new Map<string, Scope>()
  for (const [typeKey, type] of types) {
    const owner = textOf(type.label, language) || typeKey
    for (const reserved of RESERVED)
      if (type.fields[reserved])
        report(['types', typeKey, 'fields', reserved], `«${reserved}» es un nombre que ponen las fórmulas: usa otro`)
    const scope = scopeOf(type.fields, '', owner, system, language)
    scopes.set(typeKey, scope)
    const derived = derivedOf(typeKey, type, scope, owner, system, language)

    // Primera pasada: el tipo que da cada valor calculado; segunda: los problemas, ya con esos tipos
    const inferred = new Map<string, ValueType>()
    for (const d of derived) inferred.set(d.id, checkFormula(d.formula, d.context).type)
    fill(scope, inferred)
    const results = new Map<string, Checked>()
    for (const d of derived) {
      const checked = checkFormula(d.formula, d.context)
      results.set(d.id, checked)
      for (const p of checked.problems) report(d.path, p.message, p)
      if (d.id.endsWith('.max') && checked.type !== 'number' && checked.type !== 'any' && checked.problems.length === 0)
        report(d.path, 'El máximo tiene que ser un número')
    }
    cycles(derived, results, report)

    type.modifiers?.forEach((modifier, i) => {
      const context: Context = { scope, dice: false, owner }
      const at: Segment[] = ['types', typeKey, 'modifiers', i]
      const value = checkFormula(modifier.value, context)
      for (const p of value.problems) report([...at, 'value'], p.message, p)
      if (modifier.when) expectBoolean(modifier.when, context, [...at, 'when'], report)
    })
  }

  // Las tiradas, con los campos del personaje (el primero que tenga aquello por lo que va)
  for (const [rollKey, roll] of Object.entries(system.rolls ?? {})) {
    const at: Segment[] = ['rolls', rollKey]
    const contexts = rollContexts(system, roll, language, scopes)
    if (!contexts) {
      report(at, 'Las tiradas necesitan un tipo de personaje')
      continue
    }
    const { context, result } = contexts
    const formula = checkFormula(roll.formula, context)
    for (const p of formula.problems) report([...at, 'formula'], p.message, p)
    if (formula.problems.length === 0 && !['number', 'dice', 'any'].includes(formula.type))
      report([...at, 'formula'], 'Una tirada da un número')
    roll.variants?.forEach((variant, i) => {
      expectBoolean(variant.if, { ...context, dice: false }, [...at, 'variants', i, 'if'], report)
      for (const p of checkFormula(variant.formula, context).problems)
        report([...at, 'variants', i, 'formula'], p.message, p)
    })
    roll.bands?.forEach((band, i) => {
      expectBoolean(band.if, result, [...at, 'bands', i, 'if'], report)
    })
    roll.modes?.forEach((mode, i) => {
      for (const part of ['from', 'to'] as const)
        if (mode[part].includes('@')) report([...at, 'modes', i, part], 'Un modo cambia dados por dados, sin @')
    })
  }
  if (system.dice?.default?.includes('@')) report(['dice', 'default'], 'La tirada por defecto va sin @: solo dados')
}

/**
 * Los nombres de una tirada: los campos del personaje (el primero que tenga aquello por lo que va) y, si va por cada
 * uno, @este; en sus franjas, también @total, @natural y @objetivo. Sin personajes, no hay
 */
export function rollContexts(
  system: System,
  roll: Roll,
  language: Language = 'es',
  scopes?: Map<string, Scope>
): { context: Context; result: Context } | null {
  const wanted = roll.for ? ('fields' in roll.for ? roll.for.fields : [roll.for.set]) : []
  const actors = Object.entries(system.types).filter(([, t]) => t.document === 'actor')
  const actor = actors.find(([, t]) => wanted.every((k) => t.fields[k])) ?? actors[0]
  if (!actor) return null
  const [actorKey, actorType] = actor
  const owner = textOf(actorType.label, language) || actorKey
  const scope: Scope = { ...(scopes?.get(actorKey) ?? scopeOf(actorType.fields, '', owner, system, language)) }
  const first = wanted[0]
  if (roll.for && first) {
    const shape = scope[first]
    // Si va por algo que no existe, ya se ha dicho: @este no da otro error
    scope.este = !shape
      ? { type: 'any', label: 'este' }
      : 'set' in roll.for && shape.type === 'object' && shape.element
        ? shape.element
        : shape
  }
  return {
    context: { scope, dice: true, owner },
    result: {
      scope: {
        ...scope,
        total: { type: 'number', label: 'total' },
        natural: { type: 'number', label: 'natural' },
        objetivo: { type: 'number', label: 'objetivo' }
      },
      dice: false,
      owner
    }
  }
}

function expectBoolean(formula: string, context: Context, path: Segment[], report: Report) {
  const checked = checkFormula(formula, context)
  for (const p of checked.problems) report(path, p.message, p)
  if (checked.problems.length === 0 && !['boolean', 'any', 'null'].includes(checked.type))
    report(path, 'Aquí va sí o no: una comparación, como @total >= 10')
}

/** Los valores calculados que dependen de sí mismos, con la ruta de cada paso */
function cycles(derived: Derived[], results: Map<string, Checked>, report: Report) {
  const byId = new Map(derived.map((d) => [d.id, d]))
  const reported = new Set<string>()
  const state = new Map<string, 'visiting' | 'done'>()
  const stack: string[] = []
  const visit = (id: string) => {
    state.set(id, 'visiting')
    stack.push(id)
    for (const dep of results.get(id)?.deps ?? []) {
      if (!byId.has(dep)) continue
      if (state.get(dep) === 'visiting') {
        const loop = [...stack.slice(stack.indexOf(dep)), dep]
        for (const member of new Set(loop)) {
          if (reported.has(member)) continue
          reported.add(member)
          const d = byId.get(member) as Derived
          const from = loop.indexOf(member)
          const path = [...loop.slice(from, -1), ...loop.slice(0, from), member]
          report(d.path, `«${d.label}» depende de su propio valor: ${path.join(' → ')}`)
        }
      } else if (!state.has(dep)) visit(dep)
    }
    stack.pop()
    state.set(id, 'done')
  }
  for (const d of derived) if (!state.has(d.id)) visit(d.id)
}
