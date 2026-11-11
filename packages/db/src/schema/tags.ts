import { sql } from 'drizzle-orm'
import { index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations.ts'
import { trackedColumns } from './tracked.ts'

/**
 * Las etiquetas de una cuenta (su organización), que llevan sus páginas (en la propiedad `etiquetas`) y sus archivos
 * (`files.tags`) (ADR-0006). La jerarquía va en el nombre, con «/» («lugar/ciudad»); una madre puede no tener fila. El
 * nombre no se repite en la organización, sin mirar mayúsculas
 */
export const tags = pgTable(
  'tags',
  {
    ...trackedColumns(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    /** Uno de la paleta de los mundos; sin él, gris */
    color: text(),
    /**
     * Su puesto entre sus hermanas: una clave de orden fraccionaria (collation "C"), como la de las páginas. Sin ella, por
     * nombre detrás de las que la tienen; se rellena al reordenar por primera vez
     */
    position: text()
  },
  (t) => [index().on(t.organizationId), uniqueIndex('tags_name').on(t.organizationId, sql`lower(${t.name})`)]
)
