// Portado de packages/mesa/src/nucleo/imagenes.ts (Crisol actual, commit 3f68f11)
/**
 * Imágenes sueltas sobre el mapa (un objeto o un decorado de la escena: un archivo del mundo), con su centro, su
 * tamaño en píxeles del mundo y su giro. Van debajo de las fichas o encima. Geometría pura: qué imagen hay bajo el
 * puntero, sus asas, cambiar su tamaño sin deformarla y girarla.
 */
import type { Point } from './geometry.ts'

export interface MapImage {
  id: string
  /** Centro, en píxeles del mundo */
  x: number
  y: number
  width: number
  height: number
  /** Grados, en el sentido de las agujas del reloj */
  rotation: number
  /** Encima de las fichas (si no, debajo) */
  above?: boolean | undefined
}

/** Lado menor de una imagen, en píxeles del mundo */
export const MIN_IMAGE_SIDE = 8

/** En el orden en que se pintan: las de debajo primero; dentro de cada grupo, por orden de llegada */
export const imagesInPaintOrder = <T extends Pick<MapImage, 'above'>>(images: readonly T[]): T[] => [
  ...images.filter((i) => !i.above),
  ...images.filter((i) => i.above)
]

const radians = (degrees: number): number => (degrees * Math.PI) / 180

/** Un punto del mundo en el marco de la imagen (origen en su centro, sin giro) */
export function imageToLocal(image: MapImage, p: Point): Point {
  const a = -radians(image.rotation)
  const dx = p.x - image.x
  const dy = p.y - image.y
  return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) }
}

/** Un punto del marco de la imagen en el mundo */
export function localToWorld(image: MapImage, p: Point): Point {
  const a = radians(image.rotation)
  return { x: image.x + p.x * Math.cos(a) - p.y * Math.sin(a), y: image.y + p.x * Math.sin(a) + p.y * Math.cos(a) }
}

export function insideImage(image: MapImage, p: Point, margin = 0): boolean {
  const l = imageToLocal(image, p)
  return Math.abs(l.x) <= image.width / 2 + margin && Math.abs(l.y) <= image.height / 2 + margin
}

/** La imagen de más arriba bajo un punto (la última que se pinta) */
export function imageAt<T extends MapImage>(images: readonly T[], p: Point): T | null {
  for (let i = images.length - 1; i >= 0; i--) {
    const image = images[i] as T
    if (insideImage(image, p)) return image
  }
  return null
}

/** Signos de cada esquina (arriba a la izquierda, arriba a la derecha, abajo a la derecha, abajo a la izquierda) */
const CORNERS: readonly Point[] = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 }
]

/** Las cuatro esquinas en el mundo */
export function imageCorners(image: MapImage): Point[] {
  return CORNERS.map((s) => localToWorld(image, { x: (s.x * image.width) / 2, y: (s.y * image.height) / 2 }))
}

/** El asa de giro: encima del centro del lado de arriba, a `distance` de él */
export function rotationHandle(image: MapImage, distance: number): Point {
  return localToWorld(image, { x: 0, y: -image.height / 2 - distance })
}

export type ImageHandle = { handle: 'size'; corner: number } | { handle: 'rotation' }

/** El asa bajo un punto (`radius` y `distance` en píxeles del mundo, ya divididos por el zoom) */
export function handleAt(image: MapImage, p: Point, radius: number, distance: number): ImageHandle | null {
  const turn = rotationHandle(image, distance)
  if (Math.hypot(p.x - turn.x, p.y - turn.y) <= radius) return { handle: 'rotation' }
  const corner = imageCorners(image).findIndex((c) => Math.hypot(p.x - c.x, p.y - c.y) <= radius)
  return corner >= 0 ? { handle: 'size', corner } : null
}

/**
 * Arrastrar una esquina: la opuesta se queda quieta y la imagen crece o mengua sin deformarse (`free`: sin guardar la
 * proporción). Da el centro y el tamaño nuevos
 */
export function resizeImage(
  image: MapImage,
  corner: number,
  p: Point,
  free = false
): Pick<MapImage, 'x' | 'y' | 'width' | 'height'> {
  const sign = CORNERS[corner] ?? (CORNERS[2] as Point)
  const fixed = localToWorld(image, { x: (-sign.x * image.width) / 2, y: (-sign.y * image.height) / 2 })
  // El punto, en el marco de la imagen, desde la esquina que no se mueve
  const anchored = { ...image, x: fixed.x, y: fixed.y }
  const l = imageToLocal(anchored, p)
  let width = Math.max(MIN_IMAGE_SIDE, l.x * sign.x)
  let height = Math.max(MIN_IMAGE_SIDE, l.y * sign.y)
  if (!free) {
    const k = Math.max(width / image.width, height / image.height, MIN_IMAGE_SIDE / Math.min(image.width, image.height))
    width = image.width * k
    height = image.height * k
  }
  const center = localToWorld(anchored, { x: (sign.x * width) / 2, y: (sign.y * height) / 2 })
  return { x: center.x, y: center.y, width, height }
}

/** El giro con el asa en `p`: hacia donde apunta desde el centro; de 15 en 15 grados (con `coarse`, de 45 en 45) */
export function rotationToward(image: MapImage, p: Point, coarse = false): number {
  const degrees = (Math.atan2(p.y - image.y, p.x - image.x) * 180) / Math.PI + 90
  const step = coarse ? 45 : 15
  const rotation = Math.round(degrees / step) * step
  return ((rotation % 360) + 360) % 360
}

/** El tamaño al ponerla: con su forma, el lado mayor de `cells` casillas */
export function initialImageSize(
  widthPx: number,
  heightPx: number,
  cell: number,
  cells = 2
): { width: number; height: number } {
  const side = cell * cells
  if (!(widthPx > 0) || !(heightPx > 0)) return { width: side, height: side }
  const k = side / Math.max(widthPx, heightPx)
  return { width: widthPx * k, height: heightPx * k }
}
