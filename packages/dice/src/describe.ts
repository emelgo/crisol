/**
 * Una fórmula dicha en español, para quien no lee notación: `2d20kh1` → «Ventaja (2d20, se queda el mayor)»,
 * `4d6kh3` → «4d6, se quedan los 3 mayores», `5d10>=8f1` → «5d10, éxitos con 8 o más, fallos con 1». Pura: la web la
 * enseña mientras se escribe
 */
import { type Condition, type DiceNode, type DiceTerm, parseDice } from './notation.ts'

/** El signo menos tipográfico: el guion corto se confunde con un guion */
const MINUS = '−'

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)

function keepText(keep: NonNullable<DiceTerm['keep']>): string {
  const { mode, n } = keep
  switch (mode) {
    case 'kh':
      return plural(n, 'se queda el mayor', `se quedan los ${n} mayores`)
    case 'kl':
      return plural(n, 'se queda el menor', `se quedan los ${n} menores`)
    case 'dh':
      return plural(n, 'se descarta el mayor', `se descartan los ${n} mayores`)
    case 'dl':
      return plural(n, 'se descarta el menor', `se descartan los ${n} menores`)
  }
}

function conditionText(c: Condition): string {
  switch (c.op) {
    case '<':
      return `con menos de ${c.value}`
    case '>':
      return `con más de ${c.value}`
    case '<=':
      return `con ${c.value} o menos`
    case '>=':
      return `con ${c.value} o más`
    case '=':
      return `con ${c.value}`
  }
}

function rerollText(reroll: NonNullable<DiceTerm['reroll']>): string {
  const once = reroll.once ? ' una vez' : ''
  if (reroll.op === '<') return `se repiten${once} los menores de ${reroll.value}`
  if (reroll.op === '>') return `se repiten${once} los mayores de ${reroll.value}`
  if (reroll.op === '<=') return `se repiten${once} los de ${reroll.value} o menos`
  if (reroll.op === '>=') return `se repiten${once} los de ${reroll.value} o más`
  return `se repiten${once} los ${reroll.value}`
}

/** La ventaja o la desventaja de 5e: dos d20 y se queda uno (o se descarta uno, que es lo mismo) */
function advantageOf(term: DiceTerm): 'advantage' | 'disadvantage' | null {
  if (term.count !== 2 || term.sides !== 20 || !term.keep || term.keep.n !== 1) return null
  return term.keep.mode === 'kh' || term.keep.mode === 'dl' ? 'advantage' : 'disadvantage'
}

interface Said {
  text: string
  /** Lleva comas sin paréntesis: dentro de una suma hay que rodearlo para que se lea bien */
  loose: boolean
}

function sayDice(term: DiceTerm): Said {
  let head = `${term.count}d${term.sides}`
  if (term.explode) {
    head += term.compound
      ? plural(term.count, ' explosivo acumulado', ' explosivos acumulados')
      : plural(term.count, ' explosivo', ' explosivos')
  }
  if (term.explode && term.explodeOn) head += ` ${conditionText(term.explodeOn)}`
  if (term.sides === 'F') head += ' (Fate)'
  if (term.label) head += ` (${term.label})`
  const advantage = advantageOf(term)
  if (advantage) {
    const parts = [head, advantage === 'advantage' ? 'se queda el mayor' : 'se queda el menor']
    if (term.reroll) parts.push(rerollText(term.reroll))
    return { text: `${advantage === 'advantage' ? 'Ventaja' : 'Desventaja'} (${parts.join(', ')})`, loose: false }
  }
  const parts = [head]
  if (term.keep) parts.push(keepText(term.keep))
  if (term.reroll) parts.push(rerollText(term.reroll))
  if (term.success) parts.push(`éxitos ${conditionText(term.success)}`)
  if (term.failure) parts.push(`fallos ${conditionText(term.failure)}`)
  return { text: parts.join(', '), loose: parts.length > 1 }
}

const isSum = (node: DiceNode): boolean => node.kind === 'binary' && (node.op === '+' || node.op === '-')

function say(node: DiceNode, root: boolean): Said {
  switch (node.kind) {
    case 'number':
      return { text: node.label ? `${node.value} (${node.label})` : String(node.value), loose: false }
    case 'dice': {
      const said = sayDice(node)
      // Sola se lee bien; dentro de una cuenta, entre paréntesis
      return said.loose && !root ? { text: `(${said.text})`, loose: false } : said
    }
    case 'negate': {
      const inner = say(node.value, false)
      return { text: `${MINUS}${node.value.kind === 'binary' ? `(${inner.text})` : inner.text}`, loose: false }
    }
    case 'binary': {
      // «1d20+0» se lee «1d20»
      if ((node.op === '+' || node.op === '-') && node.right.kind === 'number' && node.right.value === 0) {
        return say(node.left, root)
      }
      const strong = node.op === '*' || node.op === '/'
      const side = (child: DiceNode, right: boolean): string => {
        const text = say(child, false).text
        const wrap =
          (strong && isSum(child)) ||
          (right && node.op === '-' && isSum(child)) ||
          (right && strong && child.kind === 'binary')
        return wrap ? `(${text})` : text
      }
      const sign = node.op === '+' ? '+' : node.op === '-' ? MINUS : node.op === '*' ? '×' : '÷'
      return { text: `${side(node.left, false)} ${sign} ${side(node.right, true)}`, loose: false }
    }
  }
}

/** Una fórmula dicha en español; si no se entiende, tal cual (nunca lanza) */
export function describeFormula(formula: string): string {
  try {
    return say(parseDice(formula), true).text
  } catch {
    return formula.trim()
  }
}
