import { sql } from 'drizzle-orm'
import { check, index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { campaigns } from './campaigns.ts'

/**
 * Las carpetas de la pestaña Actores de una campaña (Enrique, 2026-11-10): para agrupar personajes y criaturas en juego.
 * Es orden de la Mesa, no del mundo: no va al historial (como lo que mira la mesa)
 */
export const actorFolders = pgTable(
  'actor_folders',
  {
    id: uuid().primaryKey().defaultRandom(),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index().on(t.campaignId)]
)

/** Qué personaje o criatura va en cada carpeta (sin fila: fuera de las carpetas) */
export const actorFolderItems = pgTable(
  'actor_folder_items',
  {
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    kind: text({ enum: ['character', 'creature'] }).notNull(),
    actorId: uuid().notNull(),
    folderId: uuid()
      .notNull()
      .references(() => actorFolders.id, { onDelete: 'cascade' })
  },
  (t) => [
    primaryKey({ columns: [t.campaignId, t.kind, t.actorId] }),
    check('actor_folder_items_kind', sql`${t.kind} in ('character', 'creature')`)
  ]
)
