/**
 * Un índice espacial de segmentos (los tramos de muro): una rejilla de cubos en la que cada segmento está en todas las
 * celdas que toca. Sirve para pedir los que caen en una caja, un círculo o a lo largo de un segmento, y para recorrer
 * un rayo celda a celda (Amanatides y Woo) sin probar todos los tramos. Se construye una vez por escena y estado de
 * puertas; no cambia después. Puro: sin DOM ni render.
 */
import type { Point, Rect } from './geometry.ts'

export interface SegmentLike {
  a: Point
  b: Point
}

/** Celdas que se crean como mucho por cada segmento indexado (el lado se agranda si haría falta más) */
const CELLS_PER_ITEM = 4
const EPSILON = 1e-7

export class WallIndex<T extends SegmentLike> {
  readonly items: readonly T[]
  readonly cellSize: number
  readonly minX: number
  readonly minY: number
  readonly columns: number
  readonly rows: number
  /** Por cada celda, dónde empiezan sus segmentos en `entries` (CSR) */
  private readonly starts: Uint32Array
  private readonly entries: Uint32Array
  /** Para no devolver dos veces el mismo segmento en una consulta */
  private readonly stamps: Uint32Array
  private stamp = 0

  /** `cellSize` en píxeles; sin él, uno que deja unas pocas celdas por segmento */
  constructor(items: readonly T[], cellSize?: number) {
    this.items = items
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (const { a, b } of items) {
      minX = Math.min(minX, a.x, b.x)
      minY = Math.min(minY, a.y, b.y)
      maxX = Math.max(maxX, a.x, b.x)
      maxY = Math.max(maxY, a.y, b.y)
    }
    if (items.length === 0) {
      minX = 0
      minY = 0
      maxX = 1
      maxY = 1
    }
    const width = Math.max(1, maxX - minX)
    const height = Math.max(1, maxY - minY)
    const auto = Math.sqrt((width * height) / Math.max(1, items.length))
    let size = cellSize !== undefined && cellSize > 0 ? cellSize : Math.max(8, auto)
    // Que la rejilla no crezca sin techo con un lado muy pequeño
    const limit = Math.max(1, items.length) * CELLS_PER_ITEM + 64
    while (Math.ceil(width / size + EPSILON) * Math.ceil(height / size + EPSILON) > limit) size *= 1.5
    this.cellSize = size
    this.minX = minX
    this.minY = minY
    this.columns = Math.max(1, Math.ceil(width / size + EPSILON))
    this.rows = Math.max(1, Math.ceil(height / size + EPSILON))
    const counts = new Uint32Array(this.columns * this.rows + 1)
    items.forEach((item) => {
      this.cellsOf(item, (cell) => {
        counts[cell + 1] = (counts[cell + 1] as number) + 1
      })
    })
    for (let i = 1; i < counts.length; i++) counts[i] = (counts[i] as number) + (counts[i - 1] as number)
    this.starts = counts.slice()
    this.entries = new Uint32Array(counts[counts.length - 1] as number)
    const fill = counts
    items.forEach((item, index) => {
      this.cellsOf(item, (cell) => {
        const at = fill[cell] as number
        this.entries[at] = index
        fill[cell] = at + 1
      })
    })
    this.stamps = new Uint32Array(items.length)
  }

  /** Las celdas que toca el segmento (por columnas: el trozo de segmento en cada una, con un margen mínimo) */
  private cellsOf({ a, b }: SegmentLike, visit: (cell: number) => void): void {
    const size = this.cellSize
    const x0 = Math.min(a.x, b.x)
    const x1 = Math.max(a.x, b.x)
    const c0 = this.column(x0 - EPSILON)
    const c1 = this.column(x1 + EPSILON)
    const dx = b.x - a.x
    for (let c = c0; c <= c1; c++) {
      const left = Math.max(x0, this.minX + c * size)
      const right = Math.min(x1, this.minX + (c + 1) * size)
      let ya: number
      let yb: number
      if (Math.abs(dx) < 1e-12) {
        ya = a.y
        yb = b.y
      } else {
        ya = a.y + ((left - a.x) / dx) * (b.y - a.y)
        yb = a.y + ((right - a.x) / dx) * (b.y - a.y)
      }
      const r0 = this.row(Math.min(ya, yb) - EPSILON)
      const r1 = this.row(Math.max(ya, yb) + EPSILON)
      for (let r = r0; r <= r1; r++) visit(r * this.columns + c)
    }
  }

  private column(x: number): number {
    return Math.min(this.columns - 1, Math.max(0, Math.floor((x - this.minX) / this.cellSize)))
  }

  private row(y: number): number {
    return Math.min(this.rows - 1, Math.max(0, Math.floor((y - this.minY) / this.cellSize)))
  }

  private nextStamp(): number {
    this.stamp += 1
    if (this.stamp === 0xffffffff) {
      this.stamps.fill(0)
      this.stamp = 1
    }
    return this.stamp
  }

  /** Los índices de los segmentos de una celda que aún no se han visto en esta consulta */
  private visitCell(cell: number, stamp: number, visit: (index: number) => void): void {
    const end = this.starts[cell + 1] as number
    for (let k = this.starts[cell] as number; k < end; k++) {
      const index = this.entries[k] as number
      if (this.stamps[index] === stamp) continue
      this.stamps[index] = stamp
      visit(index)
    }
  }

  /** Cada par de segmentos que comparten alguna celda, una vez (los únicos que pueden cortarse) */
  forEachPair(visit: (first: T, second: T) => void): void {
    const seen = new Set<number>()
    const n = this.items.length
    for (let cell = 0; cell < this.columns * this.rows; cell++) {
      const start = this.starts[cell] as number
      const end = this.starts[cell + 1] as number
      for (let i = start; i < end; i++)
        for (let j = i + 1; j < end; j++) {
          const x = this.entries[i] as number
          const y = this.entries[j] as number
          const key = x < y ? x * n + y : y * n + x
          if (seen.has(key)) continue
          seen.add(key)
          visit(this.items[x] as T, this.items[y] as T)
        }
    }
  }

  /** Los segmentos que pueden tocar el rectángulo (los de sus celdas: alguno puede quedar algo fuera) */
  queryRect(rect: Rect): T[] {
    const out: T[] = []
    if (this.items.length === 0 || !(rect.width >= 0) || !(rect.height >= 0)) return out
    const right = this.minX + this.columns * this.cellSize
    const bottom = this.minY + this.rows * this.cellSize
    if (rect.x > right || rect.y > bottom || rect.x + rect.width < this.minX || rect.y + rect.height < this.minY)
      return out
    const stamp = this.nextStamp()
    const c0 = this.column(rect.x)
    const c1 = this.column(rect.x + rect.width)
    const r0 = this.row(rect.y)
    const r1 = this.row(rect.y + rect.height)
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) this.visitCell(r * this.columns + c, stamp, (i) => out.push(this.items[i] as T))
    return out
  }

  /** Los segmentos que tocan el círculo, exactos */
  queryCircle(center: Point, radius: number): T[] {
    const box = { x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2 }
    return this.queryRect(box).filter(({ a, b }) => {
      const dx = b.x - a.x
      const dy = b.y - a.y
      const length2 = dx * dx + dy * dy
      const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((center.x - a.x) * dx + (center.y - a.y) * dy) / length2))
      return Math.hypot(center.x - a.x - dx * t, center.y - a.y - dy * t) <= radius
    })
  }

  /** Los segmentos de las celdas que cruza el segmento p→q (los que podría cortar) */
  querySegment(p: Point, q: Point): T[] {
    const out: T[] = []
    const dx = q.x - p.x
    const dy = q.y - p.y
    const length = Math.hypot(dx, dy)
    if (length === 0) return this.queryRect({ x: p.x, y: p.y, width: 0, height: 0 })
    this.walkRay(
      p,
      { x: dx / length, y: dy / length },
      length,
      (item) => out.push(item),
      () => false
    )
    return out
  }

  /**
   * Recorre las celdas que cruza el rayo `origin + dir·t`, con t de 0 a `maxT`, por orden, y da cada segmento una vez
   * (`visit`). Después de cada celda pregunta a `stopAfter` con el t por el que sale de ella: si devuelve true, para.
   * Así un barrido de visión prueba solo los tramos cercanos y para en cuanto sabe dónde choca.
   */
  walkRay(
    origin: Point,
    dir: Point,
    maxT: number,
    visit: (item: T, index: number) => void,
    stopAfter: (tExit: number) => boolean
  ): void {
    if (this.items.length === 0 || !(maxT > 0)) return
    const size = this.cellSize
    const left = this.minX
    const top = this.minY
    const right = left + this.columns * size
    const bottom = top + this.rows * size
    // Recorta el rayo a la caja de la rejilla
    let t0 = 0
    let t1 = maxT
    if (Math.abs(dir.x) < 1e-12) {
      if (origin.x < left || origin.x > right) return
    } else {
      const near = ((dir.x > 0 ? left : right) - origin.x) / dir.x
      const far = ((dir.x > 0 ? right : left) - origin.x) / dir.x
      t0 = Math.max(t0, near)
      t1 = Math.min(t1, far)
    }
    if (Math.abs(dir.y) < 1e-12) {
      if (origin.y < top || origin.y > bottom) return
    } else {
      const near = ((dir.y > 0 ? top : bottom) - origin.y) / dir.y
      const far = ((dir.y > 0 ? bottom : top) - origin.y) / dir.y
      t0 = Math.max(t0, near)
      t1 = Math.min(t1, far)
    }
    if (t0 > t1) return
    const stamp = this.nextStamp()
    const x = origin.x + dir.x * t0
    const y = origin.y + dir.y * t0
    let column = this.column(x)
    let row = this.row(y)
    const stepX = dir.x > 0 ? 1 : dir.x < 0 ? -1 : 0
    const stepY = dir.y > 0 ? 1 : dir.y < 0 ? -1 : 0
    const deltaX = stepX === 0 ? Number.POSITIVE_INFINITY : size / Math.abs(dir.x)
    const deltaY = stepY === 0 ? Number.POSITIVE_INFINITY : size / Math.abs(dir.y)
    let nextX =
      stepX === 0 ? Number.POSITIVE_INFINITY : (left + (column + (stepX > 0 ? 1 : 0)) * size - origin.x) / dir.x
    let nextY = stepY === 0 ? Number.POSITIVE_INFINITY : (top + (row + (stepY > 0 ? 1 : 0)) * size - origin.y) / dir.y
    const { starts, entries, stamps, items } = this
    for (;;) {
      const cell = row * this.columns + column
      const end = starts[cell + 1] as number
      for (let k = starts[cell] as number; k < end; k++) {
        const index = entries[k] as number
        if (stamps[index] === stamp) continue
        stamps[index] = stamp
        visit(items[index] as T, index)
      }
      const exit = Math.min(nextX, nextY, t1)
      if (stopAfter(exit) || exit >= t1) return
      if (nextX < nextY) {
        column += stepX
        nextX += deltaX
      } else {
        row += stepY
        nextY += deltaY
      }
      if (column < 0 || row < 0 || column >= this.columns || row >= this.rows) return
    }
  }
}
