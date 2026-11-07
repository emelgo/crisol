/**
 * El canal de la mesa (ADR-0018): un WebSocket por conexión a la mesa de una campaña. Quien mira dice quién es al
 * entrar: el máster (todo) o la pantalla de la tele (lo que ve el grupo). Los cambios que se guardan van por la API;
 * aquí llega la proyección de cada uno y lo que va en vivo (el encuadre del máster que sigue la pantalla)
 */
import { z } from 'zod'
import { screenCombat } from './combat.ts'
import { type campaignTableView, fogMask, sceneGrid, sceneTiles, sceneViewport, screenCamera } from './scenes.ts'
import { screenToken } from './tokens.ts'

export const TABLE_VIEWS = ['master', 'screen'] as const
export type TableViewer = (typeof TABLE_VIEWS)[number]

/** Lo que manda el cliente */
export const tableClientMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('join'), campaignId: z.uuid(), view: z.enum(TABLE_VIEWS) }),
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
  })
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
  lights: z.array(screenLight).optional()
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
  | { type: 'error'; code: 'FORBIDDEN' | 'NOT_FOUND' | 'BAD_MESSAGE' | 'NOT_JOINED' }
