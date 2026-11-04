/**
 * Calcular un documento de un tipo (un personaje con lo que lleva): sus valores guardados, normalizados, y cada valor
 * calculado con su desglose (los términos con su nombre, los bonos de lo que lleva con su origen y el valor fijado a
 * mano). Lo que no cuadra (fuera de rango, de otra clase) se marca y se conserva. Con un presupuesto por documento
 * entero: al pasarlo, los valores que quedan dicen el error y lo guardado sigue (ADR-0011)
 */
import type { Field, SimpleField, System } from './format.ts'
import { FUNCTIONS, type Value } from './formulas/functions.ts'
import { type Expr, FormulaError, parseFormula } from './formulas/parse.ts'
import { type Language, textOf } from './text.ts'

export interface DocumentItem {
  id: string
  type: string
  name: string
  data: Record<string, unknown>
}

export interface SystemDocument {
  data: Record<string, unknown>
  items?: DocumentItem[]
  /** Valores fijados a mano, por su id (`ca`, `caracteristicas.des.mod`) */
  overrides?: Record<string, number>
}

export interface Term {
  label: string
  value: number
  kind: 'base' | 'field' | 'bonus' | 'override'
  /** El objeto del que sale un bono */
  origin?: string
}

export interface Computed {
  value: Value
  terms: Term[]
  error?: string
}

export interface Evaluated {
  /** Todo el documento, con lo calculado puesto */
  values: Record<string, Value>
  /** Cada valor calculado (y cada campo con bonos), por su id */
  computed: Record<string, Computed>
  /** Lo guardado que no cuadra: se marca y se conserva */
  problems: { path: string; message: string }[]
}

export const BUDGET = 200_000

class Stop extends Error {}

const parsed = new WeakMap<System, Map<string, Expr>>()
/** Cada fórmula se lee una vez por sistema */
function exprOf(system: System, formula: string): Expr {
  let cache = parsed.get(system)
  if (!cache) {
    cache = new Map()
    parsed.set(system, cache)
  }
  let expr = cache.get(formula)
  if (!expr) {
    expr = parseFormula(formula)
    cache.set(formula, expr)
  }
  return expr
}

const truthy = (v: Value) => v !== null && v !== false && v !== 0 && v !== '' && !(Array.isArray(v) && v.length === 0)

function toNumber(v: Value): number {
  if (typeof v === 'number') return v
  if (v === null) return 0
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'object' && !Array.isArray(v) && typeof v.value === 'number') return v.value
  throw new FormulaError(
    `Se esperaba un número y hay ${Array.isArray(v) ? 'una lista' : typeof v === 'string' ? `«${v}»` : 'un grupo'}`,
    0,
    0
  )
}

/** Lo que hay detrás de un nombre al calcular: un valor, un valor calculado (que se calcula al pedirlo) o un grupo */
type Node =
  | { kind: 'value'; value: Value; label?: string }
  | { kind: 'computed'; id: string; label: string; get: () => Value }
  | { kind: 'object'; fields: Record<string, Node>; label?: string; number?: boolean }
  | { kind: 'list'; items: Node[] }

interface Runtime {
  spend(): void
}

function materialize(node: Node): Value {
  switch (node.kind) {
    case 'value':
      return node.value
    case 'computed':
      return node.get()
    case 'object':
      return Object.fromEntries(Object.entries(node.fields).map(([k, n]) => [k, materialize(n)]))
    case 'list':
      return node.items.map(materialize)
  }
}

/** Evaluar una fórmula ya leída con unos nombres (sin dados: los dados son de las tiradas) */
export function evaluateExpr(expr: Expr, scope: Record<string, Node>, runtime: Runtime): Value {
  const visit = (e: Expr): Value => {
    runtime.spend()
    switch (e.kind) {
      case 'number':
      case 'string':
      case 'boolean':
        return e.value
      case 'null':
        return null
      case 'dice':
        throw new FormulaError('Un valor calculado no lleva dados: los dados van en las tiradas', e.start, e.end)
      case 'ref':
        return materialize(lookup(e))
      case 'unary': {
        const v = visit(e.value)
        return e.op === '-' ? -toNumber(v) : !truthy(v)
      }
      case 'binary': {
        if (e.op === '&&') return truthy(visit(e.left)) && truthy(visit(e.right))
        if (e.op === '||') return truthy(visit(e.left)) || truthy(visit(e.right))
        const left = visit(e.left)
        const right = visit(e.right)
        switch (e.op) {
          case '==':
            return left === right
          case '!=':
            return left !== right
          case '<':
          case '<=':
          case '>':
          case '>=': {
            if (left === null || right === null) return false
            const a = toNumber(left)
            const b = toNumber(right)
            return e.op === '<' ? a < b : e.op === '<=' ? a <= b : e.op === '>' ? a > b : a >= b
          }
          default: {
            const a = toNumber(left)
            const b = toNumber(right)
            if ((e.op === '/' || e.op === '%') && b === 0) throw new FormulaError('División entre cero', e.start, e.end)
            return e.op === '+' ? a + b : e.op === '-' ? a - b : e.op === '*' ? a * b : e.op === '/' ? a / b : a % b
          }
        }
      }
      case 'conditional':
        return truthy(visit(e.test)) ? visit(e.then) : visit(e.else)
      case 'call': {
        const fn = FUNCTIONS[e.name]
        if (!fn) throw new FormulaError(`No existe la función «${e.name}»`, e.start, e.end)
        return fn.call(e.args.map(visit))
      }
    }
  }

  const lookup = (e: Extract<Expr, { kind: 'ref' }>): Node => {
    const [first, ...rest] = e.path as [string, ...(string | Expr)[]]
    let node: Node | undefined = scope[first]
    if (!node) throw new FormulaError(`No existe «@${first}»`, e.start, e.end)
    for (const segment of rest) {
      const key = typeof segment === 'string' ? segment : String(visit(segment))
      if (node.kind === 'computed') node = { kind: 'value', value: node.get() }
      if (node.kind === 'value') {
        const v: Value = node.value
        const inner: Value | undefined = v !== null && typeof v === 'object' && !Array.isArray(v) ? v[key] : undefined
        node = { kind: 'value', value: inner ?? null }
      } else if (node.kind === 'object') {
        node = node.fields[key] ?? { kind: 'value', value: null }
      } else {
        // De una lista, lo mismo de cada fila
        const items: Node[] = node.items.map((item) =>
          item.kind === 'object' ? (item.fields[key] ?? { kind: 'value', value: null }) : { kind: 'value', value: null }
        )
        node = { kind: 'list', items }
      }
    }
    return node
  }

  return visit(expr)
}

/** El término de un trozo de la fórmula: su nombre (el de lo que nombra) y su valor */
function termLabel(e: Expr, scope: Record<string, Node>, source: string): { label: string; kind: Term['kind'] } {
  if (e.kind === 'number') return { label: 'Base', kind: 'base' }
  if (e.kind === 'ref') {
    // El nombre más concreto que tenga: el del elemento de un conjunto (Destreza) o el del campo
    let node: Node | undefined = scope[e.path[0] as string]
    let label = node && 'label' in node ? (node.label ?? '') : ''
    for (const segment of e.path.slice(1)) {
      if (typeof segment !== 'string' || !node || node.kind !== 'object') break
      node = node.fields[segment]
      if (node && node.kind === 'object' && node.label) label = node.label
      else if (node && node.kind === 'computed' && !label) label = node.label
    }
    return { label: label || source.slice(e.start, e.end), kind: 'field' }
  }
  return { label: source.slice(e.start, e.end).trim(), kind: 'field' }
}

/** Los términos de una suma (a + b - c), cada uno con su signo */
function additive(e: Expr, sign = 1): { expr: Expr; sign: number }[] {
  if (e.kind === 'binary' && (e.op === '+' || e.op === '-'))
    return [...additive(e.left, sign), ...additive(e.right, e.op === '-' ? -sign : sign)]
  return [{ expr: e, sign }]
}

export function evaluate(
  system: System,
  typeKey: string,
  doc: SystemDocument,
  { budget = BUDGET, language = 'es' as Language } = {}
): Evaluated {
  const type = system.types[typeKey]
  if (!type) throw new Error(`No existe el tipo «${typeKey}»`)
  const problems: Evaluated['problems'] = []
  const computed: Record<string, Computed> = {}
  let left = budget
  const runtime: Runtime = {
    spend() {
      if (--left < 0) throw new Stop()
    }
  }
  const label = (t: Parameters<typeof textOf>[0]) => textOf(t, language)

  // Los bonos de lo que lleva, por el id de su objetivo
  const items = doc.items ?? []
  const bonuses = new Map<string, { item: DocumentItem; value: Expr; when?: Expr }[]>()
  for (const item of items) {
    for (const modifier of system.types[item.type]?.modifiers ?? []) {
      const list = bonuses.get(modifier.target) ?? []
      list.push({
        item,
        value: exprOf(system, modifier.value),
        ...(modifier.when ? { when: exprOf(system, modifier.when) } : {})
      })
      bonuses.set(modifier.target, list)
    }
  }
  const itemScopes = new Map<string, Record<string, Node>>()
  const itemScope = (item: DocumentItem) => {
    let scope = itemScopes.get(item.id)
    if (!scope) {
      const itemType = system.types[item.type]
      scope = itemType ? nodesOf(itemType.fields, item.data, `items.${item.id}.`, [], true).fields : {}
      itemScopes.set(item.id, scope)
    }
    return scope
  }

  /** Los bonos activos a un id, como términos */
  const bonusTerms = (id: string): Term[] => {
    const out: Term[] = []
    for (const b of bonuses.get(id) ?? []) {
      const scope = itemScope(b.item)
      if (b.when && !truthy(evaluateExpr(b.when, scope, runtime))) continue
      out.push({
        label: b.item.name,
        value: toNumber(evaluateExpr(b.value, scope, runtime)),
        kind: 'bonus',
        origin: b.item.id
      })
    }
    return out
  }

  const scope: Record<string, Node> = {}

  /** Los nodos de unos campos con sus valores guardados; los calculados, al pedirlos */
  function nodesOf(
    fields: Record<string, Field | SimpleField>,
    data: Record<string, unknown>,
    prefix: string,
    path: string[],
    item = false,
    este?: { label: string; fields: () => Record<string, Node> }
  ): { kind: 'object'; fields: Record<string, Node> } {
    const out: Record<string, Node> = {}
    const local = () =>
      este
        ? { ...scope, este: { kind: 'object' as const, label: este.label, fields: { ...este.fields(), ...out } } }
        : item
          ? out
          : scope
    for (const [key, field] of Object.entries(fields)) {
      const id = `${prefix}${key}`
      const here = [...path, key]
      out[key] = nodeOf(field, data[key], id, here, local, item)
    }
    return { kind: 'object', fields: out }
  }

  function nodeOf(
    field: Field | SimpleField,
    raw: unknown,
    id: string,
    path: string[],
    local: () => Record<string, Node>,
    item: boolean
  ): Node {
    const name = label(field.label)
    switch (field.kind) {
      case 'derived':
        return computedNode(id, name, field.formula, local, item)
      case 'number': {
        const value = stored(field, raw, path)
        // Un número con bonos (un +1 a Vigor) se calcula: lo guardado más los bonos
        if (!item && bonuses.has(id)) return withBonuses(id, name, value as number)
        return { kind: 'value', value, label: name }
      }
      case 'resource': {
        const r = (raw ?? {}) as Record<string, unknown>
        const value = typeof r.value === 'number' ? r.value : (field.default ?? 0)
        const temp = typeof r.temp === 'number' ? r.temp : 0
        const max: Node =
          typeof field.max === 'string'
            ? computedNode(`${id}.max`, name, field.max, local, item)
            : { kind: 'value', value: typeof r.max === 'number' ? r.max : (field.max ?? null) }
        return {
          kind: 'object',
          label: name,
          number: true,
          fields: { value: { kind: 'value', value }, max, temp: { kind: 'value', value: temp } }
        }
      }
      case 'group':
        return {
          ...nodesOf(field.fields, (raw ?? {}) as Record<string, unknown>, `${id}.`, [...path, 'fields'], item),
          label: name
        }
      case 'set': {
        const data = (raw ?? {}) as Record<string, Record<string, unknown>>
        const fields: Record<string, Node> = {}
        for (const element of field.elements) {
          const values = data[element.key] ?? {}
          const elementLabel = label(element.label)
          const extra = () => ({
            key: { kind: 'value' as const, value: element.key },
            label: { kind: 'value' as const, value: elementLabel }
          })
          const node = nodesOf(field.fields, values, `${id}.${element.key}.`, [...path, element.key], item, {
            label: elementLabel,
            fields: extra
          })
          fields[element.key] = { ...node, fields: { ...node.fields, ...extra() }, label: elementLabel }
        }
        return { kind: 'object', label: name, fields }
      }
      case 'table': {
        const rows = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []
        return {
          kind: 'list',
          items: rows.map((row, i) => {
            const rowId = typeof row.id === 'string' ? row.id : String(i)
            const node = nodesOf(field.columns, row, `${id}.${rowId}.`, [...path, String(i)], item, {
              label: name,
              fields: () => ({})
            })
            return node
          })
        }
      }
      case 'items': {
        const mine = items.filter((it) => field.of.includes(it.type))
        return { kind: 'list', items: mine.map((it) => ({ kind: 'object', label: it.name, fields: itemScope(it) })) }
      }
      default:
        return { kind: 'value', value: stored(field, raw, path), label: name }
    }
  }

  function withBonuses(id: string, name: string, base: number): Node {
    let done: Value | undefined
    return {
      kind: 'computed',
      id,
      label: name,
      get: () => {
        if (done !== undefined) return done
        try {
          const terms: Term[] = [{ label: name, value: base, kind: 'field' }, ...bonusTerms(id)]
          done = finish(
            id,
            terms.reduce((a, t) => a + t.value, 0),
            terms
          )
        } catch (error) {
          if (!(error instanceof Stop) && !(error instanceof FormulaError)) throw error
          if (error instanceof Stop) left = 0
          computed[id] = {
            value: base,
            terms: [],
            error: error instanceof Stop ? 'La fórmula tarda demasiado' : error.message
          }
          done = base
        }
        return done
      }
    }
  }

  /** El valor fijado a mano manda, y sale en el desglose */
  function finish(id: string, value: Value, terms: Term[]): Value {
    const fixed = doc.overrides?.[id]
    if (typeof fixed === 'number') {
      computed[id] = { value: fixed, terms: [...terms, { label: 'Fijado a mano', value: fixed, kind: 'override' }] }
      return fixed
    }
    computed[id] = { value, terms }
    return value
  }

  function computedNode(
    id: string,
    name: string,
    formula: string,
    local: () => Record<string, Node>,
    item: boolean
  ): Node {
    let state: 'idle' | 'busy' | 'done' = 'idle'
    let result: Value = null
    return {
      kind: 'computed',
      id,
      label: name,
      get: () => {
        if (state === 'done') return result
        if (state === 'busy') throw new FormulaError(`«${name}» depende de su propio valor`, 0, 0)
        state = 'busy'
        try {
          const expr = exprOf(system, formula)
          const names = local()
          const value = evaluateExpr(expr, names, runtime)
          if (typeof value === 'number' && !item) {
            const extra = bonusTerms(id)
            const terms: Term[] = additive(expr).map(({ expr: part, sign }) => {
              const { label: termName, kind } = termLabel(part, names, formula)
              return { label: termName, value: sign * toNumber(evaluateExpr(part, names, runtime)), kind }
            })
            result = finish(id, value + extra.reduce((a, t) => a + t.value, 0), [...terms, ...extra])
          } else {
            result = value
            if (!item) computed[id] = { value, terms: [] }
          }
        } catch (error) {
          result = null
          const message =
            error instanceof Stop
              ? 'La fórmula tarda demasiado'
              : error instanceof FormulaError
                ? error.message
                : String(error)
          if (!item) computed[id] = { value: null, terms: [], error: message }
          if (error instanceof Stop) left = 0
        }
        state = 'done'
        return result
      }
    }
  }

  /** Un valor guardado de un campo simple: normalizado; si no cuadra, se marca y se usa el inicial */
  function stored(field: Field | SimpleField, raw: unknown, path: string[]): Value {
    const at = path.join('.')
    const flag = (message: string) => problems.push({ path: at, message })
    const fallback = 'default' in field && field.default !== undefined ? (field.default as Value) : defaultOf(field)
    if (raw === undefined || raw === null) return fallback
    switch (field.kind) {
      case 'number':
      case 'clock': {
        if (typeof raw !== 'number' || !Number.isFinite(raw)) {
          flag('Tiene que ser un número')
          return fallback
        }
        const min = field.kind === 'number' ? field.min : 0
        const max = field.kind === 'number' ? field.max : field.segments
        if (min !== undefined && raw < min) flag(`Por debajo del mínimo (${min})`)
        if (max !== undefined && raw > max) flag(`Por encima del máximo (${max})`)
        return raw
      }
      case 'boolean':
        if (typeof raw !== 'boolean') flag('Tiene que ser sí o no')
        return typeof raw === 'boolean' ? raw : fallback
      case 'choice':
        if (typeof raw !== 'string' || !field.options.some((o) => o.value === raw))
          flag(`«${String(raw)}» no es una de sus opciones`)
        return typeof raw === 'string' ? raw : fallback
      case 'list':
        return Array.isArray(raw) ? (raw.filter((v) => typeof v === 'string') as string[]) : fallback
      default:
        return typeof raw === 'string' ? raw : fallback
    }
  }

  Object.assign(scope, nodesOf(type.fields, doc.data, '', []).fields)
  // Todo, ya calculado (y cada valor calculado en `computed`)
  const values = Object.fromEntries(
    Object.entries(scope).map(([k, n]) => {
      try {
        return [k, materialize(n)]
      } catch {
        return [k, null]
      }
    })
  ) as Record<string, Value>
  return { values, computed, problems }
}

function defaultOf(field: Field | SimpleField): Value {
  switch (field.kind) {
    case 'number':
    case 'clock':
      return 0
    case 'boolean':
      return false
    case 'list':
      return []
    case 'text':
    case 'choice':
    case 'link':
    case 'dice':
      return null
    default:
      return null
  }
}
