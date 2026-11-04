import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations.ts'
import { trackedColumns } from './tracked.ts'

/**
 * Los sistemas de reglas de una cuenta (ADR-0011): el documento entero (validado con @crisol/systems), hechos desde cero,
 * copiando otro o subidos. Los de serie no tienen fila: viven en el código. La versión de la fila es la del sistema:
 * sube con cada cambio, y guardar pide la que se tenía. Borrar uno lo aparta (deleted_at) y el historial lo devuelve
 */
export const systems = pgTable(
  'systems',
  {
    ...trackedColumns(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // De cuál salió (uno de serie, por su id, o uno propio, por su uuid) y en qué versión
    basedOn: jsonb().$type<{ id: string; version: number } | null>(),
    // En texto, no en jsonb: jsonb reordena las claves, y en un sistema el orden (el de los campos) cuenta
    document: text().notNull(),
    deletedAt: timestamp({ withTimezone: true })
  },
  (t) => [index().on(t.organizationId)]
)

/** El contenido de un sistema propio (las clases, los conjuros…): un documento de uno de sus tipos, con su fuente */
export const systemContent = pgTable(
  'system_content',
  {
    ...trackedColumns(),
    systemId: uuid()
      .notNull()
      .references(() => systems.id, { onDelete: 'cascade' }),
    type: text().notNull(),
    key: text().notNull(),
    source: text(),
    data: jsonb().$type<Record<string, unknown>>().notNull()
  },
  (t) => [uniqueIndex().on(t.systemId, t.key), index().on(t.systemId, t.type)]
)
