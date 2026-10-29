import { sql } from 'drizzle-orm'
import { check, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
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
