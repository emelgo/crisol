import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid
} from 'drizzle-orm/pg-core'
import { user } from './auth.ts'
import { organizations } from './organizations.ts'

/** Una operación: lo que cambió una petición (de una persona o de la IA), en una sola transacción */
export const operations = pgTable(
  'operations',
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // Sin clave ajena: el historial sobrevive a la purga de un mundo
    worldId: uuid(),
    // La campaña de lo que cambió, si la tiene (el centro de actividad la lee de aquí); sin clave ajena, como el mundo
    campaignId: uuid(),
    actorId: text().references(() => user.id, { onDelete: 'set null' }),
    via: text({ enum: ['ui', 'ai', 'system'] }).notNull(),
    tool: text(),
    // Qué se hizo: la acción y sus datos; el texto lo pone la interfaz (i18n)
    action: text().notNull(),
    details: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    undoesId: uuid().references((): AnyPgColumn => operations.id, { onDelete: 'set null' }),
    undoneById: uuid().references((): AnyPgColumn => operations.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull()
  },
  (t) => [
    index().on(t.organizationId, t.createdAt),
    index().on(t.worldId, t.createdAt),
    index().on(t.campaignId, t.createdAt),
    check('operations_via', sql`${t.via} in ('ui', 'ai', 'system')`)
  ]
)

/** Un cambio de una fila: cómo estaba antes y después (filas completas, en JSON de Postgres) */
export const changes = pgTable(
  'changes',
  {
    id: uuid().primaryKey().defaultRandom(),
    operationId: uuid()
      .notNull()
      .references(() => operations.id, { onDelete: 'cascade' }),
    seq: integer().notNull(),
    tableName: text().notNull(),
    rowId: uuid().notNull(),
    before: jsonb(),
    after: jsonb()
  },
  (t) => [unique().on(t.operationId, t.seq), index().on(t.tableName, t.rowId)]
)
