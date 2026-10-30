import { sql } from 'drizzle-orm'
import { bigint, check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { trackedColumns } from './tracked.ts'
import { worlds } from './worlds.ts'

/**
 * Un archivo del mundo (imágenes, PDF y lo demás). Pasa por el historial; sus bytes no: van en el almacenamiento, por su
 * clave. Reemplazarlo pone una clave nueva (así deshacer vuelve a la anterior). El nombre no se repite en el mundo
 * (sin mayúsculas, entre los que no están en la papelera): `![[nombre]]` lo encuentra
 */
export const files = pgTable(
  'files',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
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
    uniqueIndex('files_name').on(t.worldId, sql`lower(${t.name})`).where(sql`${t.deletedAt} is null`),
    check('files_kind', sql`${t.kind} in ('image', 'pdf', 'other')`)
  ]
)
