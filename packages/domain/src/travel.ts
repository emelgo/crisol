/**
 * Los viajes (docs/specs/modulo-8-10-campana.md, decisiones 17, 18 y 30): de una distancia, el medio (lo que se anda
 * en un día, de los `speeds` del mapa), el ritmo y los días de descanso (repartidos por el camino) salen los días de
 * viaje. Los ritmos del sistema no se usan en esta versión
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
  /** Qué es cada día que pasa: de camino o de descanso */
  schedule: Array<'travel' | 'rest'>
}

/** Los días de descanso repartidos entre los de camino (cada uno tras su parte del camino; nunca antes de salir) */
export function restSchedule(walked: number, rest: number): Array<'travel' | 'rest'> {
  const schedule: Array<'travel' | 'rest'> = []
  let placed = 0
  for (let day = 1; day <= walked; day++) {
    schedule.push('travel')
    // Tras este día, los descansos que le tocan hasta aquí
    while (placed < rest && Math.round(((placed + 1) * walked) / (rest + 1)) <= day) {
      schedule.push('rest')
      placed++
    }
  }
  while (placed < rest) {
    schedule.push('rest')
    placed++
  }
  return schedule
}

export function planTravel(input: { distance: number; speed: number; pace: TravelPace; restDays: number }): TravelPlan {
  const travelDays = input.distance / (input.speed * PACE_FACTOR[input.pace])
  // Lo que se pierde al redondear las medidas no suma un día
  const walked = input.distance > 0 ? Math.max(1, Math.ceil(travelDays - 1e-9)) : 0
  const rest = Math.max(0, Math.trunc(input.restDays))
  return { travelDays: Math.round(travelDays * 100) / 100, days: walked + rest, schedule: restSchedule(walked, rest) }
}
