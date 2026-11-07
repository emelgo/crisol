// Portado de packages/mesa/src/nucleo/niebla.ts (Crisol actual, commit 3f68f11)
/**
 * La niebla a mano como operaciones (ADR-0018 § 6): cada gesto del máster es una (pincel, lazo o rectángulo) que
 * destapa o tapa, con su fecha y un desplazamiento opcional. Lo destapado y lo tapado salen de repetirlas en orden
 * sobre la rejilla de bits: gana lo último que se pinta. Puro: sin DOM ni render (el trazo en un lienzo es del cliente).
 */
import { FogGrid } from './fog-grid.ts'
import type { Point } from './geometry.ts'
import type { Grid } from './grid.ts'

export type FogMode = 'reveal' | 'cover'

interface FogBase {
  id: string
  mode: FogMode
  timestamp?: number
  offsetX?: number
  offsetY?: number
}

export type FogOperation =
  | (FogBase & { shape: 'brush'; points: readonly Point[]; radius: number })
  | (FogBase & { shape: 'lasso'; points: readonly Point[] })
  | (FogBase & { shape: 'rectangle'; x: number; y: number; width: number; height: number })

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isPoints = (v: unknown): v is Point[] =>
  Array.isArray(v) && v.every((p) => typeof p === 'object' && p !== null && isNumber(p.x) && isNumber(p.y))

/** Si es una operación con lo que necesita su forma (una dañada no se pinta) */
export function isFogOperation(value: unknown): value is FogOperation {
  if (typeof value !== 'object' || value === null) return false
  const op = value as Record<string, unknown>
  if (typeof op.id !== 'string' || (op.mode !== 'reveal' && op.mode !== 'cover')) return false
  for (const key of ['timestamp', 'offsetX', 'offsetY']) if (op[key] !== undefined && !isNumber(op[key])) return false
  const points = op.points
  if (op.shape === 'brush') return isPoints(points) && points.length > 0 && isNumber(op.radius) && op.radius > 0
  if (op.shape === 'lasso') return isPoints(points) && points.length >= 3
  if (op.shape === 'rectangle') return isNumber(op.x) && isNumber(op.y) && isNumber(op.width) && isNumber(op.height)
  return false
}

/** Las operaciones válidas en el orden en que se hicieron (a igualdad, como vienen) */
export function fogInOrder(ops: Iterable<unknown>): FogOperation[] {
  return [...ops]
    .filter(isFogOperation)
    .map((op, i) => ({ op, i }))
    .sort((a, b) => (a.op.timestamp ?? 0) - (b.op.timestamp ?? 0) || a.i - b.i)
    .map(({ op }) => op)
}

/** Si el punto cae en lo que destapa o tapa la operación */
export function fogOperationContains(op: FogOperation, p: Point): boolean {
  const x = p.x - (op.offsetX ?? 0)
  const y = p.y - (op.offsetY ?? 0)
  if (op.shape === 'rectangle') return x >= op.x && x <= op.x + op.width && y >= op.y && y <= op.y + op.height
  const points = op.points
  if (op.shape === 'lasso') {
    let inside = false
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i] as Point
      const b = points[j] as Point
      if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside
    }
    return inside
  }
  for (let i = 0; i < points.length; i++) {
    const a = points[i] as Point
    const b = points[i + 1] ?? a
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = dx * dx + dy * dy
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length))
    if (Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)) <= op.radius) return true
  }
  return false
}

/** La operación de más arriba (la última) que toca el punto, o null */
export function fogOperationAt(ops: Iterable<unknown>, p: Point): FogOperation | null {
  const list = fogInOrder(ops)
  for (let i = list.length - 1; i >= 0; i--) {
    const op = list[i] as FogOperation
    if (fogOperationContains(op, p)) return op
  }
  return null
}

/**
 * Normaliza un rectángulo arrastrado de `a` a `b` (anchura y altura positivas). Con una rejilla cuadrada, sus esquinas
 * van a las líneas de la rejilla: tapa o destapa casillas enteras.
 */
export function rectBetween(
  a: Point,
  b: Point,
  grid: Grid | null = null
): { x: number; y: number; width: number; height: number } {
  let x0 = Math.min(a.x, b.x)
  let y0 = Math.min(a.y, b.y)
  let x1 = Math.max(a.x, b.x)
  let y1 = Math.max(a.y, b.y)
  if (grid && grid.type === 'square' && grid.size > 0) {
    const s = grid.size
    const down = (v: number, o: number): number => Math.floor((v - o) / s) * s + o
    const up = (v: number, o: number): number => Math.ceil((v - o) / s) * s + o
    x0 = down(x0, grid.offsetX)
    y0 = down(y0, grid.offsetY)
    x1 = Math.max(up(x1, grid.offsetX), x0 + s)
    y1 = Math.max(up(y1, grid.offsetY), y0 + s)
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

/** Pinta la forma de la operación en la rejilla (encendiendo o apagando, según `value`) */
export function paintFogOperation(grid: FogGrid, op: FogOperation, value: boolean): void {
  const dx = op.offsetX ?? 0
  const dy = op.offsetY ?? 0
  const move = (points: readonly Point[]): Point[] => points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
  if (op.shape === 'rectangle') grid.fillRect({ x: op.x + dx, y: op.y + dy, width: op.width, height: op.height }, value)
  else if (op.shape === 'lasso') grid.fillPolygon(move(op.points), value)
  else grid.fillBrush(move(op.points), op.radius, value)
}

/**
 * Lo destapado y lo tapado a mano en un mapa de `width` × `height` px: las operaciones en orden; cada una enciende su
 * forma en lo suyo y la apaga en lo otro (gana la última)
 */
export function manualFog(
  ops: Iterable<unknown>,
  width: number,
  height: number,
  cellSize?: number
): { revealed: FogGrid; covered: FogGrid } {
  const revealed = new FogGrid(width, height, cellSize)
  const covered = revealed.empty()
  for (const op of fogInOrder(ops)) {
    paintFogOperation(op.mode === 'reveal' ? revealed : covered, op, true)
    paintFogOperation(op.mode === 'reveal' ? covered : revealed, op, false)
  }
  return { revealed, covered }
}
