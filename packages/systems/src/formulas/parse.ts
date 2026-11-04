/**
 * El lenguaje de fórmulas de un sistema (ADR-0011), con la forma de las de Foundry: los valores con @ (`@des.mod`), los
 * dados en la misma fórmula (`1d20 + @fue.mod`), `+ - * / %`, comparaciones, `&& || !`, `? :` y funciones. Un
 * intérprete propio, sin eval: texto → árbol. Los dados los lee `@crisol/dice`; sus modificadores van pegados al dado
 * (`5d10>=8` cuenta éxitos; `2d6 >= 10`, con espacios, compara)
 */
import { DiceSyntaxError, type DiceTerm, parseDice } from '@crisol/dice'

export type BinaryOp = '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '<' | '<=' | '>' | '>=' | '&&' | '||'

/** Cada nodo sabe de dónde salió (start, end), para decir dónde está un error */
export type Expr = (
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'null' }
  /** @a.b[expr].c: cada tramo, un nombre o una expresión (el elemento de un conjunto) */
  | { kind: 'ref'; path: (string | Expr)[] }
  | { kind: 'dice'; term: DiceTerm; text: string }
  | { kind: 'unary'; op: '-' | '!'; value: Expr }
  | { kind: 'binary'; op: BinaryOp; left: Expr; right: Expr }
  | { kind: 'conditional'; test: Expr; yes: Expr; no: Expr }
  | { kind: 'call'; name: string; args: Expr[] }
) & { start: number; end: number }

export class FormulaError extends Error {
  readonly start: number
  readonly end: number
  constructor(message: string, start: number, end: number) {
    super(message)
    this.name = 'FormulaError'
    this.start = start
    this.end = end
  }
}

export const MAX_FORMULA = 2000
/** Paréntesis y llamadas unos dentro de otros: una fórmula no necesita más */
const MAX_DEPTH = 64

const COND = '(?:<=|>=|<|>|=)'
const MODIFIER = `(?:kh\\d*|kl\\d*|k\\d*|dh\\d*|dl\\d*|!-${COND}?\\d+|!!(?:${COND}\\d+)?|!o(?:${COND}\\d+)?|!i?(?:${COND}\\d+)?|ro?${COND}?\\d+|f${COND}?\\d+|${COND}\\d+)`
/** Un término de dados, como lo entiende `@crisol/dice`: 4d6kh3, d%, 2d20kl1[ataque], 1d6!>4 */
const DICE = new RegExp(`^\\d*d(?:\\d+|%|f)${MODIFIER}*(?:\\[[^\\]]*\\])?`, 'i')
const NAME = /^[a-zA-Z_][a-zA-Z0-9_]*/
/** Como las claves de un sistema: ningún nombre es más largo */
const MAX_NAME = 60
const NUMBER = /^\d+(?:\.\d+)?/

/** Lo que escribe una persona: ×, ÷ y el signo menos tipográfico */
const normalize = (text: string) => text.replace(/×/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-')

export function parseFormula(input: string): Expr {
  const text = normalize(input)
  if (!text.trim()) throw new FormulaError('Escribe una fórmula, como 10 + @des.mod', 0, 0)
  if (text.length > MAX_FORMULA) throw new FormulaError(`Como mucho, ${MAX_FORMULA} caracteres`, 0, text.length)
  let pos = 0
  let depth = 0

  const long = (name: string, at: number) => {
    if (name.length > MAX_NAME)
      throw new FormulaError(`Un nombre tiene como mucho ${MAX_NAME} caracteres`, at, at + name.length)
  }

  const space = () => {
    while (pos < text.length && /\s/.test(text[pos] as string)) pos++
  }
  const rest = () => text.slice(pos)
  const at = (token: string) => {
    space()
    return text.startsWith(token, pos)
  }
  const fail = (start = pos): never => {
    space()
    // Lo que se escribe en otros lenguajes, dicho como se escribe aquí
    const hint = {
      '=': 'Para comparar se escribe «==»',
      '&': 'Para «y» se escribe «&&»',
      '|': 'Para «o» se escribe «||»'
    }[text[pos] ?? '']
    if (hint && text[pos + 1] !== text[pos]) throw new FormulaError(hint, pos, pos + 1)
    throw new FormulaError(
      pos >= text.length
        ? `No se entiende «${input.trim()}» al final`
        : `No se entiende «${input.trim()}» cerca de «${text.slice(start).trim()}»`,
      start,
      text.length
    )
  }
  const expect = (token: string, what: string) => {
    if (!at(token)) throw new FormulaError(`Falta «${token}» ${what}`, pos, pos)
    pos += token.length
  }
  const nested = <T>(read: () => T): T => {
    if (++depth > MAX_DEPTH) throw new FormulaError('Demasiados paréntesis unos dentro de otros', pos, pos)
    const value = read()
    depth--
    return value
  }

  const conditional = (): Expr => {
    space()
    const start = pos
    const test = or()
    if (!at('?')) return test
    pos++
    const then = nested(conditional)
    expect(':', 'en «… ? … : …»')
    const otherwise = nested(conditional)
    return { kind: 'conditional', test, yes: then, no: otherwise, start, end: otherwise.end }
  }
  const binary = (next: () => Expr, ops: readonly BinaryOp[]) => (): Expr => {
    let left = next()
    for (;;) {
      space()
      // Las de dos letras antes que las de una: <= antes que <
      const op = ops.find(
        (o) => text.startsWith(o, pos) && !(o === '<' && text[pos + 1] === '=') && !(o === '>' && text[pos + 1] === '=')
      )
      if (!op) return left
      // «!» solo y «=» solo no son operadores
      if ((op === '!=' || op === '==') && text[pos + 2] === '=') fail()
      pos += op.length
      const right = next()
      left = { kind: 'binary', op, left, right, start: left.start, end: right.end }
    }
  }
  const unary = (): Expr => {
    space()
    const start = pos
    if (text[pos] === '-' || (text[pos] === '!' && text[pos + 1] !== '=')) {
      const op = text[pos] as '-' | '!'
      pos++
      const value = nested(unary)
      return { kind: 'unary', op, value, start, end: value.end }
    }
    return primary()
  }
  const multiplicative = binary(unary, ['*', '/', '%'])
  const additive = binary(multiplicative, ['+', '-'])
  const comparison = binary(additive, ['<=', '>=', '<', '>'])
  const equality = binary(comparison, ['==', '!='])
  const and = binary(equality, ['&&'])
  const or = binary(and, ['||'])

  const primary = (): Expr => {
    space()
    const start = pos
    const c = text[pos] ?? ''
    if (c === '(') {
      pos++
      const inner = nested(conditional)
      expect(')', `en «${input.trim()}»`)
      return { ...inner, start, end: pos }
    }
    if (c === '@') {
      pos++
      return reference(start)
    }
    if (c === '"' || c === "'") {
      const close = text.indexOf(c, pos + 1)
      if (close < 0) throw new FormulaError(`Falta cerrar el texto con ${c}`, start, text.length)
      pos = close + 1
      return { kind: 'string', value: text.slice(start + 1, close), start, end: pos }
    }
    const dice = DICE.exec(rest())
    if (dice) {
      pos += dice[0].length
      if (NAME.test(rest()) || /^\d/.test(rest())) fail(start)
      let node: ReturnType<typeof parseDice>
      try {
        node = parseDice(dice[0])
      } catch (error) {
        if (error instanceof DiceSyntaxError) throw new FormulaError(error.message, start, pos)
        throw error
      }
      if (node.kind !== 'dice') return fail(start)
      return { kind: 'dice', term: node, text: dice[0], start, end: pos }
    }
    const number = NUMBER.exec(rest())
    if (number) {
      pos += number[0].length
      return { kind: 'number', value: Number(number[0]), start, end: pos }
    }
    const name = NAME.exec(rest())
    if (name) {
      long(name[0], pos)
      pos += name[0].length
      const word = name[0]
      if (word === 'true' || word === 'false') return { kind: 'boolean', value: word === 'true', start, end: pos }
      if (word === 'null') return { kind: 'null', start, end: pos }
      if (!at('(')) throw new FormulaError(`«${word}» suelto: los valores van con @ (@${word})`, start, pos)
      pos++
      const args: Expr[] = []
      if (!at(')'))
        for (;;) {
          args.push(nested(conditional))
          if (at(',')) {
            pos++
            continue
          }
          break
        }
      expect(')', `al final de ${word}(…)`)
      return { kind: 'call', name: word, args, start, end: pos }
    }
    return fail()
  }

  const reference = (start: number): Expr => {
    const first = NAME.exec(rest())
    if (!first) throw new FormulaError('Falta el nombre tras «@»', start, pos)
    long(first[0], pos)
    pos += first[0].length
    const path: (string | Expr)[] = [first[0]]
    for (;;) {
      if (text[pos] === '.') {
        const name = NAME.exec(text.slice(pos + 1))
        if (!name) throw new FormulaError('Falta el nombre tras «.»', pos, pos + 1)
        long(name[0], pos + 1)
        pos += 1 + name[0].length
        path.push(name[0])
        continue
      }
      if (text[pos] === '[') {
        pos++
        path.push(nested(conditional))
        expect(']', 'tras el elemento')
        continue
      }
      return { kind: 'ref', path, start, end: pos }
    }
  }

  const tree = conditional()
  space()
  if (pos < text.length) fail()
  return tree
}

/** Las referencias de una fórmula, para el `@` del editor y para saber de qué depende */
export function referencesOf(expr: Expr): Extract<Expr, { kind: 'ref' }>[] {
  const found: Extract<Expr, { kind: 'ref' }>[] = []
  const walk = (e: Expr) => {
    switch (e.kind) {
      case 'ref':
        found.push(e)
        for (const p of e.path) if (typeof p !== 'string') walk(p)
        break
      case 'unary':
        walk(e.value)
        break
      case 'binary':
        walk(e.left)
        walk(e.right)
        break
      case 'conditional':
        walk(e.test)
        walk(e.yes)
        walk(e.no)
        break
      case 'call':
        e.args.forEach(walk)
        break
    }
  }
  walk(expr)
  return found
}
