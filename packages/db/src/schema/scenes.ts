import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid
} from 'drizzle-orm/pg-core'
import { campaigns } from './campaigns.ts'
import { characters } from './characters.ts'
import { campaignCreatures } from './creatures.ts'
import { files } from './files.ts'
import { pageTabs } from './maps.ts'
import { systems } from './systems.ts'
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
  source: 'uvtt' | 'ai'
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
    imported: jsonb().$type<SceneImportedData>(),
    /** La oscuridad (docs/specs/vision.md): 0 de día, 1 noche cerrada */
    darkness: doublePrecision().notNull().default(0),
    /** La niebla sale de lo que ven las fichas del grupo; sin ella (un mapa sin muros), solo vale la de a mano */
    automaticVision: boolean().notNull().default(false)
  },
  (t) => [index().on(t.worldId)]
)

/** El estado de las puertas de una campaña, por el id de su muro */
export type SceneDoorStates = Record<string, { open: boolean }>

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
      .references(() => scenes.id, { onDelete: 'cascade' }),
    /** Las puertas que la campaña tiene distinto de como se dibujaron (docs/specs/vision.md), por el id de su muro */
    doors: jsonb().$type<SceneDoorStates>().notNull().default({})
  },
  (t) => [unique().on(t.campaignId, t.sceneId), index().on(t.sceneId)]
)

/** La cámara de la pantalla de la tele: sigue al máster o se queda en un encuadre */
export type ScreenCameraData = { mode: 'follow' } | { mode: 'group' } | { mode: 'fixed'; view: SceneViewData }

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
  /** Las teselas del borde de lo que ve la pantalla: enteras o recortadas con la niebla (docs/specs/vision.md) */
  tileFit: text({ enum: ['whole', 'cropped'] })
    .notNull()
    .default('whole'),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull()
})

/**
 * Las teselas de la imagen de una escena, por versión: dónde están sus bytes. Se sacan de la imagen (no van al
 * historial), y las de versiones viejas se guardan mientras la escena exista, para que deshacer la imagen las encuentre
 */
export const sceneTiles = pgTable(
  'scene_tiles',
  {
    sceneId: uuid()
      .notNull()
      .references(() => scenes.id, { onDelete: 'cascade' }),
    version: uuid().notNull(),
    level: integer().notNull(),
    x: integer().notNull(),
    y: integer().notNull(),
    storageKey: text().notNull(),
    bytes: integer().notNull()
  },
  (t) => [primaryKey({ columns: [t.sceneId, t.version, t.level, t.x, t.y] })]
)

/** El encuadre redondo de la imagen de una ficha: un archivo del mundo, o la imagen de su criatura si no hay */
export interface TokenImageData {
  fileId: string | null
  x: number
  y: number
  zoom: number
}

/**
 * Una ficha (docs/specs/fichas.md): dónde está, en una escena de una campaña, un personaje o una criatura en juego, y
 * cómo se ve. Lo vital (PG, estados, hoja) es del personaje o de la criatura: aquí no se copia. Una por escena
 */
export const sceneTokens = pgTable(
  'scene_tokens',
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
    characterId: uuid().references(() => characters.id, { onDelete: 'cascade' }),
    creatureId: uuid().references(() => campaignCreatures.id, { onDelete: 'cascade' }),
    /** El centro, en píxeles de la imagen */
    x: doublePrecision().notNull(),
    y: doublePrecision().notNull(),
    /** En casillas */
    size: doublePrecision().notNull().default(1),
    label: text().notNull(),
    faction: text({ enum: ['group', 'hostile', 'neutral'] }).notNull(),
    hidden: boolean().notNull().default(false),
    image: jsonb().$type<TokenImageData>()
  },
  (t) => [
    index().on(t.sceneId),
    index().on(t.campaignId),
    unique().on(t.campaignId, t.sceneId, t.characterId),
    unique().on(t.campaignId, t.sceneId, t.creatureId),
    check('scene_tokens_one_actor', sql`(${t.characterId} is null) <> (${t.creatureId} is null)`)
  ]
)

/** Una criatura de un encuentro: su entrada del compendio, si es la única, y dónde va cada copia (en casillas) */
export interface EncounterMemberData {
  key: string
  unique: boolean
  at: Array<{ dx: number; dy: number }>
}

/** Un encuentro del mundo (docs/specs/fichas.md): unas criaturas de un sistema con su formación */
export const encounters = pgTable(
  'encounters',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    systemId: uuid().references(() => systems.id, { onDelete: 'set null' }),
    name: text().notNull(),
    members: jsonb().$type<EncounterMemberData[]>().notNull().default([])
  },
  (t) => [index().on(t.worldId)]
)
