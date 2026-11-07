/**
 * Los encuadres de la mesa (docs/specs/escenas.md). Un encuadre que viaja o se guarda (la vista inicial de una escena,
 * la cámara fija de la tele, el del máster que sigue la tele) es un centro en píxeles del mapa y una escala **para una
 * pantalla de referencia de 1920 px de ancho**: así cada lienzo (el del máster, la tele, la pestaña de la página)
 * enseña lo mismo a su tamaño, entero. La vista de un lienzo es la del núcleo: dónde cae el mapa y a qué escala
 */
import type { SceneViewport } from '@crisol/contracts'
import { type Framing, framingOfViewport, type Size, type Viewport } from '@crisol/tabletop'

export const REFERENCE_WIDTH = 1920
/** La forma de la tele de referencia (alto / ancho): el marco «Tele» de la mesa es así */
export const REFERENCE_ASPECT = 9 / 16

/** El encuadre del núcleo (centro y ancho en el mapa) de uno guardado */
export const framingOf = (view: SceneViewport): Framing => ({
  center: { x: view.x, y: view.y },
  width: REFERENCE_WIDTH / view.scale
})

export const sceneViewportOf = (framing: Framing): SceneViewport => ({
  x: framing.center.x,
  y: framing.center.y,
  scale: REFERENCE_WIDTH / Math.max(1e-6, framing.width)
})

/** La vista de un lienzo que enseña entero el encuadre (su rectángulo 16:9), centrado */
export function canvasViewOf(view: SceneViewport, canvas: Size): Viewport {
  const framing = framingOf(view)
  const scale = Math.min(canvas.width / framing.width, canvas.height / (framing.width * REFERENCE_ASPECT))
  return { x: canvas.width / 2 - view.x * scale, y: canvas.height / 2 - view.y * scale, scale }
}

/** Lo que enseña un lienzo, como encuadre: todo lo que se ve en él cabe en la tele */
export const sceneViewportOfCanvas = (view: Viewport, canvas: Size): SceneViewport =>
  sceneViewportOf(framingOfViewport(view, canvas, REFERENCE_ASPECT))

/** Si dos encuadres ya son el mismo a la vista (menos de medio píxel del mapa, menos de un 0,1 % de escala) */
export const closeTo = (a: SceneViewport, b: SceneViewport) =>
  Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(Math.log(a.scale / b.scale)) < 1e-3

/** Lo que tarda en recorrer la mitad del camino (ms): la tele sigue al máster suave, sin quedarse atrás */
const HALF_LIFE_MS = 90

/**
 * Un paso de la tele hacia el encuadre que sigue: la mitad del camino cada `HALF_LIFE_MS`, con la escala en
 * logaritmos (acercar y alejar van igual de suaves). Un salto de más de diez anchos de pantalla no se anima
 */
export function smoothToward(current: SceneViewport, target: SceneViewport, dtMs: number): SceneViewport {
  const width = REFERENCE_WIDTH / target.scale
  if (Math.hypot(target.x - current.x, target.y - current.y) > width * 10) return target
  const k = 1 - 0.5 ** (Math.max(0, dtMs) / HALF_LIFE_MS)
  const next = {
    x: current.x + (target.x - current.x) * k,
    y: current.y + (target.y - current.y) * k,
    scale: Math.exp(Math.log(current.scale) + (Math.log(target.scale) - Math.log(current.scale)) * k)
  }
  return closeTo(next, target) ? target : next
}
