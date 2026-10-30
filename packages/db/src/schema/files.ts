import { sql } from 'drizzle-orm'
import { bigint, check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations.ts'
import { trackedColumns } from './tracked.ts'
import { worlds } from './worlds.ts'

/**
 * Un archivo (imágenes, PDF y lo demás): de un mundo o, sin mundo, común a todos los de su organización (ADR-0005).
 * Pasa por el historial; sus bytes no: van en el almacenamiento, por su clave. Reemplazarlo pone una clave nueva (así
 * deshacer vuelve a la anterior). El nombre no se repite en su ámbito (sin mayúsculas, entre los que no están en la
 * papelera): `![[nombre]]` lo encuentra, primero en el mundo y luego en los comunes
 */
export const files = pgTable(
  'files',
  {
    ...trackedColumns(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** Sin mundo, es común */
    worldId: uuid().references(() => worlds.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    kind: text({ enum: ['image', 'pdf', 'other'] }).notNull(),
    mime: text().notNull(),
    size: bigint({ mode: 'number' }).notNull(),
    hash: text().notNull(),
    storageKey: text().notNull(),
    deletedAt: timestamp({ withTimezone: true })
  },
  (t) => [
    index().on(t.worldId),
    index().on(t.organizationId),
    uniqueIndex('files_name')
      .on(t.worldId, sql`lower(${t.name})`)
      .where(sql`${t.worldId} is not null and ${t.deletedAt} is null`),
    uniqueIndex('files_common_name')
      .on(t.organizationId, sql`lower(${t.name})`)
      .where(sql`${t.worldId} is null and ${t.deletedAt} is null`),
    check('files_kind', sql`${t.kind} in ('image', 'pdf', 'other')`)
  ]
)
