import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations.ts'
import { trackedColumns } from './tracked.ts'

/**
 * Las plantillas de página de una cuenta (su organización), hechas desde cero o copiando otra (ADR-0009). Las de serie
 * no tienen fila: viven en el dominio. Borrar una la aparta (deleted_at): sus páginas siguen diciendo de cuál salieron y
 * el historial la puede traer de vuelta
 */
export const pageTemplates = pgTable(
  'page_templates',
  {
    ...trackedColumns(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    icon: text().notNull(),
    // De cuál se copió (una de serie o una propia), y ella con todas de las que viene
    basedOn: text(),
    line: text().array().notNull(),
    fields: jsonb().$type<unknown[]>().notNull().default([]),
    panel: jsonb().$type<unknown[]>().notNull().default([]),
    skeleton: text().notNull().default(''),
    deletedAt: timestamp({ withTimezone: true })
  },
  (t) => [index().on(t.organizationId), index('page_templates_line').using('gin', t.line)]
)
