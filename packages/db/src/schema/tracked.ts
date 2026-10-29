import { integer, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth.ts'

/**
 * Columnas de toda tabla de dominio: id, versión (el deshacer la usa para detectar conflictos) y autoría, que pone
 * siempre el servidor. Las escrituras de estas tablas pasan por operation() y quedan en el historial.
 */
export const trackedColumns = () => ({
  id: uuid().primaryKey().defaultRandom(),
  version: integer().notNull().default(1),
  createdBy: text().references(() => user.id, { onDelete: 'set null' }),
  updatedBy: text().references(() => user.id, { onDelete: 'set null' }),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull()
})
