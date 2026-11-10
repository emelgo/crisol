import { sql } from 'drizzle-orm'
import { boolean, check, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth.ts'
import { campaigns } from './campaigns.ts'
import { worlds } from './worlds.ts'

/** Quién habla en un mensaje: la persona, o un personaje suyo (el máster, también una criatura en juego) */
export type MessageSpeaker = { kind: 'user' } | { kind: 'character' | 'creature'; id: string; name: string }

/** Lo que se enseñó (docs/specs/ensenar.md), si la entrada es eso */
export interface ShownData {
  kind: 'page' | 'image'
  id: string
  title: string
}

/**
 * El registro de la partida de una campaña (docs/specs/registro.md, ADR-0022): sus mensajes y lo enseñado. Las tiradas
 * siguen en dice_rolls y se mezclan al listar. Como ellas, no pasa por operation(): no se deshace. whisper: los
 * destinatarios (ids de cuenta, o «master» por los másteres); null, para todos
 */
export const campaignMessages = pgTable(
  'campaign_messages',
  {
    id: uuid().primaryKey().defaultRandom(),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Lo escribió la IA, con la cuenta de quien la conecta */
    ai: boolean().notNull().default(false),
    kind: text({ enum: ['message', 'shown'] })
      .notNull()
      .default('message'),
    style: text({ enum: ['ic', 'ooc', 'emote'] })
      .notNull()
      .default('ooc'),
    speaker: jsonb().$type<MessageSpeaker>().notNull().default({ kind: 'user' }),
    text: text().notNull().default(''),
    whisper: text().array(),
    shown: jsonb().$type<ShownData>(),
    deletedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index().on(t.campaignId, t.createdAt),
    check('campaign_messages_kind', sql`${t.kind} in ('message', 'shown')`),
    check('campaign_messages_style', sql`${t.style} in ('ic', 'ooc', 'emote')`)
  ]
)
