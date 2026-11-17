import { sql } from 'drizzle-orm'
import { boolean, check, index, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth.ts'
import { trackedColumns } from './tracked.ts'
import { worlds } from './worlds.ts'

/** El «hoy» de una campaña: la fecha canónica con su calendario */
export interface CampaignToday {
  calendarId: string
  date: { year: number; month: string; day: number }
}

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
    /** En la papelera desde entonces: no sale en ninguna vista y a los 30 días se purga */
    deletedAt: timestamp({ withTimezone: true })
  },
  (t) => [index().on(t.worldId), index().on(t.deletedAt)]
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
