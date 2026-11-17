/**
 * El clima de cada día (docs/specs/modulo-8-10-campana.md, decisiones 11-14): días plausibles por zona, con semilla
 * `(mundo, zona, día absoluto)`, así que dos campañas en la misma zona y el mismo día ven lo mismo y nada se guarda.
 *
 * Origen: el generador de clima del Crisol antiguo (código de Enrique, `~/crisol-app`, commit e5a72bb,
 * `packages/core/src/calendar/weatherGen.ts`), con su modelo de los «weather pack» (curva de temperatura por estación,
 * rachas de tiempo estable que alternan con frentes, niebla los días húmedos y en calma, nieve bajo su temperatura y
 * tormentas en los frentes cálidos), su azar (FNV-1a + mulberry32) y sus parámetros («General» es la zona templada).
 * Cambios: las siete zonas como parámetros del modelo; en vez de encadenar y guardar los días, cada día se calcula
 * desde el principio de la ventana fija de 14 días anterior a la suya (los de una misma ventana siguen la misma racha);
 * los códigos (condición, viento, rumbo) en vez de las etiquetas en inglés; sin los días a mano (los guarda la campaña
 * aparte y no cambian los siguientes)
 */

import { dateFromDay, dayOfYear, yearLength } from './dates.ts'
import type { CalendarDefinition } from './definition.ts'

export const WEATHER_ZONES = ['temperate', 'arid', 'cold', 'tropical', 'mountain', 'coast', 'polar'] as const
export type WeatherZone = (typeof WEATHER_ZONES)[number]

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
export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number]

/** El viento, en la escala de Beaufort resumida */
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
export type WindForce = (typeof WIND_FORCES)[number]

export const COMPASS = [
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
export type Compass = (typeof COMPASS)[number]

/** El clima de un día: la condición, la mínima y la máxima (°C) y el viento con su rumbo */
export interface WeatherDay {
  condition: WeatherCondition
  low: number
  high: number
  wind: WindForce
  windDirection: Compass
}

/** Los parámetros del modelo de una zona (porcentajes de 0 a 100 y temperaturas en °C), los de un «weather pack» */
export interface WeatherParams {
  temperatureMin: number
  temperatureMax: number
  humidity: number
  precipitation: number
  storminess: number
  cloudiness: number
  fogginess: number
  windiness: number
  /** Cuánto cambia la temperatura entre invierno y verano */
  seasonality: number
  frontFrequency: number
  frontStrength: number
  /** Cuánto varía el tiempo de un día a otro */
  volatility: number
  stableSpanMin: number
  stableSpanMax: number
  frontSpanMin: number
  frontSpanMax: number
  /** Por debajo de esta temperatura media, la precipitación es nieve */
  snowTemperature: number
}

/** Las zonas: la templada es el pack «General» del antiguo; las demás, sus parámetros movidos hacia su clima */
export const ZONE_PARAMS: Record<WeatherZone, WeatherParams> = {
  temperate: {
    temperatureMin: -5,
    temperatureMax: 28,
    humidity: 45,
    precipitation: 35,
    storminess: 14,
    cloudiness: 42,
    fogginess: 10,
    windiness: 34,
    seasonality: 62,
    frontFrequency: 46,
    frontStrength: 48,
    volatility: 30,
    stableSpanMin: 3,
    stableSpanMax: 7,
    frontSpanMin: 1,
    frontSpanMax: 3,
    snowTemperature: 0
  },
  arid: {
    temperatureMin: 2,
    temperatureMax: 41,
    humidity: 12,
    precipitation: 6,
    storminess: 8,
    cloudiness: 14,
    fogginess: 2,
    windiness: 42,
    seasonality: 55,
    frontFrequency: 16,
    frontStrength: 35,
    volatility: 25,
    stableSpanMin: 5,
    stableSpanMax: 12,
    frontSpanMin: 1,
    frontSpanMax: 2,
    snowTemperature: 0
  },
  cold: {
    temperatureMin: -24,
    temperatureMax: 21,
    humidity: 55,
    precipitation: 40,
    storminess: 8,
    cloudiness: 55,
    fogginess: 14,
    windiness: 38,
    seasonality: 88,
    frontFrequency: 50,
    frontStrength: 55,
    volatility: 35,
    stableSpanMin: 3,
    stableSpanMax: 6,
    frontSpanMin: 1,
    frontSpanMax: 4,
    snowTemperature: 0
  },
  tropical: {
    temperatureMin: 20,
    temperatureMax: 33,
    humidity: 85,
    precipitation: 65,
    storminess: 40,
    cloudiness: 55,
    fogginess: 10,
    windiness: 25,
    seasonality: 15,
    frontFrequency: 62,
    frontStrength: 45,
    volatility: 20,
    stableSpanMin: 2,
    stableSpanMax: 5,
    frontSpanMin: 1,
    frontSpanMax: 3,
    snowTemperature: 0
  },
  mountain: {
    temperatureMin: -16,
    temperatureMax: 22,
    humidity: 50,
    precipitation: 50,
    storminess: 22,
    cloudiness: 55,
    fogginess: 25,
    windiness: 58,
    seasonality: 70,
    frontFrequency: 56,
    frontStrength: 60,
    volatility: 50,
    stableSpanMin: 2,
    stableSpanMax: 5,
    frontSpanMin: 1,
    frontSpanMax: 3,
    snowTemperature: 1
  },
  coast: {
    temperatureMin: 4,
    temperatureMax: 26,
    humidity: 75,
    precipitation: 45,
    storminess: 15,
    cloudiness: 50,
    fogginess: 28,
    windiness: 58,
    seasonality: 40,
    frontFrequency: 55,
    frontStrength: 45,
    volatility: 30,
    stableSpanMin: 2,
    stableSpanMax: 6,
    frontSpanMin: 1,
    frontSpanMax: 3,
    snowTemperature: 0
  },
  polar: {
    temperatureMin: -40,
    temperatureMax: 7,
    humidity: 40,
    precipitation: 25,
    storminess: 2,
    cloudiness: 50,
    fogginess: 15,
    windiness: 62,
    seasonality: 80,
    frontFrequency: 45,
    frontStrength: 55,
    volatility: 35,
    stableSpanMin: 3,
    stableSpanMax: 7,
    frontSpanMin: 1,
    frontSpanMax: 4,
    snowTemperature: 0
  }
}

/** Días de la ventana fija: cada día se calcula desde el principio de la ventana anterior a la suya */
export const WEATHER_WINDOW = 14

// ── Azar con semilla ──────────────────────────────────────────────────────

/** Hash de 32 bits de un texto (FNV-1a) */
function hashSeed(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Generador mulberry32: números en [0, 1) */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** La estación de un calendario que se llama así (por su id o su nombre, sin tildes) */
function namedSeason(def: CalendarDefinition, pattern: RegExp) {
  return def.seasons.find((s) => pattern.test(fold(s.id)) || pattern.test(fold(s.name)))
}

/**
 * El día del año (desde 1, con decimales) a mitad del invierno: el de la estación «Invierno» del calendario (o la
 * opuesta al «Verano»); sin ellas, al principio del año. Lo más frío del clima
 */
export function coldestDay(def: CalendarDefinition): number {
  const length = yearLength(def)
  const middle = (start: number, end: number) =>
    start <= end ? (start + end) / 2 : (((start + end + length) / 2 - 1) % length) + 1
  const winter = namedSeason(def, /invierno|winter/)
  if (winter) return middle(winter.startDay, winter.endDay)
  const summer = namedSeason(def, /verano|summer/)
  if (summer) return ((middle(summer.startDay, summer.endDay) + length / 2 - 1) % length) + 1
  return 1 + length * 0.05
}

/**
 * El solsticio de invierno, para el sol: el primer día de la estación «Invierno» (en un gregoriano, el 21 de diciembre,
 * el día más corto; corregido el 2026-11-17), o el opuesto al primero del «Verano»; sin ellas, al principio del año
 */
export function winterSolsticeDay(def: CalendarDefinition): number {
  const length = yearLength(def)
  const winter = namedSeason(def, /invierno|winter/)
  if (winter) return winter.startDay
  const summer = namedSeason(def, /verano|summer/)
  if (summer) return ((summer.startDay + length / 2 - 1) % length) + 1
  return 1
}

function cloudsCondition(sky: number): WeatherCondition {
  if (sky < 0.1) return 'clear'
  if (sky < 0.25) return 'mostly-clear'
  if (sky < 0.4) return 'partly-cloudy'
  if (sky < 0.55) return 'scattered-clouds'
  if (sky < 0.8) return 'broken-clouds'
  return 'overcast'
}

/** Escala de Beaufort a partir de un viento de 0 a 1 */
function windForce(wind: number): WindForce {
  if (wind < 0.07) return 'calm'
  if (wind < 0.3) return 'light'
  if (wind < 0.48) return 'gentle'
  if (wind < 0.62) return 'steady'
  if (wind < 0.76) return 'fresh'
  if (wind < 0.88) return 'strong'
  if (wind < 0.95) return 'near-gale'
  return 'gale'
}

// ── Día a día ─────────────────────────────────────────────────────────────

/** La racha en curso (un frente o tiempo estable), cuánto le queda y hacia dónde llevan la temperatura y el viento */
interface Trend {
  front: boolean
  /** Días que le quedan después de este */
  left: number
  /** Nubosidad base (0 a 1) */
  sky: number
  /** Desviación de temperatura a la que tiende */
  target: number
  /** Desviación de temperatura de este día (se acerca poco a poco a `target`) */
  shift: number
  /** Viento base (0 a 1) */
  wind: number
  /** Fuerza del frente (0 en las rachas estables) */
  strength: number
  /** Rumbo base del viento (índice de la rosa de 16) */
  direction: number
}

/** Lo que no cambia de un día a otro: la curva de la estación y las probabilidades de la zona */
interface Model {
  params: WeatherParams
  p: (value: number) => number
  seasonal: (dayOfYear: number) => { mean: number; cold: number }
  volatility: number
  rainChance: number
  seed: string
}

function modelOf(def: CalendarDefinition, worldId: string, zone: WeatherZone): Model {
  const params = ZONE_PARAMS[zone]
  const p = (value: number) => clamp(value / 100, 0, 1)
  const length = yearLength(def)
  const coldest = coldestDay(def)
  const middle = (params.temperatureMin + params.temperatureMax) / 2
  const amplitude = ((params.temperatureMax - params.temperatureMin) / 2) * (0.45 + 0.55 * p(params.seasonality))
  return {
    params,
    p,
    // Temperatura media del día según la estación, y lo frío que es (1 a mitad del invierno)
    seasonal: (day) => {
      const wave = Math.cos((2 * Math.PI * (day - coldest)) / length)
      return { mean: middle - amplitude * wave, cold: (wave + 1) / 2 }
    },
    volatility: p(params.volatility),
    rainChance: clamp(0.35 + 0.6 * p(params.precipitation) + 0.2 * p(params.humidity), 0, 0.95),
    seed: `${worldId}:${zone}:`
  }
}

/** Azar del día: la semilla es el mundo, la zona y el día absoluto */
function dailyRandom(m: Model, day: number) {
  const random = seededRandom(hashSeed(`${m.seed}${day}`))
  const between = (min: number, max: number) => min + random() * (max - min)
  const integer = (min: number, max: number) => Math.floor(between(min, max + 1))
  return { random, between, integer }
}
type Dice = ReturnType<typeof dailyRandom>

/** Racha nueva; en la estación fría hay algo más de frentes y nunca hay dos frentes seguidos */
function newSpan(m: Model, dice: Dice, cold: number, lastFront: boolean, lastDirection: number): Trend {
  const { random, between, integer } = dice
  const { params, p } = m
  const direction = (lastDirection + integer(-3, 3) + COMPASS.length) % COMPASS.length
  const front = !lastFront && random() < (0.3 + 0.6 * p(params.frontFrequency)) * (0.8 + 0.4 * cold)
  if (front) {
    const strength = p(params.frontStrength) * between(0.6, 1.4)
    return {
      front,
      left: integer(params.frontSpanMin, params.frontSpanMax),
      sky: between(0.85, 1),
      target: -strength * between(1, 5),
      shift: 0,
      wind: p(params.windiness) * 0.7 + strength * 0.35 + between(-0.05, 0.15),
      strength,
      direction
    }
  }
  return {
    front,
    left: integer(params.stableSpanMin, params.stableSpanMax),
    sky: clamp(p(params.cloudiness) + between(-0.45, 0.45), 0, 0.79),
    target: between(-1, 1) * (1.5 + 5 * m.volatility),
    shift: 0,
    wind: p(params.windiness) * 0.7 + between(-0.2, 0.1),
    strength: 0,
    direction
  }
}

/**
 * El clima de un día a partir de la racha del anterior: la sigue (un frente dura varios días y la temperatura cambia
 * poco a poco) o empieza otra cuando se acaba. Sin anterior, empieza con tiempo estable
 */
function nextDay(m: Model, day: number, yearDay: number, before: Trend | null): { day: WeatherDay; trend: Trend } {
  const dice = dailyRandom(m, day)
  const { random, between, integer } = dice
  const { params, p, volatility } = m
  const { mean: base, cold } = m.seasonal(yearDay)

  let span: Trend
  if (!before || before.left <= 0)
    span = {
      ...newSpan(m, dice, cold, before?.front ?? true, before?.direction ?? integer(0, COMPASS.length - 1)),
      shift: before?.shift ?? 0
    }
  else span = { ...before }
  span.left--
  // La temperatura se acerca poco a poco a la de la racha: sin saltos bruscos
  span.shift += (span.target - span.shift) * 0.55

  const mean = base + span.shift + between(-1, 1) * (0.8 + 2.5 * volatility)
  let sky = clamp(span.sky + between(-0.1, 0.1) * (0.5 + volatility), 0, span.front ? 1 : 0.79)
  let wind = clamp(span.wind + between(-0.12, 0.12), 0, 1)

  // Precipitación: casi siempre en los frentes; a veces, poca, en días estables muy nublados
  let condition: WeatherCondition | null = null
  if (span.front && random() < m.rainChance) {
    const intensity = random() * (0.4 + span.strength)
    const heavy = intensity > 0.7
    if (mean <= params.snowTemperature + 0.5) condition = heavy ? 'snow' : 'flurries'
    else if (mean <= params.snowTemperature + 2.5) condition = 'sleet'
    else if (
      intensity > 0.45 &&
      mean >= params.snowTemperature + 8 &&
      random() < p(params.storminess) * 2.5 * (1 - cold)
    )
      condition = 'thunderstorm'
    else condition = heavy ? 'heavy-rain' : 'rain'
  } else if (!span.front && sky > 0.55 && random() < p(params.precipitation) * 0.3) {
    condition = mean <= params.snowTemperature + 1 ? 'flurries' : 'drizzle'
  }
  // Niebla o neblina: días secos, húmedos y en calma, sobre todo en la estación fría
  if (!condition && wind < 0.3 && random() < p(params.fogginess) * (1 + p(params.humidity)) * (0.6 + 0.8 * cold)) {
    condition = random() < 0.35 + 0.4 * p(params.humidity) ? 'fog' : 'mist'
    sky = clamp(sky, 0.4, 0.79)
    wind = Math.min(wind, 0.25)
  }

  // Con el cielo despejado, más diferencia entre el día y la noche (menos en invierno)
  const spread = (3 + 9 * (1 - sky) * (0.6 + 0.4 * (1 - p(params.humidity)))) * (1 - 0.3 * cold)
  let low = clamp(Math.round(mean - spread / 2), params.temperatureMin, params.temperatureMax) || 0
  let high = clamp(Math.round(mean + spread / 2), params.temperatureMin, params.temperatureMax) || 0
  if (low > high) [low, high] = [high, low]

  const result: WeatherDay = {
    condition: condition ?? cloudsCondition(sky),
    low,
    high,
    wind: condition === 'thunderstorm' ? 'storm' : windForce(wind),
    windDirection: COMPASS[(span.direction + integer(-1, 1) + COMPASS.length) % COMPASS.length] ?? 'N'
  }
  return { day: result, trend: span }
}

/** Dónde se mira el clima: el mundo y la zona (con el calendario, la semilla de cada día) */
export interface WeatherPlace {
  worldId: string
  zone: WeatherZone
}

/** Donde empieza la cadena de un día: el principio de la ventana fija anterior a la suya */
const chainStart = (day: number) => Math.floor(day / WEATHER_WINDOW) * WEATHER_WINDOW - WEATHER_WINDOW

/**
 * El clima de los días absolutos `from`..`to` (los dos incluidos) del calendario. Cada día sale igual que si se pidiera
 * solo: su cadena empieza en la ventana anterior a la suya, así que los de una misma ventana siguen la misma racha
 */
export function weatherRange(def: CalendarDefinition, place: WeatherPlace, from: number, to: number): WeatherDay[] {
  const m = modelOf(def, place.worldId, place.zone)
  const out: WeatherDay[] = []
  let block = chainStart(from) + WEATHER_WINDOW
  while (block <= to) {
    let trend: Trend | null = null
    const end = Math.min(to, block + WEATHER_WINDOW - 1)
    for (let n = block - WEATHER_WINDOW; n <= end; n++) {
      const next = nextDay(m, n, dayOfYear(def, dateFromDay(def, n)), trend)
      trend = next.trend
      // Lo de antes de su ventana solo pone en marcha la racha
      if (n >= block && n >= from) out.push(next.day)
    }
    block += WEATHER_WINDOW
  }
  return out
}

/** El clima de un día absoluto del calendario */
export const weatherOn = (def: CalendarDefinition, place: WeatherPlace, day: number): WeatherDay =>
  weatherRange(def, place, day, day)[0] as WeatherDay

/** Lo que pinta la capa de clima de la Mesa (decisión 16): el tipo, su intensidad (0 a 1) y el viento (0 a 1) */
export interface WeatherLayer {
  kind: 'rain' | 'snow' | 'fog' | 'ash'
  intensity: number
  wind: number
}

const LAYER_OF: Partial<Record<WeatherCondition, Omit<WeatherLayer, 'wind'>>> = {
  drizzle: { kind: 'rain', intensity: 0.25 },
  rain: { kind: 'rain', intensity: 0.55 },
  'heavy-rain': { kind: 'rain', intensity: 0.85 },
  thunderstorm: { kind: 'rain', intensity: 1 },
  sleet: { kind: 'snow', intensity: 0.45 },
  flurries: { kind: 'snow', intensity: 0.35 },
  snow: { kind: 'snow', intensity: 0.75 },
  mist: { kind: 'fog', intensity: 0.4 },
  fog: { kind: 'fog', intensity: 0.8 }
}

/** La capa del clima de un día: lluvia, nieve o niebla; null si no cae nada (cielo despejado o nubes) */
export function weatherLayerOf(day: Pick<WeatherDay, 'condition' | 'wind'>): WeatherLayer | null {
  const layer = LAYER_OF[day.condition]
  if (!layer) return null
  return { ...layer, wind: WIND_FORCES.indexOf(day.wind) / (WIND_FORCES.length - 1) }
}

/** Cómo sale la capa de clima en la Mesa de una campaña: como el clima de hoy, a mano o ninguna */
export type WeatherLayerSetting = { mode: 'today' } | ({ mode: 'manual' } & WeatherLayer) | { mode: 'none' }

/**
 * La capa que se pinta: ninguna en una escena interior o con «ninguna»; la de a mano tal cual; si no, la del clima de
 * hoy (sin fecha, ninguna)
 */
export function effectiveWeatherLayer(
  setting: WeatherLayerSetting,
  today: Pick<WeatherDay, 'condition' | 'wind'> | null,
  interior: boolean
): WeatherLayer | null {
  if (interior || setting.mode === 'none') return null
  if (setting.mode === 'manual') return { kind: setting.kind, intensity: setting.intensity, wind: setting.wind }
  return today ? weatherLayerOf(today) : null
}
