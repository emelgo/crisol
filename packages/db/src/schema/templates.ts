import { sql } from 'drizzle-orm'
import { type AnyPgColumn, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations.ts'
import { pages } from './pages.ts'
import { trackedColumns } from './tracked.ts'

/**
 * Una carpeta para ordenar las plantillas de una cuenta (ADR-0024), dentro de otra o en lo más alto: como las de
 * archivos, con su color, su icono y su puesto entre sus hermanas. Solo ordena. Borrarla se lleva lo que tiene dentro
 */
export const templateFolders = pgTable(
  'template_folders',
  {
    ...trackedColumns(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** Sin madre, en lo más alto */
    parentId: uuid().references((): AnyPgColumn => templateFolders.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    /** Su puesto entre sus hermanas (clave fraccionaria, collation "C"); sin él, por nombre detrás de las que lo tienen */
    position: text(),
    /** Su color (uno de los fijos o #rrggbb) y su icono (un emoji), como las carpetas de archivos */
    color: text(),
    icon: text()
  },
  (t) => [
    index().on(t.organizationId),
    index().on(t.parentId),
    // El nombre no se repite entre hermanas (sin mayúsculas)
    uniqueIndex('template_folders_name').on(
      t.organizationId,
      sql`coalesce(${t.parentId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`lower(${t.name})`
    )
  ]
)

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
    pageId: uuid().references(() => pages.id, { onDelete: 'set null' }),
    /** Su carpeta (sin ella, en lo más alto) y su puesto entre las de allí, como un archivo */
    folderId: uuid().references(() => templateFolders.id, { onDelete: 'set null' }),
    position: text()
  },
  (t) => [index().on(t.organizationId), index('page_templates_line').using('gin', t.line), index().on(t.folderId)]
)
