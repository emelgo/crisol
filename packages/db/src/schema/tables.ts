import { boolean, index, jsonb, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core'
import { campaigns } from './campaigns.ts'
import { pageTabs } from './maps.ts'
import { trackedColumns } from './tracked.ts'
import { worlds } from './worlds.ts'

/** Una fila de una tabla aleatoria: su rango, su texto (que puede llevar tiradas) y, si se dice, una página u otra tabla */
export interface TableRow {
  id: string
  from: number
  to: number
  text: string
  /** Una página del mundo a la que lleva */
  page?: string | null
  /** Otra tabla (la pestaña de su página) en la que se tira también */
  table?: string | null
}

/**
 * Las tablas aleatorias del máster (docs/specs/personajes.md § tablas): una pestaña «Tabla» de una página, con su
 * fórmula (sin ella, 1dN por la última fila), sus filas y si lo sacado vuelve a salir
 */
export const randomTables = pgTable(
  'random_tables',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    tabId: uuid()
      .notNull()
      .unique()
      .references(() => pageTabs.id, { onDelete: 'cascade' }),
    formula: text(),
    /** Con reemplazo (lo de siempre): lo sacado puede volver a salir; sin él, no hasta reiniciarla */
    replacement: boolean().notNull().default(true),
    rows: jsonb().$type<TableRow[]>().notNull().default([])
  },
  (t) => [index().on(t.worldId)]
)

/** Lo sacado de una tabla sin reemplazo, por campaña: no pasa por el historial (como las tiradas) */
export const randomTableDraws = pgTable(
  'random_table_draws',
  {
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    tableId: uuid()
      .notNull()
      .references(() => randomTables.id, { onDelete: 'cascade' }),
    rows: jsonb().$type<string[]>().notNull().default([])
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.tableId] })]
)
