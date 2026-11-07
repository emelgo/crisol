// Portado de packages/mesa/src/nucleo/luz.ts (Crisol actual, commit 3f68f11), sin las animaciones (light-animation.ts)
/**
 * Las luces de una escena y la oscuridad: radios brillante y tenue en píxeles, color, intensidad, un cono si se quiere
 * y si las cortan los muros; las de oscuridad mágica. Cómo cae la luz con la distancia, lo que unos ojos sacan de ella
 * (con su umbral de iluminado y con visión en la oscuridad) y hasta dónde se ve una luz. Puro: sin DOM ni render.
 */
import type { Point } from './geometry.ts'
import { type Cone, type EdgeSource, visibilityPolygon } from './vision.ts'

export interface Light {
  id: string
  x: number
  y: number
  /** Radios en píxeles del mundo */
  bright: number
  dim: number
  /** `#rrggbb` */
  color: string
  /** 0–1 */
  intensity: number
  /** Abertura en grados: 360 alumbra alrededor */
  angle: number
  /** Hacia dónde mira el cono (grados; 0 arriba, 90 a la derecha) */
  rotation: number
  /** La cortan los muros que paran la luz */
  walls: boolean
  /** Oscuridad mágica: tapa en vez de alumbrar */
  darkness: boolean
  /** Solo se enciende cuando la luz ambiental baja de esto (0–1): una farola que se enciende de noche */
  activeBelowAmbient?: number
}

/** Desde cuánta luz ven algo los ojos (por debajo, oscuridad entera) */
export const LIT_THRESHOLD = 0.25
/** Hasta dónde se ve una luz en la imagen, respecto a su alcance tenue: pasado él se apaga poco a poco */
export const LIGHT_TAIL = 1.3
/** Desde cuánta luz se ve como brillante */
export const BRIGHT_LEVEL = 0.8
/** Lo iluminado en el borde brillante y en el tenue (0–1) */
const AT_BRIGHT = 0.8
const AT_DIM = 0.4

/** Píxeles del mundo de una distancia en unidades del juego (pies, metros) */
export const distanceToPixels = (units: number, unitsPerCell: number, cellSize: number): number =>
  unitsPerCell > 0 ? (units / unitsPerCell) * cellSize : units

/** La luz ambiental (0–1) de una escena con esa oscuridad (0 de día, 1 noche cerrada) */
export const ambientLight = (darkness: number): number => 1 - Math.min(1, Math.max(0, darkness))

/** El cono de una luz, o nada si alumbra alrededor */
export const lightCone = (light: Pick<Light, 'angle' | 'rotation'>): Cone | undefined =>
  light.angle > 0 && light.angle < 360 ? { angle: light.angle, rotation: light.rotation } : undefined

/** Las luces que alumbran ahora: sin las apagadas en la campaña y las que solo se encienden con menos luz ambiental */
export function activeLights(
  lights: readonly Light[],
  darkness: number,
  off: ReadonlySet<string> = new Set()
): Light[] {
  const ambient = ambientLight(darkness)
  return lights.filter((light) => {
    if (off.has(light.id) || !(Math.max(light.dim, light.bright) > 0)) return false
    const below = light.activeBelowAmbient ?? 1
    return below >= 1 || ambient <= below
  })
}

/**
 * Cuánto ilumina una luz a la distancia `d` (0 a oscuras, 1 a plena luz), como una llama a cierta altura sobre el
 * suelo: la luz cae con el cuadrado de la distancia a la llama, `E = E0 · h² / (h² + d²)`, y el ojo la satura con
 * suavidad, `1 − e^(−E)`. Altura y fuerza salen de que el borde brillante quede bien iluminado y el tenue en penumbra;
 * pasado el tenue se apaga del todo hasta `LIGHT_TAIL` veces su alcance. Sin escalones ni discos planos.
 */
export function illuminationAt(d: number, bright: number, dim: number): number {
  const end = Math.max(dim, bright)
  if (end <= 0 || d >= end * LIGHT_TAIL) return 0
  const eB = -Math.log(1 - AT_BRIGHT)
  const eD = -Math.log(1 - AT_DIM)
  let h2: number
  let e0: number
  if (bright > 0 && dim > bright) {
    const ratio = eB / eD
    h2 = Math.max((0.2 * dim) ** 2, (dim ** 2 - ratio * bright ** 2) / (ratio - 1))
    e0 = (eD * (h2 + dim ** 2)) / h2
  } else {
    // Solo brillante o solo tenue: su borde, como el de la luz que tiene
    h2 = (0.5 * end) ** 2
    e0 = ((bright > 0 ? eB : eD) * (h2 + end ** 2)) / h2
  }
  const e = (e0 * h2) / (h2 + d * d)
  // Pasado el tenue, una ventana suave hasta la cola
  const t = Math.min(1, Math.max(0, (d - end) / (end * (LIGHT_TAIL - 1))))
  const window = 1 - t * t * (3 - 2 * t)
  return (1 - Math.exp(-e)) * window
}

/**
 * Lo que unos ojos sacan de una luz: por debajo del umbral de iluminado es oscuridad y no se ve nada; por encima, la
 * luz que hay (tenue o brillante). Un borde suave (del 80 % al 100 % del umbral) evita escalones.
 */
export function perceivedLight(level: number, threshold: number): number {
  if (threshold <= 0) return level
  const t = Math.min(1, Math.max(0, (level - threshold * 0.8) / (threshold * 0.2)))
  return level * t * t * (3 - 2 * t)
}

/**
 * La luz tal como la ve quien tiene visión en la oscuridad: la tenue, como brillante; la oscuridad sigue oscura (se
 * pinta aparte, en blanco y negro). Con el mismo borde suave que `perceivedLight`.
 */
export function lightWithDarkvision(level: number, threshold: number): number {
  const t = threshold <= 0 ? 1 : Math.min(1, Math.max(0, (level - threshold * 0.8) / (threshold * 0.2)))
  return level + (Math.max(level, BRIGHT_LEVEL) - level) * t * t * (3 - 2 * t)
}

/** Hasta dónde se ve una luz con los ojos de los jugadores: donde su caída baja del umbral de iluminado */
export function perceivedReach(bright: number, dim: number, intensity: number, threshold: number): number {
  const end = Math.max(dim, bright) * LIGHT_TAIL
  const sees = (d: number): boolean =>
    perceivedLight(Math.min(1, intensity) * illuminationAt(d, bright, dim), threshold) > 0.01
  if (!sees(0)) return 0
  let a = 0
  let b = end
  for (let i = 0; i < 30; i++) {
    const m = (a + b) / 2
    if (sees(m)) a = m
    else b = m
  }
  return a
}

/** El radio que cuenta de una luz: el de la oscuridad mágica, su tenue; el de una luz, hasta donde se ve */
export const lightRadius = (light: Light, threshold = LIT_THRESHOLD): number =>
  light.darkness
    ? Math.max(light.dim, light.bright)
    : perceivedReach(light.bright, light.dim, light.intensity, threshold)

/** El área de una luz: hasta su radio, en su cono y, si la cortan, recortada por los tramos que paran la luz */
export function lightPolygon(light: Light, lightEdges: EdgeSource, threshold = LIT_THRESHOLD): Point[] {
  const radius = lightRadius(light, threshold)
  if (!(radius > 0)) return []
  return visibilityPolygon({ x: light.x, y: light.y }, light.walls ? lightEdges : [], radius, lightCone(light))
}
