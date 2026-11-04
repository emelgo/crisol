/**
 * La notación de dados de rol: 1d20+5, 4d6kh3, 2d20kl1, d%, 4dF, 1d6!, 1d6!>4, 1d6!o (una vez), 3d6!! (acumulada),
 * 1d20!-1 (el 1 vuelve a tirar y resta), 2d6r1, 2d6ro<3, 5d10>=8f1, 1d20[ataque]+5[fuerza] # Espada larga, (1d8+2)*2.
 * Un intérprete propio, sin eval: texto → árbol. La del Crisol actual, con sus límites
 */

/** Una condición sobre el valor de un dado: =N, <N, >N, <=N, >=N */
export interface Condition {
  op: '=' | '<' | '>' | '<=' | '>='
  value: number
}

export interface DiceTerm {
  kind: 'dice'
  count: number
  /** Las caras; 'F', dados Fate (-1, 0, +1) */
  sides: number | 'F'
  keep: { mode: 'kh' | 'kl' | 'dh' | 'dl'; n: number } | null
  explode: boolean
  /** Cuándo explota (`!>4`); sin condición, con la cara más alta */
  explodeOn: Condition | null
  /** Acumulada (`!!`): lo que sale se suma al mismo dado */
  compound: boolean
  /** Una sola vez (`!o`): el dado nuevo ya no explota */
  explodeOnce?: boolean
  /** La cara baja vuelve a tirar y el dado nuevo resta (`!-1`, `!-<=2`) */
  implodeOn?: Condition | null
  /** Repetir los que cumplan: hasta que no cumplan (r1) o una vez (ro1) */
  reroll: (Condition & { once?: boolean }) | null
  /** Contar éxitos (`>=8`) en vez de sumar */
  success: Condition | null
  /** Fallos que restan éxitos (`f1`, `f<3`) */
  failure: Condition | null
  label?: string
}

export type DiceNode =
  | DiceTerm
  | { kind: 'number'; value: number; label?: string }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/'; left: DiceNode; right: DiceNode }
  | { kind: 'negate'; value: DiceNode }

export class DiceSyntaxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DiceSyntaxError'
  }
}

export const MAX_LENGTH = 200
export const MAX_DICE = 100
export const MAX_SIDES = 1000

/** Aparta el comentario final («# Espada larga») de la fórmula */
export function splitComment(input: string): { formula: string; comment: string | null } {
  const i = input.indexOf('#')
  if (i < 0) return { formula: input, comment: null }
  const comment = input.slice(i + 1).trim()
  return { formula: input.slice(0, i), comment: comment || null }
}

/** Lo que escribe una persona o formatDice: ×, ÷ y el signo menos tipográfico */
const normalize = (text: string) => text.replace(/×/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-')

export function parseDice(input: string): DiceNode {
  const written = normalize(splitComment(input).formula).trim()
  if (!written) throw new DiceSyntaxError('Escribe una tirada, como 1d20+5')
  if (written.length > MAX_LENGTH) throw new DiceSyntaxError(`Como mucho, ${MAX_LENGTH} caracteres`)
  // Las etiquetas aparte, con sus espacios y mayúsculas: «[ataque]» → «{0}»
  const labels: string[] = []
  const text = written
    .replace(/\[([^\]]*)\]/g, (_, label: string) => `{${labels.push(label.trim()) - 1}}`)
    .replace(/\s+/g, '')
    .toLowerCase()
  let pos = 0
  let dice = 0

  const peek = () => text[pos] ?? ''
  const fail = (): never => {
    throw new DiceSyntaxError(
      pos >= text.length
        ? `No se entiende «${written}» al final`
        : `No se entiende «${written}» cerca de «${text.slice(pos)}»`
    )
  }
  const number = (): number | null => {
    const match = /^\d+/.exec(text.slice(pos))
    if (!match) return null
    pos += match[0].length
    return Number(match[0])
  }
  const condition = (required: boolean): Condition | null => {
    const match = (required ? /^(<=|>=|<|>|=)(\d+)/ : /^(<=|>=|<|>|=)?(\d+)/).exec(text.slice(pos))
    if (!match) return null
    pos += match[0].length
    return { op: (match[1] || '=') as Condition['op'], value: Number(match[2]) }
  }
  const label = (): string | undefined => {
    const match = /^\{(\d+)\}/.exec(text.slice(pos))
    if (!match) return undefined
    pos += match[0].length
    return labels[Number(match[1])] || undefined
  }

  const diceTerm = (count: number): DiceTerm => {
    pos++ // la «d»
    let sides: number | 'F'
    if (peek() === '%') {
      pos++
      sides = 100
    } else if (peek() === 'f') {
      pos++
      sides = 'F'
    } else {
      const n = number()
      if (n === null) throw new DiceSyntaxError(`Faltan las caras del dado en «${written}»`)
      if (n < 2) throw new DiceSyntaxError('Un dado tiene al menos 2 caras')
      if (n > MAX_SIDES) throw new DiceSyntaxError('Como mucho, 1.000 caras')
      sides = n
    }
    dice += count
    if (dice > MAX_DICE) throw new DiceSyntaxError(`Como mucho, ${MAX_DICE} dados por tirada`)
    const term: DiceTerm = {
      kind: 'dice',
      count,
      sides,
      keep: null,
      explode: false,
      explodeOn: null,
      compound: false,
      reroll: null,
      success: null,
      failure: null
    }
    for (;;) {
      const rest = text.slice(pos)
      const keep = /^(kh|kl|dh|dl|k)(\d+)?/.exec(rest)
      if (keep) {
        pos += keep[0].length
        const mode = (keep[1] === 'k' ? 'kh' : keep[1]) as 'kh' | 'kl' | 'dh' | 'dl'
        const n = keep[2] ? Number(keep[2]) : 1
        if (n > count) {
          throw new DiceSyntaxError(
            mode === 'kh' || mode === 'kl'
              ? `No se puede quedar con ${n} de ${count} dados`
              : `No se pueden descartar ${n} de ${count} dados`
          )
        }
        term.keep = { mode, n }
        continue
      }
      if (rest.startsWith('!-')) {
        pos += 2
        // `!-1`: la cara 1; `!-<=2`: hasta la 2
        const on = condition(false)
        if (!on) throw new DiceSyntaxError(`Falta la cara que resta tras «!-» en «${written}»`)
        term.implodeOn = on.op === '=' ? { op: '<=', value: on.value } : on
        continue
      }
      if (peek() === '!') {
        pos++
        term.explode = true
        if (peek() === '!') {
          pos++
          term.compound = true
        } else if (peek() === 'o') {
          pos++
          term.explodeOnce = true
        } else if (peek() === 'i') pos++
        term.explodeOn = condition(true)
        continue
      }
      if (/^ro?(<=|>=|<|>|=)?\d/.test(rest)) {
        const once = rest[1] === 'o'
        pos += once ? 2 : 1
        const on = condition(false)
        if (on) term.reroll = { ...on, ...(once ? { once } : {}) }
        continue
      }
      if (/^f(<=|>=|<|>|=)?\d/.test(rest)) {
        pos++
        term.failure = condition(false)
        continue
      }
      const success = condition(true)
      if (success) {
        term.success = success
        continue
      }
      const name = label()
      if (name !== undefined) term.label = name
      return term
    }
  }

  const primary = (): DiceNode => {
    if (peek() === '(') {
      pos++
      const inner = expression()
      if (peek() !== ')') throw new DiceSyntaxError(`Falta «)» en «${written}»`)
      pos++
      label()
      return inner
    }
    if (peek() === '-') {
      pos++
      return { kind: 'negate', value: primary() }
    }
    if (peek() === 'd') return diceTerm(1)
    const n = number()
    if (n === null) return fail()
    if (peek() === 'd') return diceTerm(n)
    const name = label()
    return name === undefined ? { kind: 'number', value: n } : { kind: 'number', value: n, label: name }
  }

  const product = (): DiceNode => {
    let left = primary()
    while (peek() === '*' || peek() === '/' || peek() === 'x') {
      const op = peek() === '/' ? '/' : '*'
      pos++
      left = { kind: 'binary', op, left, right: primary() }
    }
    return left
  }

  const expression = (): DiceNode => {
    let left = product()
    while (peek() === '+' || peek() === '-') {
      const op = peek() as '+' | '-'
      pos++
      left = { kind: 'binary', op, left, right: product() }
    }
    return left
  }

  const tree = expression()
  if (pos < text.length) fail()
  return tree
}

/** Si un valor cumple una condición */
export function meets(value: number, c: Condition): boolean {
  switch (c.op) {
    case '<':
      return value < c.value
    case '>':
      return value > c.value
    case '<=':
      return value <= c.value
    case '>=':
      return value >= c.value
    case '=':
      return value === c.value
  }
}

const conditionText = (c: Condition, bareEquals: boolean): string =>
  `${c.op === '=' && bareEquals ? '' : c.op}${c.value}`

/** El texto de una fórmula, para enseñarla */
export function formatDice(node: DiceNode): string {
  switch (node.kind) {
    case 'number':
      return `${node.value}${node.label ? `[${node.label}]` : ''}`
    case 'negate':
      return `-${formatDice(node.value)}`
    case 'binary': {
      // Paréntesis donde hacen falta: (1d8+2)×2
      const strong = node.op === '*' || node.op === '/'
      const wrap = (child: DiceNode, right: boolean) => {
        const weak = child.kind === 'binary' && (child.op === '+' || child.op === '-')
        return (strong && weak) || (right && node.op === '-' && weak) ? `(${formatDice(child)})` : formatDice(child)
      }
      return `${wrap(node.left, false)}${node.op === '*' ? '×' : node.op}${wrap(node.right, true)}`
    }
    case 'dice': {
      const keep = node.keep ? `${node.keep.mode}${node.keep.n}` : ''
      const explode = node.explode
        ? `${node.compound ? '!!' : node.explodeOnce ? '!o' : '!'}${node.explodeOn ? conditionText(node.explodeOn, false) : ''}`
        : ''
      const implode = node.implodeOn
        ? `!-${node.implodeOn.op === '<=' ? '' : node.implodeOn.op}${node.implodeOn.value}`
        : ''
      const reroll = node.reroll ? `r${node.reroll.once ? 'o' : ''}${conditionText(node.reroll, true)}` : ''
      const success = node.success ? conditionText(node.success, false) : ''
      const failure = node.failure ? `f${conditionText(node.failure, true)}` : ''
      const sides = node.sides === 100 ? '%' : node.sides === 'F' ? 'F' : node.sides
      return `${node.count}d${sides}${explode}${implode}${reroll}${keep}${success}${failure}${node.label ? `[${node.label}]` : ''}`
    }
  }
}
