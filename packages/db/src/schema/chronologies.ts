import type { ChronologyFilter, DateValue, EventImage } from '@crisol/domain'
import { sql } from 'drizzle-orm'
import { boolean, index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { calendars } from './calendars.ts'
import { pageTabs } from './maps.ts'
import { pages } from './pages.ts'
import { trackedColumns } from './tracked.ts'
import { worlds } from './worlds.ts'

/**
 * Las cronologías de un mundo (módulo 8; ADR-0031): cada una es una pestaña de una página (como un mapa), con su
 * calendario (null: el principal) y su filtro. No guardan eventos: los juntan al leer
 */
export const chronologies = pgTable(
  'chronologies',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    /** Su pestaña: el nombre, el orden y quién la ve son los de ella */
    tabId: uuid()
      .notNull()
      .unique()
      .references(() => pageTabs.id, { onDelete: 'cascade' }),
    calendarId: uuid().references(() => calendars.id, { onDelete: 'set null' }),
    filter: jsonb().$type<ChronologyFilter>().notNull()
  },
  (t) => [index().on(t.worldId)]
)

/** Los grupos de los eventos de un mundo (los carriles de la vista de meses): nombre, color y orden */
export const timelineGroups = pgTable(
  'timeline_groups',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    color: text(),
    position: text().notNull()
  },
  (t) => [index().on(t.worldId)]
)

/**
 * Los eventos sueltos de un mundo: no van en el árbol, se leen en sus cronologías. Su fecha es un valor «fecha» como
 * el de las propiedades (con su calendario); su página enlazada sobrevive a borrarla
 */
export const timelineEvents = pgTable(
  'timeline_events',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    /** Vacío: el de su página */
    title: text().notNull().default(''),
    date: jsonb().$type<DateValue>().notNull(),
    /** De la paleta del mundo o #rrggbb; null, el de su grupo */
    color: text(),
    image: jsonb().$type<EventImage | null>(),
    icon: text(),
    description: text().notNull().default(''),
    groupId: uuid().references(() => timelineGroups.id, { onDelete: 'set null' }),
    pageId: uuid().references(() => pages.id, { onDelete: 'set null' }),
    hidden: boolean().notNull().default(false)
  },
  (t) => [
    index().on(t.worldId),
    index().on(t.pageId),
    index('timeline_events_calendar').on(sql`(${t.date}->>'calendarId')`)
  ]
)
