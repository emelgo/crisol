import { describe, expect, it } from 'vitest'
import { dayNumber, yearLength } from './dates.ts'
import { gregorianCalendar } from './definition.ts'
import { EANA } from './fixtures.ts'
import { sunTimes } from './sun.ts'
import {
  WEATHER_WINDOW,
  WEATHER_ZONES,
  type WeatherDay,
  weatherLayerOf,
  weatherOn,
  weatherRange,
  winterSolsticeDay,
  ZONE_PARAMS
} from './weather.ts'

const WORLD = '7b0c5d0e-1111-4222-8333-444455556666'
const place = (zone: (typeof WEATHER_ZONES)[number] = 'temperate', worldId = WORLD) => ({ worldId, zone })
const START = dayNumber(EANA, { year: 1250 })
const year = (zone: (typeof WEATHER_ZONES)[number]) =>
  weatherRange(EANA, place(zone), START, START + yearLength(EANA) - 1)
const average = (days: readonly WeatherDay[]) => days.reduce((sum, d) => sum + (d.low + d.high) / 2, 0) / days.length
const WET = new Set(['drizzle', 'rain', 'heavy-rain', 'sleet', 'thunderstorm', 'flurries', 'snow'])

describe('el clima (8 · campaña)', () => {
  it('con semilla: el mismo día sale igual; otro mundo u otra zona, otro clima', () => {
    const a = weatherRange(EANA, place(), START, START + 59)
    expect(weatherRange(EANA, place(), START, START + 59)).toEqual(a)
    expect(weatherRange(EANA, place('temperate', 'otro-mundo'), START, START + 59)).not.toEqual(a)
    expect(weatherRange(EANA, place('coast'), START, START + 59)).not.toEqual(a)
  })

  it('un día pedido solo es el mismo que en un intervalo (empiece donde empiece)', () => {
    const range = weatherRange(EANA, place(), START - 5, START + 40)
    for (let i = 0; i < range.length; i++) expect(weatherOn(EANA, place(), START - 5 + i)).toEqual(range[i])
    expect(weatherRange(EANA, place(), START + 3, START + 3)).toEqual([range[8]])
  })

  it('días plausibles: mínima ≤ máxima, dentro de la zona; en una ventana, rachas de varios días', () => {
    for (const zone of WEATHER_ZONES) {
      const params = ZONE_PARAMS[zone]
      for (const day of year(zone)) {
        expect(day.low).toBeLessThanOrEqual(day.high)
        expect(day.low).toBeGreaterThanOrEqual(params.temperatureMin)
        expect(day.high).toBeLessThanOrEqual(params.temperatureMax)
      }
    }
    // Un frente dura: los días con lluvia o nieve vienen seguidos más a menudo que sueltos
    const days = year('temperate')
    let runs = 0
    let wetDays = 0
    for (let i = 0; i < days.length; i++) {
      const wet = WET.has(days[i]?.condition ?? '')
      if (wet) wetDays++
      if (wet && !WET.has(days[i - 1]?.condition ?? '')) runs++
    }
    expect(wetDays / runs).toBeGreaterThan(1.2)
    expect(WEATHER_WINDOW).toBe(14)
  })

  it('cada zona, su clima: el verano más cálido; el árido seco; el polar helado; el tropical sin nieve', () => {
    const temperate = year('temperate')
    // Eana: invierno, días 1-91; verano, 183-273
    expect(average(temperate.slice(182, 273))).toBeGreaterThan(average(temperate.slice(0, 91)) + 8)
    const wet = (days: readonly WeatherDay[]) => days.filter((d) => WET.has(d.condition)).length
    expect(wet(year('arid'))).toBeLessThan(wet(temperate) / 2)
    const polar = year('polar')
    expect(average(polar)).toBeLessThan(-5)
    expect(polar.some((d) => d.condition === 'snow' || d.condition === 'flurries')).toBe(true)
    const tropical = year('tropical')
    expect(tropical.some((d) => d.condition === 'snow' || d.condition === 'flurries' || d.condition === 'sleet')).toBe(
      false
    )
    expect(average(tropical)).toBeGreaterThan(22)
  })

  it('rendimiento: un año de clima en menos de 50 ms', () => {
    year('temperate')
    const started = performance.now()
    year('mountain')
    expect(performance.now() - started).toBeLessThan(50)
  })

  it('la capa de la Mesa: lluvia, nieve o niebla con su intensidad y el viento; nada con el cielo seco', () => {
    expect(weatherLayerOf({ condition: 'heavy-rain', wind: 'gale' })).toEqual({
      kind: 'rain',
      intensity: 0.85,
      wind: 0.875
    })
    expect(weatherLayerOf({ condition: 'snow', wind: 'calm' })).toEqual({ kind: 'snow', intensity: 0.75, wind: 0 })
    expect(weatherLayerOf({ condition: 'fog', wind: 'light' })?.kind).toBe('fog')
    expect(weatherLayerOf({ condition: 'clear', wind: 'storm' })).toBeNull()
  })
})

describe('el sol (8 · campaña)', () => {
  const hours = (minutes: number) => minutes / 60
  it('el solsticio de invierno, a mitad de la estación «Invierno» (sin ella, la opuesta al verano)', () => {
    expect(winterSolsticeDay(EANA)).toBe(46)
    expect(winterSolsticeDay(gregorianCalendar())).toBeCloseTo(34.5)
    const onlySummer = { ...EANA, seasons: EANA.seasons.filter((s) => s.name === 'Verano') }
    expect(winterSolsticeDay(onlySummer)).toBe(46)
  })

  it('a 45°: días cortos en invierno y largos en verano, con alba y anochecer alrededor del mediodía', () => {
    const winter = sunTimes(EANA, { year: 1250, month: 'escarcha', day: 11 }, 45)
    const summer = sunTimes(EANA, { year: 1250, month: 'trilla', day: 11 }, 45)
    expect(hours(winter.daylight)).toBeGreaterThan(8.5)
    expect(hours(winter.daylight)).toBeLessThan(9.1)
    expect(hours(summer.daylight)).toBeGreaterThan(15.1)
    expect(hours(summer.daylight)).toBeLessThan(15.7)
    expect((winter.sunrise ?? 0) + (winter.sunset ?? 0)).toBe(24 * 60)
    expect(winter.dawn).toBeLessThan(winter.sunrise ?? 0)
    expect(winter.dusk).toBeGreaterThan(winter.sunset ?? 0)
    expect(winter.polar).toBeNull()
  })

  it('en el ecuador, unas 12 horas siempre; cerca del polo, noche y día polares', () => {
    const equator = sunTimes(EANA, { year: 1250, month: 'escarcha', day: 11 }, 0)
    expect(hours(equator.daylight)).toBeCloseTo(12.1, 0)
    const night = sunTimes(EANA, { year: 1250, month: 'escarcha', day: 11 }, 80)
    expect(night).toMatchObject({ sunrise: null, sunset: null, daylight: 0, polar: 'night' })
    const day = sunTimes(EANA, { year: 1250, month: 'trilla', day: 11 }, 80)
    expect(day).toMatchObject({ sunrise: null, daylight: 24 * 60, polar: 'day' })
    // En el sur, al revés
    expect(sunTimes(EANA, { year: 1250, month: 'escarcha', day: 11 }, -80).polar).toBe('day')
  })
})
