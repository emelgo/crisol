import { type AnyPgColumn, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth.ts'
import { campaigns } from './campaigns.ts'
import { trackedColumns } from './tracked.ts'

/**
 * Las notas de un jugador en una campaña (docs/specs/notas-jugador.md, ADR-0022 § 6): páginas de Markdown en un árbol
 * propio, aparte de la wiki (ni su árbol, ni su búsqueda, ni lo que sabe la campaña). Las escribe su autor y las leen
 * él y los másteres. position, como en las páginas: una clave de orden fraccionaria entre sus hermanas (collation "C")
 */
export const playerNotes = pgTable(
  'player_notes',
  {
    ...trackedColumns(),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    // Si se borra su cuenta, se van con ella
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // Sin madre: en el primer nivel. Al purgar una nota se van sus subnotas
    parentId: uuid().references((): AnyPgColumn => playerNotes.id, { onDelete: 'cascade' }),
    position: text().notNull(),
    title: text().notNull().default(''),
    // Un emoji, o nada
    icon: text(),
    markdown: text().notNull().default(''),
    /** En la papelera desde entonces, con sus subnotas: a los 30 días se purga */
    deletedAt: timestamp({ withTimezone: true })
  },
  (t) => [index().on(t.campaignId, t.userId), index().on(t.parentId), index().on(t.deletedAt)]
)
