import { sql } from 'drizzle-orm'
import { check, index, integer, pgTable, primaryKey, text, timestamp, uuid, vector } from 'drizzle-orm/pg-core'
import { documents } from './documents.ts'
import { files } from './files.ts'
import { pages } from './pages.ts'
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

/** Las dimensiones del vector de cada trozo (las de multilingual-e5-small) */
export const EMBEDDING_DIMENSIONS = 384

/**
 * Los trozos para buscar por significado (docs/specs/biblioteca.md): unos 300 tokens de una página de un libro o de una
 * sección de la wiki, con su vector (null mientras no se ha calculado). Salen del texto: no pasan por el historial. Su
 * huella deja reutilizar el vector de un trozo que no ha cambiado
 */
export const searchChunks = pgTable(
  'search_chunks',
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: uuid().notNull(),
    /** Sin mundo, de los comunes */
    worldId: uuid(),
    source: text({ enum: ['book', 'page'] }).notNull(),
    fileId: uuid().references(() => files.id, { onDelete: 'cascade' }),
    page: integer(),
    documentId: uuid().references(() => documents.id, { onDelete: 'cascade' }),
    pageId: uuid().references(() => pages.id, { onDelete: 'cascade' }),
    headingId: text(),
    position: integer().notNull().default(0),
    text: text().notNull(),
    hash: text().notNull(),
    embedding: vector({ dimensions: EMBEDDING_DIMENSIONS })
  },
  (t) => [
    index().on(t.fileId),
    index().on(t.documentId),
    index().on(t.worldId),
    index('search_chunks_pending').on(t.id).where(sql`${t.embedding} is null`),
    index('search_chunks_embedding').using('hnsw', t.embedding.op('vector_cosine_ops')),
    check('search_chunks_source', sql`${t.source} in ('book', 'page')`)
  ]
)
