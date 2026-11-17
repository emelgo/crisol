/**
 * Medir en un mapa (módulo 9): la distancia de unos tramos (o de una ruta entera) con la escala del mapa, y los días que
 * se tarda a pie, a caballo y en barco con lo que se anda en un día. Puras, para la regla y sus pruebas
 */
import type { MapView } from '@crisol/contracts'
import type { Point } from './edit.ts'
import type { Size } from './geometry.ts'

export type Scale = NonNullable<MapView['scale']>
export type Speeds = MapView['speeds']

/** Lo largo de unos tramos en píxeles de la imagen */
export function pixelLength(points: readonly Point[], image: Size) {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Point
    const b = points[i] as Point
    total += Math.hypot((b[0] - a[0]) * image.width, (b[1] - a[1]) * image.height)
  }
  return total
}

/** Lo que miden de verdad unos tramos, en la unidad de la escala; sin escala, null */
export function distanceOf(points: readonly Point[], image: Size, scale: Scale | null) {
  if (!scale) return null
  return (pixelLength(points, image) * scale.value) / scale.length
}

/** La escala que sale de una raya de dos puntos que mide `value` de verdad */
export function scaleFrom(a: Point, b: Point, image: Size, value: number, unit: string): Scale | null {
  const length = pixelLength([a, b], image)
  if (!(length > 0) || !(value > 0)) return null
  return { length, value, unit }
}

/** Los días de viaje con cada velocidad (redondeados; con algo de camino, al menos medio día se dice «menos de uno») */
export function travelDays(distance: number, speeds: Speeds) {
  const days = (speed: number) => distance / speed
  return { foot: days(speeds.foot), horse: days(speeds.horse), ship: days(speeds.ship) }
}

/** Una cifra de días como se dice en la mesa: «menos de 1», o redondeada */
export function roundDays(days: number): { lessThanOne: boolean; days: number } {
  if (days > 0 && days < 0.5) return { lessThanOne: true, days: 1 }
  return { lessThanOne: false, days: Math.round(days) }
}

/** Una distancia como se dice: sin decimales desde 100; con uno, por debajo */
export const roundDistance = (distance: number) =>
  distance >= 100 ? Math.round(distance) : Math.round(distance * 10) / 10

/**
 * La barra de escala del mapa (abajo a la izquierda): un número redondo de unidades (1, 2 o 5 por una potencia de diez)
 * cuya raya mida cerca de `target` píxeles en pantalla, con `pixelsPerUnit` (lo que mide una unidad, a la escala de ahora)
 */
export function scaleBar(pixelsPerUnit: number, target = 110): { units: number; width: number } | null {
  if (!(pixelsPerUnit > 0) || !Number.isFinite(pixelsPerUnit)) return null
  const raw = target / pixelsPerUnit
  const power = 10 ** Math.floor(Math.log10(raw))
  // El redondo más cercano (en proporción) a lo que mediría la raya justa
  const closest = [1, 2, 5, 10].reduce((best, each) =>
    Math.abs(Math.log((each * power) / raw)) < Math.abs(Math.log((best * power) / raw)) ? each : best
  )
  const units = Number((closest * power).toPrecision(12))
  return { units, width: Math.round(units * pixelsPerUnit) }
}
