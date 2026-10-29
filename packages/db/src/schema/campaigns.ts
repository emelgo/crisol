import { sql } from 'drizzle-orm'
import { check, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth.ts'
import { trackedColumns } from './tracked.ts'
import { worlds } from './worlds.ts'

export const campaigns = pgTable(
  'campaigns',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    /** En la papelera desde entonces: no sale en ninguna vista y a los 30 días se purga */
    deletedAt: timestamp({ withTimezone: true })
  },
  (t) => [index().on(t.worldId), index().on(t.deletedAt)]
)

/** master: la dirige. player: juega en ella. Reservado para más adelante: spectator */
export const campaignMembers = pgTable(
  'campaign_members',
  {
    ...trackedColumns(),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text({ enum: ['master', 'player'] }).notNull()
  },
  (t) => [
    unique().on(t.campaignId, t.userId),
    index().on(t.userId),
    check('campaign_members_role', sql`${t.role} in ('master', 'player')`)
  ]
)
