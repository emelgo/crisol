import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations.ts'
import { pages } from './pages.ts'
import { trackedColumns } from './tracked.ts'

/**
 * Las plantillas de página de una cuenta (su organización), hechas desde cero o copiando otra (ADR-0009). Desde el
 * ADR-0024 cada una es una página del mundo oculto de la cuenta (page_id): esta fila es su ficha (su página, su linaje);
 * sus campos, panel y esqueleto quedan como estaban hasta que se abre por primera vez y pasan a su página. Borrar una la
 * aparta (deleted_at): sus páginas siguen diciendo de cuál salieron y el historial la puede traer de vuelta
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
    deletedAt: timestamp({ withTimezone: true }),
    /** Su página, en el mundo oculto de la cuenta (ADR-0024); sin ella, aún no se ha abierto desde entonces */
    pageId: uuid().references(() => pages.id, { onDelete: 'set null' })
  },
  (t) => [index().on(t.organizationId), index('page_templates_line').using('gin', t.line)]
)
