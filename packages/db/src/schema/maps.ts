import {
  boolean,
  type AnyPgColumn as Column,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uuid
} from 'drizzle-orm/pg-core'
import { documents } from './documents.ts'
import { files } from './files.ts'
import { pages } from './pages.ts'
import { trackedColumns } from './tracked.ts'
import { worlds } from './worlds.ts'

/**
 * Las pestañas de una página de la wiki además de «Texto» (que es su cuerpo y no se guarda aquí): un mapa, y más
 * adelante una pizarra, una línea temporal… (ADR-0007). position es una clave de orden fraccionaria, como en el árbol
 */
export const pageTabs = pgTable(
  'page_tabs',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    pageId: uuid()
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    kind: text({ enum: ['map', 'text', 'table', 'scene'] }).notNull(),
    /** La de texto, su documento (como un secreto: aparte del cuerpo) */
    documentId: uuid().references((): Column => documents.id, { onDelete: 'set null' }),
    name: text().notNull(),
    position: text().notNull(),
    /** Oculta: el máster la ve atenuada; los jugadores, cuando lleguen (módulo 5), no */
    hidden: boolean().notNull().default(false),
    /** Su color en la barra (uno de los fijos o #rrggbb); null, sin color */
    color: text()
  },
  // Por documento: lo que se busca o enlaza desde una pestaña de texto cuenta solo si la pestaña sigue
  (t) => [index().on(t.pageId), index().on(t.worldId), index().on(t.documentId)]
)

/** El mapa de una pestaña: su imagen (un archivo del mundo) con sus medidas y, si se calibró, su escala */
export const maps = pgTable(
  'maps',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    tabId: uuid()
      .notNull()
      .unique()
      .references(() => pageTabs.id, { onDelete: 'cascade' }),
    /** Sin imagen aún: la pestaña pide una */
    fileId: uuid().references(() => files.id, { onDelete: 'set null' }),
    width: integer(),
    height: integer(),
    /** Un tramo de referencia en píxeles de la imagen y lo que mide de verdad (y su unidad) */
    scaleLength: doublePrecision(),
    scaleValue: doublePrecision(),
    scaleUnit: text()
  },
  (t) => [index().on(t.worldId)]
)

/**
 * Un pin del mapa: dónde (de 0 a 1 sobre la imagen), su nombre, la página a la que lleva y cómo se ve (como en Everlore:
 * color, forma 0-7, variante grande/pequeño/icono, y si su nombre se ve al pasar, siempre o nunca)
 */
export const mapPins = pgTable(
  'map_pins',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    mapId: uuid()
      .notNull()
      .references((): Column => maps.id, { onDelete: 'cascade' }),
    x: doublePrecision().notNull(),
    y: doublePrecision().notNull(),
    label: text(),
    pageId: uuid().references(() => pages.id, { onDelete: 'set null' }),
    /** Un emoji, o nada */
    icon: text(),
    /** Uno de la paleta de los mundos o #rrggbb */
    color: text().notNull().default('wine'),
    shape: integer().notNull().default(0),
    variant: integer().notNull().default(0),
    display: integer().notNull().default(0),
    hidden: boolean().notNull().default(false),
    locked: boolean().notNull().default(false)
  },
  (t) => [index().on(t.mapId), index().on(t.pageId)]
)

/** Lo que se dibuja en el mapa: textos, regiones y rutas, con su geometría de 0 a 1 y su estilo */
export const mapElements = pgTable(
  'map_elements',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    mapId: uuid()
      .notNull()
      .references((): Column => maps.id, { onDelete: 'cascade' }),
    kind: text({ enum: ['label', 'region', 'path'] }).notNull(),
    geometry: jsonb().$type<Record<string, unknown>>().notNull(),
    label: text(),
    pageId: uuid().references(() => pages.id, { onDelete: 'set null' }),
    style: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    hidden: boolean().notNull().default(false)
  },
  (t) => [index().on(t.mapId)]
)
