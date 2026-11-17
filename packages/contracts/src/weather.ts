/**
 * El clima y el sol de cada campaña (docs/specs/modulo-8-10-campana.md, decisiones 11-15): el de cada día sale de su
 * zona con semilla (no cambia al recargar) y el máster puede cambiar uno a mano (no altera los siguientes). El máster ve
 * hoy y la previsión; la jugadora, solo el clima de hoy y el sol (en el «hoy» de la campaña). Las listas son las del
 * dominio (`packages/domain/src/calendar/weather.ts`)
 */
import { z } from 'zod'
import { defineAction } from './action.ts'
import { dateInput, fullDate } from './calendars.ts'

export const WEATHER_ZONES = ['temperate', 'arid', 'cold', 'tropical', 'mountain', 'coast', 'polar'] as const
export const WEATHER_CONDITIONS = [
  'clear',
  'mostly-clear',
  'partly-cloudy',
  'scattered-clouds',
  'broken-clouds',
  'overcast',
  'fog',
  'mist',
  'drizzle',
  'rain',
  'heavy-rain',
  'sleet',
  'thunderstorm',
  'flurries',
  'snow'
] as const
export const WIND_FORCES = [
  'calm',
  'light',
  'gentle',
  'steady',
  'fresh',
  'strong',
  'near-gale',
  'gale',
  'storm'
] as const
export const COMPASS_POINTS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW'
] as const

export const weatherZone = z
  .enum(WEATHER_ZONES)
  .describe('temperate (templada), arid (árida), cold (fría), tropical, mountain (montaña), coast (costa) o polar')

/** El clima de un día: la condición, la mínima y la máxima (°C) y el viento con su rumbo */
export const weatherDay = z
  .object({
    condition: z.enum(WEATHER_CONDITIONS),
    low: z.int().min(-90).max(70),
    high: z.int().min(-90).max(70),
    wind: z.enum(WIND_FORCES).describe('Escala de Beaufort resumida'),
    windDirection: z.enum(COMPASS_POINTS)
  })
  .refine((day) => day.low <= day.high, { message: 'la mínima no pasa de la máxima' })

/** Salida, puesta, alba y anochecer en minutos desde la medianoche (null en la noche o el día polar) */
export const sunView = z.object({
  sunrise: z.int().nullable(),
  sunset: z.int().nullable(),
  dawn: z.int().nullable(),
  dusk: z.int().nullable(),
  daylight: z.int().describe('Minutos de sol'),
  polar: z.enum(['day', 'night']).nullable()
})

export const weatherDayView = z.object({
  date: fullDate,
  text: z.string(),
  form: z.string(),
  day: z.int().describe('Su día absoluto en su calendario'),
  condition: z.enum(WEATHER_CONDITIONS),
  low: z.int(),
  high: z.int(),
  wind: z.enum(WIND_FORCES),
  windDirection: z.enum(COMPASS_POINTS),
  manual: z.boolean().describe('Cambiado a mano por el máster'),
  sun: sunView
})

export type WeatherDayView = z.infer<typeof weatherDayView>
export type SunView = z.infer<typeof sunView>

export const getCampaignWeather = defineAction({
  name: 'getCampaignWeather',
  kind: 'read',
  description:
    'El clima de una campaña día a día (solo su máster), con el sol de cada uno: desde from (sin él, su «hoy») tantos días como days (7 por defecto, hasta 366). Sale de su zona con semilla, salvo los días cambiados a mano (manual)',
  input: z.object({
    campaignId: z.uuid(),
    from: dateInput.optional(),
    days: z.int().min(1).max(366).default(7)
  }),
  output: z.object({ zone: weatherZone, latitude: z.number(), days: z.array(weatherDayView) })
})

export const setCampaignClimate = defineAction({
  name: 'setCampaignClimate',
  kind: 'write',
  description:
    'Cambia la zona de clima de una campaña (de la lista cerrada) o su latitud (para el sol; de -90 a 90). Se deshace desde el historial',
  input: z
    .object({ campaignId: z.uuid(), zone: weatherZone.optional(), latitude: z.number().min(-90).max(90).optional() })
    .refine((input) => input.zone !== undefined || input.latitude !== undefined, { message: 'zone o latitude' }),
  output: z.object({ zone: weatherZone, latitude: z.number() })
})

export const setDayWeather = defineAction({
  name: 'setDayWeather',
  kind: 'write',
  description:
    'Cambia a mano el clima de un día de una campaña (solo su máster; sin date, su «hoy»): condición, mínima, máxima, viento y rumbo. No cambia los días siguientes. Con weather null vuelve al generado. Queda en el registro, solo para el máster, y se deshace desde el historial',
  input: z.object({
    campaignId: z.uuid(),
    date: dateInput.optional(),
    weather: weatherDay.nullable()
  }),
  output: z.object({ day: weatherDayView })
})

export const WEATHER_LAYER_KINDS = ['rain', 'snow', 'fog', 'ash'] as const

/** La capa de clima que se pinta en la Mesa: lluvia, nieve, niebla o ceniza, con su intensidad y su viento (0 a 1) */
export const weatherLayer = z.object({
  kind: z.enum(WEATHER_LAYER_KINDS),
  intensity: z.number().min(0).max(1),
  wind: z.number().min(0).max(1)
})

/** Cómo sale en la Mesa de una campaña: como el clima de hoy (lo de siempre), a mano o ninguna */
export const weatherLayerSetting = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('today') }),
  weatherLayer.extend({ mode: z.literal('manual') }),
  z.object({ mode: z.literal('none') })
])

export type WeatherLayerView = z.infer<typeof weatherLayer>
export type WeatherLayerSettingView = z.infer<typeof weatherLayerSetting>

export const setWeatherLayer = defineAction({
  name: 'setWeatherLayer',
  kind: 'write',
  description:
    'La capa de clima de la Mesa de una campaña (solo su máster): como el clima de hoy (today, lo de siempre), a mano (manual: rain, snow, fog o ash, con intensity y wind de 0 a 1) o ninguna (none). En una escena Interior no sale nunca',
  input: z.object({ campaignId: z.uuid(), layer: weatherLayerSetting }),
  output: z.object({ layer: weatherLayerSetting, effective: weatherLayer.nullable() })
})
