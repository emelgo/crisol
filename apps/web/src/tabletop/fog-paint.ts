/**
 * La niebla al pintarla (docs/specs/vision.md, decisión 5): las máscaras de la rejilla de bits (lo explorado y lo
 * visible) pasan a una imagen pequeña, una celda por píxel, que el lienzo estira con suavizado; antes se desenfoca para
 * que el borde sea blando y no de casillas. En la tele, lo no explorado negro (sin aclararse nunca: no asoma el mapa),
 * lo explorado en gris oscuro y lo visible con su luz (la oscuridad lo sombrea y cada luz le da su brillo); en la mesa
 * del máster, atenuado, para que sepa qué ve la tele. Y qué teselas pide la tele: solo las que tocan lo que ve o vio,
 * las de a medias con una huella de lo que dejan ver (si se recortan en el servidor, cambian al explorar). Puro
 */
import { FogGrid, type Point, type Rect, type TilePyramid, tileWorldRect } from '@crisol/tabletop'

type Rgba = readonly [number, number, number, number]

/** Los colores de cada parte: lo no explorado y lo explorado que no se ve */
export const FOG_LOOKS: Record<'screen' | 'master', { unexplored: Rgba; explored: Rgba }> = {
  screen: { unexplored: [0, 0, 0, 255], explored: [9, 10, 14, 184] },
  master: { unexplored: [5, 6, 10, 184], explored: [5, 6, 10, 100] }
}

export type FogLook = keyof typeof FOG_LOOKS

/** Una luz que alumbra lo que ve el grupo (la de la tele), con sus radios en píxeles del mapa */
export interface FogLight {
  color: string
  intensity: number
  bright: number
  dim: number
  origin: Point | null
  cells: FogGrid
}

export interface FogImage {
  columns: number
  rows: number
  /** RGBA, una celda por píxel */
  pixels: Uint8ClampedArray<ArrayBuffer>
  /** El brillo de las luces (RGBA), o null sin luces */
  glow: Uint8ClampedArray<ArrayBuffer> | null
}

/** Cuánto oscurece la noche cerrada lo que se ve sin luz */
const SHADE = 0.6
/** Cuánto brilla una luz entera */
const GLOW = 0.32
/** Lo que alumbra una luz cuyo centro no se ve */
const FAR_LIGHT = 0.6

const hex = (color: string): [number, number, number] => {
  const value = Number.parseInt(color.replace('#', ''), 16)
  return Number.isFinite(value) ? [(value >> 16) & 255, (value >> 8) & 255, value & 255] : [255, 200, 140]
}

/** Cuánto alumbra una luz una celda (de 0 a 1): entera en lo brillante, a la mitad en el borde de lo tenue */
function litBy(light: FogLight, x: number, y: number): number {
  if (!light.origin) return FAR_LIGHT
  const d = Math.hypot(x - light.origin.x, y - light.origin.y)
  if (d <= light.bright) return 1
  const span = Math.max(1, light.dim - light.bright)
  return Math.max(0.5, 1 - (0.5 * (d - light.bright)) / span)
}

/** Lo que alumbra cada celda (la más fuerte de las luces que llegan) y de qué color */
function lighting(columns: number, rows: number, cellSize: number, lights: readonly FogLight[]) {
  const level = new Float32Array(columns * rows)
  const color = new Uint8ClampedArray(columns * rows * 3)
  for (const light of lights) {
    if (light.cells.columns !== columns || light.cells.rows !== rows) continue
    const [r, g, b] = hex(light.color)
    light.cells.forEachRun((row, c0, c1) => {
      for (let c = c0; c <= c1; c++) {
        const lit =
          litBy(light, (c + 0.5) * cellSize, (row + 0.5) * cellSize) * Math.max(0, Math.min(1, light.intensity))
        const i = row * columns + c
        if (lit <= (level[i] as number)) continue
        level[i] = lit
        color[i * 3] = r
        color[i * 3 + 1] = g
        color[i * 3 + 2] = b
      }
    })
  }
  return { level, color }
}

/** Un desenfoque de caja (en las dos direcciones, con el borde repetido) de una imagen RGBA */
export function soften<T extends Uint8ClampedArray<ArrayBuffer> | Float32Array<ArrayBuffer>>(
  pixels: T,
  columns: number,
  rows: number,
  radius: number
): T {
  if (radius <= 0) return pixels
  const span = 2 * radius + 1
  const pass = (from: T, horizontal: boolean): T => {
    const to = (from instanceof Float32Array ? new Float32Array(from.length) : new Uint8ClampedArray(from.length)) as T
    const length = horizontal ? columns : rows
    const lines = horizontal ? rows : columns
    const index = (line: number, k: number) =>
      (horizontal
        ? line * columns + Math.max(0, Math.min(columns - 1, k))
        : Math.max(0, Math.min(rows - 1, k)) * columns + line) * 4
    for (let line = 0; line < lines; line++)
      for (let channel = 0; channel < 4; channel++) {
        let sum = 0
        for (let k = -radius; k <= radius; k++) sum += from[index(line, k) + channel] as number
        for (let k = 0; k < length; k++) {
          to[index(line, k) + channel] = sum / span
          sum +=
            (from[index(line, k + radius + 1) + channel] as number) -
            (from[index(line, k - radius) + channel] as number)
        }
      }
    return to
  }
  return pass(pass(pixels, true), false)
}

/**
 * La imagen de la niebla: `soften` celdas de desenfoque (en la tele, lo no explorado se queda negro del todo); con
 * `darkness` y `lights` (la tele), lo visible se sombrea donde no llega la luz y las luces dan su brillo
 */
export function fogImage(
  explored: FogGrid,
  visible: FogGrid,
  look: FogLook,
  options: { soften?: number; darkness?: number; lights?: readonly FogLight[] } = {}
): FogImage {
  const { columns, rows, cellSize } = explored
  const colors = FOG_LOOKS[look]
  const lights = options.lights ?? []
  const darkness = Math.max(0, Math.min(1, options.darkness ?? 0))
  const light = lights.length > 0 || darkness > 0 ? lighting(columns, rows, cellSize, lights) : null
  const pixels = new Uint8ClampedArray(columns * rows * 4)
  const opaque = new Uint8Array(columns * rows)
  for (let row = 0; row < rows; row++)
    for (let c = 0; c < columns; c++) {
      const i = row * columns + c
      const at = i * 4
      if (visible.get(c, row)) {
        if (light) pixels[at + 3] = 255 * SHADE * darkness * (1 - (light.level[i] as number))
        continue
      }
      const color = explored.get(c, row) ? colors.explored : colors.unexplored
      pixels.set(color, at)
      if (color[3] === 255) opaque[i] = 1
    }
  const radius = options.soften ?? 2
  const soft = soften(pixels, columns, rows, radius)
  // Lo que es negro del todo sigue siéndolo: el suavizado entra en lo visible, no saca el mapa de la niebla
  for (let i = 0; i < opaque.length; i++) if (opaque[i]) soft.set(colors.unexplored, i * 4)
  let glow: Uint8ClampedArray<ArrayBuffer> | null = null
  if (light && lights.length > 0) {
    // Se desenfoca premultiplicado (el color por su alfa) para que el borde no se ensucie de negro
    const premultiplied = new Float32Array(columns * rows * 4)
    for (let i = 0; i < columns * rows; i++) {
      const level = light.level[i] as number
      if (level <= 0 || !visible.get(i % columns, Math.floor(i / columns))) continue
      const alpha = GLOW * level
      for (let k = 0; k < 3; k++) premultiplied[i * 4 + k] = (light.color[i * 3 + k] as number) * alpha
      premultiplied[i * 4 + 3] = 255 * alpha
    }
    const blurred = soften(premultiplied, columns, rows, radius + 1)
    glow = new Uint8ClampedArray(blurred.length)
    for (let i = 0; i < columns * rows; i++) {
      const alpha = blurred[i * 4 + 3] as number
      // Fuera de lo visible no brilla (no aclara la niebla)
      if (alpha === 0 || !visible.get(i % columns, Math.floor(i / columns))) continue
      for (let k = 0; k < 3; k++) glow[i * 4 + k] = ((blurred[i * 4 + k] as number) * 255) / alpha
      glow[i * 4 + 3] = alpha
    }
  }
  return { columns, rows, pixels: soft, glow }
}

/** Las celdas de la niebla que tocan un rectángulo del mapa */
function cellsOf(mask: FogGrid, rect: Rect) {
  const s = mask.cellSize
  return {
    c0: Math.max(0, Math.floor(rect.x / s)),
    r0: Math.max(0, Math.floor(rect.y / s)),
    c1: Math.min(mask.columns - 1, Math.ceil((rect.x + rect.width) / s) - 1),
    r1: Math.min(mask.rows - 1, Math.ceil((rect.y + rect.height) / s) - 1)
  }
}

/** Cuánto de un rectángulo cae en la máscara: nada, una parte o entero (como lo decide el servidor) */
export function tileCoverage(mask: FogGrid, rect: Rect): 'none' | 'partial' | 'full' {
  const { c0, r0, c1, r1 } = cellsOf(mask, rect)
  let on = 0
  let off = 0
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) {
      if (mask.get(c, r)) on++
      else off++
      if (on > 0 && off > 0) return 'partial'
    }
  return on === 0 ? 'none' : off === 0 ? 'full' : 'partial'
}

/** Una huella (FNV-1a) de lo que la máscara deja ver en un rectángulo */
export function tileSignature(mask: FogGrid, rect: Rect): string {
  const { c0, r0, c1, r1 } = cellsOf(mask, rect)
  let hash = 0x811c9dc5
  const mix = (value: number) => {
    hash ^= value
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  for (let r = r0; r <= r1; r++) {
    mix(r)
    for (let c = c0; c <= c1; c++) if (mask.get(c, r)) mix(c + 1)
  }
  return hash.toString(36)
}

/**
 * Las direcciones de las teselas de la tele con su máscara (lo explorado y lo visible): ninguna para las que no la
 * tocan (el servidor no las da), la de siempre para las enteras y, para las de a medias, con su huella
 */
export function maskTileUrl(
  base: (level: number, x: number, y: number) => string,
  mask: FogGrid,
  pyramid: TilePyramid
): (level: number, x: number, y: number) => string | null {
  return (level, x, y) => {
    const rect = tileWorldRect(pyramid, { level, x, y })
    const coverage = tileCoverage(mask, rect)
    if (coverage === 'none') return null
    const url = base(level, x, y)
    return coverage === 'full' ? url : `${url}?m=${tileSignature(mask, rect)}`
  }
}

/** Una máscara tal como llega (`FogGrid.encode()` en base64) */
export function decodeMask(base64: string): FogGrid {
  return FogGrid.decode(Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)))
}

/** La capa que pinta el lienzo, de una imagen de la niebla */
export const fogLayerOf = (pixels: Uint8ClampedArray<ArrayBuffer>, mask: FogGrid) => ({
  columns: mask.columns,
  rows: mask.rows,
  cellSize: mask.cellSize,
  pixels
})
