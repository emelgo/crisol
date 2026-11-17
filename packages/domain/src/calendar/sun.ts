/**
 * El sol de un día del mundo (docs/specs/modulo-8-10-campana.md, decisión 15): salida, puesta, alba y anochecer
 * (crepúsculo civil: el sol 6° bajo el horizonte), horas de luz y día o noche polar, a partir de la latitud de la
 * campaña y del solsticio de invierno del calendario (la mitad de su estación «Invierno»). Como en la Tierra, con días
 * de 24 horas y el mediodía a las 12. Solo informa: no mueve la oscuridad de las escenas.
 *
 * Origen: el sol del Crisol antiguo (código de Enrique, `~/crisol-app`, commit e5a72bb,
 * `packages/core/src/calendar/sun.ts`), con nombres en inglés; la latitud viene de la campaña y el solsticio, de las
 * estaciones del calendario (no se guardan en él)
 */

import { dayOfYear, yearLength } from './dates.ts'
import type { CalendarDefinition, WorldDate } from './definition.ts'
import { winterSolsticeDay } from './weather.ts'

export interface SunTimes {
  /** Minutos desde la medianoche; null en la noche o el día polar */
  sunrise: number | null
  sunset: number | null
  dawn: number | null
  dusk: number | null
  /** Minutos de sol */
  daylight: number
  /** Sin salida ni puesta: sol todo el día o nada */
  polar: 'day' | 'night' | null
}

/** La latitud de una campaña nueva */
export const DEFAULT_LATITUDE = 45
/** La inclinación del eje, como la de la Tierra */
export const AXIAL_TILT = 23.44

const rad = (degrees: number) => (degrees * Math.PI) / 180

/** Medio arco del sol (en minutos) hasta que baja `below` grados del horizonte; si no llega (o no pasa), cuál */
function halfArc(latitude: number, declination: number, below: number): number | 'day' | 'night' {
  const cosine =
    (Math.sin(rad(-below)) - Math.sin(rad(latitude)) * Math.sin(declination)) /
    (Math.cos(rad(latitude)) * Math.cos(declination))
  if (cosine <= -1) return 'day'
  if (cosine >= 1) return 'night'
  return ((Math.acos(cosine) * 180) / Math.PI) * 4
}

export function sunTimes(def: CalendarDefinition, date: WorldDate, latitude: number, axialTilt = AXIAL_TILT): SunTimes {
  const length = yearLength(def, date.year)
  // La declinación es mínima en el solsticio de invierno (en el sur, el de su verano)
  const declination =
    -rad(axialTilt) * Math.cos((2 * Math.PI * (dayOfYear(def, date) - winterSolsticeDay(def))) / length)
  const noon = 12 * 60
  // Los polos exactos no tienen horizonte que cruzar: casi en ellos
  const lat = Math.max(-89.9, Math.min(89.9, latitude))
  const arc = halfArc(lat, declination, 0.833)
  const twilight = halfArc(lat, declination, 6)
  if (typeof arc !== 'number')
    return {
      sunrise: null,
      sunset: null,
      dawn: typeof twilight === 'number' ? Math.round(noon - twilight) : null,
      dusk: typeof twilight === 'number' ? Math.round(noon + twilight) : null,
      daylight: arc === 'day' ? 24 * 60 : 0,
      polar: arc
    }
  return {
    sunrise: Math.round(noon - arc),
    sunset: Math.round(noon + arc),
    dawn: typeof twilight === 'number' ? Math.round(noon - twilight) : null,
    dusk: typeof twilight === 'number' ? Math.round(noon + twilight) : null,
    daylight: Math.round(2 * arc),
    polar: null
  }
}
