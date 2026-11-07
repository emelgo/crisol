/**
 * La niebla como rejilla de bits (ADR-0018 § 6): `cellSize` píxeles del mapa por bit (10 por defecto), un bit por celda,
 * encendido si se ve (o se exploró). Una celda está dentro de una forma si su centro lo está. Rellenar un polígono, un
 * círculo, un rectángulo o un trazo de pincel; unir, restar y cruzar con otra del mismo tamaño; contar; guardarla
 * comprimida (RLE propio, sin dependencias) y leerla; y saber qué teselas del mapa tocan sus bits encendidos. Puro.
 */
import type { Point, Rect } from './geometry.ts'
import { type TilePyramid, type TileRef, tilesInRect } from './tiles.ts'

export const FOG_CELL_SIZE = 10
/** Bits como mucho (unos 8 MB sin comprimir): una rejilla mayor no se crea ni se lee */
export const FOG_MAX_BITS = 64 * 1024 * 1024

const MAGIC_C = 0x43
const MAGIC_F = 0x46
const VERSION = 1

const popcount = (v: number): number => {
  let x = v - ((v >>> 1) & 0x55555555)
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333)
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24
}

export class FogGrid {
  /** Tamaño del mapa, en píxeles */
  readonly width: number
  readonly height: number
  readonly cellSize: number
  readonly columns: number
  readonly rows: number
  /** Palabras de 32 bits por fila (cada fila empieza en una palabra) */
  readonly stride: number
  readonly words: Uint32Array

  constructor(width: number, height: number, cellSize = FOG_CELL_SIZE) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0)
      throw new RangeError(`Tamaño de niebla no válido: ${width} × ${height}`)
    if (!Number.isInteger(cellSize) || cellSize <= 0) throw new RangeError(`Celda de niebla no válida: ${cellSize}`)
    this.width = width
    this.height = height
    this.cellSize = cellSize
    this.columns = Math.ceil(width / cellSize)
    this.rows = Math.ceil(height / cellSize)
    if (this.columns * this.rows > FOG_MAX_BITS)
      throw new RangeError(`La niebla pasa de ${FOG_MAX_BITS} celdas: ${this.columns} × ${this.rows}`)
    this.stride = Math.ceil(this.columns / 32)
    this.words = new Uint32Array(this.stride * this.rows)
  }

  /** Otra vacía del mismo tamaño */
  empty(): FogGrid {
    return new FogGrid(this.width, this.height, this.cellSize)
  }

  clone(): FogGrid {
    const copy = this.empty()
    copy.words.set(this.words)
    return copy
  }

  /** Todo encendido (true) o apagado (false) */
  fill(value: boolean): this {
    if (!value) {
      this.words.fill(0)
      return this
    }
    for (let r = 0; r < this.rows; r++) this.setSpan(r, 0, this.columns - 1, true)
    return this
  }

  get(column: number, row: number): boolean {
    if (column < 0 || row < 0 || column >= this.columns || row >= this.rows) return false
    return (((this.words[row * this.stride + (column >>> 5)] as number) >>> (column & 31)) & 1) === 1
  }

  set(column: number, row: number, value: boolean): void {
    if (column < 0 || row < 0 || column >= this.columns || row >= this.rows) return
    const i = row * this.stride + (column >>> 5)
    const bit = 1 << (column & 31)
    this.words[i] = value ? (this.words[i] as number) | bit : (this.words[i] as number) & ~bit
  }

  /** La celda que contiene el punto (en píxeles del mapa) */
  cellAt(p: Point): { column: number; row: number } {
    return { column: Math.floor(p.x / this.cellSize), row: Math.floor(p.y / this.cellSize) }
  }

  /** Si el punto cae en una celda encendida */
  hasPoint(p: Point): boolean {
    const { column, row } = this.cellAt(p)
    return this.get(column, row)
  }

  /** Enciende o apaga las celdas `c0`–`c1` (incluidas) de una fila; lo que se sale se recorta */
  setSpan(row: number, c0: number, c1: number, value: boolean): void {
    if (row < 0 || row >= this.rows) return
    const from = Math.max(0, c0)
    const to = Math.min(this.columns - 1, c1)
    if (from > to) return
    const base = row * this.stride
    const w0 = from >>> 5
    const w1 = to >>> 5
    for (let w = w0; w <= w1; w++) {
      const lo = w === w0 ? from & 31 : 0
      const hi = w === w1 ? to & 31 : 31
      const mask = hi === 31 ? (0xffffffff << lo) >>> 0 : ((((1 << (hi + 1)) >>> 0) - 1) & (0xffffffff << lo)) >>> 0
      const i = base + w
      this.words[i] = value ? (this.words[i] as number) | mask : (this.words[i] as number) & ~mask
    }
  }

  /** Las columnas cuyo centro cae en [x0, x1) */
  private columnsBetween(x0: number, x1: number): [number, number] {
    const s = this.cellSize
    return [Math.ceil(x0 / s - 0.5), Math.ceil(x1 / s - 0.5) - 1]
  }

  /** Rellena un polígono (regla par-impar): las celdas cuyo centro cae dentro */
  fillPolygon(polygon: readonly Point[], value = true): this {
    if (polygon.length < 3) return this
    const s = this.cellSize
    let minY = Number.POSITIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (const p of polygon) {
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    }
    const r0 = Math.max(0, Math.ceil(minY / s - 0.5))
    const r1 = Math.min(this.rows - 1, Math.ceil(maxY / s - 0.5) - 1)
    if (r0 > r1) return this
    // Los cortes de cada fila (en el centro de sus celdas) con los lados del polígono
    const crossings: number[][] = Array.from({ length: r1 - r0 + 1 }, () => [])
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[j] as Point
      const b = polygon[i] as Point
      if (a.y === b.y) continue
      const top = a.y < b.y ? a : b
      const bottom = a.y < b.y ? b : a
      // Filas con el centro en [top.y, bottom.y)
      const from = Math.max(r0, Math.ceil(top.y / s - 0.5))
      const to = Math.min(r1, Math.ceil(bottom.y / s - 0.5) - 1)
      const slope = (bottom.x - top.x) / (bottom.y - top.y)
      for (let r = from; r <= to; r++) (crossings[r - r0] as number[]).push(top.x + ((r + 0.5) * s - top.y) * slope)
    }
    crossings.forEach((xs, k) => {
      xs.sort((x, y) => x - y)
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const [c0, c1] = this.columnsBetween(xs[i] as number, xs[i + 1] as number)
        this.setSpan(r0 + k, c0, c1, value)
      }
    })
    return this
  }

  /** Rellena un círculo: las celdas cuyo centro está a `radius` o menos */
  fillCircle(center: Point, radius: number, value = true): this {
    if (!(radius > 0)) return this
    const s = this.cellSize
    const r0 = Math.max(0, Math.ceil((center.y - radius) / s - 0.5))
    const r1 = Math.min(this.rows - 1, Math.floor((center.y + radius) / s - 0.5))
    for (let r = r0; r <= r1; r++) {
      const dy = (r + 0.5) * s - center.y
      const dx = Math.sqrt(Math.max(0, radius * radius - dy * dy))
      this.setSpan(r, Math.ceil((center.x - dx) / s - 0.5), Math.floor((center.x + dx) / s - 0.5), value)
    }
    return this
  }

  /** Rellena un rectángulo: las celdas cuyo centro cae dentro */
  fillRect(rect: Rect, value = true): this {
    if (!(rect.width > 0) || !(rect.height > 0)) return this
    const s = this.cellSize
    const r0 = Math.max(0, Math.ceil(rect.y / s - 0.5))
    const r1 = Math.min(this.rows - 1, Math.ceil((rect.y + rect.height) / s - 0.5) - 1)
    const [c0, c1] = this.columnsBetween(rect.x, rect.x + rect.width)
    for (let r = r0; r <= r1; r++) this.setSpan(r, c0, c1, value)
    return this
  }

  /** Rellena un trazo de pincel: las celdas cuyo centro está a `radius` o menos de la línea de puntos */
  fillBrush(points: readonly Point[], radius: number, value = true): this {
    if (!(radius > 0) || points.length === 0) return this
    const s = this.cellSize
    // Un punto suelto es un círculo; si no, un tramo entre cada dos puntos seguidos
    const segments = Math.max(1, points.length - 1)
    for (let i = 0; i < segments; i++) {
      const a = points[i] as Point
      const b = points[i + 1] ?? a
      const dx = b.x - a.x
      const dy = b.y - a.y
      const length2 = dx * dx + dy * dy
      const r0 = Math.max(0, Math.ceil((Math.min(a.y, b.y) - radius) / s - 0.5))
      const r1 = Math.min(this.rows - 1, Math.floor((Math.max(a.y, b.y) + radius) / s - 0.5))
      const c0 = Math.max(0, Math.ceil((Math.min(a.x, b.x) - radius) / s - 0.5))
      const c1 = Math.min(this.columns - 1, Math.floor((Math.max(a.x, b.x) + radius) / s - 0.5))
      for (let r = r0; r <= r1; r++) {
        const y = (r + 0.5) * s
        for (let c = c0; c <= c1; c++) {
          const x = (c + 0.5) * s
          const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length2))
          if (Math.hypot(x - a.x - dx * t, y - a.y - dy * t) <= radius) this.set(c, r, value)
        }
      }
    }
    return this
  }

  private same(other: FogGrid): void {
    if (other.width !== this.width || other.height !== this.height || other.cellSize !== this.cellSize)
      throw new RangeError('Las dos nieblas no tienen el mismo tamaño')
  }

  /** Enciende lo que está encendido en la otra */
  union(other: FogGrid): this {
    this.same(other)
    for (let i = 0; i < this.words.length; i++) this.words[i] = (this.words[i] as number) | (other.words[i] as number)
    return this
  }

  /** Apaga lo que está encendido en la otra */
  subtract(other: FogGrid): this {
    this.same(other)
    for (let i = 0; i < this.words.length; i++) this.words[i] = (this.words[i] as number) & ~(other.words[i] as number)
    return this
  }

  /** Deja encendido solo lo que también lo está en la otra */
  intersect(other: FogGrid): this {
    this.same(other)
    for (let i = 0; i < this.words.length; i++) this.words[i] = (this.words[i] as number) & (other.words[i] as number)
    return this
  }

  /** Si alguna celda está encendida en las dos */
  intersects(other: FogGrid): boolean {
    this.same(other)
    for (let i = 0; i < this.words.length; i++)
      if (((this.words[i] as number) & (other.words[i] as number)) !== 0) return true
    return false
  }

  /** Celdas encendidas */
  count(): number {
    let n = 0
    for (const w of this.words) if (w !== 0) n += popcount(w)
    return n
  }

  isEmpty(): boolean {
    return this.words.every((w) => w === 0)
  }

  /** Cada tramo encendido de cada fila: su fila y sus columnas primera y última */
  forEachRun(visit: (row: number, c0: number, c1: number) => void): void {
    for (let r = 0; r < this.rows; r++) {
      const base = r * this.stride
      let start = -1
      for (let w = 0; w < this.stride; w++) {
        const word = this.words[base + w] as number
        if (start < 0 && word === 0) continue
        if (start >= 0 && word === 0xffffffff) continue
        for (let bit = 0; bit < 32; bit++) {
          const c = w * 32 + bit
          if (c >= this.columns) break
          const on = ((word >>> bit) & 1) === 1
          if (on && start < 0) start = c
          else if (!on && start >= 0) {
            visit(r, start, c - 1)
            start = -1
          }
        }
      }
      if (start >= 0) visit(r, start, this.columns - 1)
    }
  }

  /** El rectángulo (en píxeles del mapa) que encierra lo encendido, o null si no hay nada */
  bounds(): Rect | null {
    let c0 = Number.POSITIVE_INFINITY
    let c1 = -1
    let r0 = -1
    let r1 = -1
    this.forEachRun((r, a, b) => {
      if (r0 < 0) r0 = r
      r1 = r
      c0 = Math.min(c0, a)
      c1 = Math.max(c1, b)
    })
    if (r0 < 0) return null
    const s = this.cellSize
    return { x: c0 * s, y: r0 * s, width: (c1 - c0 + 1) * s, height: (r1 - r0 + 1) * s }
  }

  /**
   * Las teselas de un nivel que tocan alguna celda encendida, por filas. `toImage` pasa un rectángulo del mapa a
   * píxeles de la imagen (nivel 0) si no coinciden (un mapa estirado); sin él, son los mismos.
   */
  tilesTouched(pyramid: TilePyramid, level = 0, toImage: (rect: Rect) => Rect = (rect) => rect): TileRef[] {
    const found = new Map<string, TileRef>()
    const s = this.cellSize
    this.forEachRun((r, c0, c1) => {
      const rect = toImage({ x: c0 * s, y: r * s, width: (c1 - c0 + 1) * s, height: s })
      for (const tile of tilesInRect(pyramid, level, rect)) found.set(`${tile.y},${tile.x}`, tile)
    })
    return [...found.values()].sort((a, b) => a.y - b.y || a.x - b.x)
  }

  /**
   * Comprimida: «CF», la versión, el lado de la celda, el ancho y el alto del mapa y, después, los largos de los tramos
   * de bits iguales (fila tras fila, empezando por uno apagado, que puede medir 0), cada uno en LEB128
   */
  encode(): Uint8Array {
    const bytes: number[] = [MAGIC_C, MAGIC_F, VERSION]
    const varint = (value: number): void => {
      let v = value
      while (v >= 0x80) {
        bytes.push((v % 0x80) | 0x80)
        v = Math.floor(v / 0x80)
      }
      bytes.push(v)
    }
    varint(this.cellSize)
    varint(this.width)
    varint(this.height)
    // Los tramos: apagado, encendido, apagado… (los encendidos seguidos de una fila a la siguiente, juntos)
    const runs: number[] = []
    let position = 0
    this.forEachRun((r, c0, c1) => {
      const start = r * this.columns + c0
      const end = r * this.columns + c1 + 1
      if (runs.length > 0 && start === position) runs[runs.length - 1] = (runs.at(-1) as number) + end - start
      else runs.push(start - position, end - start)
      position = end
    })
    const total = this.columns * this.rows
    if (position < total) runs.push(total - position)
    for (const run of runs) varint(run)
    return Uint8Array.from(bytes)
  }

  /** Lee una comprimida con `encode`; si está mal, un RangeError */
  static decode(data: Uint8Array): FogGrid {
    let at = 0
    const varint = (): number => {
      let value = 0
      let scale = 1
      for (let k = 0; k < 6; k++) {
        if (at >= data.length) throw new RangeError('Niebla cortada')
        const byte = data[at++] as number
        value += (byte & 0x7f) * scale
        if (byte < 0x80) return value
        scale *= 0x80
      }
      throw new RangeError('Niebla mal formada: número demasiado largo')
    }
    if (data.length < 3 || data[0] !== MAGIC_C || data[1] !== MAGIC_F) throw new RangeError('No es una niebla')
    if (data[2] !== VERSION) throw new RangeError(`Versión de niebla desconocida: ${data[2]}`)
    at = 3
    const cellSize = varint()
    const width = varint()
    const height = varint()
    const grid = new FogGrid(width, height, cellSize)
    const total = grid.columns * grid.rows
    let position = 0
    let on = false
    while (at < data.length) {
      const run = varint()
      if (position + run > total) throw new RangeError('Niebla mal formada: sobran celdas')
      if (on) {
        // Un tramo encendido puede pasar de una fila a la siguiente
        let left = run
        let p = position
        while (left > 0) {
          const row = Math.floor(p / grid.columns)
          const column = p - row * grid.columns
          const take = Math.min(left, grid.columns - column)
          grid.setSpan(row, column, column + take - 1, true)
          p += take
          left -= take
        }
      }
      position += run
      on = !on
    }
    if (position !== total) throw new RangeError('Niebla mal formada: faltan celdas')
    return grid
  }
}
