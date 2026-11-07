// Portado de packages/mesa/src/nucleo/plantillas.ts (Crisol actual, commit 3f68f11)
/**
 * Plantillas de área que se quedan en el mapa (bola de fuego, cono de frío, relámpago…): una línea con su anchura, un
 * círculo, un cono o un cuadrado desde un punto. Una casilla cuenta si su centro cae dentro (como en 5e); una ficha,
 * si alguna de las casillas de su huella cuenta. Puro.
 */
import type { Point, Rect } from './geometry.ts'
import { cellAt, cellCenter, footprintCells, type Grid, isHex } from './grid.ts'

export type TemplateShape = 'line' | 'circle' | 'cone' | 'square'

export const TEMPLATE_SHAPES: readonly TemplateShape[] = ['line', 'circle', 'cone', 'square']

/** La apertura de un cono de 5e (su anchura igual a su largo), en grados */
export const DEFAULT_CONE_ANGLE = 53.13

export interface AreaTemplate {
  shape: TemplateShape
  /** El origen (centro del círculo, vértice del cono, principio de la línea, esquina del cuadrado) */
  a: Point
  /** Hasta dónde llega (el borde del círculo, el final del cono o de la línea, la esquina opuesta del cuadrado) */
  b: Point
  /** La apertura del cono, en grados */
  angle?: number | undefined
  /** La anchura de la línea, en píxeles */
  width?: number | undefined
}

const EPSILON = 1e-6

/** El cuadrado (5e: un cubo) de lado |a→b| desde la esquina `a`, hacia donde apunta `b` */
export function squareOf(a: Point, b: Point): { x: number; y: number; side: number } {
  const side = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))
  return { x: b.x >= a.x ? a.x : a.x - side, y: b.y >= a.y ? a.y : a.y - side, side }
}

/** Si un punto del mapa cae dentro de la plantilla (las líneas, con su anchura o, sin ella, `lineWidth`) */
export function insideTemplate(t: AreaTemplate, p: Point, lineWidth = 0): boolean {
  const { a, b } = t
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  const dx = p.x - a.x
  const dy = p.y - a.y
  const distance = Math.hypot(dx, dy)
  switch (t.shape) {
    case 'circle':
      return distance <= length + EPSILON
    case 'cone': {
      if (distance > length + EPSILON || length === 0) return false
      if (distance < EPSILON) return true
      const half = ((t.angle ?? DEFAULT_CONE_ANGLE) * Math.PI) / 360
      let difference = Math.abs(Math.atan2(dy, dx) - Math.atan2(b.y - a.y, b.x - a.x))
      if (difference > Math.PI) difference = 2 * Math.PI - difference
      return difference <= half + EPSILON
    }
    case 'square': {
      const r = squareOf(a, b)
      return (
        p.x >= r.x - EPSILON && p.x <= r.x + r.side + EPSILON && p.y >= r.y - EPSILON && p.y <= r.y + r.side + EPSILON
      )
    }
    case 'line': {
      if (length === 0) return false
      const k = (dx * (b.x - a.x) + dy * (b.y - a.y)) / (length * length)
      if (k < 0 || k > 1) return false
      const near = { x: a.x + k * (b.x - a.x), y: a.y + k * (b.y - a.y) }
      return Math.hypot(p.x - near.x, p.y - near.y) <= (t.width ?? lineWidth) / 2 + EPSILON
    }
  }
}

/** La caja que la contiene */
export function templateBounds(t: AreaTemplate): Rect {
  const length = Math.hypot(t.b.x - t.a.x, t.b.y - t.a.y)
  if (t.shape === 'square') {
    const r = squareOf(t.a, t.b)
    return { x: r.x, y: r.y, width: r.side, height: r.side }
  }
  if (t.shape === 'line') {
    const half = (t.width ?? 0) / 2
    const x = Math.min(t.a.x, t.b.x) - half
    const y = Math.min(t.a.y, t.b.y) - half
    return { x, y, width: Math.abs(t.b.x - t.a.x) + 2 * half, height: Math.abs(t.b.y - t.a.y) + 2 * half }
  }
  return { x: t.a.x - length, y: t.a.y - length, width: 2 * length, height: 2 * length }
}

/** Los centros de las casillas que toca la plantilla (para resaltarlas); las líneas sin anchura, de una casilla */
export function templateCells(t: AreaTemplate, grid: Grid): Point[] {
  const side = grid.size
  const box = templateBounds({ ...t, width: t.width ?? side })
  const seen = new Set<string>()
  const centers: Point[] = []
  for (let y = box.y - side; y <= box.y + box.height + side; y += side / 2) {
    for (let x = box.x - side; x <= box.x + box.width + side; x += side / 2) {
      const cell = cellAt(grid, { x, y })
      const key = `${cell.q},${cell.r}`
      if (seen.has(key)) continue
      seen.add(key)
      const center = cellCenter(grid, cell)
      if (insideTemplate(t, center, side)) centers.push(center)
    }
  }
  return centers
}

/** Una ficha: su centro, en píxeles, y su tamaño en casillas */
export interface TemplateToken {
  id: string
  x: number
  y: number
  size: number
}

/**
 * Los puntos de la huella de una ficha que se miran: en la cuadrada (o sin rejilla, con casillas de `cell` píxeles),
 * el centro de cada casilla que ocupa; en hexagonal, su centro y, si es grande, un anillo a media huella
 */
function footprintPoints(token: TemplateToken, grid: Grid | null, cell: number): Point[] {
  const n = footprintCells(token.size)
  const side = grid?.size ?? cell
  if (grid && isHex(grid.type)) {
    const center = { x: token.x, y: token.y }
    if (n === 1) return [center]
    const radius = ((n - 1) * side) / 2
    return [
      center,
      ...Array.from({ length: 6 }, (_, i) => ({
        x: token.x + radius * Math.cos((i * Math.PI) / 3),
        y: token.y + radius * Math.sin((i * Math.PI) / 3)
      }))
    ]
  }
  const start = { x: token.x - (n * side) / 2, y: token.y - (n * side) / 2 }
  return Array.from({ length: n * n }, (_, i) => ({
    x: start.x + ((i % n) + 0.5) * side,
    y: start.y + (Math.floor(i / n) + 0.5) * side
  }))
}

/** Las fichas que quedan dentro de la plantilla (alguna casilla de su huella cuenta), en su orden */
export function tokensInTemplate<T extends TemplateToken>(
  t: AreaTemplate,
  tokens: readonly T[],
  grid: Grid | null,
  cell = 100
): T[] {
  const side = grid?.size ?? cell
  return tokens.filter((token) => footprintPoints(token, grid, cell).some((p) => insideTemplate(t, p, side)))
}
