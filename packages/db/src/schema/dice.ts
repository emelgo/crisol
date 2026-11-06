import { sql } from 'drizzle-orm'
import { bigint, boolean, check, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth.ts'
import { campaigns } from './campaigns.ts'
import { worlds } from './worlds.ts'

/** Lo que se guarda de una tirada ya resuelta: el total, cada dado, el crítico y el desglose */
export interface StoredRoll {
  total: number
  detail: string
  critical: 'high' | 'low' | null
  dice: { sides: number | 'F'; value: number; kept: boolean }[]
  /** Si fue en una tabla aleatoria: su nombre y lo que salió (con lo de sus tablas anidadas) */
  table?: { name: string; results: { text: string; page: string | null }[] }
  /** El daño (o la curación) de una acción, parte a parte con su tipo: para aplicarlo a quien lo recibe */
  apply?: { kind: 'damage' | 'heal'; parts: { amount: number; type: string | null }[] }
}

/**
 * Las tiradas de una campaña (ADR-0010). No pasan por operation(): una tirada no se deshace, y el registro es su propia
 * lista. n da el orden (dos tiradas pueden caer en el mismo instante)
 */
export const diceRolls = pgTable(
  'dice_rolls',
  {
    id: uuid().primaryKey().defaultRandom(),
    n: bigint({ mode: 'number' }).generatedAlwaysAsIdentity(),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** La tiró la IA, con la cuenta del máster */
    ai: boolean().notNull().default(false),
    formula: text().notNull(),
    label: text(),
    visibility: text({ enum: ['all', 'self', 'master', 'hidden'] }).notNull(),
    result: jsonb().$type<StoredRoll>().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index().on(t.campaignId, t.n),
    index().on(t.userId, t.createdAt),
    check('dice_rolls_visibility', sql`${t.visibility} in ('all', 'self', 'master', 'hidden')`)
  ]
)
