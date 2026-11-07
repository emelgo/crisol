import { boolean, doublePrecision, index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { campaigns } from './campaigns.ts'
import { bytea } from './documents.ts'
import { scenes } from './scenes.ts'
import { trackedColumns } from './tracked.ts'
import { worlds } from './worlds.ts'

/** Lo que para un muro de la vista, de la luz, del paso o del sonido: nada, el segundo que se cruza, o todo */
const RESTRICTIONS = ['none', 'limited', 'full'] as const

/**
 * Un tramo de muro de una escena (docs/specs/vision.md): lo del mundo, con su historial. Una puerta es un muro con su
 * clase (normal o secreta), si tiene llave y cómo se dibujó (abierta o cerrada); su estado en cada campaña va en
 * `scene_states.doors`. Los extremos, en píxeles de la imagen
 */
export const sceneWalls = pgTable(
  'scene_walls',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    sceneId: uuid()
      .notNull()
      .references(() => scenes.id, { onDelete: 'cascade' }),
    ax: doublePrecision().notNull(),
    ay: doublePrecision().notNull(),
    bx: doublePrecision().notNull(),
    by: doublePrecision().notNull(),
    sight: text({ enum: RESTRICTIONS }).notNull().default('full'),
    light: text({ enum: RESTRICTIONS }).notNull().default('full'),
    move: text({ enum: RESTRICTIONS }).notNull().default('full'),
    sound: text({ enum: RESTRICTIONS }).notNull().default('full'),
    direction: text({ enum: ['both', 'left', 'right'] })
      .notNull()
      .default('both'),
    door: text({ enum: ['door', 'secret'] }),
    locked: boolean().notNull().default(false),
    open: boolean().notNull().default(false)
  },
  (t) => [index().on(t.sceneId)]
)

/**
 * Una luz de una escena: su sitio (en píxeles de la imagen), sus radios brillante y tenue (en la unidad de la rejilla),
 * su color e intensidad, su cono, si la cortan los muros, si es oscuridad mágica y si está encendida. Lo del mundo
 */
export const sceneLights = pgTable(
  'scene_lights',
  {
    ...trackedColumns(),
    worldId: uuid()
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    sceneId: uuid()
      .notNull()
      .references(() => scenes.id, { onDelete: 'cascade' }),
    x: doublePrecision().notNull(),
    y: doublePrecision().notNull(),
    bright: doublePrecision().notNull().default(0),
    dim: doublePrecision().notNull().default(0),
    color: text().notNull().default('#ffe2a8'),
    intensity: doublePrecision().notNull().default(1),
    angle: doublePrecision().notNull().default(360),
    rotation: doublePrecision().notNull().default(0),
    walls: boolean().notNull().default(true),
    darkness: boolean().notNull().default(false),
    enabled: boolean().notNull().default(true),
    /** Solo se enciende cuando la luz ambiental baja de esto (0–1) */
    activeBelowAmbient: doublePrecision()
  },
  (t) => [index().on(t.sceneId)]
)

/** Una operación de la niebla a mano, sin su id (es el de la fila): la forma, destapar o tapar y su momento */
export type FogOperationData = Record<string, unknown> & { mode: 'reveal' | 'cover'; shape: string; timestamp: number }

/**
 * La niebla a mano de una campaña en una escena: cada gesto del máster (pincel, rectángulo, lazo), una fila con su
 * historial (se deshace). Gana la última que se pinta
 */
export const sceneFog = pgTable(
  'scene_fog',
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
    operation: jsonb().$type<FogOperationData>().notNull()
  },
  (t) => [index().on(t.campaignId, t.sceneId)]
)

/**
 * Lo explorado por el grupo de una campaña en una escena: la rejilla de bits comprimida (`FogGrid.encode`). Se llena
 * sola con lo que ve el grupo: no va al historial (sería ruido); reiniciar la niebla la borra. Sin clave ajena a la
 * escena: si se quita su pestaña, se queda mientras el historial pueda devolverla (lo recoge la purga)
 */
export const sceneExplored = pgTable(
  'scene_explored',
  {
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    sceneId: uuid().notNull(),
    data: bytea().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull()
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.sceneId] })]
)
