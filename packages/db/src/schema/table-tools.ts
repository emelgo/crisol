import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { campaigns } from './campaigns.ts'
import { scenes } from './scenes.ts'
import { trackedColumns } from './tracked.ts'
import { worlds } from './worlds.ts'

/** Lo que se deja en el mapa con las herramientas de la mesa (docs/specs/herramientas-mesa.md) */
export const MARK_KINDS = ['template', 'drawing', 'text', 'stamp', 'pin', 'image'] as const
export type MarkKind = (typeof MARK_KINDS)[number]

/** Lo de cada marca según su clase (lo valida el contrato): puntos y medidas en píxeles de la imagen */
export type MarkData = Record<string, unknown>

/**
 * Una marca de una campaña en una escena: una plantilla de área, un dibujo, un texto, un sello, un pin o una imagen
 * suelta. Como las fichas, de la campaña y con historial; las ocultas (del máster) no llegan a la pantalla
 */
export const sceneMarks = pgTable(
  'scene_marks',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    sceneId: uuid()
      .notNull()
      .references(() => scenes.id, { onDelete: 'cascade' }),
    kind: text({ enum: MARK_KINDS }).notNull(),
    hidden: boolean().notNull().default(false),
    data: jsonb().$type<MarkData>().notNull(),
    /** Su orden entre las que se pusieron a la vez (se pintan en el orden en que se pusieron) */
    sort: integer().notNull().default(0)
  },
  (t) => [index().on(t.campaignId, t.sceneId)]
)

export const WIDGET_KINDS = ['counter', 'clock', 'timer'] as const

/** Lo propio de cada clase de widget: límites del contador, segmentos del reloj, duración y carrera del temporizador */
export interface WidgetSettingsData {
  min?: number | null
  max?: number | null
  segments?: number
  showCount?: boolean
  duration?: number
  /** Mientras corre: desde cuándo (ms de la pared) y con cuántos segundos empezó */
  running?: { since: number; remaining: number } | null
}

/**
 * Un widget de la campaña (contador, reloj de progreso o temporizador): de la campaña, no de la escena (sigue ahí al
 * cambiar de mapa), con su ojo para verse o no en la pantalla
 */
export const campaignWidgets = pgTable(
  'campaign_widgets',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    kind: text({ enum: WIDGET_KINDS }).notNull(),
    label: text().notNull(),
    icon: text(),
    color: text().notNull(),
    shown: boolean().notNull().default(true),
    sort: integer().notNull().default(0),
    value: doublePrecision().notNull().default(0),
    settings: jsonb().$type<WidgetSettingsData>().notNull().default({})
  },
  (t) => [index().on(t.campaignId)]
)

/** Lo que guarda una instantánea: lo de la campaña en la escena (fichas, puertas, niebla a mano y marcas) */
export interface SnapshotData {
  tokens: Array<{
    characterId: string | null
    creatureId: string | null
    x: number
    y: number
    size: number
    label: string
    faction: 'group' | 'hostile' | 'neutral'
    hidden: boolean
    image: Record<string, unknown> | null
  }>
  doors: Record<string, { open: boolean }>
  fog: Array<Record<string, unknown>>
  marks: Array<{ kind: MarkKind; hidden: boolean; data: MarkData }>
}

/**
 * Una instantánea del estado de una campaña en una escena, para volver a él (docs/specs/herramientas-mesa.md): no
 * guarda la escena del mundo ni las criaturas en juego. Su miniatura, una imagen pequeña en data URL
 */
export const sceneSnapshots = pgTable(
  'scene_snapshots',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    sceneId: uuid()
      .notNull()
      .references(() => scenes.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    thumbnail: text(),
    data: jsonb().$type<SnapshotData>().notNull()
  },
  (t) => [index().on(t.campaignId, t.sceneId)]
)
