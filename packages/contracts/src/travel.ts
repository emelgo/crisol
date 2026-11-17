/**
 * Los viajes de una campaña (docs/specs/modulo-8-10-campana.md, decisiones 3, 17 y 18): una ruta medida en un mapa (o
 * la distancia escrita), el medio y el ritmo dan los días y el clima de cada uno; avanzar el «hoy» lo hace en una sola
 * operación y deja el resumen en el registro
 */
import { z } from 'zod'
import { defineAction } from './action.ts'
import { campaignDate } from './today.ts'
import { weatherDayView, weatherZone } from './weather.ts'

export const TRAVEL_MEDIUMS = ['foot', 'horse', 'ship'] as const
export const TRAVEL_PACES = ['slow', 'normal', 'fast'] as const

const coordinate = z.number().min(0).max(1)

/** Lo que se planea: de dónde sale la distancia, el medio, el ritmo y el descanso */
export const travelInput = z
  .object({
    campaignId: z.uuid(),
    distance: z.number().positive().max(1_000_000).optional().describe('La distancia escrita, en la unidad de unit'),
    unit: z.string().trim().min(1).max(20).optional(),
    tabId: z.uuid().optional().describe('O medirla en un mapa (su pestaña) del mundo, con su escala y sus velocidades'),
    points: z
      .array(z.tuple([coordinate, coordinate]))
      .min(2)
      .max(200)
      .optional()
      .describe('Con tabId: unos puntos (de 0 a 1)'),
    pins: z.tuple([z.uuid(), z.uuid()]).optional().describe('Con tabId: entre dos pines'),
    elementId: z.uuid().optional().describe('Con tabId: a lo largo de una ruta dibujada'),
    medium: z.enum(TRAVEL_MEDIUMS).default('foot').describe('A pie, a caballo o en barco'),
    pace: z.enum(TRAVEL_PACES).default('normal').describe('Lento ×0,67, normal ×1 o rápido ×1,33'),
    restDays: z.int().min(0).max(365).default(0).describe('Días de descanso, que se suman')
  })
  .refine((input) => (input.distance === undefined) !== (input.tabId === undefined), {
    message: 'distance o tabId'
  })
  .refine((input) => !input.tabId || input.points || input.pins || input.elementId, {
    message: 'con tabId, points, pins o elementId'
  })

export const travelPlan = z.object({
  distance: z.number(),
  unit: z.string().nullable(),
  route: z.string().nullable().describe('El nombre de la ruta del mapa, si se midió una'),
  medium: z.enum(TRAVEL_MEDIUMS),
  pace: z.enum(TRAVEL_PACES),
  speed: z.number().describe('Lo que se anda en un día con ese medio, a ritmo normal'),
  restDays: z.int(),
  travelDays: z.number().describe('Los días de camino, con decimales'),
  days: z.int().describe('Los que pasan: los de camino redondeados hacia arriba, más el descanso'),
  schedule: z
    .array(z.enum(['travel', 'rest']))
    .describe('Qué es cada día que pasa: de camino o de descanso (repartidos por el camino)'),
  from: campaignDate.nullable().describe('El «hoy» de la campaña (null si no tiene)'),
  arrival: campaignDate.nullable(),
  weather: z.array(weatherDayView).describe('El clima de cada día del viaje, en la zona de ahora')
})

export type TravelPlanView = z.infer<typeof travelPlan>

export const planTravel = defineAction({
  name: 'planTravel',
  kind: 'read',
  description:
    'Planea un viaje de una campaña (solo su máster): de la distancia escrita o medida en un mapa del mundo (tabId con points, pins o una ruta, elementId), el medio (a pie, a caballo, en barco: lo que se anda en un día, del mapa) y el ritmo, los días de camino y los que pasan (redondeados hacia arriba, más el descanso), la llegada y el clima de cada día',
  input: travelInput,
  output: travelPlan
})

export const travel = defineAction({
  name: 'travel',
  kind: 'write',
  description:
    'Hace un viaje planeado: avanza el «hoy» de la campaña los días que pasan y, con zone, cambia su zona de clima a la de destino, en una sola operación (se deshace); deja en el registro el resumen (ruta, medio, días y el clima de cada día)',
  input: travelInput.safeExtend({ zone: weatherZone.optional().describe('La zona de destino') }),
  output: z.object({ plan: travelPlan, today: campaignDate })
})
