/**
 * Calcular un documento de un tipo (un personaje con lo que lleva): sus valores guardados, normalizados, y cada valor
 * calculado con su desglose (los términos con su nombre, los bonos de lo que lleva con su origen y el valor fijado a
 * mano). Lo que no cuadra (fuera de rango, de otra clase) se marca y se conserva. Con un presupuesto por documento
 * entero: al pasarlo, los valores que quedan dicen el error y lo guardado sigue (ADR-0011)
 */
import type { Field, SimpleField, System } from './format.ts'
import { FUNCTIONS, type Value } from './formulas/functions.ts'
import { type Expr, FormulaError, parseFormula } from './formulas/parse.ts'
import type { EFFECT_OPS, Mechanics } from './mechanics.ts'
import { own } from './own.ts'
import { type Language, textOf } from './text.ts'

export interface DocumentItem {
  id: string
  type: string
  name: string
  data: Record<string, unknown>
  /** Su mecánica (la del contenido del que sale): sus efectos cambian a quien lo lleva */
  mechanics?: Mechanics
  /** Lo gastado de cada uno de sus recursos, por su clave */
  uses?: Record<string, number>
}

export interface SystemDocument {
  data: Record<string, unknown>
  items?: DocumentItem[]
  /** Su propia mecánica (una criatura: sus acciones y sus recursos) y lo gastado de sus recursos */
  mechanics?: Mechanics
  uses?: Record<string, number>
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
  /** La ventaja o la desventaja que dan los efectos, por tirada (`salvacion` o `salvacion.des`) */
  advantages: Record<string, { mode: 'advantage' | 'disadvantage'; label: string; origin: string }[]>
  /** Los recursos de lo que lleva (y los suyos, con `item` null): su máximo, lo gastado y lo que queda */
  resources: Resource[]
}

export interface Resource {
  item: string | null
  key: string
  label: string
  max: number
  used: number
  left: number
  recovery?: string
  /** Cuánto se recupera (una fórmula, con dados); sin ella, todo */
  amount?: string
  error?: string
}

export const BUDGET = 200_000

/** Los ajustes de la campaña (`@ajustes`): los elegidos o, si no, su valor inicial */
export function settingsOf(system: System, chosen: Record<string, unknown> = {}): Record<string, Value> {
  return Object.fromEntries(
    Object.entries(system.settings ?? {}).map(([k, st]) => [
      k,
      (own(chosen, k) ??
        st.default ??
        (st.kind === 'choices'
          ? []
          : st.kind === 'number'
            ? 0
            : st.kind === 'boolean'
              ? false
              : (st.options?.[0]?.value ?? null))) as Value
    ])
  )
}

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

/** El valor de un nodo, entero: cada nodo que se copia gasta del presupuesto (una lista de 200 objetos pesa) */
function materialize(node: Node, runtime: Runtime): Value {
  runtime.spend()
  switch (node.kind) {
    case 'value':
      return node.value
    case 'computed':
      return node.get()
    case 'object':
      return Object.fromEntries(Object.entries(node.fields).map(([k, n]) => [k, materialize(n, runtime)]))
    case 'list':
      return node.items.map((item) => materialize(item, runtime))
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
        return materialize(lookup(e), runtime)
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
        return truthy(visit(e.test)) ? visit(e.yes) : visit(e.no)
      case 'call': {
        const fn = own(FUNCTIONS, e.name)
        if (!fn) throw new FormulaError(`No existe la función «${e.name}»`, e.start, e.end)
        return fn.call(e.args.map(visit))
      }
    }
  }

  const lookup = (e: Extract<Expr, { kind: 'ref' }>): Node => {
    const [first, ...rest] = e.path as [string, ...(string | Expr)[]]
    let node: Node | undefined = own(scope, first)
    if (!node) throw new FormulaError(`No existe «@${first}»`, e.start, e.end)
    for (const segment of rest) {
      const key = typeof segment === 'string' ? segment : String(visit(segment))
      if (node.kind === 'computed') node = { kind: 'value', value: node.get() }
      if (node.kind === 'value') {
        const v: Value = node.value
        const inner: Value | undefined =
          v !== null && typeof v === 'object' && !Array.isArray(v) ? own(v as Record<string, Value>, key) : undefined
        node = { kind: 'value', value: inner ?? null }
      } else if (node.kind === 'object') {
        node = own(node.fields, key) ?? { kind: 'value', value: null }
      } else {
        // De una lista, lo mismo de cada fila
        const items: Node[] = node.items.map((item) => {
          runtime.spend()
          return item.kind === 'object'
            ? (own(item.fields, key) ?? { kind: 'value', value: null })
            : { kind: 'value', value: null }
        })
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
  {
    budget = BUDGET,
    language = 'es' as Language,
    settings = {}
  }: { budget?: number; language?: Language; settings?: Record<string, unknown> } = {}
): Evaluated {
  const type = own(system.types, typeKey)
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

  // Los efectos de lo que lleva, por el id de su destino: los bonos del tipo (de siempre, con los campos del objeto) y
  // los de su mecánica (con los de quien lo lleva, @este y @ajustes)
  const items = doc.items ?? []
  const effects = new Map<string, Effect[]>()
  const pending: Effect[] = []
  const push = (target: string, effect: Effect) => {
    const list = effects.get(target) ?? []
    list.push(effect)
    effects.set(target, list)
  }
  for (const item of items) {
    for (const modifier of own(system.types, item.type)?.modifiers ?? [])
      push(modifier.target, {
        op: 'add',
        item,
        label: item.name,
        legacy: true,
        value: exprOf(system, modifier.value),
        ...(modifier.when ? { when: exprOf(system, modifier.when) } : {})
      })
    for (const e of item.mechanics?.effects ?? []) {
      const effect: Effect = {
        op: e.op,
        item,
        label: e.label ? label(e.label) : item.name,
        legacy: false,
        ...(e.value ? { value: exprOf(system, e.value) } : {}),
        ...(e.when ? { when: exprOf(system, e.when) } : {})
      }
      if (e.op === 'advantage' || e.op === 'disadvantage') pending.push({ ...effect, target: e.target })
      else push(e.target, effect)
    }
  }
  const itemScopes = new Map<string, Record<string, Node>>()
  const itemScope = (item: DocumentItem) => {
    let scope = itemScopes.get(item.id)
    if (!scope) {
      const itemType = own(system.types, item.type)
      scope = itemType ? nodesOf(itemType.fields, item.data, `items.${item.id}.`, [], true).fields : {}
      itemScopes.set(item.id, scope)
    }
    return scope
  }
  // Los ajustes de la campaña: los elegidos o, si no, su valor inicial
  const ajustes: Node = { kind: 'value', value: settingsOf(system, settings) }
  /** Los nombres de un efecto: los del objeto (los bonos de siempre) o los de quien lo lleva, con @este y @ajustes */
  const ownerScopes = new Map<string, Record<string, Node>>()
  /** Los nombres de quien lo lleva, con @este (el objeto) y @ajustes */
  const ownerScope = (item: DocumentItem): Record<string, Node> => {
    let names = ownerScopes.get(item.id)
    if (!names) {
      const fields = { ...itemScope(item), name: { kind: 'value', value: item.name } as Node }
      names = { ...scope, este: { kind: 'object', label: item.name, fields }, ajustes }
      ownerScopes.set(item.id, names)
    }
    return names
  }
  const legacyScopes = new Map<string, Record<string, Node>>()
  /** Los bonos de siempre: los campos del objeto y @ajustes */
  const legacyScope = (item: DocumentItem) => {
    let names = legacyScopes.get(item.id)
    if (!names) {
      names = { ...itemScope(item), ajustes }
      legacyScopes.set(item.id, names)
    }
    return names
  }
  const effectScope = (e: Effect): Record<string, Node> => (e.legacy ? legacyScope(e.item) : ownerScope(e.item))
  const holds = (e: Effect) => !e.when || truthy(evaluateExpr(e.when, effectScope(e), runtime))
  const amount = (e: Effect) => (e.value ? toNumber(evaluateExpr(e.value, effectScope(e), runtime)) : 0)

  /** Aplica a un valor los efectos a su id, en su orden (base, fijar, sumar, mínimo y máximo), con su desglose */
  const applyEffects = (id: string, value: number, terms: Term[]): { value: number; terms: Term[] } => {
    const active = (effects.get(id) ?? []).filter(holds)
    let v = value
    let t = terms
    // La base: la mayor de las que se aplican sustituye a la de siempre, aunque dé menos (con armadura, la de la armadura)
    let best: { e: Effect; n: number } | undefined
    for (const e of active.filter((x) => x.op === 'base')) {
      const n = amount(e)
      if (!best || n > best.n) best = { e, n }
    }
    if (best?.e.value) {
      const { e } = best
      const names = effectScope(e)
      v = best.n
      t = additive(best.e.value).map(({ expr: part, sign }) => {
        const named = termLabel(part, names, '')
        const partValue = sign * toNumber(evaluateExpr(part, names, runtime))
        return named.kind === 'base'
          ? { label: e.label, value: partValue, kind: 'base' as const, origin: e.item.id }
          : { label: named.label, value: partValue, kind: named.kind }
      })
    }
    for (const e of active.filter((x) => x.op === 'set')) {
      v = amount(e)
      t = [{ label: e.label, value: v, kind: 'base', origin: e.item.id }]
    }
    for (const e of active.filter((x) => x.op === 'add')) {
      const n = amount(e)
      v += n
      t = [...t, { label: e.label, value: n, kind: 'bonus', origin: e.item.id }]
    }
    for (const e of active.filter((x) => x.op === 'min' || x.op === 'max')) {
      const n = amount(e)
      if (e.op === 'min' ? v >= n : v <= n) continue
      t = [...t, { label: e.label, value: n - v, kind: 'bonus', origin: e.item.id }]
      v = n
    }
    return { value: v, terms: t }
  }

  const scope: Record<string, Node> = {}

  /** Los nodos de unos campos con sus valores guardados; los calculados, al pedirlos */
  function nodesOf(
    fields: Record<string, Field | SimpleField>,
    data: Record<string, unknown>,
    prefix: string,
    path: string[],
    item = false,
    /** Los campos del documento (el personaje o el objeto): con ellos se calcula, también dentro de un grupo */
    root?: () => Record<string, Node>,
    este?: { label: string; fields: () => Record<string, Node> }
  ): { kind: 'object'; fields: Record<string, Node> } {
    const out: Record<string, Node> = {}
    const top = root ?? (item ? () => out : () => scope)
    const local = () =>
      este
        ? { ...top(), este: { kind: 'object' as const, label: este.label, fields: { ...este.fields(), ...out } } }
        : top()
    for (const [key, field] of Object.entries(fields)) {
      const id = `${prefix}${key}`
      const here = [...path, key]
      out[key] = nodeOf(field, data[key], id, here, local, item, top)
    }
    return { kind: 'object', fields: out }
  }

  function nodeOf(
    field: Field | SimpleField,
    raw: unknown,
    id: string,
    path: string[],
    local: () => Record<string, Node>,
    item: boolean,
    root: () => Record<string, Node>
  ): Node {
    const name = label(field.label)
    switch (field.kind) {
      case 'derived':
        return computedNode(id, name, field.formula, local, item)
      case 'number': {
        const value = stored(field, raw, path)
        // Un número con bonos (un +1 a Vigor) se calcula: lo guardado más los bonos
        if (!item && effects.has(id)) return withBonuses(id, name, value as number)
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
          ...nodesOf(field.fields, (raw ?? {}) as Record<string, unknown>, `${id}.`, path, item, root),
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
          const node = nodesOf(field.fields, values, `${id}.${element.key}.`, [...path, element.key], item, root, {
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
            const node = nodesOf(field.columns, row, `${id}.${rowId}.`, [...path, String(i)], item, root, {
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
      case 'list': {
        const value = stored(field, raw, path) as Value[]
        if (item || !effects.has(id)) return { kind: 'value', value, label: name }
        // Lo que añaden los efectos (una resistencia, un idioma), sin repetir
        return {
          kind: 'computed',
          id,
          label: name,
          get: () => {
            const extra: Value[] = []
            for (const e of (effects.get(id) ?? []).filter((x) => x.op === 'append'))
              try {
                if (e.value && holds(e)) extra.push(evaluateExpr(e.value, effectScope(e), runtime))
              } catch (error) {
                // Un efecto que falla no se lleva la lista: se dice y se sigue
                if (!(error instanceof Stop) && !(error instanceof FormulaError)) throw error
                if (error instanceof Stop) left = 0
                const why = error instanceof Stop ? 'tarda demasiado' : error.message
                problems.push({ path: id, message: `Lo que añade «${e.item.name}» no se pudo calcular: ${why}` })
              }
            return [...value, ...extra.filter((v) => !value.includes(v))]
          }
        }
      }
      default:
        return { kind: 'value', value: stored(field, raw, path), label: name }
    }
  }

  function withBonuses(id: string, name: string, base: number): Node {
    let done: Value | undefined
    let busy = false
    return {
      kind: 'computed',
      id,
      label: name,
      get: () => {
        if (done !== undefined) return done
        if (busy) throw new FormulaError(`«${name}» depende de su propio valor`, 0, 0)
        busy = true
        try {
          const applied = applyEffects(id, base, [{ label: name, value: base, kind: 'field' }])
          done = finish(id, applied.value, applied.terms)
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
            const terms: Term[] = additive(expr).map(({ expr: part, sign }) => {
              const { label: termName, kind } = termLabel(part, names, formula)
              return { label: termName, value: sign * toNumber(evaluateExpr(part, names, runtime)), kind }
            })
            const applied = applyEffects(id, value, terms)
            result = finish(id, applied.value, applied.terms)
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
      default: {
        if (typeof raw !== 'string') return fallback
        // Un texto o unos dados guardados, con su tope (el de su campo o el del formato)
        const max = field.kind === 'text' ? (field.max ?? 20000) : 300
        if (raw.length > max) flag(`Como mucho, ${max} caracteres`)
        return raw.length > max ? raw.slice(0, max) : raw
      }
    }
  }

  const fieldNodes = nodesOf(type.fields, doc.data, '', []).fields
  Object.assign(scope, fieldNodes)
  // @ajustes, después de los campos: empezar el ámbito con él lo hace el doble de lento
  if (!Object.hasOwn(scope, 'ajustes')) scope.ajustes = ajustes
  // Todo, ya calculado (y cada valor calculado en `computed`), con su propio presupuesto para copiarlo
  let copying = BUDGET
  const copy: Runtime = {
    spend() {
      if (--copying < 0) throw new Stop()
    }
  }
  const values = Object.fromEntries(
    Object.entries(fieldNodes).map(([k, n]) => {
      try {
        return [k, materialize(n, copy)]
      } catch {
        return [k, null]
      }
    })
  ) as Record<string, Value>
  // La ventaja y la desventaja, por tirada, de los efectos que se cumplen
  const advantages: Evaluated['advantages'] = {}
  for (const e of pending) {
    try {
      if (!holds(e)) continue
    } catch {
      continue
    }
    const list = advantages[e.target as string] ?? []
    list.push({ mode: e.op as 'advantage' | 'disadvantage', label: e.label, origin: e.item.id })
    advantages[e.target as string] = list
  }
  // Los recursos, con su máximo calculado con los nombres de quien los lleva
  const resources: Resource[] = []
  const owners: [DocumentItem | null, Mechanics | undefined, Record<string, number> | undefined][] = [
    [null, doc.mechanics, doc.uses],
    ...items.map((it): [DocumentItem, Mechanics | undefined, Record<string, number> | undefined] => [
      it,
      it.mechanics,
      it.uses
    ])
  ]
  for (const [item, mechanics, uses] of owners)
    for (const r of mechanics?.resources ?? []) {
      const spent = own(uses ?? {}, r.key)
      const used = typeof spent === 'number' && Number.isFinite(spent) ? Math.max(0, spent) : 0
      const entry: Resource = { item: item?.id ?? null, key: r.key, label: label(r.label), max: 0, used, left: 0 }
      if (r.recovery) entry.recovery = r.recovery
      if (r.amount) entry.amount = r.amount
      try {
        const names = item
          ? ownerScope(item)
          : { ...scope, este: { kind: 'object', label: '', fields: scope } as Node, ajustes }
        entry.max = Math.max(0, toNumber(evaluateExpr(exprOf(system, r.max), names, runtime)))
        entry.left = Math.max(0, entry.max - used)
      } catch (error) {
        if (!(error instanceof Stop) && !(error instanceof FormulaError)) throw error
        if (error instanceof Stop) left = 0
        entry.error = error instanceof Stop ? 'La fórmula tarda demasiado' : error.message
      }
      resources.push(entry)
    }
  return { values, computed, problems, advantages, resources }
}

/** Un efecto que se aplica: de qué objeto sale, qué hace y con qué fórmulas ya leídas */
interface Effect {
  op: (typeof EFFECT_OPS)[number]
  item: DocumentItem
  label: string
  /** Los bonos de siempre (del tipo): sus fórmulas, con los campos del objeto */
  legacy: boolean
  value?: Expr
  when?: Expr
  target?: string
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
