/**
 * Las cuentas de lo dibujado en un mapa (módulo 9), en píxeles de la imagen: el trazado de una región o una ruta, dónde
 * va el nombre de una región y el arco de un texto. Funciones puras, para el visor y sus pruebas
 */
import type { MapElementView, MapLayerView } from '@crisol/contracts'

export type Point = readonly [number, number]
export type Size = { width: number; height: number }

/** De 0–1 a píxeles de la imagen */
export const toPixels = (point: readonly number[], size: Size): Point => [
  (point[0] ?? 0) * size.width,
  (point[1] ?? 0) * size.height
]

const fixed = (value: number) => Math.round(value * 10) / 10

/** El trazado SVG de una línea (abierta) o de un anillo (cerrado) */
export function pathOf(points: readonly (readonly number[])[], size: Size, closed: boolean) {
  const [first, ...rest] = points.map((point) => toPixels(point, size))
  if (!first) return ''
  const head = `M${fixed(first[0])} ${fixed(first[1])}`
  const tail = rest.map(([x, y]) => `L${fixed(x)} ${fixed(y)}`).join('')
  return `${head}${tail}${closed ? 'Z' : ''}`
}

/** El área (con signo) y el centro de gravedad de un anillo en píxeles */
function ringCentroid(ring: readonly Point[]) {
  let area = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i] as Point
    const [x1, y1] = ring[(i + 1) % ring.length] as Point
    const cross = x0 * y1 - x1 * y0
    area += cross
    cx += (x0 + x1) * cross
    cy += (y0 + y1) * cross
  }
  area /= 2
  if (Math.abs(area) < 1e-9) {
    // Degenerado (todos en línea): la media de sus puntos
    const n = ring.length || 1
    return { area: 0, at: [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n] as Point }
  }
  return { area, at: [cx / (6 * area), cy / (6 * area)] as Point }
}

/** Dónde va el nombre de una región: el centro de su pieza más grande */
export function regionLabelAt(pieces: readonly (readonly (readonly number[])[])[], size: Size): Point {
  let best: { area: number; at: Point } | null = null
  for (const piece of pieces) {
    const found = ringCentroid(piece.map((point) => toPixels(point, size)))
    if (!best || Math.abs(found.area) > Math.abs(best.area)) best = { area: found.area, at: found.at }
  }
  return best?.at ?? [0, 0]
}

/**
 * El arco de un texto: una curva de su ancho (aproximado por sus letras) centrada en `at`, que se dobla hacia arriba
 * (arc > 0) o hacia abajo (arc < 0); recto, una línea
 */
export function arcPath(at: Point, text: string, fontSize: number, arc: number) {
  const half = Math.max(fontSize, text.length * fontSize * 0.3)
  const [x, y] = at
  const bend = -arc * half
  return `M${fixed(x - half)} ${fixed(y)}Q${fixed(x)} ${fixed(y + bend * 2)} ${fixed(x + half)} ${fixed(y)}`
}

/** El tamaño de letra en píxeles de la imagen: el estilo dice el que tendría en una imagen de 1000 de ancho */
export const fontPixels = (size: number | undefined, image: Size, fallback: number) =>
  ((size ?? fallback) * image.width) / 1000

/** Lo dibujado en el orden en que se pinta: por capas (de abajo arriba) y, dentro de cada una, como viene */
export function paintOrder(elements: readonly MapElementView[], layers: readonly MapLayerView[]) {
  const rank = new Map(layers.map((layer, index) => [layer.id, index]))
  return elements
    .map((element, index) => ({ element, index, layer: element.layerId ? (rank.get(element.layerId) ?? 0) : 0 }))
    .sort((a, b) => a.layer - b.layer || a.index - b.index)
    .map(({ element }) => element)
}
