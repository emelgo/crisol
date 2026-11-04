/**
 * Tirar una fórmula: cada dado con su valor, el total y el desglose. El azar entra de fuera: en el servidor, el
 * criptográfico; en las pruebas, una secuencia fija. La web nunca tira: el resultado lo decide el servidor
 */
import {
  type DiceNode,
  DiceSyntaxError,
  type DiceTerm,
  formatDice,
  meets,
  needsParentheses,
  parseDice,
  splitComment
} from './notation.ts'

/** Un entero al azar entre 1 y las caras */
export type DieRoller = (sides: number) => number

/** El azar criptográfico, sin sesgo (con rechazo) */
export const cryptoRoller: DieRoller = (sides) => {
  const limit = Math.floor(0x1_0000_0000 / sides) * sides
  const buffer = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buffer)
    const value = buffer[0] ?? 0
    if (value < limit) return (value % sides) + 1
  }
}

export interface DieResult {
  value: number
  /** false si se descartó (kh, kl, dh, dl) o se repitió (r) */
  kept: boolean
  /** Un dado de más, por explotar */
  exploded: boolean
  /** Un dado de más que resta (la cara baja de `!-1`) */
  subtract?: boolean
  /** Contando éxitos: 1 si es un éxito, -1 si es un fallo */
  success?: 1 | -1
  /** En una explosión acumulada (!!), lo que salió primero: decide el crítico */
  natural?: number
}

export interface TermResult {
  notation: string
  sides: number | 'F'
  dice: DieResult[]
  total: number
  label?: string
  /** Si cuenta éxitos en vez de sumar */
  counts?: boolean
}

export interface RollResult {
  /** La fórmula, escrita como la escribe formatDice */
  formula: string
  total: number
  terms: TermResult[]
  /** «1d20+5 → [14] + 5 = 19» */
  detail: string
  /** El comentario de la fórmula («# Espada larga») */
  comment?: string
  /** El 20 natural del d20 es crítico (high) y el 1, pifia (low): la regla de 5e, hasta que el sistema ponga la suya */
  critical: 'high' | 'low' | null
}

const MAX_EXPLOSIONS = 100
const MAX_REROLLS = 100
/** Como mucho, tantos dados por tirada contando los que se repiten y los que explotan: una fórmula no pesa más */
export const MAX_RESULTS = 500

/** Lo que queda de los dados de una tirada: cada uno que se tira lo gasta */
type Budget = { left: number }
const spend = (budget: Budget) => {
  if (--budget.left < 0)
    throw new DiceSyntaxError(
      `Como mucho, ${MAX_RESULTS} dados por tirada, contando los que se repiten y los que explotan`
    )
}

function rollTerm(term: DiceTerm, roll: DieRoller, budget: Budget): TermResult {
  const one = () => {
    spend(budget)
    return term.sides === 'F' ? roll(3) - 2 : roll(term.sides)
  }
  const explodes = (value: number): boolean =>
    term.explode && term.sides !== 'F' && (term.explodeOn ? meets(value, term.explodeOn) : value === term.sides)
  const dice: DieResult[] = []
  for (let i = 0; i < term.count; i++) {
    let value = one()
    // Repetir: una vez (ro) o hasta que no cumpla (r)
    for (
      let times = 0;
      term.reroll && meets(value, term.reroll) && times < (term.reroll.once ? 1 : MAX_REROLLS);
      times++
    ) {
      dice.push({ value, kept: false, exploded: false })
      value = one()
    }
    if (term.compound) {
      const natural = value
      let total = value
      for (let explosions = 0; explodes(value) && explosions < MAX_EXPLOSIONS; explosions++) {
        value = one()
        total += value
      }
      dice.push({ value: total, kept: true, exploded: false, ...(total !== natural ? { natural } : {}) })
      continue
    }
    const first = value
    dice.push({ value, kept: true, exploded: false })
    for (let explosions = 0; explodes(value) && explosions < (term.explodeOnce ? 1 : MAX_EXPLOSIONS); explosions++) {
      value = one()
      dice.push({ value, kept: true, exploded: true })
    }
    // La cara baja vuelve a tirar y el dado nuevo resta (solo el primero de cada dado)
    if (term.implodeOn && term.sides !== 'F' && meets(first, term.implodeOn)) {
      dice.push({ value: one(), kept: true, exploded: true, subtract: true })
    }
  }
  if (term.keep) {
    const live = dice.filter((d) => d.kept)
    const sorted = [...live].sort((a, b) => a.value - b.value)
    const n = Math.min(term.keep.n, live.length)
    const drop =
      term.keep.mode === 'kh'
        ? sorted.slice(0, live.length - n)
        : term.keep.mode === 'kl'
          ? sorted.slice(n)
          : term.keep.mode === 'dh'
            ? sorted.slice(live.length - n)
            : sorted.slice(0, n)
    for (const d of drop) d.kept = false
  }
  const kept = dice.filter((d) => d.kept)
  const counts = term.success !== null || term.failure !== null
  if (counts) {
    for (const d of kept) {
      if (term.success && meets(d.value, term.success)) d.success = 1
      else if (term.failure && meets(d.value, term.failure)) d.success = -1
    }
  }
  const total = counts
    ? kept.reduce((sum, d) => sum + (d.success ?? 0), 0)
    : kept.reduce((sum, d) => sum + (d.subtract ? -d.value : d.value), 0)
  return {
    notation: formatDice(term),
    sides: term.sides,
    dice,
    total,
    ...(term.label ? { label: term.label } : {}),
    ...(counts ? { counts: true } : {})
  }
}

function evaluate(
  node: DiceNode,
  roll: DieRoller,
  terms: TermResult[],
  budget: Budget
): { value: number; text: string } {
  switch (node.kind) {
    case 'number':
      return { value: node.value, text: `${node.value}${node.label ? ` (${node.label})` : ''}` }
    case 'negate': {
      const inner = evaluate(node.value, roll, terms, budget)
      return { value: -inner.value, text: node.value.kind === 'binary' ? `-(${inner.text})` : `-${inner.text}` }
    }
    case 'dice': {
      const result = rollTerm(node, roll, budget)
      terms.push(result)
      const shown = result.dice
        .map((d) => {
          const value = d.subtract ? `-${d.value}` : String(d.value)
          return d.kept ? value : `(${value})`
        })
        .join(', ')
      const successes = result.counts ? ` (${result.total} ${Math.abs(result.total) === 1 ? 'éxito' : 'éxitos'})` : ''
      return { value: result.total, text: `[${shown}]${successes}${result.label ? ` (${result.label})` : ''}` }
    }
    case 'binary': {
      const left = evaluate(node.left, roll, terms, budget)
      const right = evaluate(node.right, roll, terms, budget)
      const value =
        node.op === '+'
          ? left.value + right.value
          : node.op === '-'
            ? left.value - right.value
            : node.op === '*'
              ? left.value * right.value
              : Math.floor(left.value / (right.value || 1))
      // Los mismos paréntesis que la fórmula: ([3] + 2) × 2
      const side = (child: DiceNode, text: string, right: boolean) =>
        needsParentheses(node, child, right) ? `(${text})` : text
      return {
        value,
        text: `${side(node.left, left.text, false)} ${node.op === '*' ? '×' : node.op} ${side(node.right, right.text, true)}`
      }
    }
  }
}

/**
 * Cuándo una tirada es crítica, según el juego (ADR-0010 lo dejó para cada sistema):
 * - none: nunca;
 * - d20: el 20 natural de un d20 que cuenta es crítico y el 1, pifia (la regla de 5e);
 * - doubles: los dados que cuentan, todos iguales (dos o más) es crítico;
 * - under: se tira por debajo, así que el 1 natural es crítico y la cara más alta, pifia
 */
export type CriticalRule = 'none' | 'd20' | 'doubles' | 'under'

/** Los dados que cuentan para el crítico: los que se quedan, sin los de más por explotar */
const counted = (terms: readonly TermResult[], sides?: number) =>
  terms
    .filter((t) => typeof t.sides === 'number' && (sides === undefined || t.sides === sides))
    .flatMap((t) =>
      t.dice
        .filter((d) => d.kept && !d.exploded)
        .map((d) => ({ value: d.natural ?? d.value, sides: t.sides as number }))
    )

export function criticalOf(terms: readonly TermResult[], rule: CriticalRule = 'd20'): RollResult['critical'] {
  switch (rule) {
    case 'none':
      return null
    case 'd20': {
      const d20 = counted(terms, 20).map((d) => d.value)
      if (d20.some((v) => v === 20)) return 'high'
      if (d20.some((v) => v === 1)) return 'low'
      return null
    }
    case 'doubles': {
      const dice = counted(terms)
      return dice.length >= 2 && dice.every((d) => d.value === dice[0]?.value) ? 'high' : null
    }
    case 'under': {
      const dice = counted(terms)
      if (dice.some((d) => d.value === 1)) return 'high'
      if (dice.some((d) => d.value === d.sides)) return 'low'
      return null
    }
  }
}

/** Tira un árbol ya leído (el de una tirada de un sistema, ya armada) */
export function rollTree(
  tree: DiceNode,
  roll: DieRoller = cryptoRoller,
  { critical = 'd20', comment }: { critical?: CriticalRule; comment?: string | null } = {}
): RollResult {
  const terms: TermResult[] = []
  const { value, text } = evaluate(tree, roll, terms, { left: MAX_RESULTS })
  return {
    formula: formatDice(tree),
    total: value,
    terms,
    detail: `${formatDice(tree)} → ${text} = ${value}`,
    ...(comment ? { comment } : {}),
    critical: criticalOf(terms, critical)
  }
}

/** Tira una fórmula; lanza DiceSyntaxError si no se entiende */
export function rollDice(
  formula: string,
  roll: DieRoller = cryptoRoller,
  options: { critical?: CriticalRule } = {}
): RollResult {
  const { comment } = splitComment(formula)
  return rollTree(parseDice(formula), roll, { ...options, comment })
}
