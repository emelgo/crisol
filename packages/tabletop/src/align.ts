// Portado de packages/mesa/src/nucleo/alineacion.ts (Crisol actual, commit 3f68f11)
/**
 * Alinear la rejilla con la impresa en el mapa: de las medidas que hace el máster (dos intersecciones contiguas, o dos
 * esquinas contiguas de un hexágono) o de la colocación libre, a una rejilla. Puro: sin DOM ni render.
 */
import type { Point } from './geometry.ts'
import { cellAt, cellBox, cellCenter, type Grid, type GridType, isHex, MIN_GRID_SIZE } from './grid.ts'

const SQRT3 = Math.sqrt(3)

/** Dos clics: intersecciones contiguas (cuadrada) o esquinas contiguas de un hexágono */
export interface Measure {
  a: Point
  b: Point
}

export interface MeasuredGrid {
  grid: Grid
  /** El tamaño que da cada medida */
  sizes: number[]
  /** Lo más que se aparta una medida del tamaño, o un punto medido de la rejilla resultante (px) */
  deviation: number
}

/** Medidas más cortas que esto son clics repetidos */
const MIN_MEASURE = 2

const lengthOf = ({ a, b }: Measure): number => Math.hypot(b.x - a.x, b.y - a.y)
const mean = (values: readonly number[]): number => values.reduce((s, v) => s + v, 0) / values.length

/** El tamaño que da una medida: la distancia (cuadrada) o el lado por √3 (hexagonal, de lado plano a lado plano) */
export const sizeFromMeasure = (type: GridType, measure: Measure): number =>
  isHex(type) ? lengthOf(measure) * SQRT3 : lengthOf(measure)

/** El nudo de la red de un centro de celda: la esquina de su caja */
function nodeOfCenter(type: GridType, size: number, center: Point): Point {
  const box = cellBox({ type, size, offsetX: 0, offsetY: 0 })
  return { x: center.x - box.width / 2, y: center.y - box.height / 2 }
}

/**
 * El nudo de la red que da una medida: la intersección (cuadrada) o, en la hexagonal, el de uno de los dos hexágonos
 * que comparten el lado medido (su centro está a medio tamaño del punto medio del lado; cualquiera de los dos sirve).
 */
function nodeOfMeasure(type: GridType, measure: Measure, size: number): Point {
  if (!isHex(type)) return measure.a
  const { a, b } = measure
  const l = lengthOf(measure)
  const normal = { x: -(b.y - a.y) / l, y: (b.x - a.x) / l }
  const center = { x: (a.x + b.x) / 2 + (normal.x * size) / 2, y: (a.y + b.y) / 2 + (normal.y * size) / 2 }
  return nodeOfCenter(type, size, center)
}

/** El nudo de la rejilla más cercano a `p` */
export function nearestNode(grid: Grid, p: Point): Point {
  const box = cellBox(grid)
  const center = cellCenter(grid, cellAt(grid, { x: p.x + box.width / 2, y: p.y + box.height / 2 }))
  return { x: center.x - box.width / 2, y: center.y - box.height / 2 }
}

const round3 = (v: number): number => Math.round(v * 1000) / 1000

/** La misma rejilla con el desplazamiento del nudo más cercano a su caja en el origen (entre 0 y una celda) */
export function normalizeGrid(grid: Grid): Grid {
  const box = cellBox(grid)
  // Un poco antes del medio: en un empate (0 o una celda) gana el nudo menor
  const node = nearestNode(grid, { x: box.width / 2 - 1e-3, y: box.height / 2 - 1e-3 })
  const zero = (v: number): number => (Math.abs(v) < 1e-6 ? 0 : round3(v))
  return { ...grid, size: Math.max(MIN_GRID_SIZE, round3(grid.size)), offsetX: zero(node.x), offsetY: zero(node.y) }
}

/** La rejilla que dan las medidas: tamaño medio y nudos llevados al mismo; null sin ninguna medida válida */
export function gridFromMeasures(type: GridType, measures: readonly Measure[]): MeasuredGrid | null {
  const valid = measures.filter((m) => lengthOf(m) >= MIN_MEASURE)
  if (valid.length === 0) return null
  const sizes = valid.map((m) => sizeFromMeasure(type, m))
  const size = mean(sizes)
  const nodes = valid.map((m) => nodeOfMeasure(type, m, size))
  const first = nodes[0] ?? { x: 0, y: 0 }
  const base: Grid = { type, size, offsetX: first.x, offsetY: first.y }
  const shifts = nodes.map((n) => {
    const c = nearestNode(base, n)
    return { x: n.x - c.x, y: n.y - c.y }
  })
  const grid = normalizeGrid({
    ...base,
    offsetX: base.offsetX + mean(shifts.map((d) => d.x)),
    offsetY: base.offsetY + mean(shifts.map((d) => d.y))
  })
  const bySize = Math.max(...sizes.map((t) => Math.abs(t - size)))
  const byPlace = Math.max(
    ...nodes.map((n) => {
      const c = nearestNode(grid, n)
      return Math.hypot(n.x - c.x, n.y - c.y)
    })
  )
  return { grid, sizes: sizes.map(round3), deviation: round3(Math.max(bySize, byPlace)) }
}

/** Colocación libre: una rejilla de ese tamaño con una intersección (cuadrada) o un centro (hexagonal) en `point` */
export function gridAtPoint(type: GridType, size: number, point: Point): Grid {
  const node = isHex(type) ? nodeOfCenter(type, size, point) : point
  return normalizeGrid({ type, size, offsetX: node.x, offsetY: node.y })
}

/** La rejilla desplazada (las flechas, al afinar) */
export const nudgeGrid = (grid: Grid, dx: number, dy: number): Grid =>
  normalizeGrid({ ...grid, offsetX: grid.offsetX + dx, offsetY: grid.offsetY + dy })
