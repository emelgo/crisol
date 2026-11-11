import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  bigint,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core'
import { organizations } from './organizations.ts'
import { trackedColumns } from './tracked.ts'
import { worlds } from './worlds.ts'

/**
 * Una carpeta para ordenar los archivos de un ámbito (un mundo o los comunes de una organización), dentro de otra o en
 * lo más alto. Solo ordena: el nombre de un archivo sigue siendo único en todo su ámbito, para que `![[nombre]]` no
 * dependa de dónde esté. Al borrarla, lo que tenía pasa a la de arriba
 */
export const fileFolders = pgTable(
  'file_folders',
  {
    ...trackedColumns(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** Sin mundo, es de los comunes */
    worldId: uuid().references(() => worlds.id, { onDelete: 'cascade' }),
    /** Sin madre, en lo más alto */
    parentId: uuid().references((): AnyPgColumn => fileFolders.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    /**
     * Su puesto entre sus hermanas: una clave de orden fraccionaria (collation "C"), como la de las páginas. Sin ella,
     * por nombre detrás de las que la tienen; se rellena al reordenar por primera vez
     */
    position: text(),
    /** Su color (uno de los fijos o #rrggbb, como el de un mundo o una etiqueta): tiñe su icono */
    color: text(),
    /** Su icono, un emoji como el de una página; sin él, el de una carpeta */
    icon: text()
  },
  (t) => [
    index().on(t.worldId),
    index().on(t.organizationId),
    index().on(t.parentId),
    // El nombre no se repite entre hermanas (sin mayúsculas)
    uniqueIndex('file_folders_name').on(
      sql`coalesce(${t.worldId}, ${t.organizationId})`,
      sql`coalesce(${t.parentId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`lower(${t.name})`
    )
  ]
)

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
    /** Su carpeta; sin ella, en lo más alto */
    folderId: uuid().references(() => fileFolders.id, { onDelete: 'set null' }),
    /** Su puesto entre los archivos de su carpeta, como el de las carpetas (sin él, por nombre, detrás) */
    position: text(),
    kind: text({ enum: ['image', 'pdf', 'other'] }).notNull(),
    mime: text().notNull(),
    size: bigint({ mode: 'number' }).notNull(),
    hash: text().notNull(),
    storageKey: text().notNull(),
    /** Sus etiquetas, de las de la cuenta (ADR-0006) */
    tags: text().array().notNull().default(sql`'{}'::text[]`),
    deletedAt: timestamp({ withTimezone: true })
  },
  (t) => [
    index().on(t.worldId),
    index().on(t.organizationId),
    index().on(t.folderId),
    uniqueIndex('files_name')
      .on(t.worldId, sql`lower(${t.name})`)
      .where(sql`${t.worldId} is not null and ${t.deletedAt} is null`),
    uniqueIndex('files_common_name')
      .on(t.organizationId, sql`lower(${t.name})`)
      .where(sql`${t.worldId} is null and ${t.deletedAt} is null`),
    check('files_kind', sql`${t.kind} in ('image', 'pdf', 'other')`)
  ]
)
