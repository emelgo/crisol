import { jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth.ts'
import { worlds } from './worlds.ts'

/**
 * Lo que cada cuenta tiene a mano en la wiki de un mundo: las pestañas abiertas y los marcadores. Son preferencias
 * suyas, no datos del mundo: no van al historial ni se deshacen
 */
export const wikiPreferences = pgTable(
  'wiki_preferences',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    tabs: jsonb().$type<{ pageId: string; pinned: boolean }[]>().notNull().default([]),
    bookmarks: jsonb().$type<{ name: string; pages: string[] }[]>().notNull().default([]),
    // Las páginas con hoja que la cuenta prefiere leer en la vista sencilla
    simplePages: jsonb().$type<string[]>().notNull().default([]),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull()
  },
  (t) => [unique().on(t.userId, t.worldId)]
)
