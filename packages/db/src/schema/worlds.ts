import { sql } from 'drizzle-orm'
import { check, index, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth.ts'
import { organizations } from './organizations.ts'
import { trackedColumns } from './tracked.ts'

export const worlds = pgTable(
  'worlds',
  {
    ...trackedColumns(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    /** Una línea que sale en su tarjeta */
    description: text().notNull().default(''),
    /** El icono de su tarjeta, de los que ofrece la interfaz; sin él, uno por defecto */
    icon: text(),
    /** El color de la portada cuando no hay imagen */
    color: text(),
    /** La portada: una imagen del mundo y su encuadre */
    cover: jsonb().$type<{ fileId: string; x: number; y: number } | null>(),
    /** En la papelera desde entonces: no sale en ninguna vista y a los 30 días se purga */
    deletedAt: timestamp({ withTimezone: true })
  },
  (t) => [index().on(t.organizationId), index().on(t.deletedAt)]
)

/** master: lo administra. Reservado para más adelante: comaster */
export const worldMembers = pgTable(
  'world_members',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text({ enum: ['master'] }).notNull()
  },
  (t) => [
    unique().on(t.worldId, t.userId),
    index().on(t.userId),
    check('world_members_role', sql`${t.role} in ('master')`)
  ]
)
