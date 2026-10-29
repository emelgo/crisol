import { sql } from 'drizzle-orm'
import { boolean, check, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { campaigns } from './campaigns.ts'
import { trackedColumns } from './tracked.ts'

/**
 * El enlace de invitación de una campaña: uno por campaña. Se busca por el hash del secreto y el secreto se guarda
 * cifrado con la clave del servidor, para que el máster lo pueda volver a ver (una filtración solo de la base de
 * datos no da enlaces válidos)
 */
export const invitationLinks = pgTable(
  'invitation_links',
  {
    ...trackedColumns(),
    campaignId: uuid()
      .notNull()
      .unique()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    // El rol que da: siempre player en el módulo 0 (más adelante, spectator; nunca master)
    role: text({ enum: ['player'] })
      .notNull()
      .default('player'),
    tokenHash: text().notNull().unique(),
    secretSealed: text().notNull(),
    open: boolean().notNull().default(true),
    /** Cuándo se generó el enlace actual */
    issuedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    /** Cuántos han entrado con el enlace actual */
    joins: integer().notNull().default(0)
  },
  (t) => [check('invitation_links_role', sql`${t.role} in ('player')`)]
)
