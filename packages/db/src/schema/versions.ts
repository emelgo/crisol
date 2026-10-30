import { index, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth.ts'
import { bytea, documents } from './documents.ts'
import { pages } from './pages.ts'
import { trackedColumns } from './tracked.ts'
import { worlds } from './worlds.ts'

/**
 * En qué versión está el texto de cada página (ADR-0003). Es la fila que tocan las sesiones de edición en el historial:
 * va aparte de `pages` para que editar el texto y cambiar el título no choquen al deshacer. Solo lleva ids y huellas,
 * nunca el texto: el historial no puede filtrar un secreto
 */
export const pageBodies = pgTable(
  'page_bodies',
  {
    ...trackedColumns(),
    pageId: uuid()
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    // La versión con lo que hay ahora (null: aún ninguna)
    versionId: uuid(),
    // La huella del contenido (el cuerpo y sus secretos), para ver si cambió sin mirar el texto
    fingerprint: text().notNull()
  },
  (t) => [uniqueIndex('page_bodies_page').on(t.pageId)]
)

/** Una versión de una página: cómo estaban su cuerpo y sus secretos al cerrarse una sesión (o al escribir Claude) */
export const pageVersions = pgTable(
  'page_versions',
  {
    id: uuid().primaryKey().defaultRandom(),
    pageId: uuid()
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    createdBy: text().references(() => user.id, { onDelete: 'set null' }),
    via: text({ enum: ['ui', 'ai', 'system'] }).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull()
  },
  (t) => [index().on(t.pageId, t.createdAt)]
)

/** El estado de un documento en un momento, por su huella: lo comparten las versiones en que no cambió */
export const snapshots = pgTable(
  'snapshots',
  {
    id: uuid().primaryKey().defaultRandom(),
    documentId: uuid()
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    hash: text().notNull(),
    state: bytea().notNull()
  },
  (t) => [uniqueIndex('snapshots_document_hash').on(t.documentId, t.hash)]
)

/** Qué estado tenía cada documento de la página en una versión */
export const versionDocuments = pgTable(
  'version_documents',
  {
    versionId: uuid()
      .notNull()
      .references(() => pageVersions.id, { onDelete: 'cascade' }),
    documentId: uuid()
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    kind: text({ enum: ['body', 'secret', 'note'] }).notNull(),
    snapshotId: uuid()
      .notNull()
      .references(() => snapshots.id, { onDelete: 'cascade' })
  },
  (t) => [primaryKey({ columns: [t.versionId, t.documentId] }), index().on(t.snapshotId)]
)
