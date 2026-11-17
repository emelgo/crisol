// Solo lo importan el editor y la vista de la pizarra, que se cargan al abrir una (con Excalidraw)
import { CaptureUpdateAction } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

/**
 * Nítida al acercar y alejar (Enrique, 2026-11-16: «al alejar se difumina … y al acercar se ven dientes de sierra hasta
 * que se para»): mientras dura un gesto de zoom (la rueda con Ctrl, dos dedos), Excalidraw reaprovecha el dibujo de cada
 * elemento hecho a la escala de antes (`shouldCacheIgnoreZoom`) y lo estira sin suavizar; hasta 300 ms después de
 * parar no lo vuelve a dibujar. Se le quita en cuanto lo pone (va en su onChange, antes de pintar): cada paso se dibuja
 * a su escala. Cuesta más en una pizarra muy grande, pero las nuestras son de tarjetas y flechas
 */
export function keepSharp(excalidraw: ExcalidrawImperativeAPI | null, state: { shouldCacheIgnoreZoom: boolean }) {
  if (!excalidraw || !state.shouldCacheIgnoreZoom) return
  excalidraw.updateScene({ appState: { shouldCacheIgnoreZoom: false }, captureUpdate: CaptureUpdateAction.NEVER })
}
