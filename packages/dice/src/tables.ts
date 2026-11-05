/**
 * Las tablas aleatorias (docs/specs/personajes.md § tablas): su fórmula (sin ella, 1dN por la última fila), la fila de
 * un total y los problemas de sus rangos (que no se pisen, que no queden huecos y que no se salgan de la fórmula)
 */
import { rollDice } from './roll.ts'

export interface RangeRow {
  id: string
  from: number
  to: number
}

/** La fórmula con la que se tira: la suya o, sin ella, 1dN por la última fila */
export function tableFormula(formula: string | null | undefined, rows: readonly RangeRow[]): string {
  const given = formula?.trim()
  if (given) return given
  const top = Math.max(1, ...rows.map((r) => r.to))
  // Un dado tiene al menos 2 caras: con una sola fila, siempre sale
  return top > 1 ? `1d${top}` : '1'
}

/** Lo menos y lo más que puede salir con una fórmula (si no se entiende, null) */
export function boundsOf(formula: string): { min: number; max: number } | null {
  try {
    // Con todos los dados al mínimo y al máximo (lo que resta, al revés: 10 - 1d6 va del 4 al 9)
    const low = rollDice(formula, () => 1).total
    const high = rollDice(formula, (sides) => sides).total
    return { min: Math.min(low, high), max: Math.max(low, high) }
  } catch {
    return null
  }
}

/** La fila de un total */
export function rowFor<T extends RangeRow>(rows: readonly T[], total: number): T | null {
  return rows.find((r) => r.from <= total && total <= r.to) ?? null
}

/** Un problema de sus rangos, con sus datos: la web lo dice en su idioma; el servidor, con `tableProblems` */
export type TableProblem =
  | { code: 'notIntegers' | 'backwards'; from: number; to: number }
  | { code: 'overlap'; from: number; to: number; nextFrom: number; nextTo: number }
  | { code: 'gap'; from: number; to: number }
  | { code: 'formula'; formula: string }
  | { code: 'below'; formula: string; min: number; first: number }
  | { code: 'above'; formula: string; max: number; last: number }
  | { code: 'outside'; formula: string; min: number; max: number }

/** Lo que está mal en sus rangos, para decirlo al guardar */
export function tableProblemList(formula: string | null | undefined, rows: readonly RangeRow[]): TableProblem[] {
  const problems: TableProblem[] = []
  for (const r of rows) {
    if (!Number.isInteger(r.from) || !Number.isInteger(r.to))
      problems.push({ code: 'notIntegers', from: r.from, to: r.to })
    else if (r.from > r.to) problems.push({ code: 'backwards', from: r.from, to: r.to })
  }
  const sorted = [...rows].sort((a, b) => a.from - b.from)
  for (let i = 1; i < sorted.length; i++) {
    const before = sorted[i - 1] as RangeRow
    const here = sorted[i] as RangeRow
    if (here.from <= before.to)
      problems.push({ code: 'overlap', from: before.from, to: before.to, nextFrom: here.from, nextTo: here.to })
    else if (here.from > before.to + 1) problems.push({ code: 'gap', from: before.to + 1, to: here.from - 1 })
  }
  const used = tableFormula(formula, rows)
  const bounds = boundsOf(used)
  if (!bounds) problems.push({ code: 'formula', formula: used })
  else if (sorted.length > 0) {
    const first = sorted[0] as RangeRow
    const last = sorted.at(-1) as RangeRow
    if (first.from > bounds.min) problems.push({ code: 'below', formula: used, min: bounds.min, first: first.from })
    if (last.to < bounds.max) problems.push({ code: 'above', formula: used, max: bounds.max, last: last.to })
    if (first.from < bounds.min || last.to > bounds.max)
      problems.push({ code: 'outside', formula: used, min: bounds.min, max: bounds.max })
  }
  return problems
}

/** Un problema, dicho en español (para el servidor y la IA) */
export function describeTableProblem(p: TableProblem): string {
  switch (p.code) {
    case 'notIntegers':
      return `La fila ${p.from}–${p.to} no es de enteros`
    case 'backwards':
      return `La fila ${p.from}–${p.to} empieza después de acabar`
    case 'overlap':
      return `Las filas ${p.from}–${p.to} y ${p.nextFrom}–${p.nextTo} se pisan`
    case 'gap':
      return `Falta del ${p.from} al ${p.to}`
    case 'formula':
      return `No se entiende la fórmula «${p.formula}»`
    case 'below':
      return `Con ${p.formula} puede salir ${p.min}, y la primera fila empieza en ${p.first}`
    case 'above':
      return `Con ${p.formula} puede salir ${p.max}, y la última fila acaba en ${p.last}`
    case 'outside':
      return `Con ${p.formula} solo sale del ${p.min} al ${p.max}`
  }
}

/** Lo que está mal en sus rangos, dicho en español */
export function tableProblems(formula: string | null | undefined, rows: readonly RangeRow[]): string[] {
  return tableProblemList(formula, rows).map(describeTableProblem)
}
