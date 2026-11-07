// Portado de packages/mesa/src/nucleo/rejilla.ts (Crisol actual, commit 3f68f11)
/**
 * Geometría de la rejilla de una escena: cuadrada y hexagonal (coordenadas axiales con redondeo cúbico, como en
 * redblobgames.com/grids/hexagons), celdas, colocación de fichas y líneas para dibujarla. Puro: sin DOM ni render.
 */
import type { Point, Rect, Size } from './geometry.ts'

/**
 * Cuadrada; hexagonal por filas (vértice arriba: las filas van desplazadas media celda) o por columnas (lado plano
 * arriba: las columnas van desplazadas). Las «pares» o «impares» desplazadas de otras mesas son lo mismo con otro
 * desplazamiento. Sin rejilla es `null`.
 */
export type GridType = 'square' | 'hex-rows' | 'hex-columns'

export const GRID_TYPES: readonly GridType[] = ['square', 'hex-rows', 'hex-columns']

/** Lo que la geometría lee de la rejilla de una escena */
export interface Grid {
  type: GridType
  /** Lado de la celda (cuadrada) o distancia de lado plano a lado plano (hexagonal), en píxeles del mundo */
  size: number
  /** Esquina de arriba a la izquierda de la celda (0, 0) (de su caja, en las hexagonales) */
  offsetX: number
  offsetY: number
}

/** Celda: (columna, fila) en la cuadrada; (q, r) axiales en las hexagonales */
export interface Cell {
  q: number
  r: number
}

/** Segmento [x1, y1, x2, y2] */
export type Segment = [number, number, number, number]

const SQRT3 = Math.sqrt(3)

/** Casilla más pequeña que se admite (píxeles del mapa): por debajo no se distingue y la rejilla pesa demasiado */
export const MIN_GRID_SIZE = 10

export const isHex = (type: GridType | undefined): type is 'hex-rows' | 'hex-columns' =>
  type === 'hex-rows' || type === 'hex-columns'

/** La rejilla de unos datos guardados (`type`, `size`, `offsetX`, `offsetY`); null si no hay o no sirve */
export function toGrid(
  data: { type?: unknown; size?: unknown; offsetX?: unknown; offsetY?: unknown } | null | undefined
): Grid | null {
  if (!data) return null
  const size = typeof data.size === 'number' && data.size > 0 ? Math.max(MIN_GRID_SIZE, data.size) : null
  if (size === null) return null
  const type: GridType = data.type === 'hex-rows' || data.type === 'hex-columns' ? data.type : 'square'
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return { type, size, offsetX: num(data.offsetX), offsetY: num(data.offsetY) }
}

/**
 * Dónde queda un punto si la rejilla pasa de `from` a `to` (mismo tipo, otro tamaño o desplazamiento): en el mismo
 * sitio de su casilla. Así las fichas siguen en sus casillas, con su tamaño en casillas.
 */
export function pointInNewGrid(p: Point, from: Grid, to: Grid): Point {
  const scale = to.size / from.size
  return { x: to.offsetX + (p.x - from.offsetX) * scale, y: to.offsetY + (p.y - from.offsetY) * scale }
}

/** Distancia del centro de un hexágono a sus vértices */
export const hexCircumradius = (size: number): number => size / SQRT3

/** Ancho y alto de la caja de una celda */
export function cellBox(grid: Grid): Size {
  const { type, size } = grid
  if (type === 'hex-rows') return { width: size, height: 2 * hexCircumradius(size) }
  if (type === 'hex-columns') return { width: 2 * hexCircumradius(size), height: size }
  return { width: size, height: size }
}

/** Centro de la celda (0, 0) */
function originCenter(grid: Grid): Point {
  const box = cellBox(grid)
  return { x: grid.offsetX + box.width / 2, y: grid.offsetY + box.height / 2 }
}

/** Centro de una celda */
export function cellCenter(grid: Grid, { q, r }: Cell): Point {
  const o = originCenter(grid)
  const { type, size } = grid
  if (type === 'hex-rows') return { x: o.x + size * (q + r / 2), y: o.y + 1.5 * hexCircumradius(size) * r }
  if (type === 'hex-columns') return { x: o.x + 1.5 * hexCircumradius(size) * q, y: o.y + size * (r + q / 2) }
  return { x: o.x + size * q, y: o.y + size * r }
}

/** Redondeo cúbico de coordenadas axiales fraccionarias */
export function roundAxial(q: number, r: number): Cell {
  const s = -q - r
  let rq = Math.round(q)
  let rr = Math.round(r)
  const rs = Math.round(s)
  const dq = Math.abs(rq - q)
  const dr = Math.abs(rr - r)
  const ds = Math.abs(rs - s)
  if (dq > dr && dq > ds) rq = -rr - rs
  else if (dr > ds) rr = -rq - rs
  // + 0 quita el -0
  return { q: rq + 0, r: rr + 0 }
}

/** Celda que contiene el punto */
export function cellAt(grid: Grid, point: Point): Cell {
  const o = originCenter(grid)
  const x = point.x - o.x
  const y = point.y - o.y
  const { type, size } = grid
  if (type === 'hex-rows') {
    const r = y / (1.5 * hexCircumradius(size))
    return roundAxial(x / size - r / 2, r)
  }
  if (type === 'hex-columns') {
    const q = x / (1.5 * hexCircumradius(size))
    return roundAxial(q, y / size - q / 2)
  }
  return { q: Math.round(x / size) + 0, r: Math.round(y / size) + 0 }
}

/** Pasos entre dos celdas (en la cuadrada, como el rey del ajedrez; las reglas de medida van aparte) */
export function stepsBetween(grid: Grid, a: Cell, b: Cell): number {
  const dq = b.q - a.q
  const dr = b.r - a.r
  if (isHex(grid.type)) return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2
  return Math.max(Math.abs(dq), Math.abs(dr))
}

/** Los vértices de la celda con ese centro, en el sentido de las agujas del reloj */
export function cellVertices(grid: Grid, center: Point): Point[] {
  const { type, size } = grid
  if (!isHex(type)) {
    const m = size / 2
    return [
      { x: center.x - m, y: center.y - m },
      { x: center.x + m, y: center.y - m },
      { x: center.x + m, y: center.y + m },
      { x: center.x - m, y: center.y + m }
    ]
  }
  const radius = hexCircumradius(size)
  const start = type === 'hex-rows' ? -90 : 0
  return Array.from({ length: 6 }, (_, i) => {
    const angle = ((start + 60 * i) * Math.PI) / 180
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }
  })
}

// ── Fichas ───────────────────────────────────────────────────────────────

/** Celdas por lado de la huella de una ficha de `size` casillas por lado (la de ½ ocupa una) */
export const footprintCells = (size: number): number => Math.max(1, Math.round(size))

/** Casillas por lado que mide el dibujo de una ficha: su tamaño (una diminuta, media casilla) */
export const drawnCells = (size: number): number => (size > 0 && size < 1 ? size : footprintCells(size))

/**
 * Cuánto se separa el centro de una ficha del centro de la celda donde empieza su huella: nada si la huella es impar;
 * con huella par, hasta la esquina (cuadrada) o el vértice (hexagonal) de abajo a la derecha.
 */
export function tokenOffset(grid: Grid | null, size: number): Point {
  if (!grid || footprintCells(size) % 2 === 1) return { x: 0, y: 0 }
  const { type, size: side } = grid
  if (type === 'hex-rows') return { x: side / 2, y: hexCircumradius(side) / 2 }
  if (type === 'hex-columns') return { x: hexCircumradius(side) / 2, y: side / 2 }
  return { x: side / 2, y: side / 2 }
}

/** Dónde se ajusta el centro de una ficha soltada en `point` */
export function snapToken(grid: Grid | null, point: Point, size = 1): Point {
  if (!grid) return point
  const offset = tokenOffset(grid, size)
  const center = cellCenter(grid, cellAt(grid, { x: point.x - offset.x, y: point.y - offset.y }))
  return { x: center.x + offset.x, y: center.y + offset.y }
}

/** Centro de una ficha que pasa de `from` a `to` de tamaño: ajustada, conserva la celda donde empieza su huella */
export function centerOnResize(grid: Grid | null, center: Point, from: number, to: number, snapped: boolean): Point {
  if (!grid || !snapped) return center
  // En la cuadrada la huella crece hacia abajo a la derecha desde su esquina de arriba a la izquierda
  if (!isHex(grid.type)) {
    const n1 = footprintCells(from)
    const n2 = footprintCells(to)
    const corner = { x: center.x - (n1 * grid.size) / 2, y: center.y - (n1 * grid.size) / 2 }
    return { x: corner.x + (n2 * grid.size) / 2, y: corner.y + (n2 * grid.size) / 2 }
  }
  const before = tokenOffset(grid, from)
  const after = tokenOffset(grid, to)
  return { x: center.x - before.x + after.x, y: center.y - before.y + after.y }
}

// ── Celdas visibles y líneas ─────────────────────────────────────────────

/** Celdas cuyo centro cae dentro del rectángulo ampliado una celda por cada lado */
export function cellsIn(grid: Grid, rect: Rect): Cell[] {
  const box = cellBox(grid)
  const margin = Math.max(box.width, box.height)
  const x0 = rect.x - margin
  const y0 = rect.y - margin
  const x1 = rect.x + rect.width + margin
  const y1 = rect.y + rect.height + margin
  const corners = [
    cellAt(grid, { x: x0, y: y0 }),
    cellAt(grid, { x: x1, y: y0 }),
    cellAt(grid, { x: x0, y: y1 }),
    cellAt(grid, { x: x1, y: y1 })
  ]
  const qs = corners.map((c) => c.q)
  const rs = corners.map((c) => c.r)
  const out: Cell[] = []
  for (let r = Math.min(...rs) - 1; r <= Math.max(...rs) + 1; r++) {
    for (let q = Math.min(...qs) - 1; q <= Math.max(...qs) + 1; q++) {
      const c = cellCenter(grid, { q, r })
      if (c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1) out.push({ q, r })
    }
  }
  return out
}

/** Clave de un punto a 1/8 de píxel, para no repetir lados ni esquinas que comparten varias celdas */
const pointKey = (x: number, y: number): string => `${Math.round(x * 8)},${Math.round(y * 8)}`

/** Líneas de la rejilla que cruzan el rectángulo (sin repetir los lados que comparten dos celdas) */
export function gridLines(grid: Grid, rect: Rect): Segment[] {
  if (!isHex(grid.type)) {
    const { size, offsetX, offsetY } = grid
    const out: Segment[] = []
    const x1 = rect.x + rect.width
    const y1 = rect.y + rect.height
    for (let x = offsetX + Math.ceil((rect.x - offsetX) / size) * size; x <= x1 + 1e-9; x += size)
      out.push([x, rect.y, x, y1])
    for (let y = offsetY + Math.ceil((rect.y - offsetY) / size) * size; y <= y1 + 1e-9; y += size)
      out.push([rect.x, y, x1, y])
    return out
  }
  const seen = new Set<string>()
  const out: Segment[] = []
  for (const cell of cellsIn(grid, rect)) {
    const v = cellVertices(grid, cellCenter(grid, cell))
    v.forEach((a, i) => {
      const b = v[(i + 1) % v.length] ?? a
      const key = pointKey((a.x + b.x) / 2, (a.y + b.y) / 2)
      if (seen.has(key)) return
      seen.add(key)
      out.push([a.x, a.y, b.x, b.y])
    })
  }
  return out
}

/**
 * Rejilla de cruces: una «+» con brazos de `arm` (desde el centro) en cada esquina de casilla que cae dentro del
 * rectángulo, sin repetir las esquinas que comparten varias casillas.
 */
export function gridCrosses(grid: Grid, rect: Rect, arm: number): Segment[] {
  const inside = (x: number, y: number): boolean =>
    x >= rect.x - 1e-9 && x <= rect.x + rect.width + 1e-9 && y >= rect.y - 1e-9 && y <= rect.y + rect.height + 1e-9
  const points: Point[] = []
  if (!isHex(grid.type)) {
    const { size, offsetX, offsetY } = grid
    for (let x = offsetX + Math.ceil((rect.x - offsetX) / size) * size; x <= rect.x + rect.width + 1e-9; x += size)
      for (let y = offsetY + Math.ceil((rect.y - offsetY) / size) * size; y <= rect.y + rect.height + 1e-9; y += size)
        points.push({ x, y })
  } else {
    const seen = new Set<string>()
    for (const cell of cellsIn(grid, rect)) {
      for (const v of cellVertices(grid, cellCenter(grid, cell))) {
        const key = pointKey(v.x, v.y)
        if (seen.has(key) || !inside(v.x, v.y)) continue
        seen.add(key)
        points.push(v)
      }
    }
  }
  return points.flatMap(({ x, y }): Segment[] => [
    [x - arm, y, x + arm, y],
    [x, y - arm, x, y + arm]
  ])
}

/** Trozos de un segmento con trazo discontinuo (`dash` dibujado, `gap` sin dibujar) */
export function dashSegment([x1, y1, x2, y2]: Segment, dash: number, gap: number): Segment[] {
  const length = Math.hypot(x2 - x1, y2 - y1)
  if (length === 0 || dash <= 0) return []
  const ux = (x2 - x1) / length
  const uy = (y2 - y1) / length
  const out: Segment[] = []
  for (let t = 0; t < length; t += dash + gap) {
    const end = Math.min(length, t + dash)
    out.push([x1 + ux * t, y1 + uy * t, x1 + ux * end, y1 + uy * end])
  }
  return out
}

// ── Numeración ───────────────────────────────────────────────────────────

export type CellNumbering = 'column-row' | 'sequential' | 'letter-number'

/** Una celda numerada: su centro, dónde va el número y el texto */
export interface NumberedCell {
  cell: Cell
  center: Point
  anchor: Point
  label: string
}

/** Columna en letras, base 26 biyectiva: 1 → A, 26 → Z, 27 → AA, 53 → BA */
export function columnLetters(column: number): string {
  let n = column
  let out = ''
  while (n > 0) {
    const rest = (n - 1) % 26
    out = String.fromCharCode(65 + rest) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

const twoDigits = (n: number): string => String(n).padStart(2, '0')

/** Tamaño de letra de los números de celda, en píxeles del mundo */
export const cellNumberFontSize = (size: number): number => Math.max(6, size * 0.2)

/**
 * Numera las celdas del mapa (`map`, en el mundo) que están al menos a medias dentro (su centro, dentro): también las
 * que corta el borde. Las líneas son las filas (cuadrada y hexágonos por filas) o las columnas (hexágonos por
 * columnas), y cada línea empieza a contar en su primera celda. El número no se sale del mapa.
 */
export function numberCells(grid: Grid, map: Rect, format: CellNumbering): NumberedCell[] {
  const inside = cellsIn(grid, map)
    .map((cell) => ({ cell, center: cellCenter(grid, cell) }))
    .filter(
      ({ center }) =>
        center.x >= map.x && center.x <= map.x + map.width && center.y >= map.y && center.y <= map.y + map.height
    )
  const byColumns = grid.type === 'hex-columns'
  const lineOf = (c: Cell): number => (byColumns ? c.q : c.r)
  const lines = [...new Set(inside.map(({ cell }) => lineOf(cell)))].sort((a, b) => a - b)
  const position = new Map<string, { row: number; column: number }>()
  const keyOf = (c: Cell): string => `${c.q},${c.r}`
  lines.forEach((line, lineIndex) => {
    const ofLine = inside
      .filter(({ cell }) => lineOf(cell) === line)
      .sort((a, b) => (byColumns ? a.center.y - b.center.y : a.center.x - b.center.x))
    ofLine.forEach(({ cell }, i) => {
      position.set(keyOf(cell), byColumns ? { row: i, column: lineIndex } : { row: lineIndex, column: i })
    })
  })
  const at = (c: Cell): { row: number; column: number } => position.get(keyOf(c)) ?? { row: 0, column: 0 }
  const reading = [...inside].sort((a, b) => {
    const pa = at(a.cell)
    const pb = at(b.cell)
    return pa.row - pb.row || pa.column - pb.column
  })
  const height = cellBox(grid).height
  const font = cellNumberFontSize(grid.size)
  const clamp = (v: number, min: number, max: number): number =>
    min > max ? (min + max) / 2 : Math.min(max, Math.max(min, v))
  return reading.map(({ cell, center }, i) => {
    const { row, column } = at(cell)
    const label =
      format === 'sequential'
        ? String(i + 1)
        : format === 'letter-number'
          ? `${columnLetters(column + 1)}${row + 1}`
          : `${twoDigits(column + 1)}${twoDigits(row + 1)}`
    // Arriba de la celda; en una cortada por el borde, dentro del mapa
    const half = (label.length * font * 0.62) / 2 + font * 0.3
    const x = clamp(center.x, map.x + half, map.x + map.width - half)
    const y = clamp(center.y - height / 2 + font * 0.9, map.y + font * 0.9, map.y + map.height - font * 0.9)
    return { cell, center, anchor: { x, y }, label }
  })
}
