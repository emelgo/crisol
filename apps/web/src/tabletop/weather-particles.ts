/**
 * Las partículas de la capa de clima de la Mesa (docs/specs/modulo-8-10-campana.md, decisión 16): sin estado, cada una
 * sale de la semilla y del tiempo, así que la Mesa, la jugadora y la Vista de jugadores pintan lo mismo sin sincronizar
 * nada. Lluvia (trazos inclinados por el viento), nieve (copos que bajan meciéndose), niebla (bancos grandes y suaves
 * que se arrastran) y ceniza (motas grises que flotan y titilan). Sin PixiJS: se prueba aparte
 */
import type { WeatherLayerView } from '@crisol/contracts'

export interface Particle {
  x: number
  y: number
  /** El radio (o, en la lluvia, el grosor del trazo) */
  size: number
  alpha: number
  /** El trazo de la lluvia: hacia dónde va (0 en lo demás) */
  dx: number
  dy: number
}

/** Cuántas caben en un millón de píxeles a toda intensidad */
const DENSITY: Record<WeatherLayerView['kind'], number> = { rain: 420, snow: 300, fog: 10, ash: 160 }
/** Tope por si la pantalla es enorme */
const MAX: Record<WeatherLayerView['kind'], number> = { rain: 900, snow: 700, fog: 28, ash: 360 }

/** Un número de 0 a 1 que solo depende de la semilla, la partícula y qué se pide de ella */
function hash(seed: number, index: number, salt: number): number {
  let h = (seed * 374761393 + index * 668265263 + salt * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const wrap = (value: number, span: number) => ((value % span) + span) % span

/** Cuántas partículas lleva una capa en una pantalla de ese tamaño */
export function particleCount(layer: WeatherLayerView, width: number, height: number): number {
  const area = (Math.max(0, width) * Math.max(0, height)) / 1_000_000
  const wanted = Math.round(DENSITY[layer.kind] * Math.max(0, Math.min(1, layer.intensity)) * Math.max(area, 0.3))
  return Math.min(MAX[layer.kind], wanted)
}

/** Las partículas de una capa en un momento (time, en segundos) y en una pantalla de ese tamaño */
export function particlesAt(
  layer: WeatherLayerView,
  size: { width: number; height: number },
  time: number,
  seed = 1
): Particle[] {
  const { width, height } = size
  if (width <= 0 || height <= 0) return []
  const count = particleCount(layer, width, height)
  const wind = Math.max(0, Math.min(1, layer.wind))
  const out: Particle[] = []
  for (let i = 0; i < count; i++) {
    const a = hash(seed, i, 1)
    const b = hash(seed, i, 2)
    const c = hash(seed, i, 3)
    const d = hash(seed, i, 4)
    if (layer.kind === 'rain') {
      // Caen deprisa y en diagonal con el viento; el trazo, más largo cuanto más rápidas
      const speed = 900 + c * 700
      const drift = wind * 0.75
      const span = height + 80
      const fall = wrap(b * span + speed * time, span) - 40
      const x = wrap(a * (width + 200) + fall * drift, width + 200) - 100
      const length = 12 + c * 14
      out.push({ x, y: fall, size: 1 + d * 0.6, alpha: 0.25 + d * 0.35, dx: drift * length, dy: length })
    } else if (layer.kind === 'snow') {
      // Bajan despacio y se mecen; el viento las arrastra de lado
      const speed = 35 + c * 55
      const span = height + 20
      const fall = wrap(b * span + speed * time, span) - 10
      const sway = Math.sin(time * (0.6 + d) + a * 20) * (8 + d * 14)
      const x = wrap(a * width + sway + wind * speed * 1.4 * time, width)
      out.push({ x, y: fall, size: 1.2 + c * 2.4, alpha: 0.55 + d * 0.4, dx: 0, dy: 0 })
    } else if (layer.kind === 'ash') {
      // Flotan, suben y bajan un poco y titilan, como brasas apagadas
      const speed = 10 + c * 22
      const span = height + 20
      const fall = wrap(b * span + speed * time, span) - 10
      const x = wrap(a * width + Math.sin(time * 0.4 + d * 9) * 18 + wind * 40 * time, width)
      const flicker = 0.5 + 0.5 * Math.sin(time * (1.5 + d * 2) + a * 30)
      out.push({ x, y: fall, size: 1 + c * 2, alpha: 0.25 + flicker * 0.45, dx: 0, dy: 0 })
    } else {
      // La niebla: bancos grandes que se arrastran con el viento y respiran
      const radius = Math.max(width, height) * (0.18 + c * 0.22)
      const x = wrap(a * (width + radius * 2) + (6 + wind * 30) * time, width + radius * 2) - radius
      const y = b * height + Math.sin(time * 0.05 + d * 6) * 30
      const breath = 0.5 + 0.5 * Math.sin(time * 0.15 + a * 12)
      out.push({ x, y, size: radius, alpha: 0.05 + breath * 0.07, dx: 0, dy: 0 })
    }
  }
  return out
}
