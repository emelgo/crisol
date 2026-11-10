/**
 * Las escenas de la mesa (docs/specs/escenas.md, ADR-0018): una pestaña «Escena» de una página, con su imagen en
 * teselas y su rejilla (lo del mundo), y la mesa de cada campaña (qué tiene abierto el máster, qué enseña la pantalla)
 */
import { z } from 'zod'
import { defineAction } from './action.ts'
import { combatView } from './combat.ts'
import { markView, widgetView } from './table-tools.ts'
import { tokenView } from './tokens.ts'

export const SCENE_GRID_TYPES = ['square', 'hex-rows', 'hex-columns', 'none'] as const
/** Cómo cuentan las diagonales al medir: todas iguales, alternas (una sí y otra doble) o la distancia real */
export const DIAGONAL_RULES = ['equal', 'alternate', 'euclidean'] as const

/** Lo más que mide de lado la imagen de una escena, y el tamaño de sus teselas */
export const MAX_SCENE_SIDE = 32_768
export const SCENE_TILE_SIZE = 512
/** Lo más que pesa una tesela al subirla */
export const MAX_TILE_BYTES = 2 * 1024 * 1024

const point = z.object({ x: z.number(), y: z.number() })

export const sceneGrid = z.object({
  type: z.enum(SCENE_GRID_TYPES),
  size: z.number().min(10).max(2000).describe('Lado de la casilla (o de lado plano a lado plano), en píxeles'),
  offsetX: z.number().min(-100_000).max(100_000),
  offsetY: z.number().min(-100_000).max(100_000),
  distance: z.number().positive().max(100_000).describe('Lo que mide una casilla, en su unidad'),
  units: z.string().trim().min(1).max(20),
  diagonals: z.enum(DIAGONAL_RULES),
  visible: z.boolean(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  opacity: z.number().min(0).max(1)
})

export type SceneGrid = z.infer<typeof sceneGrid>

/** Un encuadre: el centro en píxeles de la imagen y la escala (píxeles de pantalla por píxel de la imagen) */
export const sceneViewport = z.object({
  x: z.number().min(-1_000_000).max(1_000_000),
  y: z.number().min(-1_000_000).max(1_000_000),
  scale: z.number().positive().max(64)
})

export type SceneViewport = z.infer<typeof sceneViewport>

export const sceneTiles = z.object({
  version: z.uuid(),
  size: z.number().int().min(128).max(2048),
  levels: z.number().int().min(1).max(16)
})

export type SceneTiles = z.infer<typeof sceneTiles>

/** Lo que trae un UVTT (o dibuja la IA con su mapa) y que pondrá en juego `vision`, ya en píxeles de la imagen */
export const sceneImported = z.object({
  source: z.enum(['uvtt', 'ai']),
  walls: z.array(z.array(point).max(5000)).max(20_000),
  objects: z.array(z.array(point).max(5000)).max(20_000),
  portals: z.array(z.object({ a: point, b: point, closed: z.boolean(), window: z.boolean() })).max(5000),
  lights: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
        range: z.number().min(0),
        intensity: z.number().min(0),
        color: z.string().max(16),
        shadows: z.boolean()
      })
    )
    .max(2000),
  ambientLight: z.string().max(16).nullable(),
  bakedLighting: z.boolean()
})

export type SceneImported = z.infer<typeof sceneImported>

export const sceneImage = z.object({
  width: z.number().int().positive().max(MAX_SCENE_SIDE),
  height: z.number().int().positive().max(MAX_SCENE_SIDE),
  /** null: aún sin trocear (la creó la IA con un archivo; se trocea al abrirla el máster) */
  tiles: sceneTiles.nullable(),
  /** El archivo del mundo del que salió, si salió de uno (y sigue fuera de la papelera) */
  fileId: z.uuid().nullable()
})

export const sceneView = z.object({
  id: z.uuid(),
  /** La pestaña y la página en la que vive; null: una escena suelta de la Mesa (ADR-0020) */
  tabId: z.uuid().nullable(),
  pageId: z.uuid().nullable(),
  pageTitle: z.string().nullable(),
  name: z.string(),
  image: sceneImage.nullable(),
  grid: sceneGrid,
  initialView: sceneViewport.nullable(),
  /** Trae muros, puertas o luces de un UVTT o de la IA (se ponen en juego con placeImportedWalls) */
  hasImported: z.boolean(),
  /**
   * Sus criaturas preparadas (docs/specs/escenas-foundry.md): se ponen en juego y en el mapa la primera vez que una
   * campaña abre la escena (opcional hasta que lo dé la API de prueba de la web)
   */
  prepared: z
    .array(z.object({ key: z.string(), name: z.string(), unique: z.boolean(), hidden: z.boolean() }))
    .optional(),
  /** Cuántos pines trae (las notas de una escena de Foundry): salen como marcas del máster al abrirla una campaña */
  pins: z.int().optional()
})

export type SceneView = z.infer<typeof sceneView>

export const listScenes = defineAction({
  name: 'listScenes',
  kind: 'read',
  description:
    'Las escenas de un mundo (las sueltas de la Mesa y las pestañas «Escena» de sus páginas), con su imagen y su rejilla',
  input: z.object({ worldId: z.uuid() }),
  output: z.object({ scenes: z.array(sceneView) })
})

export const getScene = defineAction({
  name: 'getScene',
  kind: 'read',
  description:
    'Una escena, por su id o por el de su pestaña: su imagen, sus medidas, su rejilla y sus criaturas preparadas (salen en juego y en el mapa la primera vez que una campaña la abre)',
  input: z
    .object({ sceneId: z.uuid().optional(), tabId: z.uuid().optional() })
    .refine((input) => (input.sceneId === undefined) !== (input.tabId === undefined), {
      message: 'sceneId o tabId'
    }),
  output: sceneView
})

const sceneName = z.string().trim().min(1).max(80)

export const createScene = defineAction({
  name: 'createScene',
  kind: 'write',
  description:
    'Crea una escena suelta en un mundo (sin página, como en Foundry): con su nombre, sin mapa (se le pone con setSceneImage) y la rejilla de siempre',
  input: z.object({ worldId: z.uuid(), name: sceneName }),
  output: sceneView
})

export const renameScene = defineAction({
  name: 'renameScene',
  kind: 'write',
  description: 'Cambia el nombre de una escena (la de una página cambia el de su pestaña)',
  input: z.object({ sceneId: z.uuid(), name: sceneName }),
  output: sceneView
})

export const deleteScene = defineAction({
  name: 'deleteScene',
  kind: 'write',
  description:
    'Borra una escena con lo que hay en ella (fichas, dibujos, niebla). La de una página quita su pestaña. Se puede deshacer desde el historial del mundo',
  input: z.object({ sceneId: z.uuid() }),
  output: z.object({ ok: z.literal(true) })
})

export const updateScene = defineAction({
  name: 'updateScene',
  kind: 'write',
  description: 'Cambia la rejilla de una escena (lo que se pase) o su vista inicial (null, sin ella)',
  input: z
    .object({
      sceneId: z.uuid(),
      grid: sceneGrid.partial().optional(),
      initialView: sceneViewport.nullable().optional()
    })
    .refine((input) => input.grid !== undefined || input.initialView !== undefined, {
      message: 'grid o initialView'
    }),
  output: sceneView
})

export const setSceneImage = defineAction({
  name: 'setSceneImage',
  kind: 'write',
  description:
    'Pone la imagen de una escena: un archivo del mundo (fileId; se trocea al abrirla el máster) o las teselas ya subidas (tiles), y lo que trajo un UVTT',
  input: z
    .object({
      sceneId: z.uuid(),
      width: z.number().int().positive().max(MAX_SCENE_SIDE).optional(),
      height: z.number().int().positive().max(MAX_SCENE_SIDE).optional(),
      fileId: z.uuid().nullable().optional(),
      tiles: sceneTiles.optional(),
      imported: sceneImported.nullable().optional()
    })
    .refine((input) => input.tiles !== undefined || input.fileId, { message: 'tiles o fileId' }),
  output: sceneView
})

export const drawScene = defineAction({
  name: 'drawScene',
  kind: 'write',
  description:
    'Pone como imagen de una escena un mapa dibujado en SVG (lee antes la guía guia_mapas): se guarda como archivo del mundo y el máster lo trocea al abrirlo. Con walls, portals y lights (en píxeles del SVG), su niebla automática sabrá por dónde se ve',
  input: z.object({
    sceneId: z.uuid(),
    svg: z
      .string()
      .min(20)
      .max(4 * 1024 * 1024),
    name: z.string().trim().min(1).max(120).optional().describe('El nombre del archivo (sin .svg)'),
    walls: sceneImported.shape.walls.optional().describe('Muros: polilíneas de puntos'),
    portals: sceneImported.shape.portals.optional().describe('Puertas (window: ventana)'),
    lights: sceneImported.shape.lights.optional().describe('Luces: range en píxeles, intensity de 0 a 1')
  }),
  output: sceneView
})

/** La cámara de la pantalla de la tele: sigue al máster o se queda en un encuadre */
export const screenCamera = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('follow') }),
  /** Encuadra las fichas del grupo (docs/specs/fichas.md) */
  z.object({ mode: z.literal('group') }),
  z.object({ mode: z.literal('fixed'), view: sceneViewport })
])

export type ScreenCamera = z.infer<typeof screenCamera>

/** Las teselas del borde de lo que ve la pantalla: enteras (asoma como mucho una más) o recortadas con la niebla */
export const TILE_FITS = ['whole', 'cropped'] as const
export type TileFit = (typeof TILE_FITS)[number]

/**
 * Una máscara de la niebla (docs/specs/vision.md): la rejilla de bits comprimida (`FogGrid.encode` de
 * `@crisol/tabletop`), en base64, de `cellSize` píxeles de la imagen por bit
 */
export const fogMask = z.string().max(4_000_000).describe('FogGrid.encode() en base64')

/** La visión de la escena abierta, para el máster: lo que ve el grupo, lo explorado y el estado de sus puertas */
export const tableVision = z.object({
  sceneId: z.uuid(),
  /** La de la escena: si cambia, cambiaron sus muros o sus luces (se vuelven a pedir con getSceneVision) */
  version: z.int(),
  automaticVision: z.boolean(),
  darkness: z.number(),
  tileFit: z.enum(TILE_FITS),
  /** Si está abierta cada puerta, en esta campaña, por el id de su muro */
  doors: z.record(z.string(), z.boolean()),
  /** Lo explorado por el grupo y lo que ve ahora */
  explored: fogMask,
  visible: fogMask,
  /** Las fichas de la escena que el grupo no ve (ocultas o fuera de su vista) */
  notSeen: z.array(z.uuid())
})

export type TableVision = z.infer<typeof tableVision>

export const campaignTableView = z.object({
  campaignId: z.uuid(),
  /** La que mira (o prepara) el máster */
  open: sceneView.nullable(),
  /** La que enseña la pantalla */
  presented: sceneView.nullable(),
  screenHidden: z.boolean(),
  camera: screenCamera,
  /** Las fichas de la escena abierta */
  tokens: z.array(tokenView),
  /** El combate de la campaña, si hay uno (null si no) */
  combat: combatView.nullable(),
  /** La visión de la escena abierta (llega siempre; opcional hasta que lo dé la API de prueba de la web) */
  vision: tableVision.nullable().optional(),
  /** Lo dejado en el mapa de la escena abierta (docs/specs/herramientas-mesa.md; opcional por la API de prueba de la web) */
  marks: z.array(markView).optional(),
  /** Los widgets de la campaña */
  widgets: z.array(widgetView).optional(),
  /** «La tele ve lo que mides» */
  measureOnScreen: z.boolean().optional(),
  /** La sala (docs/specs/sala.md): en pausa y cómo mueven los jugadores (opcional por la API de prueba de la web) */
  paused: z.boolean().optional(),
  movement: z.enum(['free', 'turn', 'locked']).optional()
})

export type CampaignTableView = z.infer<typeof campaignTableView>

export const getCampaignTable = defineAction({
  name: 'getCampaignTable',
  kind: 'read',
  description: 'La mesa de una campaña: la escena abierta, la que enseña la pantalla, si está oculta y su cámara',
  input: z.object({ campaignId: z.uuid() }),
  output: campaignTableView
})

export const openScene = defineAction({
  name: 'openScene',
  kind: 'write',
  description: 'Abre una escena del mundo en la mesa de la campaña (sin presentarla en la pantalla)',
  input: z.object({ campaignId: z.uuid(), sceneId: z.uuid() }),
  output: campaignTableView
})

export const presentScene = defineAction({
  name: 'presentScene',
  kind: 'players',
  description: 'Enseña en la pantalla de los jugadores una escena (sin sceneId, la abierta) y la destapa',
  input: z.object({ campaignId: z.uuid(), sceneId: z.uuid().optional() }),
  output: campaignTableView
})

export const hideScreen = defineAction({
  name: 'hideScreen',
  kind: 'write',
  description: 'Oculta la pantalla de los jugadores (a oscuras) o la vuelve a destapar',
  input: z.object({ campaignId: z.uuid(), hidden: z.boolean() }),
  output: campaignTableView
})

export const setScreenCamera = defineAction({
  name: 'setScreenCamera',
  kind: 'write',
  description: 'La cámara de la pantalla: seguir al máster, quedarse en un encuadre (view) o encuadrar al grupo',
  input: z.object({ campaignId: z.uuid(), camera: screenCamera }),
  output: campaignTableView
})
