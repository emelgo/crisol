/**
 * Las funciones de las fórmulas: las de matemáticas de Foundry y unas pocas para listas. Cada una dice cuántos
 * argumentos lleva, de qué tipo, qué da y cómo se calcula (sin eval)
 */
export type ValueType = 'number' | 'string' | 'boolean' | 'null' | 'dice' | 'list' | 'object' | 'any'

export type Value = number | string | boolean | null | Value[] | { [key: string]: Value }

export interface FormulaFunction {
  min: number
  max: number
  /** El tipo de cada argumento (el último vale para los que sigan) */
  args: ValueType[]
  returns: ValueType
  call: (args: Value[]) => Value
}

const num = (v: Value) => (typeof v === 'number' ? v : 0)
const listOf = (v: Value): Value[] => (Array.isArray(v) ? v : [])
const many = (args: Value[]) => args.flatMap((a) => (Array.isArray(a) ? a : [a])).map(num)

export const FUNCTIONS: Record<string, FormulaFunction> = {
  floor: { min: 1, max: 1, args: ['number'], returns: 'number', call: ([x]) => Math.floor(num(x ?? 0)) },
  ceil: { min: 1, max: 1, args: ['number'], returns: 'number', call: ([x]) => Math.ceil(num(x ?? 0)) },
  round: { min: 1, max: 1, args: ['number'], returns: 'number', call: ([x]) => Math.round(num(x ?? 0)) },
  abs: { min: 1, max: 1, args: ['number'], returns: 'number', call: ([x]) => Math.abs(num(x ?? 0)) },
  sign: { min: 1, max: 1, args: ['number'], returns: 'number', call: ([x]) => Math.sign(num(x ?? 0)) },
  // max(a, b, …) o max(una lista)
  max: { min: 1, max: 20, args: ['any'], returns: 'number', call: (args) => Math.max(...many(args)) },
  min: { min: 1, max: 20, args: ['any'], returns: 'number', call: (args) => Math.min(...many(args)) },
  clamp: {
    min: 3,
    max: 3,
    args: ['number'],
    returns: 'number',
    call: ([x, low, high]) => Math.min(num(high ?? 0), Math.max(num(low ?? 0), num(x ?? 0)))
  },
  // Sumar y contar una lista (sum(@lleva.peso), count(@lleva))
  sum: {
    min: 1,
    max: 1,
    args: ['list'],
    returns: 'number',
    call: ([l]) => many(listOf(l ?? [])).reduce((a, b) => a + b, 0)
  },
  count: {
    min: 1,
    max: 1,
    args: ['list'],
    returns: 'number',
    call: ([l]) => listOf(l ?? []).filter((v) => v !== null && v !== false).length
  },
  has: {
    min: 2,
    max: 2,
    args: ['list', 'any'],
    returns: 'boolean',
    call: ([l, v]) => listOf(l ?? []).includes(v ?? null)
  }
}
