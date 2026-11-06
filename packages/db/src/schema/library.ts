import { sql } from 'drizzle-orm'
import { check, index, integer, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { files } from './files.ts'
import { tsvector } from './tsvector.ts'

/**
 * El texto de los PDF (docs/specs/biblioteca.md): cómo va su lectura (pendiente, leyendo con su avance, hecho, sin
 * texto o fallido) y de qué versión del archivo (su huella: si se cambia, se vuelve a leer). Sale del archivo: no pasa
 * por el historial
 */
export const fileTexts = pgTable(
  'file_texts',
  {
    fileId: uuid()
      .primaryKey()
      .references(() => files.id, { onDelete: 'cascade' }),
    status: text({ enum: ['pending', 'reading', 'done', 'empty', 'failed'] }).notNull(),
    hash: text().notNull(),
    pages: integer().notNull().default(0),
    read: integer().notNull().default(0),
    error: text(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull()
  },
  (t) => [check('file_texts_status', sql`${t.status} in ('pending', 'reading', 'done', 'empty', 'failed')`)]
)

/** El texto de cada página de un PDF, con su vector de búsqueda en español sin tildes (como la wiki) */
export const filePages = pgTable(
  'file_pages',
  {
    fileId: uuid()
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    page: integer().notNull(),
    text: text().notNull(),
    tsv: tsvector().generatedAlwaysAs(sql`to_tsvector('es_unaccent'::regconfig, text)`)
  },
  (t) => [primaryKey({ columns: [t.fileId, t.page] }), index('file_pages_tsv').using('gin', t.tsv)]
)
