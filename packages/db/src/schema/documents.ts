import { sql } from 'drizzle-orm'
import { check, customType, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth.ts'
import { pages } from './pages.ts'
import { worlds } from './worlds.ts'

/** Bytes tal cual (bytea): el estado de Yjs */
const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => 'bytea',
  toDriver: (value) => Buffer.from(value),
  fromDriver: (value) => new Uint8Array(value)
})

/**
 * Un documento de Yjs: el cuerpo de una página, o uno de sus secretos o notas ocultas (ADR-0003). Guarda el estado
 * fusionado. No pasa por el historial: lo que cambia el texto lo cuentan las sesiones de edición y las versiones
 */
export const documents = pgTable(
  'documents',
  {
    id: uuid().primaryKey().defaultRandom(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    pageId: uuid()
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    kind: text({ enum: ['body', 'secret', 'note'] }).notNull(),
    state: bytea().notNull(),
    // Su texto plano, para buscar y encontrar menciones (se rehace con cada guardado; null: aún no)
    text: text(),
    // Quien escribió el último (para cerrar su sesión si el servidor se para con ella abierta)
    updatedBy: text().references(() => user.id, { onDelete: 'set null' }),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull()
  },
  (t) => [
    index().on(t.pageId),
    // Un solo cuerpo por página
    uniqueIndex('documents_one_body').on(t.pageId).where(sql`${t.kind} = 'body'`),
    check('documents_kind', sql`${t.kind} in ('body', 'secret', 'note')`)
  ]
)
