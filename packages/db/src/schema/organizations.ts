import { sql } from 'drizzle-orm'
import { check, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth.ts'
import { trackedColumns } from './tracked.ts'

export const organizations = pgTable('organizations', {
  ...trackedColumns(),
  name: text().notNull()
})

/** owner: crea mundos y lo ve todo. member: entra por alguna campaña */
export const organizationMembers = pgTable(
  'organization_members',
  {
    ...trackedColumns(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text({ enum: ['owner', 'member'] }).notNull()
  },
  (t) => [
    unique().on(t.organizationId, t.userId),
    index().on(t.userId),
    check('organization_members_role', sql`${t.role} in ('owner', 'member')`)
  ]
)

/** Enlace de un solo uso para crear la cuenta del propietario. Del secreto solo se guarda el hash */
export const bootstrapTokens = pgTable('bootstrap_tokens', {
  id: uuid().primaryKey().defaultRandom(),
  organizationId: uuid()
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  tokenHash: text().notNull().unique(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  usedAt: timestamp({ withTimezone: true }),
  usedBy: text().references(() => user.id, { onDelete: 'set null' }),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull()
})
