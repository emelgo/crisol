import { sql } from 'drizzle-orm'
import { boolean, check, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth.ts'
import { campaigns } from './campaigns.ts'
import { pages } from './pages.ts'
import { trackedColumns } from './tracked.ts'
import { worlds } from './worlds.ts'

export const KNOWLEDGE_KINDS = ['page', 'secret', 'tab', 'pin', 'element', 'content', 'event', 'chronology'] as const

/**
 * Lo que sabe cada campaña (ADR-0017): una marca por campaña (o por mundo, sin campaña) y cosa: una página (con
 * herencia a sus subpáginas, que se calcula al leer), un secreto, una pestaña, un pin, una región, una entrada del
 * compendio del mundo, un evento suelto o una cronología (módulo 8). Sin fila, hereda. Pasa por el historial: revelar se deshace
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
    check(
      'knowledge_kind',
      sql`${t.kind} in ('page', 'secret', 'tab', 'pin', 'element', 'content', 'event', 'chronology')`
    )
  ]
)

/**
 * Lo nuevo de cada jugador (docs/specs/revelar.md): lo que se le reveló y aún no ha abierto, con la página donde está.
 * No pasa por el historial (como los avisos): se borra al abrir esa página o al ocultarlo otra vez
 */
export const knowledgeNews = pgTable(
  'knowledge_news',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    kind: text({ enum: KNOWLEDGE_KINDS }).notNull(),
    targetId: text().notNull(),
    // La página donde está (la de un secreto, una pestaña o un pin); sin ella, una entrada del mundo
    pageId: uuid().references(() => pages.id, { onDelete: 'cascade' }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull()
  },
  (t) => [unique('knowledge_news_one').on(t.userId, t.campaignId, t.kind, t.targetId), index().on(t.campaignId)]
)

/**
 * Quién de una campaña puede escribir en una página (docs/specs/pagina-de-jugadores.md): toda la campaña o unos
 * personajes (sus dueños). Solo el cuerpo, en vivo; no se hereda a las subpáginas. Pasa por el historial
 */
export const pageEditors = pgTable(
  'page_editors',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    pageId: uuid()
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    // null: toda la campaña; si no, esos personajes
    characters: uuid().array()
  },
  (t) => [unique('page_editors_one').on(t.campaignId, t.pageId), index().on(t.pageId)]
)
