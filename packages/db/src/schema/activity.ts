import { pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth.ts'
import { campaigns } from './campaigns.ts'

/**
 * La última visita de cada cuenta al centro de actividad de una campaña (docs/specs/modulo-8-10-campana.md, decisión
 * 19): lo nuevo es lo de después. Se pone al marcarlo como visto o al salir del centro, nunca con cada carga. Es estado
 * de quien lo mira, como lo nuevo de un jugador: no va al historial
 */
export const campaignVisits = pgTable(
  'campaign_visits',
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    seenAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [primaryKey({ columns: [t.userId, t.campaignId] })]
)
