// Portado de packages/mesa/src/nucleo/medidas.ts (Crisol actual, commit 3f68f11)
/**
 * Medir en la rejilla (docs/specs/herramientas-mesa.md): las casillas entre dos puntos según la regla de diagonales
 * (todas iguales, alternas o la línea recta), también en hexagonal, un camino con puntos intermedios y su texto en la
 * unidad de la escena («30 pies») o por bandas («Cerca»). Puro.
 */
import type { Point } from './geometry.ts'
import { cellAt, type Grid, isHex, stepsBetween } from './grid.ts'

/** `equal`: cada diagonal cuenta 1 (5e); `alternate`: 1, 2, 1, 2 (5-10-5); `euclidean`: la línea recta */
export type DiagonalRule = 'equal' | 'alternate' | 'euclidean'

/** Lo que mide una casilla y en qué unidad («5», «pies») */
export interface DistanceScale {
  distance: number
  units: string
}

/** Una banda de distancia (Cerca, Lejos…): hasta cuántas casillas llega */
export interface RangeBand {
  name: string
  maxCells: number
}

/** Las casillas de un tramo en la cuadrada: rectas y diagonales */
function squareSteps(grid: Grid, a: Point, b: Point) {
  const ca = cellAt(grid, a)
  const cb = cellAt(grid, b)
  const dx = Math.abs(cb.q - ca.q)
  const dy = Math.abs(cb.r - ca.r)
  const diagonals = Math.min(dx, dy)
  return { dx, dy, diagonals, straight: Math.max(dx, dy) - diagonals }
}

/** Casillas que hay que andar de un punto a otro (de su casilla a la del otro) */
export function cellsBetween(grid: Grid, a: Point, b: Point, rule: DiagonalRule): number {
  if (isHex(grid.type)) return stepsBetween(grid, cellAt(grid, a), cellAt(grid, b))
  const { dx, dy, diagonals, straight } = squareSteps(grid, a, b)
  if (rule === 'euclidean') return Math.hypot(dx, dy)
  if (rule === 'alternate') return straight + diagonals + Math.floor(diagonals / 2)
  return straight + diagonals
}

/** Casillas de una distancia sin rejilla (en línea recta, con casillas de `cell` píxeles) */
export const straightCells = (a: Point, b: Point, cell: number): number => Math.hypot(b.x - a.x, b.y - a.y) / cell

/**
 * Lo que mide un camino con puntos intermedios, tramo a tramo. Con diagonales alternas la cuenta sigue de un tramo al
 * siguiente (la segunda diagonal del camino cuenta doble aunque esté en otro tramo). Sin rejilla, en línea recta con
 * casillas de `cell` píxeles
 */
export function measurePath(
  grid: Grid | null,
  points: readonly Point[],
  rule: DiagonalRule,
  cell = grid?.size ?? 100
): { cells: number; segments: number[] } {
  const segments: number[] = []
  let diagonalsSoFar = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Point
    const b = points[i] as Point
    if (!grid) {
      segments.push(straightCells(a, b, cell))
      continue
    }
    if (rule !== 'alternate' || isHex(grid.type)) {
      segments.push(cellsBetween(grid, a, b, rule))
      continue
    }
    const { diagonals, straight } = squareSteps(grid, a, b)
    // Las diagonales dobles de todo el camino hasta aquí, menos las que ya se contaron
    const doubled = Math.floor((diagonalsSoFar + diagonals) / 2) - Math.floor(diagonalsSoFar / 2)
    diagonalsSoFar += diagonals
    segments.push(straight + diagonals + doubled)
  }
  return { cells: segments.reduce((sum, n) => sum + n, 0), segments }
}

/** Lo que mide una casilla según una medida hecha sobre el mapa: `distance` a lo largo de `length` píxeles */
export const distancePerCell = (distance: number, length: number, cell: number): number =>
  length > 0 ? (distance * cell) / length : 0

const formatNumber = (n: number, decimals: number): string =>
  n.toLocaleString(
    'es-ES',
    decimals > 1
      ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
      : { maximumFractionDigits: decimals }
  )

/**
 * El texto de una distancia de `cells` casillas. Con `decimals` 2, siempre dos («1,21 m»): la distancia continua, que
 * cambia al momento al mover; con 1 (por defecto), las casillas enteras pegadas a la rejilla («4,5 m»). Con bandas, el
 * nombre de la primera que la alcanza (o la última)
 */
export function distanceText(cells: number, scale: DistanceScale, decimals = 1, bands?: readonly RangeBand[]): string {
  if (bands && bands.length > 0) {
    const sorted = [...bands].sort((p, q) => p.maxCells - q.maxCells)
    return (sorted.find((band) => cells <= band.maxCells) ?? (sorted[sorted.length - 1] as RangeBand)).name
  }
  const value = formatNumber(cells * scale.distance, decimals)
  const units = scale.units.trim()
  return units ? `${value} ${units}` : value
}
