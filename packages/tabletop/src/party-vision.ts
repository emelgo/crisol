// Portado de packages/mesa/src/nucleo/visionJugadores.ts (Crisol actual, commit 3f68f11)
/**
 * Lo que ve cada ficha del grupo: su línea de visión (recortada por los muros que paran la vista, con su alcance y su
 * cono) y sus sentidos, que llegan ya como datos en píxeles (los lee el servidor del sistema de la campaña): visión en la
 * oscuridad, vista ciega o verdadera y sentido sísmico. La oscuridad mágica tapa la vista (no se ve dentro ni a través)
 * salvo a la vista ciega o verdadera. Puro: sin DOM ni render.
 */
import type { Point } from './geometry.ts'
import type { Light } from './light.ts'
import { lightPolygon } from './light.ts'
import { type Cone, type EdgeSource, visibilityPolygon } from './vision.ts'
import type { Edge } from './walls.ts'

/** Los sentidos de una ficha, con su alcance en píxeles del mundo */
export interface Senses {
  darkvision?: number
  blindsight?: number
  truesight?: number
  /** Nota las criaturas a su alcance a través de los muros, sin verlas ni ver el mapa */
  tremorsense?: number
}

export interface PartyToken {
  id: string
  x: number
  y: number
  /** Radio de su huella en píxeles: cada ficha se ve a sí misma aunque esté a oscuras */
  radius?: number
  /** Alcance de su vista en píxeles; sin él, sin límite */
  range?: number
  /** Abertura de su vista en grados (360 alrededor) y hacia dónde mira (0 arriba, 90 a la derecha) */
  angle?: number
  rotation?: number
  senses?: Senses
}

/** Lo que ve una ficha: su polígono y, en píxeles, hasta dónde llega cada sentido */
export interface TokenSight {
  id: string
  origin: Point
  polygon: Point[]
  darkvision: number
  /** Vista ciega o verdadera: ve sin luz y dentro de la oscuridad mágica */
  beyondDarkness: number
  footprint: number
  tremorsense: number
}

const positive = (v: number | undefined): number => (typeof v === 'number' && v > 0 ? v : 0)

/** Si la ficha ve dentro de la oscuridad mágica (vista ciega o verdadera) */
export const seesInMagicalDarkness = (senses: Senses | undefined): boolean =>
  positive(senses?.blindsight) > 0 || positive(senses?.truesight) > 0

/** Las zonas de oscuridad mágica: el área de cada luz de oscuridad, recortada por los muros que paran la luz */
export function darknessZones(lights: readonly Light[], lightEdges: EdgeSource): Point[][] {
  return lights
    .filter((light) => light.darkness)
    .map((light) => lightPolygon(light, lightEdges))
    .filter((zone) => zone.length >= 3)
}

/** El borde de las zonas de oscuridad mágica como tramos que paran la vista: no se ve a través de ella */
export function darknessEdges(zones: readonly (readonly Point[])[]): Edge[] {
  return zones.flatMap((zone) =>
    zone.map((a, i) => ({ a, b: zone[(i + 1) % zone.length] as Point, limited: false, pass: null }))
  )
}

/**
 * Lo que ve una ficha: con la vista que no atraviesa la oscuridad mágica (`withDarkness`, con sus bordes) o, si tiene
 * vista ciega o verdadera, con la de solo los muros (`plain`). Sin alcance, ve hasta `unlimited`.
 */
export function tokenSight(
  token: PartyToken,
  sight: { plain: EdgeSource; withDarkness: EdgeSource },
  unlimited = 1e6
): TokenSight {
  const origin = { x: token.x, y: token.y }
  const range = positive(token.range) || unlimited
  const angle = token.angle ?? 360
  const cone: Cone | undefined = angle > 0 && angle < 360 ? { angle, rotation: token.rotation ?? 0 } : undefined
  const senses = token.senses
  const source = seesInMagicalDarkness(senses) ? sight.plain : sight.withDarkness
  return {
    id: token.id,
    origin,
    polygon: visibilityPolygon(origin, source, range, cone),
    darkvision: Math.min(range, positive(senses?.darkvision)),
    beyondDarkness: Math.max(positive(senses?.blindsight), positive(senses?.truesight)),
    footprint: positive(token.radius),
    tremorsense: positive(senses?.tremorsense)
  }
}
