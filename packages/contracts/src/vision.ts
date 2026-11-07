/**
 * La visión de la mesa (docs/specs/vision.md, ADR-0018 §§ 4–7): los muros, las puertas y las luces de una escena (lo
 * del mundo: los lleva quien lleva la wiki), la oscuridad, y lo de cada campaña (su máster): abrir y cerrar puertas,
 * la niebla a mano, reiniciarla, el ajuste de las teselas y «ver como el grupo»
 */
import { z } from 'zod'
import { defineAction } from './action.ts'
import { campaignTableView, TILE_FITS } from './scenes.ts'
import { screenView } from './table.ts'

export const RESTRICTIONS = ['none', 'limited', 'full'] as const
export type Restriction = (typeof RESTRICTIONS)[number]
export const WALL_DIRECTIONS = ['both', 'left', 'right'] as const
export const DOOR_KINDS = ['door', 'secret'] as const
/** Los tipos de muro ya hechos: lo que paran de la vista, la luz, el paso y el sonido */
export const WALL_KINDS = ['wall', 'low', 'invisible', 'window', 'object'] as const
export type WallKind = (typeof WALL_KINDS)[number]

type Blocks = { sight: Restriction; light: Restriction; move: Restriction; sound: Restriction }

export const WALL_PRESETS: Record<WallKind, Blocks> = {
  wall: { sight: 'full', light: 'full', move: 'full', sound: 'full' },
  // Un muro bajo deja ver por encima: el primero que se cruza no tapa
  low: { sight: 'limited', light: 'limited', move: 'full', sound: 'limited' },
  invisible: { sight: 'none', light: 'none', move: 'full', sound: 'none' },
  window: { sight: 'none', light: 'none', move: 'full', sound: 'full' },
  object: { sight: 'full', light: 'full', move: 'full', sound: 'none' }
}

/** El tipo ya hecho de un muro por lo que para, o «custom» si no es ninguno */
export function wallKindOf(blocks: Blocks): WallKind | 'custom' {
  const found = WALL_KINDS.find((kind) => {
    const preset = WALL_PRESETS[kind]
    return (
      preset.sight === blocks.sight &&
      preset.light === blocks.light &&
      preset.move === blocks.move &&
      preset.sound === blocks.sound
    )
  })
  return found ?? 'custom'
}

const coordinate = z.number().min(-1_000_000).max(1_000_000)
const point = z.object({ x: coordinate, y: coordinate })
/** Cuántos muros o luces se cambian de una vez (un mapa grande trae miles de tramos) */
export const MAX_WALLS_AT_ONCE = 20_000
export const MAX_LIGHTS_AT_ONCE = 2000

export const wallView = z.object({
  id: z.uuid(),
  a: point,
  b: point,
  kind: z.enum([...WALL_KINDS, 'custom']),
  sight: z.enum(RESTRICTIONS),
  light: z.enum(RESTRICTIONS),
  move: z.enum(RESTRICTIONS),
  sound: z.enum(RESTRICTIONS),
  direction: z.enum(WALL_DIRECTIONS),
  door: z.enum(DOOR_KINDS).nullable(),
  locked: z.boolean(),
  /** Cómo se dibujó la puerta: abierta o cerrada (en cada campaña puede estar distinta) */
  open: z.boolean()
})

export type WallView = z.infer<typeof wallView>

export const lightView = z.object({
  id: z.uuid(),
  x: z.number(),
  y: z.number(),
  bright: z.number().describe('Radio brillante, en la unidad de la rejilla (pies)'),
  dim: z.number().describe('Radio tenue, en la unidad de la rejilla'),
  color: z.string(),
  intensity: z.number(),
  angle: z.number().describe('Abertura en grados: 360 alumbra alrededor'),
  rotation: z.number().describe('Hacia dónde mira el cono (0 arriba, 90 a la derecha)'),
  walls: z.boolean().describe('La cortan los muros'),
  darkness: z.boolean().describe('Oscuridad mágica: tapa la vista salvo a la vista ciega o verdadera'),
  enabled: z.boolean(),
  activeBelowAmbient: z.number().nullable().describe('Solo se enciende cuando la luz ambiental baja de esto (0–1)')
})

export type LightView = z.infer<typeof lightView>

export const sceneVisionView = z.object({
  sceneId: z.uuid(),
  version: z.int().describe('La de la escena: sube con cada cambio de sus muros o sus luces'),
  darkness: z.number().describe('0 de día, 1 noche cerrada'),
  automaticVision: z
    .boolean()
    .describe('La niebla sale de lo que ven las fichas del grupo; sin ella, solo la de a mano'),
  walls: z.array(wallView),
  lights: z.array(lightView),
  /** Con campaña: si está abierta cada puerta en ella, por el id de su muro */
  doors: z.record(z.string(), z.boolean()).optional()
})

export type SceneVisionView = z.infer<typeof sceneVisionView>

const unit = z
  .enum(['px', 'cell'])
  .optional()
  .describe(
    'px (por defecto): píxeles de la imagen. cell: en casillas de una rejilla cuadrada, donde los enteros son las líneas de la rejilla (x 3, y 2 es la esquina de arriba a la izquierda de la casilla de la columna 3 y la fila 2; su centro, 3.5 y 2.5)'
  )

const blocks = {
  sight: z.enum(RESTRICTIONS).optional(),
  light: z.enum(RESTRICTIONS).optional(),
  move: z.enum(RESTRICTIONS).optional(),
  sound: z.enum(RESTRICTIONS).optional()
}

export const wallInput = z.object({
  a: point,
  b: point,
  kind: z
    .enum(WALL_KINDS)
    .optional()
    .describe(
      'wall (por defecto), low (muro bajo: deja ver por encima), invisible (para el paso, no la vista), window (deja ver, no pasar) u object; sight, light, move y sound lo cambian'
    ),
  ...blocks,
  direction: z
    .enum(WALL_DIRECTIONS)
    .optional()
    .describe('De un solo sentido: deja pasar por la izquierda o la derecha'),
  door: z.enum(DOOR_KINDS).nullable().optional().describe('door (puerta) o secret (secreta: muro para el grupo)'),
  locked: z.boolean().optional(),
  open: z.boolean().optional().describe('La puerta, dibujada abierta')
})

const wallPatch = wallInput.partial().extend({ id: z.uuid() })

export const lightInput = z.object({
  x: coordinate,
  y: coordinate,
  bright: z.number().min(0).max(10_000).optional().describe('Radio brillante, en la unidad de la rejilla (pies)'),
  dim: z.number().min(0).max(10_000).optional().describe('Radio tenue (hasta donde llega), en la unidad de la rejilla'),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  intensity: z.number().min(0).max(1).optional(),
  angle: z.number().min(0).max(360).optional(),
  rotation: z.number().min(-360).max(360).optional(),
  walls: z.boolean().optional(),
  darkness: z.boolean().optional(),
  enabled: z.boolean().optional(),
  activeBelowAmbient: z.number().min(0).max(1).nullable().optional()
})

const lightPatch = lightInput.partial().extend({ id: z.uuid() })

export const getSceneVision = defineAction({
  name: 'getSceneVision',
  kind: 'read',
  description:
    'Los muros, puertas y luces de una escena, su oscuridad y si su niebla es automática; con campaignId, también si está abierta cada puerta en esa campaña',
  input: z.object({ sceneId: z.uuid(), campaignId: z.uuid().optional() }),
  output: sceneVisionView
})

export const changeWalls = defineAction({
  name: 'changeWalls',
  kind: 'write',
  description:
    'Añade, cambia o quita muros, puertas y luces de una escena, todo en una operación (se deshace desde el historial)',
  input: z
    .object({
      sceneId: z.uuid(),
      unit,
      walls: z
        .object({
          add: z.array(wallInput).max(MAX_WALLS_AT_ONCE).optional(),
          update: z.array(wallPatch).max(MAX_WALLS_AT_ONCE).optional(),
          remove: z.array(z.uuid()).max(MAX_WALLS_AT_ONCE).optional()
        })
        .optional(),
      lights: z
        .object({
          add: z.array(lightInput).max(MAX_LIGHTS_AT_ONCE).optional(),
          update: z.array(lightPatch).max(MAX_LIGHTS_AT_ONCE).optional(),
          remove: z.array(z.uuid()).max(MAX_LIGHTS_AT_ONCE).optional()
        })
        .optional()
    })
    .refine((input) => input.walls !== undefined || input.lights !== undefined, { message: 'walls o lights' }),
  output: sceneVisionView
})

export const placeImportedWalls = defineAction({
  name: 'placeImportedWalls',
  kind: 'write',
  description:
    'Pone en juego los muros, puertas y luces que trajo el mapa de la escena (un UVTT o uno dibujado por la IA), uniendo los tramos seguidos; con replace, en lugar de los que tuviera',
  input: z.object({ sceneId: z.uuid(), replace: z.boolean().optional() }),
  output: sceneVisionView
})

export const updateSceneVision = defineAction({
  name: 'updateSceneVision',
  kind: 'write',
  description:
    'La oscuridad de una escena (0 de día, 1 noche cerrada) y si su niebla es automática (por lo que ven las fichas del grupo) o solo a mano',
  input: z
    .object({
      sceneId: z.uuid(),
      darkness: z.number().min(0).max(1).optional(),
      automaticVision: z.boolean().optional()
    })
    .refine((input) => input.darkness !== undefined || input.automaticVision !== undefined, {
      message: 'darkness o automaticVision'
    }),
  output: sceneVisionView
})

export const setDoor = defineAction({
  name: 'setDoor',
  kind: 'players',
  description: 'Abre o cierra una puerta en una campaña (también las secretas y las que tienen llave)',
  input: z.object({ campaignId: z.uuid(), wallId: z.uuid(), open: z.boolean() }),
  output: z.object({ wallId: z.uuid(), open: z.boolean() })
})

export const FOG_SHAPES = ['rectangle', 'brush', 'lasso', 'cells', 'area'] as const

export const changeFog = defineAction({
  name: 'changeFog',
  kind: 'players',
  description:
    'Destapa (reveal: se ve, con sus fichas no ocultas) o tapa (cover: aunque las fichas lo vean) una zona en la escena abierta de una campaña (o en sceneId). En píxeles: rectangle (x, y, width, height), brush (points y radius) o lasso (points). En casillas: cells (unas casillas) o area (column, row, columns, rows)',
  input: z
    .object({
      campaignId: z.uuid(),
      sceneId: z.uuid().optional(),
      mode: z.enum(['reveal', 'cover']),
      shape: z.enum(FOG_SHAPES),
      x: coordinate.optional(),
      y: coordinate.optional(),
      width: z.number().positive().max(1_000_000).optional(),
      height: z.number().positive().max(1_000_000).optional(),
      points: z.array(point).max(5000).optional(),
      radius: z.number().positive().max(100_000).optional(),
      cells: z
        .array(z.object({ column: z.int().min(-1000).max(5000), row: z.int().min(-1000).max(5000) }))
        .max(5000)
        .optional(),
      column: z.int().min(-1000).max(5000).optional(),
      row: z.int().min(-1000).max(5000).optional(),
      columns: z.int().min(1).max(5000).optional(),
      rows: z.int().min(1).max(5000).optional()
    })
    .refine(
      (i) =>
        i.shape === 'rectangle'
          ? i.x !== undefined && i.y !== undefined && i.width !== undefined && i.height !== undefined
          : i.shape === 'brush'
            ? (i.points?.length ?? 0) > 0 && i.radius !== undefined
            : i.shape === 'lasso'
              ? (i.points?.length ?? 0) >= 3
              : i.shape === 'cells'
                ? (i.cells?.length ?? 0) > 0
                : i.column !== undefined && i.row !== undefined && i.columns !== undefined && i.rows !== undefined,
      { message: 'faltan los datos de la forma' }
    ),
  output: z.object({ sceneId: z.uuid(), operations: z.int() })
})

export const resetFog = defineAction({
  name: 'resetFog',
  kind: 'players',
  description:
    'Reinicia la niebla de una campaña en su escena abierta (o en sceneId): olvida lo explorado (no vuelve) y quita la de a mano (esto se deshace)',
  input: z.object({ campaignId: z.uuid(), sceneId: z.uuid().optional() }),
  output: z.object({ sceneId: z.uuid(), removed: z.int() })
})

export const setTileFit = defineAction({
  name: 'setTileFit',
  kind: 'write',
  description:
    'Cómo enseña la pantalla el borde de lo explorado: whole (teselas enteras: asoma un poco más, para jugar en persona) o cropped (recortadas con la niebla, para jugar online)',
  input: z.object({ campaignId: z.uuid(), tileFit: z.enum(TILE_FITS) }),
  output: campaignTableView
})

const cellRun = z.object({ row: z.int(), from: z.int(), to: z.int() })

export const viewAsParty = defineAction({
  name: 'viewAsParty',
  kind: 'read',
  description:
    'Lo que ve el grupo en la escena abierta de una campaña (o en sceneId): lo que recibiría su pantalla, las casillas a la vista, las fichas que ve y las que no, y las puertas secretas',
  input: z.object({ campaignId: z.uuid(), sceneId: z.uuid().optional() }),
  output: z.object({
    sceneId: z.uuid(),
    automaticVision: z.boolean(),
    /** Lo que recibiría la pantalla con esta escena presentada */
    screen: screenView,
    /** Las casillas cuyo centro ve el grupo, por filas (en una rejilla cuadrada; sin rejilla, de 100 px) */
    visibleCells: z.array(cellRun).describe('Por filas: de la columna from a la to'),
    visibleCount: z.int().describe('Cuántas casillas ve'),
    tokensSeen: z.array(z.object({ id: z.uuid(), label: z.string(), name: z.string() })),
    notSeen: z.array(
      z.object({ id: z.uuid(), label: z.string(), name: z.string(), hidden: z.boolean().describe('Oculta a mano') })
    ),
    secretDoors: z.array(z.object({ id: z.uuid(), open: z.boolean() }))
  })
})
