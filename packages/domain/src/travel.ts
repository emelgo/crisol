/**
 * Los viajes (docs/specs/modulo-8-10-campana.md, decisiones 17 y 18): de una distancia, el medio (lo que se anda en un
 * día, de los `speeds` del mapa), el ritmo y los días de descanso salen los días de viaje. Los ritmos del sistema no se
 * usan en esta versión
 */

export const TRAVEL_MEDIUMS = ['foot', 'horse', 'ship'] as const
export type TravelMedium = (typeof TRAVEL_MEDIUMS)[number]

export const TRAVEL_PACES = ['slow', 'normal', 'fast'] as const
export type TravelPace = (typeof TRAVEL_PACES)[number]

/** Cuánto se anda con cada ritmo respecto al normal */
export const PACE_FACTOR: Record<TravelPace, number> = { slow: 0.67, normal: 1, fast: 1.33 }

/** Los días de un viaje: los de camino (con decimales) y los que pasan, redondeados hacia arriba y con el descanso */
export interface TravelPlan {
  travelDays: number
  days: number
}

export function planTravel(input: { distance: number; speed: number; pace: TravelPace; restDays: number }): TravelPlan {
  const travelDays = input.distance / (input.speed * PACE_FACTOR[input.pace])
  // Lo que se pierde al redondear las medidas no suma un día
  const walked = input.distance > 0 ? Math.max(1, Math.ceil(travelDays - 1e-9)) : 0
  return { travelDays: Math.round(travelDays * 100) / 100, days: walked + Math.max(0, Math.trunc(input.restDays)) }
}
