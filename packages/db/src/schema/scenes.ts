import { boolean, index, integer, jsonb, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { campaigns } from './campaigns.ts'
import { files } from './files.ts'
import { pageTabs } from './maps.ts'
import { trackedColumns } from './tracked.ts'
import { worlds } from './worlds.ts'

/** La rejilla de una escena (docs/specs/escenas.md): en píxeles de la imagen; la distancia de una casilla, en su unidad */
export interface SceneGridData {
  type: 'square' | 'hex-rows' | 'hex-columns' | 'none'
  size: number
  offsetX: number
  offsetY: number
  distance: number
  units: string
  diagonals: 'equal' | 'alternate' | 'euclidean'
  visible: boolean
  color: string
  opacity: number
}

/** La rejilla de una escena nueva: cuadrada, de 100 px y 5 pies (las medidas, en las de D&D: docs/diseno.md) */
export const DEFAULT_SCENE_GRID: SceneGridData = {
  type: 'square',
  size: 100,
  offsetX: 0,
  offsetY: 0,
  distance: 5,
  units: 'pies',
  diagonals: 'equal',
  visible: true,
  color: '#000000',
  opacity: 0.3
}

/** Las teselas de la imagen: dónde están (su versión) y cómo se trocearon */
export interface SceneTilesData {
  version: string
  size: number
  levels: number
}

/** Un encuadre: el centro, en píxeles de la imagen, y la escala (píxeles de pantalla por píxel de la imagen) */
export interface SceneViewData {
  x: number
  y: number
  scale: number
}

/** Lo que trajo un UVTT y que pondrá en juego `vision`, ya en píxeles de la imagen */
export interface SceneImportedData {
  source: 'uvtt'
  walls: Array<Array<{ x: number; y: number }>>
  objects: Array<Array<{ x: number; y: number }>>
  portals: Array<{ a: { x: number; y: number }; b: { x: number; y: number }; closed: boolean; window: boolean }>
  lights: Array<{ x: number; y: number; range: number; intensity: number; color: string; shadows: boolean }>
  ambientLight: string | null
  bakedLighting: boolean
}

/**
 * La escena de una pestaña «Escena» (ADR-0018): lo del mundo, lo que se prepara una vez. La imagen va en teselas
 * (fuera de Archivos); fileId es el archivo del mundo del que salió, si salió de uno. Sin teselas, aún sin trocear
 */
export const scenes = pgTable(
  'scenes',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    tabId: uuid()
      .notNull()
      .unique()
      .references(() => pageTabs.id, { onDelete: 'cascade' }),
    fileId: uuid().references(() => files.id, { onDelete: 'set null' }),
    width: integer(),
    height: integer(),
    tiles: jsonb().$type<SceneTilesData>(),
    grid: jsonb().$type<SceneGridData>().notNull(),
    initialView: jsonb().$type<SceneViewData>(),
    imported: jsonb().$type<SceneImportedData>()
  },
  (t) => [index().on(t.worldId)]
)

/**
 * El estado de una campaña en una escena (ADR-0018): se crea la primera vez que la abre. Las fichas, las puertas, la
 * niebla y lo demás de la partida llegan con sus capacidades
 */
export const sceneStates = pgTable(
  'scene_states',
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
      .references(() => scenes.id, { onDelete: 'cascade' })
  },
  (t) => [unique().on(t.campaignId, t.sceneId), index().on(t.sceneId)]
)

/** La cámara de la pantalla de la tele: sigue al máster o se queda en un encuadre */
export type ScreenCameraData = { mode: 'follow' } | { mode: 'fixed'; view: SceneViewData }

/**
 * La mesa de una campaña: la escena que mira el máster, la que enseña la pantalla, si está oculta y su cámara. Es
 * estado de la sesión, como lo nuevo de un jugador: no va al historial
 */
export const campaignTables = pgTable('campaign_tables', {
  campaignId: uuid()
    .primaryKey()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  openSceneId: uuid().references(() => scenes.id, { onDelete: 'set null' }),
  presentedSceneId: uuid().references(() => scenes.id, { onDelete: 'set null' }),
  screenHidden: boolean().notNull().default(false),
  camera: jsonb().$type<ScreenCameraData>().notNull().default({ mode: 'follow' }),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull()
})
