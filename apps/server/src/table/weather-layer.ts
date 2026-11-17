/**
 * La capa de clima de la Mesa (docs/specs/modulo-8-10-campana.md, decisión 16): el clima de hoy de la campaña (el de
 * su zona con semilla, o el que puso el máster a mano) y la capa que sale de él en una escena
 */
import type { WeatherLayerView } from '@crisol/contracts'
import { calendarsRepo, campaignTimeRepo, type Database } from '@crisol/db'
import {
  type Compass,
  dayNumber,
  effectiveWeatherLayer,
  type WeatherCondition,
  type WeatherDay,
  type WeatherLayerSetting,
  type WindForce,
  weatherOn
} from '@crisol/domain'

/** El clima de hoy de una campaña (null sin fecha) */
export async function todayWeather(
  db: Database,
  campaign: { id: string; worldId: string }
): Promise<WeatherDay | null> {
  const climate = await campaignTimeRepo.findClimate(db, campaign.id)
  const today = climate?.today
  if (!climate || !today) return null
  const calendar = await calendarsRepo.findCalendar(db, today.calendarId)
  if (!calendar) return null
  const manual = (await campaignTimeRepo.listDayWeather(db, campaign.id, calendar.id)).find(
    (row) => row.year === today.date.year && row.month === today.date.month && row.day === today.date.day
  )
  if (manual)
    return {
      condition: manual.condition as WeatherCondition,
      low: manual.low,
      high: manual.high,
      wind: manual.wind as WindForce,
      windDirection: manual.windDirection as Compass
    }
  const day = dayNumber(calendar.definition, today.date)
  return weatherOn(calendar.definition, { worldId: campaign.worldId, zone: climate.zone }, day)
}

/** La capa que se pinta en una escena (null: ninguna), con el modo de la campaña y el clima de hoy */
export const layerIn = (
  setting: WeatherLayerSetting,
  today: WeatherDay | null,
  scene: { interior?: boolean | undefined } | null
): WeatherLayerView | null => (scene ? effectiveWeatherLayer(setting, today, scene.interior ?? false) : null)
