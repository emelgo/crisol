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
import { evaluate, evaluateExpr, type SystemDocument } from './evaluate.ts'
import type { Field, Roll, System, TONES } from './format.ts'
import type { Value } from './formulas/functions.ts'
import { type Expr, FormulaError, parseFormula } from './formulas/parse.ts'
import { type Language, textOf } from './text.ts'

export interface RollOptions {
  /** Por qué se tira: la clave del campo (`vigor`) o del elemento del conjunto (`des`) */
  element?: string
  /** El modo: su clave (`ventaja`) */
  mode?: string
  /** La dificultad o la CA, si la hay */
  target?: number | null
  roller?: DieRoller
  language?: Language
}

export interface SystemRoll extends RollResult {
  /** «Atributo · Vigor» */
  label: string
  band: { label: string; tone: (typeof TONES)[number] } | null
  /** Si el modo pedido cambió algo (sin el dado que cambia, no) */
  modeApplied: boolean
}

export class RollError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RollError'
  }
}

type Node = { kind: 'value'; value: Value; label?: string }
const node = (value: Value, label?: string): Node =>
  label === undefined ? { kind: 'value', value } : { kind: 'value', value, label }
const NO_RUNTIME = { spend() {} }

const formula = (text: string) => {
  try {
    return parseFormula(text)
  } catch (error) {
    if (error instanceof FormulaError) throw new RollError(error.message)
    throw error
  }
}

/** Las tiradas que tiene un tipo, cada una con sus elementos, para elegirlas en la hoja o en «Probar» */
export function rollsOf(system: System, typeKey: string, language: Language = 'es') {
  const type = system.types[typeKey]
  if (!type) return []
  return Object.entries(system.rolls ?? {})
    .filter(([, roll]) => {
      if (!roll.for) return type.document === 'actor'
      return 'fields' in roll.for
        ? roll.for.fields.every((f) => type.fields[f])
        : type.fields[roll.for.set]?.kind === 'set'
    })
    .map(([key, roll]) => ({
      key,
      label: textOf(roll.label, language),
      formula: roll.formula,
      elements: elementsOf(type.fields, roll, language),
      modes: (roll.modes ?? []).map((m) => ({ key: m.key, label: textOf(m.label, language) })),
      target: roll.target ?? 'none'
    }))
}

function elementsOf(fields: Record<string, Field>, roll: Roll, language: Language) {
  if (!roll.for) return []
  if ('fields' in roll.for)
    return roll.for.fields.map((key) => ({ key, label: textOf(fields[key]?.label, language) || key }))
  const set = fields[roll.for.set]
  return set?.kind === 'set' ? set.elements.map((e) => ({ key: e.key, label: textOf(e.label, language) })) : []
}

/** El nombre de lo que nombra una referencia: el del elemento de un conjunto (Destreza) o el del campo */
function labelOf(
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

const sameDice = (a: DiceTerm, b: DiceTerm) =>
  a.count === b.count &&
  a.sides === b.sides &&
  JSON.stringify(a.keep) === JSON.stringify(b.keep) &&
  a.explode === b.explode &&
  JSON.stringify(a.reroll) === JSON.stringify(b.reroll) &&
  JSON.stringify(a.success) === JSON.stringify(b.success)

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

/** Arma una tirada: su fórmula (o la de su variante) con los valores puestos, y el modo aplicado. Sin tirarla */
export function prepareRoll(
  system: System,
  typeKey: string,
  doc: SystemDocument,
  rollKey: string,
  options: RollOptions = {}
) {
  const language = options.language ?? 'es'
  const roll = system.rolls?.[rollKey]
  const type = system.types[typeKey]
  if (!roll || !type) throw new RollError(`No existe la tirada «${rollKey}»`)
  const { values } = evaluate(system, typeKey, doc, { language })
  const scope: Record<string, Node> = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, node(v)]))

  // @este: el campo o el elemento por el que se tira
  let esteLabel: string | undefined
  if (roll.for) {
    const elements = elementsOf(type.fields, roll, language)
    const element = elements.find((e) => e.key === options.element)
    if (!element) throw new RollError(`Elige por qué se tira: ${elements.map((e) => e.label).join(', ')}`)
    esteLabel = element.label
    const value =
      'fields' in roll.for ? values[element.key] : (values[roll.for.set] as Record<string, Value> | null)?.[element.key]
    scope.este = node(value ?? null)
  }
  const evaluateTo = (e: Expr): Value => {
    try {
      return evaluateExpr(e, scope as never, NO_RUNTIME)
    } catch (error) {
      if (error instanceof FormulaError) throw new RollError(error.message)
      throw error
    }
  }

  // La variante que se cumpla manda
  const variant = roll.variants?.find((v) => evaluateTo(formula(v.if)) === true)
  const text = variant?.formula ?? roll.formula

  const hasDice = (e: Expr): boolean => {
    switch (e.kind) {
      case 'dice':
        return true
      case 'ref': {
        const v = evaluateTo(e)
        return typeof v === 'string' && /\d*d(\d|%|f)/i.test(v)
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
    const label = e.kind === 'ref' ? labelOf(type.fields, e.path, esteLabel, language) : undefined
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
    }
    throw new RollError('Los dados solo se suman, se restan, se multiplican o se dividen')
  }
  let tree = arm(formula(text))

  let modeApplied = false
  if (options.mode) {
    const mode = roll.modes?.find((m) => m.key === options.mode)
    if (!mode) throw new RollError(`No existe el modo «${options.mode}»`)
    const from = parseDice(mode.from)
    if (from.kind !== 'dice') throw new RollError('Un modo cambia unos dados por otros')
    const changed = replace(tree, from, parseDice(mode.to))
    tree = changed.tree
    modeApplied = changed.changed
  }
  const label = [textOf(roll.label, language), esteLabel].filter(Boolean).join(' · ')
  return { tree, label, roll, scope, modeApplied, critical: (system.dice?.critical ?? 'd20') as CriticalRule }
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
    modeApplied: prepared.modeApplied
  }
}
