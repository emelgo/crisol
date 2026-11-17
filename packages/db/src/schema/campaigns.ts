import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid
} from 'drizzle-orm/pg-core'
import { user } from './auth.ts'
import { calendars } from './calendars.ts'
import { trackedColumns } from './tracked.ts'
import { worlds } from './worlds.ts'

/** El «hoy» de una campaña: la fecha canónica con su calendario */
export interface CampaignToday {
  calendarId: string
  date: { year: number; month: string; day: number }
}

/** Las zonas de clima (las de `WEATHER_ZONES` del dominio) */
export const WEATHER_ZONE_VALUES = ['temperate', 'arid', 'cold', 'tropical', 'mountain', 'coast', 'polar'] as const

export const campaigns = pgTable(
  'campaigns',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    /** Como en un mundo: una línea que sale en su tarjeta, su color y su portada (una imagen de su mundo o común) */
    description: text().notNull().default(''),
    color: text(),
    cover: jsonb().$type<{ fileId: string; x: number; y: number; zoom?: number } | null>(),
    /** Su sistema de reglas (ADR-0011): el id de uno de serie o el uuid de uno de la cuenta; sin él, null */
    system: text(),
    /** Lo que elige de su sistema: sus fuentes, el idioma del contenido y sus ajustes */
    systemChoices: jsonb().$type<{
      sources: string[]
      language: 'es' | 'en'
      settings: Record<string, unknown>
    } | null>(),
    /** Si parte de lo que sabe el mundo (ADR-0017); si no, empezó de cero */
    knowsWorld: boolean().notNull().default(true),
    /** Los tipos del compendio de su sistema que no ven sus jugadores (docs/specs/compendio-jugadores.md) */
    hiddenTypes: text().array().notNull().default(sql`'{}'::text[]`),
    /**
     * Su «hoy» (docs/specs/modulo-8-10-campana.md, ADR-0029): una fecha con día de un calendario del mundo (al ponerla,
     * el principal); null hasta que el máster la pone
     */
    today: jsonb().$type<CampaignToday | null>(),
    /** Su zona de clima (decisión 11), de una lista cerrada: cambia al viajar */
    weatherZone: text({ enum: WEATHER_ZONE_VALUES }).notNull().default('temperate'),
    /** Su latitud, para el sol (decisión 15) */
    latitude: doublePrecision().notNull().default(45),
    /** En la papelera desde entonces: no sale en ninguna vista y a los 30 días se purga */
    deletedAt: timestamp({ withTimezone: true })
  },
  (t) => [
    index().on(t.worldId),
    index().on(t.deletedAt),
    check(
      'campaigns_weather_zone',
      sql`${t.weatherZone} in ('temperate', 'arid', 'cold', 'tropical', 'mountain', 'coast', 'polar')`
    ),
    check('campaigns_latitude', sql`${t.latitude} between -90 and 90`)
  ]
)

/** master: la dirige. player: juega en ella. Reservado para más adelante: spectator */
export const campaignMembers = pgTable(
  'campaign_members',
  {
    ...trackedColumns(),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text({ enum: ['master', 'player'] }).notNull()
  },
  (t) => [
    unique().on(t.campaignId, t.userId),
    index().on(t.userId),
    check('campaign_members_role', sql`${t.role} in ('master', 'player')`)
  ]
)

/**
 * El clima de un día cambiado a mano por el máster (decisión 13): su condición, la mínima, la máxima y el viento. El
 * día va como fecha de su calendario (ADR-0029: el día absoluto no se guarda). No cambia los días siguientes, que se
 * siguen calculando con la semilla. Pasa por el historial: se deshace
 */
export const campaignWeather = pgTable(
  'campaign_weather',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    calendarId: uuid()
      .notNull()
      .references(() => calendars.id, { onDelete: 'cascade' }),
    year: integer().notNull(),
    month: text().notNull(),
    day: integer().notNull(),
    condition: text().notNull(),
    low: integer().notNull(),
    high: integer().notNull(),
    wind: text().notNull(),
    windDirection: text().notNull()
  },
  (t) => [
    unique('campaign_weather_day').on(t.campaignId, t.calendarId, t.year, t.month, t.day),
    index().on(t.calendarId)
  ]
)
