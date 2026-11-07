// Portado de packages/mesa/src/nucleo/estiramiento.ts (Crisol actual, commit 3f68f11)
/**
 * Estiramiento del mapa: la imagen se nivela girándola sobre su centro y se estira por un eje para que una rejilla
 * regular encaje en la impresa. El mundo empieza en la esquina de la caja que contiene la imagen girada.
 */
import type { Point, Size } from './geometry.ts'

export interface MapStretch {
  x: number
  y: number
  /** Grados que la imagen está girada en el sentido de las agujas del reloj; el dibujo los deshace */
  rotation: number
}

export const NO_STRETCH: MapStretch = Object.freeze({ x: 1, y: 1, rotation: 0 })
export const MAX_STRETCH = 1.5
export const MAX_ROTATION = 5

/** El estiramiento guardado (`{x, y, rotation}`); lo que no sea un par de factores y un giro en rango es ninguno */
export function toStretch(value: unknown): MapStretch {
  if (typeof value !== 'object' || value === null) return NO_STRETCH
  const { x, y, rotation } = value as { x?: unknown; y?: unknown; rotation?: unknown }
  const factor = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= MAX_STRETCH
  if (!factor(x) || !factor(y)) return NO_STRETCH
  const turn =
    typeof rotation === 'number' && Number.isFinite(rotation) && Math.abs(rotation) <= MAX_ROTATION ? rotation : 0
  return { x, y, rotation: turn }
}

/** Seno y coseno del giro que deshace el de la imagen, y la caja que la contiene ya nivelada (en píxeles de la imagen) */
function leveled(image: Size, rotation: number): { cos: number; sin: number; box: Size } {
  const angle = (-rotation * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const box = {
    width: Math.abs(image.width * cos) + Math.abs(image.height * sin),
    height: Math.abs(image.width * sin) + Math.abs(image.height * cos)
  }
  return { cos, sin, box }
}

/** Tamaño del mundo de una imagen dibujada con ese estiramiento */
export function worldSize(image: Size, stretch: MapStretch): Size {
  const { box } = leveled(image, stretch.rotation)
  return { width: box.width * stretch.x, height: box.height * stretch.y }
}

/** Dónde cae en el mundo un píxel de la imagen */
export function imageToWorld(p: Point, image: Size, stretch: MapStretch): Point {
  const { cos, sin, box } = leveled(image, stretch.rotation)
  const dx = p.x - image.width / 2
  const dy = p.y - image.height / 2
  const x = dx * cos - dy * sin + box.width / 2
  const y = dx * sin + dy * cos + box.height / 2
  return { x: x * stretch.x, y: y * stretch.y }
}

/** El píxel de la imagen que cae en un punto del mundo */
export function worldToImage(p: Point, image: Size, stretch: MapStretch): Point {
  const { cos, sin, box } = leveled(image, stretch.rotation)
  const x = p.x / stretch.x - box.width / 2
  const y = p.y / stretch.y - box.height / 2
  return { x: x * cos + y * sin + image.width / 2, y: -x * sin + y * cos + image.height / 2 }
}

/**
 * Dónde queda un punto del mundo cuando el mapa pasa de dibujarse con `from` a con `to`: sobre el mismo píxel de la
 * imagen. Sirve para llevar con el mapa lo colocado en él (fichas, muros, luces, niebla…).
 */
export const followMap =
  (image: Size, from: MapStretch, to: MapStretch) =>
  (p: Point): Point =>
    imageToWorld(worldToImage(p, image, from), image, to)
