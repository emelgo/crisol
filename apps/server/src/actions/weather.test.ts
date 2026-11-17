import { COMPASS_POINTS, WEATHER_CONDITIONS, WEATHER_ZONES, WIND_FORCES } from '@crisol/contracts'
import { schema } from '@crisol/db'
import * as domain from '@crisol/domain'
import { describe, expect, it } from 'vitest'

describe('las listas del clima (8 · campaña)', () => {
  it('el contrato, la base y el dominio dicen lo mismo', () => {
    expect(WEATHER_ZONES).toEqual(domain.WEATHER_ZONES)
    expect(schema.WEATHER_ZONE_VALUES).toEqual(domain.WEATHER_ZONES)
    expect(WEATHER_CONDITIONS).toEqual(domain.WEATHER_CONDITIONS)
    expect(WIND_FORCES).toEqual(domain.WIND_FORCES)
    expect(COMPASS_POINTS).toEqual(domain.COMPASS)
  })
})
