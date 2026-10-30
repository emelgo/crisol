import { sql } from 'drizzle-orm'
import { index, integer, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core'
import { documents } from './documents.ts'
import { pages } from './pages.ts'
import { tsvector } from './tsvector.ts'
import { worlds } from './worlds.ts'

/**
 * Lo que se busca del texto de la wiki (ADR-0003): cada documento (el cuerpo de una página o un secreto suyo) en sus
 * secciones, lo de debajo de cada título. Sale del texto: se rehace con cada guardado y no pasa por el historial. El
 * vector va en español sin tildes, con el título de la sección por delante
 */
export const searchSections = pgTable(
  'search_sections',
  {
    id: uuid().primaryKey().defaultRandom(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    pageId: uuid()
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    documentId: uuid()
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    // body, secret o note: lo de un secreto sale marcado
    kind: text().notNull(),
    position: integer().notNull(),
    // El título de la sección y el id de su bloque (null: lo de antes del primer título)
    heading: text(),
    headingId: text(),
    body: text().notNull(),
    tsv: tsvector().generatedAlwaysAs(
      sql`setweight(to_tsvector('es_unaccent'::regconfig, coalesce(heading, '')), 'A') || setweight(to_tsvector('es_unaccent'::regconfig, body), 'B')`
    )
  },
  (t) => [index().on(t.documentId), index().on(t.worldId), index('search_sections_tsv').using('gin', t.tsv)]
)

/**
 * Las palabras de cada mundo, sin tildes, para las erratas: la palabra buscada se amplía con las parecidas que de
 * verdad están. Las llenan triggers de search_sections y de pages; las que dejan de usarse no estorban
 */
export const searchWords = pgTable(
  'search_words',
  {
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    word: text().notNull()
  },
  (t) => [
    primaryKey({ columns: [t.worldId, t.word] }),
    index('search_words_trgm').using('gin', sql`${t.word} gin_trgm_ops`)
  ]
)
