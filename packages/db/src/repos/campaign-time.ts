/**
 * El tiempo de una campaña (docs/specs/modulo-8-10-campana.md): su «hoy», y lo que cuelga de él. Se escribe por
 * operation(), con su historial: cambiar la fecha se deshace
 */
import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { type CampaignToday, campaigns, campaignWeather } from '../schema/campaigns.ts'
import { worlds } from '../schema/worlds.ts'

export type { CampaignToday }

/** El «hoy» de una campaña (null si no tiene o no existe) */
export async function findToday(db: Database, campaignId: string): Promise<CampaignToday | null> {
  const [found] = await db.select({ today: campaigns.today }).from(campaigns).where(eq(campaigns.id, campaignId))
  return found?.today ?? null
}

/** El «hoy», la zona de clima y la latitud de una campaña (null si no existe) */
export async function findClimate(db: Database, campaignId: string) {
  const [found] = await db
    .select({ today: campaigns.today, zone: campaigns.weatherZone, latitude: campaigns.latitude })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
  return found ?? null
}

export type WeatherZoneValue = (typeof campaigns.$inferSelect)['weatherZone']

/** Cambia el «hoy» de una campaña (y, si se dice, su zona: al viajar) */
export function setToday(
  db: Database,
  context: OperationContext,
  campaignId: string,
  today: CampaignToday | null,
  zone?: WeatherZoneValue
) {
  return operation(db, context, (w) =>
    w.update(campaigns, campaignId, { today, ...(zone ? { weatherZone: zone } : {}) })
  )
}

/** Cambia la zona de clima o la latitud de una campaña */
export function setClimate(
  db: Database,
  context: OperationContext,
  campaignId: string,
  patch: { weatherZone?: WeatherZoneValue; latitude?: number }
) {
  return operation(db, context, (w) => w.update(campaigns, campaignId, patch))
}

export type DayWeatherRow = typeof campaignWeather.$inferSelect
/** El clima de un día a mano: condición, mínima, máxima, viento y rumbo */
export type DayWeather = Pick<DayWeatherRow, 'condition' | 'low' | 'high' | 'wind' | 'windDirection'>
type DayKey = { worldId: string; campaignId: string; calendarId: string; year: number; month: string; day: number }

/** Los días con el clima cambiado a mano de una campaña en un calendario */
export function listDayWeather(db: Database, campaignId: string, calendarId: string) {
  return db
    .select()
    .from(campaignWeather)
    .where(and(eq(campaignWeather.campaignId, campaignId), eq(campaignWeather.calendarId, calendarId)))
}

/** Cambia a mano el clima de un día (null: lo quita, vuelve al generado) */
export function setDayWeather(db: Database, context: OperationContext, key: DayKey, weather: DayWeather | null) {
  return operation(db, context, async (w) => {
    const [found] = await w.read
      .select({ id: campaignWeather.id })
      .from(campaignWeather)
      .where(
        and(
          eq(campaignWeather.campaignId, key.campaignId),
          eq(campaignWeather.calendarId, key.calendarId),
          eq(campaignWeather.year, key.year),
          eq(campaignWeather.month, key.month),
          eq(campaignWeather.day, key.day)
        )
      )
    if (!weather) {
      if (found) await w.remove(campaignWeather, found.id)
      return
    }
    if (found) await w.update(campaignWeather, found.id, weather)
    else await w.insert(campaignWeather, { ...key, ...weather })
  })
}

/** Los días con el clima a mano en un calendario (fechas en uso) */
export async function dayWeatherInCalendar(db: Database, calendarId: string) {
  return db
    .select({ year: campaignWeather.year, month: campaignWeather.month, day: campaignWeather.day })
    .from(campaignWeather)
    .where(eq(campaignWeather.calendarId, calendarId))
}

/** Las campañas de un mundo (fuera de la papelera) que tienen «hoy», en el orden en que se crearon */
export function todaysOfWorld(db: Database, worldId: string) {
  return db
    .select({ id: campaigns.id, name: campaigns.name, today: campaigns.today })
    .from(campaigns)
    .innerJoin(worlds, eq(worlds.id, campaigns.worldId))
    .where(and(eq(campaigns.worldId, worldId), isNotNull(campaigns.today), isNull(campaigns.deletedAt)))
    .orderBy(asc(campaigns.createdAt), asc(campaigns.id))
}

/** Los «hoy» que usan un calendario (también los de la papelera: al volver tienen que caber) */
export async function todaysInCalendar(db: Database, calendarId: string) {
  const rows = await db
    .select({ today: campaigns.today })
    .from(campaigns)
    .where(sql`${campaigns.today}->>'calendarId' = ${calendarId}`)
  return rows.flatMap((row) => (row.today ? [row.today] : []))
}
