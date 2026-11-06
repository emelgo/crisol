import { sql } from 'drizzle-orm'
import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { campaigns } from './campaigns.ts'
import { systems } from './systems.ts'
import { trackedColumns } from './tracked.ts'

/**
 * Las criaturas en juego de una campaña (docs/specs/criaturas.md): una entrada del compendio (del sistema o del mundo,
 * por su clave) puesta en juego, con su nombre, su número de copia (las únicas, sin número) y lo de la partida aparte,
 * como un personaje (`play`). Su hoja es la entrada calculada con eso encima; `overrides`, el máximo de unos recursos
 * (sus PG tirados u otro máximo). Una única por entrada y campaña
 */
export const campaignCreatures = pgTable(
  'campaign_creatures',
  {
    ...trackedColumns(),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    systemId: uuid()
      .notNull()
      .references(() => systems.id, { onDelete: 'cascade' }),
    key: text().notNull(),
    name: text().notNull(),
    number: integer(),
    unique: boolean().notNull().default(false),
    play: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    overrides: jsonb().$type<Record<string, number>>().notNull().default({}),
    // Oculta a los jugadores (docs/specs/compendio-jugadores.md): por defecto, a la vista
    hidden: boolean().notNull().default(false)
  },
  (t) => [
    index().on(t.campaignId),
    uniqueIndex('campaign_creatures_unique').on(t.campaignId, t.key).where(sql`${t.unique}`)
  ]
)
