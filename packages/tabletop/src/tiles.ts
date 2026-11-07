/**
 * El mapa de una escena, en teselas (ADR-0018 § 7): el nivel 0 es la imagen a tamaño real y cada nivel siguiente, la
 * imagen a la mitad (su ancho y su alto, redondeados hacia arriba), hasta que el lado mayor cabe en
 * `TOP_LEVEL_MAX_SIDE`. Cada nivel se parte en teselas cuadradas de `TILE_SIZE` desde arriba a la izquierda; las del
 * borde derecho y el de abajo son más pequeñas. Los rectángulos que se piden van en píxeles de la imagen (nivel 0).
 * Puro: lo usan el navegador al trocear y pintar, y el servidor al guardar y servir.
 */
import type { Rect } from './geometry.ts'

export const TILE_SIZE = 512
/** El último nivel es el primero cuyo lado mayor cabe en esto */
export const TOP_LEVEL_MAX_SIDE = 1024

export interface TileLevel {
  level: number
  /** Píxeles del nivel por píxel del nivel 0: 1, ½, ¼… */
  scale: number
  width: number
  height: number
  columns: number
  rows: number
}

export interface TilePyramid {
  width: number
  height: number
  tileSize: number
  levels: TileLevel[]
}

/** Una tesela: su nivel, su columna (`x`) y su fila (`y`), desde 0 */
export interface TileRef {
  level: number
  x: number
  y: number
}

const isPositiveInteger = (v: number): boolean => Number.isInteger(v) && v > 0

/** Los niveles y las teselas de una imagen de `width` × `height` píxeles */
export function tilePyramid(
  width: number,
  height: number,
  tileSize = TILE_SIZE,
  topMaxSide = TOP_LEVEL_MAX_SIDE
): TilePyramid {
  if (!isPositiveInteger(width) || !isPositiveInteger(height))
    throw new RangeError(`Tamaño de imagen no válido: ${width} × ${height}`)
  if (!isPositiveInteger(tileSize)) throw new RangeError(`Tamaño de tesela no válido: ${tileSize}`)
  if (!isPositiveInteger(topMaxSide)) throw new RangeError(`Lado del último nivel no válido: ${topMaxSide}`)
  const levels: TileLevel[] = []
  for (let level = 0; ; level++) {
    const divisor = 2 ** level
    const w = Math.ceil(width / divisor)
    const h = Math.ceil(height / divisor)
    levels.push({
      level,
      scale: 1 / divisor,
      width: w,
      height: h,
      columns: Math.ceil(w / tileSize),
      rows: Math.ceil(h / tileSize)
    })
    if (Math.max(w, h) <= topMaxSide) break
  }
  return { width, height, tileSize, levels }
}

/** Cuántas teselas hay entre todos los niveles */
export const tileCount = (pyramid: TilePyramid): number =>
  pyramid.levels.reduce((total, l) => total + l.columns * l.rows, 0)

/** Si la tesela existe en la pirámide */
export function hasTile(pyramid: TilePyramid, ref: TileRef): boolean {
  const level = Number.isInteger(ref.level) ? pyramid.levels[ref.level] : undefined
  if (!level) return false
  return (
    Number.isInteger(ref.x) &&
    Number.isInteger(ref.y) &&
    ref.x >= 0 &&
    ref.y >= 0 &&
    ref.x < level.columns &&
    ref.y < level.rows
  )
}

/**
 * Las teselas de un nivel que pisan un rectángulo en píxeles del nivel 0, por filas. Lo que se sale de la imagen se
 * recorta; tocar el borde de una tesela no es pisarla.
 */
export function tilesInRect(pyramid: TilePyramid, level: number, rect: Rect): TileRef[] {
  const info = pyramid.levels[level]
  if (!info || !(rect.width > 0) || !(rect.height > 0)) return []
  const span = pyramid.tileSize / info.scale
  const x0 = Math.max(0, Math.floor(rect.x / span))
  const y0 = Math.max(0, Math.floor(rect.y / span))
  const x1 = Math.min(info.columns - 1, Math.ceil((rect.x + rect.width) / span) - 1)
  const y1 = Math.min(info.rows - 1, Math.ceil((rect.y + rect.height) / span) - 1)
  const out: TileRef[] = []
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push({ level, x, y })
  return out
}

/**
 * El nivel que conviene para dibujar a `scale` píxeles de pantalla por píxel de la imagen (con la densidad de la
 * pantalla ya multiplicada): el más pequeño que aún tiene un píxel por cada píxel de pantalla.
 */
export function levelForScale(pyramid: TilePyramid, scale: number): number {
  const last = pyramid.levels.length - 1
  if (!(scale > 0)) return last
  // El margen evita que un error de redondeo baje de nivel justo en las escalas exactas (½, ¼…)
  const level = Math.floor(Math.log2(1 / scale) + 1e-9)
  return Math.min(last, Math.max(0, level))
}

/** El trozo del nivel que es la tesela, en píxeles de su nivel (lo que se recorta al trocear) */
export function tileRect(pyramid: TilePyramid, ref: TileRef): Rect {
  const level = pyramid.levels[ref.level]
  if (!level || !hasTile(pyramid, ref)) throw new RangeError(`No existe la tesela ${ref.level}/${ref.x}_${ref.y}`)
  const size = pyramid.tileSize
  const x = ref.x * size
  const y = ref.y * size
  return { x, y, width: Math.min(size, level.width - x), height: Math.min(size, level.height - y) }
}

/** Dónde se dibuja la tesela, en píxeles del nivel 0 */
export function tileWorldRect(pyramid: TilePyramid, ref: TileRef): Rect {
  const r = tileRect(pyramid, ref)
  const k = 2 ** ref.level
  return { x: r.x * k, y: r.y * k, width: r.width * k, height: r.height * k }
}
