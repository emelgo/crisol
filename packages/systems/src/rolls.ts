/**
 * Las tiradas de un sistema: se arman sobre la fórmula ya leída (los valores del documento entran como números con su
 * nombre; los dados se quedan como dados), se les aplica el modo (la ventaja cambia dados por dados en el árbol, no en
 * el texto: `1d20` dentro de `11d20` no se toca), se tiran con `@crisol/dice` y la regla de críticos del sistema, y se
 * elige su franja de resultado
 */
import {
  type CriticalRule,
  type DiceNode,
  type DiceTerm,
  type DieRoller,
  parseDice,
  type RollResult,
  rollTree
} from '@crisol/dice'
import { type DocumentItem, evaluate, evaluateExpr, type SystemDocument, settingsOf } from './evaluate.ts'
import type { Field, Roll, System, TONES } from './format.ts'
import type { Value } from './formulas/functions.ts'
import { type Expr, FormulaError, parseFormula } from './formulas/parse.ts'
import { own } from './own.ts'
import { type Language, textOf } from './text.ts'

export interface RollOptions {
  /** Por qué se tira: la clave del campo (`vigor`) o del elemento del conjunto (`des`) */
  element?: string
  /** El modo: su clave (`ventaja`); sin él, el que pongan los efectos (la Furia: ventaja); '', ninguno */
  mode?: string
  /** La dificultad o la CA, si la hay */
  target?: number | null
  roller?: DieRoller
  language?: Language
  /** Los ajustes de la campaña (`@ajustes`); sin ellos, sus valores iniciales */
  settings?: Record<string, unknown>
}

export interface SystemRoll extends RollResult {
  /** «Atributo · Vigor» */
  label: string
  band: { label: string; tone: (typeof TONES)[number] } | null
  /** Si el modo pedido cambió algo (sin el dado que cambia, no) */
  modeApplied: boolean
  /** El modo que se aplicó (su clave) y, si lo pusieron los efectos, por qué */
  mode: string | null
  because: { mode: 'advantage' | 'disadvantage'; label: string; origin: string }[]
}

export class RollError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RollError'
  }
}

export type Node = { kind: 'value'; value: Value; label?: string }
export const node = (value: Value, label?: string): Node =>
  label === undefined ? { kind: 'value', value } : { kind: 'value', value, label }
const NO_RUNTIME = { spend() {} }

export const formula = (text: string) => {
  try {
    return parseFormula(text)
  } catch (error) {
    if (error instanceof FormulaError) throw new RollError(error.message)
    throw error
  }
}

/** Las tiradas que tiene un tipo, cada una con sus elementos, para elegirlas en la hoja o en «Probar» */
export function rollsOf(system: System, typeKey: string, language: Language = 'es', doc?: SystemDocument) {
  const type = own(system.types, typeKey)
  if (!type) return []
  return Object.entries(system.rolls ?? {})
    .filter(([, roll]) => {
      if (!roll.for) return type.document === 'actor'
      if ('items' in roll.for) {
        const kinds = roll.for.items
        return Object.values(type.fields).some((f) => f.kind === 'items' && f.of.some((o) => kinds.includes(o)))
      }
      return 'fields' in roll.for
        ? roll.for.fields.every((f) => type.fields[f])
        : type.fields[roll.for.set]?.kind === 'set'
    })
    .map(([key, roll]) => ({
      key,
      label: textOf(roll.label, language),
      formula: roll.formula,
      // Por objetos: los que lleva de esos tipos (sin el documento, ninguno)
      elements: elementsOf(type.fields, roll, language, doc),
      modes: (roll.modes ?? []).map((m) => ({ key: m.key, label: textOf(m.label, language) })),
      target: roll.target ?? 'none'
    }))
}

function elementsOf(fields: Record<string, Field>, roll: Roll, language: Language, doc?: SystemDocument) {
  if (!roll.for) return []
  if ('items' in roll.for) {
    const kinds = roll.for.items
    return (doc?.items ?? []).filter((it) => kinds.includes(it.type)).map((it) => ({ key: it.id, label: it.name }))
  }
  if ('fields' in roll.for)
    return roll.for.fields.map((key) => ({ key, label: textOf(fields[key]?.label, language) || key }))
  const set = fields[roll.for.set]
  return set?.kind === 'set' ? set.elements.map((e) => ({ key: e.key, label: textOf(e.label, language) })) : []
}

/** El nombre de lo que nombra una referencia: el del elemento de un conjunto (Destreza) o el del campo */
export function labelOf(
  fields: Record<string, Field>,
  path: (string | Expr)[],
  este: string | undefined,
  language: Language
): string | undefined {
  const [first, ...rest] = path
  if (first === 'este') return este
  if (typeof first !== 'string') return undefined
  const field = fields[first]
  if (!field) return undefined
  const next = rest[0]
  if (field.kind === 'set' && typeof next === 'string') {
    const element = field.elements.find((e) => e.key === next)
    if (element) return textOf(element.label, language)
  }
  return textOf(field.label, language)
}

/** Los mismos dados, con todo lo que les cambia la tirada (lo que se queda, explota, se repite, cuenta…); sin el nombre */
const sameDice = (a: DiceTerm, b: DiceTerm) => {
  const { label: _a, ...left } = a
  const { label: _b, ...right } = b
  return JSON.stringify(left) === JSON.stringify(right)
}

/** Cambia en el árbol los dados `from` por `to` (los dados, no el texto) */
function replace(tree: DiceNode, from: DiceTerm, to: DiceNode): { tree: DiceNode; changed: boolean } {
  switch (tree.kind) {
    case 'number':
      return { tree, changed: false }
    case 'negate': {
      const inner = replace(tree.value, from, to)
      return { tree: { ...tree, value: inner.tree }, changed: inner.changed }
    }
    case 'binary': {
      const left = replace(tree.left, from, to)
      const right = replace(tree.right, from, to)
      return { tree: { ...tree, left: left.tree, right: right.tree }, changed: left.changed || right.changed }
    }
    case 'dice':
      if (!sameDice(tree, from)) return { tree, changed: false }
      return {
        tree: structuredClone(to.kind === 'dice' && tree.label ? { ...to, label: tree.label } : to),
        changed: true
      }
  }
}

/** El valor de una fórmula sin dados con estos nombres; su error, como error de la tirada */
export function valueIn(scope: Record<string, Node>, e: Expr): Value {
  try {
    return evaluateExpr(e, scope as never, NO_RUNTIME)
  } catch (error) {
    if (error instanceof FormulaError) throw new RollError(error.message)
    throw error
  }
}

const truthyValue = (v: Value) =>
  v !== null && v !== false && v !== 0 && v !== '' && !(Array.isArray(v) && v.length === 0)

/**
 * Arma una fórmula con dados: los valores entran como números con su nombre (`labelFor`) y los dados se quedan como
 * dados (también los de un campo de dados, como el dado de golpe). Sin tirarla
 */
export function armFormula(
  text: string,
  scope: Record<string, Node>,
  labelFor: (path: (string | Expr)[]) => string | undefined
): DiceNode {
  const evaluateTo = (e: Expr) => valueIn(scope, e)
  const hasDice = (e: Expr): boolean => {
    switch (e.kind) {
      case 'dice':
        return true
      case 'ref': {
        const v = evaluateTo(e)
        // Lineal (sin «\d*» delante, que con muchas cifras seguidas iba cuadrático) y con un tope de largo
        return typeof v === 'string' && v.length <= 300 && /d[\d%f]/i.test(v)
      }
      case 'unary':
        return hasDice(e.value)
      case 'binary':
        return hasDice(e.left) || hasDice(e.right)
      case 'conditional':
        return hasDice(e.test) || hasDice(e.yes) || hasDice(e.no)
      case 'call':
        return e.args.some(hasDice)
      default:
        return false
    }
  }
  const number = (e: Expr): DiceNode => {
    const v = evaluateTo(e)
    const value =
      typeof v === 'number'
        ? v
        : typeof v === 'object' && v !== null && !Array.isArray(v) && typeof v.value === 'number'
          ? v.value
          : null
    if (value === null) throw new RollError(`«${text.slice(e.start, e.end).trim()}» no es un número`)
    const label = e.kind === 'ref' ? labelFor(e.path) : undefined
    return label ? { kind: 'number', value, label } : { kind: 'number', value }
  }
  const arm = (e: Expr): DiceNode => {
    if (!hasDice(e)) return number(e)
    switch (e.kind) {
      case 'dice':
        return e.term
      case 'ref': {
        // Un campo de dados (el dado de golpe): sus dados entran en la tirada
        try {
          return parseDice(String(evaluateTo(e)))
        } catch {
          throw new RollError(`«${text.slice(e.start, e.end).trim()}» no son dados`)
        }
      }
      case 'unary':
        if (e.op === '-') return { kind: 'negate', value: arm(e.value) }
        break
      case 'binary':
        if (e.op === '+' || e.op === '-' || e.op === '*' || e.op === '/')
          return { kind: 'binary', op: e.op, left: arm(e.left), right: arm(e.right) }
        break
      case 'conditional':
        // La condición va sin dados: elige la rama, y se tira la elegida (@nivel >= 5 ? 2d6 : 1d6)
        return arm(truthyValue(evaluateTo(e.test)) ? e.yes : e.no)
    }
    throw new RollError('Los dados solo se suman, se restan, se multiplican o se dividen')
  }
  return arm(formula(text))
}

/** Aplica un modo (la ventaja) a una tirada ya armada: cambia sus dados `from` por `to` */
export function applyMode(tree: DiceNode, mode: { from: string; to: string }) {
  const from = parseDice(mode.from)
  if (from.kind !== 'dice') throw new RollError('Un modo cambia unos dados por otros')
  return replace(tree, from, parseDice(mode.to))
}

/** Lo calculado de quien tira y sus nombres (sus valores y @ajustes, los de la campaña) */
function rollContext(system: System, typeKey: string, doc: SystemDocument, options: RollOptions = {}) {
  const language = options.language ?? 'es'
  const evaluated = evaluate(system, typeKey, doc, { language, settings: options.settings ?? {} })
  const scope: Record<string, Node> = Object.fromEntries(Object.entries(evaluated.values).map(([k, v]) => [k, node(v)]))
  scope.ajustes = node(settingsOf(system, options.settings ?? {}))
  return { scope, evaluated }
}

/** Los nombres de quien tira: sus valores ya calculados y @ajustes */
export const rollScope = (system: System, typeKey: string, doc: SystemDocument, options: RollOptions = {}) =>
  rollContext(system, typeKey, doc, options).scope

/** Los valores de un objeto que lleva (sus campos, calculados), con su nombre: lo que es @este */
export function itemValues(system: System, item: DocumentItem, language: Language = 'es'): Value {
  const type = own(system.types, item.type)
  const values = type ? evaluate(system, item.type, { data: item.data }, { language }).values : {}
  return { ...values, name: item.name }
}

/** Arma una tirada: su fórmula (o la de su variante) con los valores puestos, y el modo aplicado. Sin tirarla */
export function prepareRoll(
  system: System,
  typeKey: string,
  doc: SystemDocument,
  rollKey: string,
  options: RollOptions = {}
) {
  const language = options.language ?? 'es'
  const roll = system.rolls ? own(system.rolls, rollKey) : undefined
  const type = own(system.types, typeKey)
  if (!roll || !type) throw new RollError(`No existe la tirada «${rollKey}»`)
  const { scope, evaluated } = rollContext(system, typeKey, doc, options)
  const values = scope as Record<string, { value: Value }>

  // @este: el campo, el elemento o el objeto por el que se tira
  let esteLabel: string | undefined
  if (roll.for) {
    const elements = elementsOf(type.fields, roll, language, doc)
    const element = elements.find((e) => e.key === options.element)
    if ('items' in roll.for) {
      if (elements.length === 0) throw new RollError(`No lleva nada para «${textOf(roll.label, language)}»`)
      if (!element) throw new RollError(`Elige con qué se tira: ${elements.map((e) => e.label).join(', ')}`)
      const item = doc.items?.find((it) => it.id === element.key) as DocumentItem
      scope.este = node(itemValues(system, item, language))
    } else {
      if (!element) throw new RollError(`Elige por qué se tira: ${elements.map((e) => e.label).join(', ')}`)
      const value =
        'fields' in roll.for
          ? values[element.key]?.value
          : (values[roll.for.set]?.value as Record<string, Value> | null)?.[element.key]
      scope.este = node(value ?? null)
    }
    esteLabel = element.label
  }

  // La variante que se cumpla manda
  const variant = roll.variants?.find((v) => valueIn(scope, formula(v.if)) === true)
  const text = variant?.formula ?? roll.formula
  let tree = armFormula(text, scope, (path) => labelOf(type.fields, path, esteLabel, language))

  // El modo pedido o, sin él, el que pongan los efectos: ventaja o desventaja (las dos a la vez se anulan)
  let mode: NonNullable<Roll['modes']>[number] | undefined
  let because: SystemRoll['because'] = []
  if (options.mode) {
    mode = roll.modes?.find((m) => m.key === options.mode)
    if (!mode) throw new RollError(`No existe el modo «${options.mode}»`)
  } else if (options.mode === undefined) {
    const marks = [
      ...(own(evaluated.advantages, rollKey) ?? []),
      ...(options.element ? (own(evaluated.advantages, `${rollKey}.${options.element}`) ?? []) : [])
    ]
    const advantage = marks.some((m) => m.mode === 'advantage')
    const disadvantage = marks.some((m) => m.mode === 'disadvantage')
    if (advantage !== disadvantage) {
      mode = roll.modes?.find((m) => m.gives === (advantage ? 'advantage' : 'disadvantage'))
      if (mode) because = marks
    }
  }
  let modeApplied = false
  if (mode) {
    const changed = applyMode(tree, mode)
    tree = changed.tree
    modeApplied = changed.changed
  }
  const label = [textOf(roll.label, language), esteLabel].filter(Boolean).join(' · ')
  return {
    tree,
    label,
    roll,
    scope,
    modeApplied,
    mode: mode?.key ?? null,
    because,
    critical: (system.dice?.critical ?? 'd20') as CriticalRule
  }
}

/** La franja de una tirada ya hecha: la primera que se cumple con su total, su natural y su objetivo */
export function bandOf(
  prepared: ReturnType<typeof prepareRoll>,
  result: { total: number; natural: number | null },
  target: number | null,
  language: Language = 'es'
): SystemRoll['band'] {
  const scope = {
    ...prepared.scope,
    total: node(result.total),
    natural: node(result.natural),
    objetivo: node(target)
  }
  const band = prepared.roll.bands?.find((b) => {
    try {
      return evaluateExpr(formula(b.if), scope as never, NO_RUNTIME) === true
    } catch {
      return false
    }
  })
  return band ? { label: textOf(band.label, language), tone: band.tone } : null
}

/** Tira una tirada del sistema, sin apuntarla: da la fórmula armada, el resultado, el desglose y su franja */
export function tryRoll(
  system: System,
  typeKey: string,
  doc: SystemDocument,
  rollKey: string,
  options: RollOptions = {}
): SystemRoll {
  const language = options.language ?? 'es'
  const prepared = prepareRoll(system, typeKey, doc, rollKey, options)
  const result = rollTree(prepared.tree, options.roller, { critical: prepared.critical })
  const first = result.terms.find((t) => typeof t.sides === 'number')
  const natural = first?.dice.find((d) => d.kept && !d.exploded)
  const band = bandOf(
    prepared,
    { total: result.total, natural: natural ? (natural.natural ?? natural.value) : null },
    options.target ?? null,
    language
  )
  return {
    ...result,
    label: prepared.label,
    band,
    modeApplied: prepared.modeApplied,
    mode: prepared.mode,
    because: prepared.because
  }
}
