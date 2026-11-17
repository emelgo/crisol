import type { CalendarDefinition } from '@crisol/domain'
import { sql } from 'drizzle-orm'
import { boolean, index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { trackedColumns } from './tracked.ts'
import { worlds } from './worlds.ts'

/**
 * Los calendarios de un mundo (módulo 8, ADR-0029): en su orden, uno principal (el de las fechas por defecto) y su
 * definición entera, validada antes de guardarla. Las fechas no se guardan aquí: van con su calendario por su id
 */
export const calendars = pgTable(
  'calendars',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    /** Orden fraccionario, como el árbol */
    position: text().notNull(),
    isPrimary: boolean().notNull().default(false),
    definition: jsonb().$type<CalendarDefinition>().notNull()
  },
  (t) => [index().on(t.worldId), uniqueIndex('calendars_one_primary').on(t.worldId).where(sql`${t.isPrimary}`)]
)
