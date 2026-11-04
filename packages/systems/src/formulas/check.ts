/**
 * Comprobar las fórmulas de un sistema al guardarlo, no al usarlo: que lo que nombran exista (con una sugerencia si se
 * parece a algo), que los tipos casen, que las funciones existan y que ningún valor dependa de sí mismo
 */
import type { Field, SimpleField, System } from '../format.ts'
import { own } from '../own.ts'
import { textOf } from '../text.ts'
import { FUNCTIONS, type ValueType } from './functions.ts'
import { type Expr, FormulaError, parseFormula } from './parse.ts'

/** Lo que hay detrás de un nombre: su tipo, su nombre para los mensajes y, si es un valor calculado, cuál */
export type Shape =
  | { type: Exclude<ValueType, 'list' | 'object'>; label: string; dep?: string }
  | {
      type: 'object'
      label: string
      fields: Record<string, Shape>
      /** El de cualquier elemento (un conjunto, por `@caracteristicas[@este.car]`) */
      element?: Shape
      /** Se usa como número (un recurso: su valor) */
      number?: boolean
      dep?: string
    }
  | { type: 'list'; label: string; of: Shape; dep?: string }

export type Scope = Record<string, Shape>

/** Los nombres que ponen las fórmulas: no pueden ser campos de primer nivel */
export const RESERVED = ['este', 'total', 'natural', 'objetivo', 'ajustes'] as const

/** Los ajustes de la campaña, como nombres de las fórmulas (`@ajustes.reglas`) */
export function settingsShape(system: System, language: 'es' | 'en' = 'es'): Shape {
  const fields: Scope = {}
  for (const [k, s] of Object.entries(system.settings ?? {})) {
    const label = textOf(s.label, language) || k
    fields[k] =
      s.kind === 'boolean'
        ? { type: 'boolean', label }
        : s.kind === 'number'
          ? { type: 'number', label }
          : s.kind === 'choice'
            ? { type: 'string', label }
            : { type: 'list', label, of: { type: 'string', label } }
  }
  return { type: 'object', label: 'ajustes', fields }
}

export interface FormulaProblem {
  message: string
  start: number
  end: number
}

export interface Context {
  scope: Scope
  /** Si caben dados (las tiradas sí; los valores calculados no) */
  dice: boolean
  /** Para los mensajes: «No existe «@vigr» en Personaje» */
  owner: string
}

const TYPE_NAMES: Record<ValueType, string> = {
  number: 'un número',
  string: 'un texto',
  boolean: 'sí o no',
  null: 'nada',
  dice: 'dados',
  list: 'una lista',
  object: 'un grupo',
  any: 'cualquier cosa'
}

/**
 * El más parecido de los candidatos, si se parece lo bastante (una errata): a dos letras como mucho o, si no, uno que
 * empiece igual. Acotado: solo se mira la franja de esas dos letras, y lo hallado se guarda por ámbito
 */
export function closest(name: string, candidates: Iterable<string>): string | null {
  if (name.length > 60) return null
  const lower = name.toLowerCase()
  const max = Math.max(1, Math.min(2, Math.floor(name.length / 3)))
  let best: string | null = null
  let bestDistance = max + 1
  let sameStart: string | null = null
  for (const candidate of candidates) {
    const other = candidate.toLowerCase()
    if (!sameStart && name.length >= 3 && other.startsWith(lower.slice(0, 3))) sameStart = candidate
    const d = within(lower, other, max)
    if (d < bestDistance) {
      best = candidate
      bestDistance = d
    }
  }
  return best ?? sameStart
}

/** La distancia de Levenshtein si es como mucho max; si no, max + 1. Solo se calcula la franja |i − j| ≤ max */
function within(a: string, b: string, max: number): number {
  const far = max + 1
  if (Math.abs(a.length - b.length) > max) return far
  let previous = Array.from({ length: b.length + 1 }, (_, j) => (j <= max ? j : far))
  for (let i = 1; i <= a.length; i++) {
    const row = new Array<number>(b.length + 1).fill(far)
    if (i <= max) row[0] = i
    let least = row[0] as number
    for (let j = Math.max(1, i - max); j <= Math.min(b.length, i + max); j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min((previous[j] as number) + 1, (row[j - 1] as number) + 1, (previous[j - 1] as number) + cost)
      if ((row[j] as number) < least) least = row[j] as number
    }
    if (least > max) return far
    previous = row
  }
  return Math.min(previous[b.length] as number, far)
}

/** Lo sugerido para cada nombre, por ámbito: una errata repetida en cien fórmulas se busca una vez */
const suggested = new WeakMap<object, Map<string, string | null>>()
function closestIn(name: string, fields: Record<string, unknown>): string | null {
  let cache = suggested.get(fields)
  if (!cache) {
    cache = new Map()
    suggested.set(fields, cache)
  }
  if (!cache.has(name)) cache.set(name, closest(name, Object.keys(fields)))
  return cache.get(name) ?? null
}

export interface Checked {
  type: ValueType
  /** Los valores calculados de los que depende (para los ciclos) */
  deps: Set<string>
  problems: FormulaProblem[]
}

/** Comprueba una fórmula ya leída en su contexto */
export function checkExpr(expr: Expr, context: Context): Checked {
  const problems: FormulaProblem[] = []
  const deps = new Set<string>()
  const report = (e: Expr, message: string) => problems.push({ message, start: e.start, end: e.end })

  // Los dados que no se pueden tirar: dentro de una función o de una comparación (la condición de «? :» elige la rama)
  const diceInside = (e: Expr, where: string) =>
    report(e, `Los dados no van dentro de ${where}: van sumados en la tirada (2d6 + @este)`)

  const typeOfShape = (s: Shape): ValueType => (s.type === 'object' && s.number ? 'number' : s.type)

  const resolve = (e: Extract<Expr, { kind: 'ref' }>): Shape | null => {
    const [first, ...rest] = e.path as [string, ...(string | Expr)[]]
    let shape: Shape | undefined = own(context.scope, first)
    if (!shape) {
      const near = closestIn(first, context.scope)
      report(e, `No existe «@${first}» en ${context.owner}${near ? `. ¿Quizás «@${near}»?` : ''}`)
      return null
    }
    let written = `@${first}`
    for (const segment of rest) {
      // De lo que no se sabe qué es (un valor sin comprobar), no se sabe qué tiene: se deja pasar
      if (shape.type === 'any') {
        if (shape.dep) deps.add(shape.dep)
        return shape
      }
      if (typeof segment !== 'string') {
        const index = visit(segment)
        if (index !== 'string' && index !== 'any')
          report(segment, `Un elemento se elige por su clave, un texto; esto es ${TYPE_NAMES[index]}`)
        if (shape.type !== 'object' || !shape.element) {
          report(e, `«${written}» no tiene elementos`)
          return null
        }
        shape = shape.element
        written += '[…]'
        continue
      }
      if (shape.type === 'list') {
        // De una lista, lo mismo de cada fila: @lleva.peso es la lista de los pesos
        const of: Shape = shape.of
        if (of.type !== 'object' || !own(of.fields, segment)) {
          const near = of.type === 'object' ? closestIn(segment, of.fields) : null
          report(e, `«${segment}» no existe en «${written}»${near ? `. ¿Quizás «${near}»?` : ''}`)
          return null
        }
        shape = { type: 'list', label: shape.label, of: own(of.fields, segment) as Shape }
      } else if (shape.type === 'object') {
        const next: Shape | undefined = own(shape.fields, segment)
        if (!next) {
          const near = closestIn(segment, shape.fields)
          report(e, `«${segment}» no existe en «${written}»${near ? `. ¿Quizás «${near}»?` : ''}`)
          return null
        }
        shape = next
      } else {
        report(e, `«${written}» es ${TYPE_NAMES[shape.type]}: no tiene «${segment}»`)
        return null
      }
      written += `.${segment}`
    }
    if (shape.dep) deps.add(shape.dep)
    if (shape.type === 'object' && shape.number) {
      const value = shape.fields.value
      if (value?.dep) deps.add(value.dep)
    }
    return shape
  }

  const numeric = (e: Expr, t: ValueType, what: string) => {
    // Los dados donde no caben ya se han dicho donde están
    if (t === 'number' || t === 'any' || t === 'dice') return
    report(e, `No se puede ${what} ${TYPE_NAMES[t]}`)
  }
  const logical = (e: Expr, t: ValueType) => {
    if (t === 'boolean' || t === 'any' || t === 'null') return
    report(e, `Aquí va sí o no (una comparación), no ${TYPE_NAMES[t]}`)
  }

  const visit = (e: Expr): ValueType => {
    switch (e.kind) {
      case 'number':
        return 'number'
      case 'string':
        return 'string'
      case 'boolean':
        return 'boolean'
      case 'null':
        return 'null'
      case 'dice':
        if (!context.dice) report(e, 'Un valor calculado no lleva dados: los dados van en las tiradas')
        return 'dice'
      case 'ref': {
        const shape = resolve(e)
        if (shape?.type === 'dice' && !context.dice)
          report(e, 'Un valor calculado no lleva dados: los dados van en las tiradas')
        return shape ? typeOfShape(shape) : 'any'
      }
      case 'unary': {
        const t = visit(e.value)
        if (e.op === '-') {
          numeric(e.value, t, 'cambiar de signo')
          return t === 'dice' ? 'dice' : 'number'
        }
        logical(e.value, t)
        return 'boolean'
      }
      case 'binary': {
        const left = visit(e.left)
        const right = visit(e.right)
        switch (e.op) {
          case '+':
          case '-':
          case '*':
          case '/':
          case '%': {
            const what = { '+': 'sumar', '-': 'restar', '*': 'multiplicar', '/': 'dividir', '%': 'dividir' }[e.op]
            numeric(e.left, left, what)
            numeric(e.right, right, what)
            // Al tirar, los dados se suman, restan, multiplican o dividen; el resto no se puede armar
            if (e.op === '%' && (left === 'dice' || right === 'dice'))
              report(e, 'Con dados no se saca el resto (%): súmalos, réstalos, multiplícalos o divídelos')
            return left === 'dice' || right === 'dice' ? 'dice' : 'number'
          }
          case '<':
          case '<=':
          case '>':
          case '>=':
            if (left !== 'null') numeric(e.left, left, 'comparar')
            if (right !== 'null') numeric(e.right, right, 'comparar')
            if (left === 'dice' || right === 'dice') diceInside(e, 'una comparación')
            return 'boolean'
          case '==':
          case '!=':
            return 'boolean'
          default:
            logical(e.left, left)
            logical(e.right, right)
            return 'boolean'
        }
      }
      case 'conditional': {
        const test = visit(e.test)
        logical(e.test, test)
        if (test === 'dice') diceInside(e.test, 'la condición de «? :»')
        const then = visit(e.yes)
        const otherwise = visit(e.no)
        if (then === 'any' || then === 'null') return otherwise
        if (otherwise === 'any' || otherwise === 'null' || then === otherwise) return then
        if ((then === 'dice' || otherwise === 'dice') && (then === 'number' || otherwise === 'number')) return 'dice'
        report(e, `Las dos ramas de «? :» dan cosas distintas: ${TYPE_NAMES[then]} y ${TYPE_NAMES[otherwise]}`)
        return 'any'
      }
      case 'call': {
        const fn = own(FUNCTIONS, e.name)
        const args = e.args.map(visit)
        if (!fn) {
          const near = closest(e.name, Object.keys(FUNCTIONS))
          report(e, `No existe la función «${e.name}»${near ? `. ¿Quizás «${near}»?` : ''}`)
          return 'any'
        }
        if (args.length < fn.min || args.length > fn.max) {
          const wanted = fn.min === fn.max ? `${fn.min}` : `de ${fn.min} a ${fn.max}`
          report(e, `${e.name} lleva ${wanted} ${fn.max === 1 ? 'valor' : 'valores'}`)
        }
        args.forEach((t, i) => {
          const wanted = fn.args[Math.min(i, fn.args.length - 1)] as ValueType
          const arg = e.args[i] as Expr
          if (t === 'dice') diceInside(arg, `${e.name}(…)`)
          if (wanted === 'number') numeric(arg, t, `usar en ${e.name}`)
          if (wanted === 'list' && t !== 'list' && t !== 'any')
            report(arg, `${e.name} va con una lista, no con ${TYPE_NAMES[t]}`)
        })
        return fn.returns
      }
    }
  }

  const type = visit(expr)
  return { type, deps, problems }
}

/** Leer y comprobar una fórmula escrita; un error de sintaxis sale como un problema más */
export function checkFormula(formula: string, context: Context): Checked & { expr: Expr | null } {
  try {
    const expr = parseFormula(formula)
    return { ...checkExpr(expr, context), expr }
  } catch (error) {
    if (!(error instanceof FormulaError)) throw error
    return {
      type: 'any',
      deps: new Set(),
      problems: [{ message: error.message, start: error.start, end: error.end }],
      expr: null
    }
  }
}

const expanding = new Set<string>()

/** Lo que se puede nombrar desde un campo de un tipo: sus campos, con su forma */
export function shapeOf(
  field: Field | SimpleField,
  id: string,
  owner: string,
  system?: System,
  language: 'es' | 'en' = 'es'
): Shape {
  const label = textOf(field.label, language)
  switch (field.kind) {
    case 'text':
    case 'choice':
    case 'link':
      return { type: 'string', label }
    case 'number':
    case 'clock':
      return { type: 'number', label }
    case 'boolean':
      return { type: 'boolean', label }
    case 'list':
      return { type: 'list', label, of: { type: 'string', label } }
    case 'dice':
      return { type: 'dice', label }
    case 'derived':
      return { type: 'any', label, dep: id }
    case 'resource':
      return {
        type: 'object',
        label,
        number: true,
        fields: {
          value: { type: 'number', label },
          max: typeof field.max === 'string' ? { type: 'number', label, dep: `${id}.max` } : { type: 'number', label },
          temp: { type: 'number', label }
        }
      }
    case 'group':
      return { type: 'object', label, fields: scopeOf(field.fields, `${id}.`, owner, system, language) }
    case 'table':
      return {
        type: 'list',
        label,
        of: { type: 'object', label, fields: scopeOf(field.columns, `${id}.`, owner, system, language) }
      }
    case 'set': {
      const element: Shape = { type: 'object', label, fields: elementScope(field, id, owner, system, language) }
      return {
        type: 'object',
        label,
        element,
        fields: Object.fromEntries(field.elements.map((e) => [e.key, { ...element, label: textOf(e.label, language) }]))
      }
    }
    case 'items': {
      // Los campos de los tipos de objeto que lleva (si son varios, los de todos). Lo que lleva lo que se lleva no se
      // despliega otra vez: sería un camino por cada combinación de tipos, que crece sin fin
      if (expanding.size > 0) return { type: 'list', label, of: { type: 'any', label } }
      const fields: Scope = {}
      for (const type of field.of) {
        const itemType = system ? own(system.types, type) : undefined
        expanding.add(type)
        try {
          Object.assign(fields, scopeOf(itemType?.fields ?? {}, `${type}:`, owner, system, language))
        } finally {
          expanding.delete(type)
        }
      }
      return { type: 'list', label, of: { type: 'object', label, fields } }
    }
  }
}

/** Dentro de un conjunto, cada elemento: sus campos, su clave y su nombre */
function elementScope(
  field: Extract<Field, { kind: 'set' }>,
  id: string,
  owner: string,
  system: System | undefined,
  language: 'es' | 'en'
): Scope {
  return {
    ...scopeOf(field.fields, `${id}.`, owner, system, language),
    key: { type: 'string', label: 'clave' },
    label: { type: 'string', label: 'nombre' }
  }
}

export function scopeOf(
  fields: Record<string, Field | SimpleField>,
  prefix: string,
  owner: string,
  system?: System,
  language: 'es' | 'en' = 'es'
): Scope {
  return Object.fromEntries(
    Object.entries(fields).map(([key, f]) => [key, shapeOf(f, `${prefix}${key}`, owner, system, language)])
  )
}
