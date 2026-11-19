import type { FamilyTreeEdge, FamilyTreeNode } from '@crisol/domain'
import { index, jsonb, pgTable, uuid } from 'drizzle-orm/pg-core'
import { pageTabs } from './maps.ts'
import { trackedColumns } from './tracked.ts'
import { worlds } from './worlds.ts'

/**
 * El árbol de una pestaña (genealógico, un organigrama o lo que se quiera: sus líneas no son fijas): sus nodos (una
 * página del mundo o solo un nombre) y sus líneas, en dos listas. Se cambia entero; sus líneas entre páginas cuentan como
 * relaciones del grafo
 */
export const trees = pgTable(
  'trees',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    tabId: uuid()
      .notNull()
      .unique()
      .references(() => pageTabs.id, { onDelete: 'cascade' }),
    nodes: jsonb().$type<FamilyTreeNode[]>().notNull().default([]),
    edges: jsonb().$type<FamilyTreeEdge[]>().notNull().default([])
  },
  (t) => [index().on(t.worldId)]
)
