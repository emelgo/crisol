import { sql } from 'drizzle-orm'
import { boolean, check, index, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'
import { campaigns } from './campaigns.ts'
import { trackedColumns } from './tracked.ts'
import { worlds } from './worlds.ts'

export const KNOWLEDGE_KINDS = ['page', 'secret', 'tab', 'pin', 'element', 'content'] as const

/**
 * Lo que sabe cada campaña (ADR-0017): una marca por campaña (o por mundo, sin campaña) y cosa: una página (con
 * herencia a sus subpáginas, que se calcula al leer), un secreto, una pestaña, un pin, una región o una entrada del
 * compendio del mundo. Sin fila, hereda. Pasa por el historial: revelar se deshace
 */
export const knowledge = pgTable(
  'knowledge',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    // Sin campaña: la capa del mundo (lo que sabe todo el mundo)
    campaignId: uuid().references(() => campaigns.id, { onDelete: 'cascade' }),
    kind: text({ enum: KNOWLEDGE_KINDS }).notNull(),
    // El id de la página, del documento del secreto, de la pestaña, del pin o de la región; la clave de la entrada
    targetId: text().notNull(),
    // La conocen o no la conocen
    known: boolean().notNull(),
    // null: todos; si no, los personajes de la campaña que la conocen (sus dueños la ven)
    characters: uuid().array()
  },
  (t) => [
    unique('knowledge_one').on(t.worldId, t.campaignId, t.kind, t.targetId).nullsNotDistinct(),
    index().on(t.campaignId),
    check('knowledge_kind', sql`${t.kind} in ('page', 'secret', 'tab', 'pin', 'element', 'content')`)
  ]
)
