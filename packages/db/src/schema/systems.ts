import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations.ts'
import { trackedColumns } from './tracked.ts'
import { worlds } from './worlds.ts'

/**
 * Los sistemas de reglas de una cuenta (ADR-0011): el documento entero (validado con @crisol/systems), hechos desde cero,
 * copiando otro o subidos. Los de serie no tienen fila: viven en el código. La versión de la fila es la del sistema:
 * sube con cada cambio, y guardar pide la que se tenía. Borrar uno lo aparta (deleted_at) y el historial lo devuelve
 */
export const systems = pgTable(
  'systems',
  {
    ...trackedColumns(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // De cuál salió (uno de serie, por su id, o uno propio, por su uuid) y en qué versión
    basedOn: jsonb().$type<{ id: string; version: number } | null>(),
    // En texto, no en jsonb: jsonb reordena las claves, y en un sistema el orden (el de los campos) cuenta
    document: text().notNull(),
    deletedAt: timestamp({ withTimezone: true })
  },
  (t) => [index().on(t.organizationId)]
)

/** El contenido de un sistema propio (las clases, los conjuros…): un documento de uno de sus tipos, con su fuente */
export const systemContent = pgTable(
  'system_content',
  {
    ...trackedColumns(),
    systemId: uuid()
      .notNull()
      .references(() => systems.id, { onDelete: 'cascade' }),
    type: text().notNull(),
    key: text().notNull(),
    source: text(),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
    // Lo que une sus versiones entre ediciones, su mecánica y su página (ADR-0012)
    concept: text(),
    mechanics: jsonb().$type<Record<string, unknown>>(),
    ref: jsonb().$type<Record<string, unknown>>(),
    // Su imagen, por su ruta entre las del sistema (system_images): la de un zip de Foundry o una subida
    img: text(),
    // Si es una tabla (el tipo «Tabla» de Crisol): su fórmula, si repite y sus filas
    table: jsonb().$type<Record<string, unknown>>(),
    // Pendiente de revisar (la propuso la IA desde un PDF, ADR-0021): no se ve en ningún sitio hasta aceptarla
    review: jsonb().$type<ContentReview>()
  },
  (t) => [uniqueIndex().on(t.systemId, t.key), index().on(t.systemId, t.type)]
)

/**
 * Los capítulos de un libro de un sistema propio (ADR-0025): texto corrido en Markdown (cómo se juega, la ambientación,
 * una aventura), con su título y su puesto entre los del libro (source: la clave del libro en el documento del sistema)
 */
export const systemChapters = pgTable(
  'system_chapters',
  {
    ...trackedColumns(),
    systemId: uuid()
      .notNull()
      .references(() => systems.id, { onDelete: 'cascade' }),
    source: text().notNull(),
    position: integer().notNull(),
    title: text().notNull(),
    markdown: text().notNull().default('')
  },
  (t) => [index().on(t.systemId, t.source, t.position)]
)

/**
 * Las imágenes de un sistema (docs/specs/imagenes.md): las de su contenido (un zip de Foundry), por su ruta, con su
 * licencia y su crédito. Sus bytes, en el almacenamiento de archivos; no pasan por el historial (se rehacen al importar)
 */
export const systemImages = pgTable(
  'system_images',
  {
    id: uuid().primaryKey().defaultRandom(),
    systemId: uuid()
      .notNull()
      .references(() => systems.id, { onDelete: 'cascade' }),
    path: text().notNull(),
    storageKey: text().notNull(),
    mime: text().notNull(),
    bytes: integer().notNull(),
    /** foundry-only, cc-by, cc-by-nc-sa, mit o unknown */
    license: text().notNull(),
    credit: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex().on(t.systemId, t.path)]
)

/** Lo de una entrada pendiente de revisar: su página del PDF, el trozo del que sale y lo que falta o choca */
export interface ContentReview {
  page?: number
  excerpt?: string
  notes?: string[]
  /** La que ya existe con su nombre en otro libro del sistema: la clave y el libro */
  repeats?: { key: string; source: string | null; name: string }
}

/** De dónde sale una entrada copiada: su capa, su sistema, su clave y cómo era al copiarla (para ver lo que cambió) */
export interface ContentOrigin {
  /** «system»: del contenido de un sistema; «world»: del compendio de un mundo */
  layer: 'system' | 'world'
  systemId: string
  key: string
  worldId?: string
  /** La huella del original al copiarlo o al traer sus cambios (`contentFingerprint`) */
  fingerprint: string
  /** El original de entonces (sus datos y su mecánica), para enseñar las diferencias por campo */
  data: Record<string, unknown>
  mechanics?: Record<string, unknown> | null
  table?: Record<string, unknown> | null
}

/**
 * El compendio de un mundo (docs/specs/compendio-mundo.md): contenido hecho para un sistema, que ven las campañas del
 * mundo que lo usan. Aparte de `system_content`, para que lo que lee o cuenta el contenido de un sistema no lo vea; cada
 * entrada lleva su versión (la de la fila), y cambiarla no cambia la del sistema
 */
export const worldContent = pgTable(
  'world_content',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    systemId: uuid()
      .notNull()
      .references(() => systems.id, { onDelete: 'cascade' }),
    type: text().notNull(),
    key: text().notNull(),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
    concept: text(),
    mechanics: jsonb().$type<Record<string, unknown>>(),
    ref: jsonb().$type<Record<string, unknown>>(),
    img: text(),
    table: jsonb().$type<Record<string, unknown>>(),
    origin: jsonb().$type<ContentOrigin>()
  },
  (t) => [uniqueIndex().on(t.worldId, t.systemId, t.key), index().on(t.worldId, t.systemId, t.type)]
)
