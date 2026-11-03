import { sql } from 'drizzle-orm'
import { type AnyPgColumn, boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { trackedColumns } from './tracked.ts'
import { tsvector } from './tsvector.ts'
import { worlds } from './worlds.ts'

/**
 * Una página de la wiki: la fila con su sitio en el árbol y lo que no es el cuerpo (ADR-0003). El cuerpo va en Yjs,
 * aparte. position es una clave de orden fraccionaria entre sus hermanas: se compara con la collation "C"
 */
export const pages = pgTable(
  'pages',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    // Sin padre: en el primer nivel del mundo. Al purgar una página se van sus subpáginas
    parentId: uuid().references((): AnyPgColumn => pages.id, { onDelete: 'cascade' }),
    position: text().notNull(),
    title: text().notNull(),
    // Un emoji, o nada
    icon: text(),
    properties: jsonb().$type<unknown[]>().notNull().default([]),
    // Pone el editor en lectura; no es un permiso
    locked: boolean().notNull().default(false),
    // La imagen de cabecera (un archivo del mundo) y su punto de encuadre, en % del ancho y del alto
    cover: jsonb().$type<{ fileId: string; x: number; y: number; zoom?: number } | null>(),
    // Lo que se busca de la página además de su texto: el título y sus propiedades, con el peso de un título (la
    // función, en la migración 0018)
    searchTsv: tsvector().generatedAlwaysAs(
      sql`setweight(to_tsvector('es_unaccent'::regconfig, crisol_page_text(title, properties)), 'A')`
    ),
    // Los ajustes de la hoja; null: no se ve como hoja
    sheet: jsonb().$type<Record<string, unknown> | null>(),
    // El panel a su lado: bloques con datos de toda la página (ADR-0008)
    panel: jsonb().$type<unknown[]>().notNull().default([]),
    /** En la papelera desde entonces, con sus subpáginas: no sale en ninguna vista y a los 30 días se purga */
    deletedAt: timestamp({ withTimezone: true })
  },
  (t) => [
    index().on(t.worldId, t.parentId),
    index().on(t.parentId),
    index().on(t.deletedAt),
    index('pages_search').using('gin', t.searchTsv)
  ]
)
