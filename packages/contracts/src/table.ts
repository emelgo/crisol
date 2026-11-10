/**
 * El canal de la mesa (ADR-0018): un WebSocket por conexión a la mesa de una campaña. Quien mira dice quién es al
 * entrar: el máster (todo) o la pantalla de la tele (lo que ve el grupo). Los cambios que se guardan van por la API;
 * aquí llega la proyección de cada uno y lo que va en vivo (el encuadre del máster, el arrastre, la medida y el láser)
 */
import { z } from 'zod'
import { defineAction } from './action.ts'
import { screenCombat } from './combat.ts'
import { type campaignTableView, fogMask, sceneGrid, sceneTiles, sceneViewport, screenCamera } from './scenes.ts'
import { type LiveMeasure, laserPoints, liveMeasure, screenMark, screenWidget } from './table-tools.ts'
import { screenToken } from './tokens.ts'

/** master: todo; screen: la tele (lo que ve el grupo); player: la Mesa de un jugador, que ve lo mismo que la tele */
export const TABLE_VIEWS = ['master', 'screen', 'player'] as const
export type TableViewer = (typeof TABLE_VIEWS)[number]

/** El canal de la mesa se cierra con este código cuando el máster echa a alguien (docs/specs/sala.md) */
export const TABLE_CLOSE_KICKED = 4409

/** Cómo mueven los jugadores sus fichas (docs/specs/sala.md): libre, solo en su turno (con combate) o bloqueado */
export const tableMovement = z.enum(['free', 'turn', 'locked'])

/** Lo que manda el cliente */
export const tableClientMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('join'), campaignId: z.uuid(), view: z.enum(TABLE_VIEWS) }),
  /** Si quien mira tiene la pestaña a la vista (lo enseña la sección Mesa de la campaña: quién está y si está activo) */
  z.object({ type: z.literal('presence'), active: z.boolean() }),
  /** El encuadre del máster en vivo: con «Seguir», la pantalla lo sigue (no se guarda) */
  z.object({ type: z.literal('viewport'), view: sceneViewport }),
  /** Unas fichas mientras el máster las arrastra (no se guarda: al soltar, moveTokens) */
  z.object({
    type: z.literal('drag'),
    moves: z
      .array(
        z.object({
          tokenId: z.uuid(),
          x: z.number().min(-100_000).max(100_000),
          y: z.number().min(-100_000).max(100_000)
        })
      )
      .min(1)
      .max(20)
  }),
  /** La medida en curso del máster (null: ya no mide): a la pantalla, solo con «la tele ve lo que mides» */
  z.object({ type: z.literal('measure'), measure: liveMeasure.nullable() }),
  /** La estela del láser: a la pantalla, lo que cae en lo que ve o vio el grupo */
  z.object({ type: z.literal('laser'), points: laserPoints })
])

export type TableClientMessage = z.infer<typeof tableClientMessage>

/** La escena tal como la recibe la pantalla: sin su página ni su nombre, solo lo que se pinta */
export const screenScene = z.object({
  id: z.uuid(),
  image: z.object({ width: z.number(), height: z.number(), tiles: sceneTiles.nullable() }).nullable(),
  grid: sceneGrid,
  initialView: sceneViewport.nullable()
})

export type ScreenScene = z.infer<typeof screenScene>

/** La niebla de la pantalla (docs/specs/vision.md): lo explorado y lo que ve el grupo, en máscaras pequeñas */
export const screenFog = z.object({
  width: z.int(),
  height: z.int(),
  cellSize: z.int(),
  explored: fogMask,
  visible: fogMask,
  /** 0 de día, 1 noche cerrada */
  darkness: z.number()
})

export type ScreenFog = z.infer<typeof screenFog>

/** Una luz que alumbra algo de lo que ve el grupo: lo que alumbra de ello (cells) y su centro solo si se ve */
export const screenLight = z.object({
  id: z.uuid(),
  color: z.string(),
  intensity: z.number(),
  /** Radios en píxeles de la imagen */
  bright: z.number(),
  dim: z.number(),
  origin: z.object({ x: z.number(), y: z.number() }).nullable(),
  cells: fogMask
})

export type ScreenLight = z.infer<typeof screenLight>

export const screenView = z.object({
  campaignId: z.uuid(),
  campaignName: z.string(),
  /** La escena presentada; null si no hay o si la pantalla está oculta */
  scene: screenScene.nullable(),
  hidden: z.boolean(),
  camera: screenCamera,
  /** Las fichas de la escena presentada que el grupo ve y no están ocultas */
  tokens: z.array(screenToken),
  /** La franja de turnos, si hay combate y la pantalla enseña algo: sin los ocultos ni las criaturas que no ve */
  combat: screenCombat.nullable(),
  /** La niebla (llega con la escena; opcional hasta que lo dé la API de prueba de la web) */
  fog: screenFog.nullable().optional(),
  /** Las luces que alumbran lo que ve el grupo, recortadas a ello */
  lights: z.array(screenLight).optional(),
  /** Lo dejado en el mapa que el grupo puede ver (docs/specs/herramientas-mesa.md) */
  marks: z.array(screenMark).optional(),
  /** Los widgets de la campaña con el ojo abierto */
  widgets: z.array(screenWidget).optional(),
  /** La sala (docs/specs/sala.md): en pausa y cómo mueven los jugadores (opcional por la API de prueba de la web) */
  paused: z.boolean().optional(),
  movement: tableMovement.optional()
})

export type ScreenView = z.infer<typeof screenView>

/** Lo que manda el servidor, ya proyectado para quien lo recibe */
export type TableServerMessage =
  | { type: 'master'; table: z.infer<typeof campaignTableView> }
  | { type: 'screen'; screen: ScreenView }
  /** El encuadre del máster, a la pantalla que lo sigue */
  | { type: 'viewport'; view: z.infer<typeof sceneViewport> }
  /** Unas fichas mientras se arrastran (a la pantalla, solo las que ve) */
  | { type: 'drag'; moves: Array<{ tokenId: string; x: number; y: number }> }
  /** La medida en curso del máster (null: se acabó) */
  | { type: 'measure'; measure: LiveMeasure | null }
  /** La estela del láser (a la pantalla, solo sus puntos que ve o vio el grupo) */
  | { type: 'laser'; points: Array<{ x: number; y: number }> }
  | { type: 'error'; code: 'FORBIDDEN' | 'NOT_FOUND' | 'BAD_MESSAGE' | 'NOT_JOINED' | 'KICKED' }

/** Quién está en la Mesa de una campaña ahora (ADR-0021) */
export const tablePresence = z.object({
  userId: z.string(),
  name: z.string(),
  viewer: z.enum(TABLE_VIEWS).describe('master: el máster; screen: la tele; player: la Mesa de un jugador'),
  since: z.iso.datetime(),
  active: z.boolean().describe('Con alguna de sus pestañas a la vista'),
  tabs: z.int()
})

export type TablePresenceEntry = z.infer<typeof tablePresence>

export const setTableControls = defineAction({
  name: 'setTableControls',
  kind: 'write',
  description:
    'Los controles de la sala de una campaña (solo su máster): la pausa (paused: nadie más que el máster mueve fichas, abre puertas ni pone nada en la Mesa; sale «Pausa» en la pantalla de los jugadores) y cómo mueven los jugadores sus fichas (movement: free, libre; turn, con combate solo en su turno; locked, nadie). Lo que no se pasa no cambia',
  input: z.object({ campaignId: z.uuid(), paused: z.boolean().optional(), movement: tableMovement.optional() }),
  output: z.object({ paused: z.boolean(), movement: tableMovement })
})

export const kickFromTable = defineAction({
  name: 'kickFromTable',
  kind: 'players',
  description:
    'Echa a un jugador de la Mesa de una campaña: se le cierra al momento en todos sus aparatos y no puede volver a entrar en ella hasta dejarle volver (allowBackToTable). Sigue siendo de la campaña (quitarlo del todo es removeMember)',
  input: z.object({ campaignId: z.uuid(), userId: z.string().min(1).max(100) }),
  output: z.object({ ok: z.literal(true) })
})

export const allowBackToTable = defineAction({
  name: 'allowBackToTable',
  kind: 'players',
  description: 'Deja volver a la Mesa a un jugador al que se echó (kickFromTable)',
  input: z.object({ campaignId: z.uuid(), userId: z.string().min(1).max(100) }),
  output: z.object({ ok: z.literal(true) })
})

export const getTablePresence = defineAction({
  name: 'getTablePresence',
  kind: 'read',
  description:
    'Quién está ahora en la Mesa de una campaña: el máster, los jugadores y la tele, desde cuándo y si tienen la pestaña a la vista. Lo ve cualquiera de la campaña',
  input: z.object({ campaignId: z.uuid() }),
  output: z.object({ present: z.array(tablePresence) })
})
