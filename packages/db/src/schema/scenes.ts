import type { SoundState } from '@crisol/domain'
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
 * Una criatura preparada de una escena (docs/specs/escenas-foundry.md): una entrada del compendio (por su clave, del
 * sistema donde se encontró) con su sitio, en píxeles de la imagen. Sale en juego y en el mapa la primera vez que una
 * campaña abre la escena
 */
export interface PreparedCreatureData {
  key: string
  systemId: string
  name: string
  x: number
  y: number
  /** En casillas */
  size: number
  hidden: boolean
  faction: 'hostile' | 'neutral'
  /** La única (conserva su estado) o una copia numerada */
  unique: boolean
}

/** Un pin de una escena (las notas de una de Foundry): su sitio en píxeles de la imagen y la página a la que lleva */
export interface ScenePinData {
  x: number
  y: number
  label: string
  pageId: string | null
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
    /** La pestaña de la página en la que vive; sin ella, una escena suelta de la Mesa (ADR-0020) */
    tabId: uuid()
      .unique()
      .references(() => pageTabs.id, { onDelete: 'cascade' }),
    /** El nombre de una escena suelta (la de una pestaña lleva el de la pestaña) */
    name: text(),
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
    automaticVision: boolean().notNull().default(false),
    /** Las criaturas preparadas (docs/specs/escenas-foundry.md): salen al abrirla una campaña por primera vez */
    prepared: jsonb().$type<PreparedCreatureData[]>().notNull().default([]),
    /** Sus pines a páginas (las notas de una escena de Foundry) */
    pins: jsonb().$type<ScenePinData[]>().notNull().default([]),
    /** Interior (8 · campaña, decisión 16): la capa de clima de la Mesa no se pinta en ella */
    interior: boolean().notNull().default(false)
  },
  (t) => [index().on(t.worldId)]
)

/**
 * Lo que enseña la pantalla del máster (el cajón G) en una escena (docs/specs/modulo-8-10-campana.md, decisiones 24 y
 * 33): qué columnas salen (statblocks, personajes, nota y tablas), la nota fijada (una página del mundo) y las tablas
 * aleatorias elegidas (sus pestañas)
 */
export interface GmScreenData {
  columns: { statblocks: boolean; characters: boolean; note: boolean; tables: boolean }
  note: string | null
  tables: string[]
}

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
    doors: jsonb().$type<SceneDoorStates>().notNull().default({}),
    /** Los sonidos del mapa que la campaña tiene apagados (o encendidos), por su id (docs/specs/sonido-mapa.md) */
    sounds: jsonb().$type<Record<string, boolean>>().notNull().default({}),
    /** La pantalla del máster en esta escena (null: la de siempre, con su página y los statblocks) */
    gmScreen: jsonb().$type<GmScreenData | null>()
  },
  (t) => [unique().on(t.campaignId, t.sceneId), index().on(t.sceneId)]
)

/**
 * La capa de clima de la Mesa de una campaña (8 · campaña, decisión 16): como el clima de hoy (lo de siempre), a mano
 * (lluvia, nieve, niebla o ceniza, con su intensidad y su viento, de 0 a 1) o ninguna
 */
export type WeatherLayerData =
  | { mode: 'today' }
  | { mode: 'manual'; kind: 'rain' | 'snow' | 'fog' | 'ash'; intensity: number; wind: number }
  | { mode: 'none' }

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
  /** «La tele ve lo que mides»: la medida en curso del máster va en vivo a la pantalla (docs/specs/herramientas-mesa.md) */
  measureOnScreen: boolean().notNull().default(false),
  /** La sala (docs/specs/sala.md): en pausa, solo el máster hace algo en la Mesa */
  paused: boolean().notNull().default(false),
  /** Cómo mueven los jugadores sus fichas: libre, en su turno o bloqueado */
  movement: text({ enum: ['free', 'turn', 'locked'] })
    .notNull()
    .default('free'),
  /** A quiénes ha echado el máster de la Mesa (no vuelven a entrar hasta que los deje) */
  kicked: text().array().notNull().default(sql`'{}'::text[]`),
  /** Lo que enseña el máster en la vista de jugadores, encima de la escena (docs/specs/ensenar.md) */
  screenShow: jsonb().$type<{ kind: 'page' | 'image'; id: string; title: string } | null>(),
  /** Lo que suena (docs/specs/sonido.md): las listas y los efectos con la hora del servidor en que empezaron */
  sound: jsonb().$type<SoundState>(),
  /** La capa de clima (8 · campaña): como hoy, a mano o ninguna */
  weatherLayer: jsonb().$type<WeatherLayerData>().notNull().default({ mode: 'today' }),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull()
})

/**
 * Las teselas de la imagen de una escena, por versión: dónde están sus bytes. Se sacan de la imagen (no van al
 * historial). Las de versiones viejas, y las de una escena quitada, se guardan mientras el historial pueda devolverlas
 * (deshacer la imagen o el quitar la pestaña las encuentra): sin clave ajena a la escena; las recoge la purga
 */
export const sceneTiles = pgTable(
  'scene_tiles',
  {
    sceneId: uuid().notNull(),
    version: uuid().notNull(),
    level: integer().notNull(),
    x: integer().notNull(),
    y: integer().notNull(),
    storageKey: text().notNull(),
    bytes: integer().notNull(),
    /** Cuándo se subió: la purga no recoge las de una imagen que se está subiendo (aún sin poner en la escena) */
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull()
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
