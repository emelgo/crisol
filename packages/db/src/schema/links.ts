import { sql } from 'drizzle-orm'
import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { documents } from './documents.ts'
import { pages } from './pages.ts'
import { worlds } from './worlds.ts'

/**
 * Los enlaces de la wiki (ADR-0003): de qué página y de qué documento salen (el cuerpo o un secreto) y adónde van. Salen
 * del texto: se rehacen con cada guardado y no pasan por el historial. Sin página de destino, está sin resolver: se
 * guarda su nombre (target_key, sin mayúsculas) para resolverlo cuando aparezca
 */
export const pageLinks = pgTable(
  'page_links',
  {
    id: uuid().primaryKey().defaultRandom(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    sourcePageId: uuid()
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    sourceDocumentId: uuid()
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    targetPageId: uuid().references(() => pages.id, { onDelete: 'set null' }),
    // Como se escribió (para enseñarlo) y como se compara
    targetTitle: text().notNull(),
    targetKey: text().notNull(),
    // La sección o el bloque (^id), si va a uno
    anchor: text()
  },
  (t) => [
    index().on(t.sourceDocumentId),
    index().on(t.targetPageId),
    index('page_links_unresolved').on(t.worldId, t.targetKey).where(sql`${t.targetPageId} is null`)
  ]
)
