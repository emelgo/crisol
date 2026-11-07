/**
 * El canal de la mesa (ADR-0018): un WebSocket por conexión a la mesa de una campaña. Quien mira dice quién es al
 * entrar: el máster (todo) o la pantalla de la tele (lo que ve el grupo). Los cambios que se guardan van por la API;
 * aquí llega la proyección de cada uno y lo que va en vivo (el encuadre del máster que sigue la pantalla)
 */
import { z } from 'zod'
import { type campaignTableView, sceneGrid, sceneTiles, sceneViewport, screenCamera } from './scenes.ts'

export const TABLE_VIEWS = ['master', 'screen'] as const
export type TableViewer = (typeof TABLE_VIEWS)[number]

/** Lo que manda el cliente */
export const tableClientMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('join'), campaignId: z.uuid(), view: z.enum(TABLE_VIEWS) }),
  /** El encuadre del máster en vivo: con «Seguir», la pantalla lo sigue (no se guarda) */
  z.object({ type: z.literal('viewport'), view: sceneViewport })
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

export const screenView = z.object({
  campaignId: z.uuid(),
  campaignName: z.string(),
  /** La escena presentada; null si no hay o si la pantalla está oculta */
  scene: screenScene.nullable(),
  hidden: z.boolean(),
  camera: screenCamera
})

export type ScreenView = z.infer<typeof screenView>

/** Lo que manda el servidor, ya proyectado para quien lo recibe */
export type TableServerMessage =
  | { type: 'master'; table: z.infer<typeof campaignTableView> }
  | { type: 'screen'; screen: ScreenView }
  /** El encuadre del máster, a la pantalla que lo sigue */
  | { type: 'viewport'; view: z.infer<typeof sceneViewport> }
  | { type: 'error'; code: 'FORBIDDEN' | 'NOT_FOUND' | 'BAD_MESSAGE' | 'NOT_JOINED' }
