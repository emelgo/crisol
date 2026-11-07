// Portado de packages/mesa/src/nucleo/camara.ts y camaraJugadores.ts (Crisol actual, commit 3f68f11); el encuadre
// de lo que ve el máster y su vuelta a una vista, de packages/mesa/src/sesion/ventanaJugadores.ts
/**
 * Las cámaras de la mesa. La vista de un lienzo: un punto del mundo se ve en `(x · scale + view.x, y · scale + view.y)`
 * del lienzo; es de cada pantalla, no de la escena. La cámara de la pantalla del grupo: sigue al máster, se queda
 * fija, sigue a una ficha o encuadra al grupo; se guarda en el mundo como un encuadre (un centro y el ancho que
 * abarca; el alto sale de la forma de la pantalla).
 */
import type { Point, Rect, Size } from './geometry.ts'

export interface Viewport {
  x: number
  y: number
  scale: number
}

export interface ZoomLimits {
  min: number
  max: number
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

export const toScreen = (view: Viewport, p: Point): Point => ({
  x: p.x * view.scale + view.x,
  y: p.y * view.scale + view.y
})
export const toWorld = (view: Viewport, p: Point): Point => ({
  x: (p.x - view.x) / view.scale,
  y: (p.y - view.y) / view.scale
})

/** El mundo entero, centrado en el lienzo, con un margen */
export function fitView(world: Size, canvas: Size, margin = 24): Viewport {
  const scale = Math.max(
    1e-4,
    Math.min((canvas.width - 2 * margin) / world.width, (canvas.height - 2 * margin) / world.height)
  )
  return { x: (canvas.width - world.width * scale) / 2, y: (canvas.height - world.height * scale) / 2, scale }
}

/** La mitad del ajuste y ×4 sobre el mundo o ×16 sobre el ajuste, lo que sea mayor */
export function zoomLimits(world: Size, canvas: Size): ZoomLimits {
  const fit = fitView(world, canvas).scale
  return { min: fit / 2, max: Math.max(4, fit * 16) }
}

/** Acerca o aleja `factor` veces dejando quieto el punto del lienzo `center` (el cursor) */
export function zoomAt(view: Viewport, factor: number, center: Point, limits: ZoomLimits): Viewport {
  const scale = clamp(view.scale * factor, limits.min, limits.max)
  const k = scale / view.scale
  return { x: center.x - (center.x - view.x) * k, y: center.y - (center.y - view.y) * k, scale }
}

/** La vista con el punto del mundo en el centro del lienzo */
export const centerOn = (p: Point, canvas: Size, scale: number): Viewport => ({
  x: canvas.width / 2 - p.x * scale,
  y: canvas.height / 2 - p.y * scale,
  scale
})

export const panBy = (view: Viewport, dx: number, dy: number): Viewport => ({ ...view, x: view.x + dx, y: view.y + dy })

/**
 * Factor de zoom de un giro de rueda. `deltaMode` 1 son líneas (Firefox) y 2 páginas. Con Ctrl (el pellizco del
 * trackpad llega así) los pasos son pequeños y se acelera.
 */
export function wheelZoomFactor(deltaY: number, deltaMode = 0, pinch = false): number {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY
  return Math.exp(-clamp(pixels, -300, 300) * (pinch ? 0.01 : 0.0015))
}

/** Una rueda de trackpad (desplazamiento con dos dedos) y no de ratón: pasos finos o en horizontal */
export const isTrackpadWheel = (deltaX: number, deltaY: number, deltaMode: number): boolean =>
  deltaMode === 0 && (deltaX !== 0 || (Math.abs(deltaY) > 0 && Math.abs(deltaY) < 40 && !Number.isInteger(deltaY)))

/** Inercia del desplazamiento: velocidad (px/ms) tras `ms` con un rozamiento por milisegundo */
export const decelerate = (velocity: Point, ms: number, friction = 0.995): Point => {
  const k = friction ** ms
  return { x: velocity.x * k, y: velocity.y * k }
}

/** Misma vista (para no repintar por nada) */
export const sameViewport = (a: Viewport, b: Viewport): boolean =>
  Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6 && Math.abs(a.scale - b.scale) < 1e-9

// ── La cámara de la pantalla del grupo ───────────────────────────────────

export type ScreenCamera =
  | { mode: 'follow' }
  | { mode: 'fixed'; center: Point; width: number }
  | { mode: 'token'; tokenId: string; width: number }
  | { mode: 'group' }

/** Lo que enseña la pantalla: centro y ancho del mundo (el alto, `width × aspect`) */
export interface Framing {
  center: Point
  width: number
}

/** El rectángulo del mundo que se ve (aspect = alto / ancho de la pantalla) */
export const framingRect = (framing: Framing, aspect: number): Rect => {
  const height = framing.width * aspect
  return { x: framing.center.x - framing.width / 2, y: framing.center.y - height / 2, width: framing.width, height }
}

/** Lo mínimo que abarca la cámara (en casillas de ancho): ni el grupo junto ni una ficha sola se ven enormes */
export const MIN_FRAMING_CELLS = 8
/** Margen alrededor del grupo, en casillas */
const GROUP_MARGIN_CELLS = 2

/**
 * El encuadre del grupo: los centros de sus fichas (las que se ven: quien llama quita las ocultas), con un margen
 * alrededor y nunca menos de `MIN_FRAMING_CELLS` de ancho. Null si no hay ninguna.
 */
export function frameGroup(points: readonly Point[], cellSize: number, aspect: number): Framing | null {
  if (points.length === 0) return null
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const margin = (GROUP_MARGIN_CELLS + 0.5) * cellSize
  const x0 = Math.min(...xs) - margin
  const x1 = Math.max(...xs) + margin
  const y0 = Math.min(...ys) - margin
  const y1 = Math.max(...ys) + margin
  const width = Math.max(MIN_FRAMING_CELLS * cellSize, x1 - x0, (y1 - y0) / Math.max(0.1, aspect))
  return { center: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, width }
}

/** El ancho al arrastrar la esquina del marco hasta `p`, con la esquina contraria quieta (nunca menos de 2 casillas) */
export function widthToCorner(rect: Rect, p: Point, aspect: number, cellSize: number): number {
  const byWidth = p.x - rect.x
  const byHeight = (p.y - rect.y) / Math.max(0.1, aspect)
  return Math.max(2 * cellSize, Math.max(byWidth, byHeight))
}

/** Lo que ve un lienzo (el del máster), entero en una pantalla de esa forma (aspect = alto / ancho de la pantalla) */
export function framingOfViewport(view: Viewport, canvas: Size, aspect: number): Framing {
  const scale = Math.max(1e-6, view.scale)
  return {
    center: toWorld(view, { x: canvas.width / 2, y: canvas.height / 2 }),
    width: Math.max(canvas.width / scale, canvas.height / scale / Math.max(1e-6, aspect))
  }
}

/** La vista de un lienzo que enseña el encuadre a lo ancho */
export const viewportOfFraming = (framing: Framing, canvas: Size): Viewport =>
  centerOn(framing.center, canvas, canvas.width / Math.max(1e-6, framing.width))

export interface FramingContext {
  /** Lo que ve el máster, ya encuadrado para la pantalla (`framingOfViewport`) */
  master: Framing
  /** Dónde está una ficha; null si ya no está o no se ve */
  tokenPosition: (tokenId: string) => Point | null
  /** Las fichas del grupo que se ven */
  group: readonly Point[]
  cellSize: number
  aspect: number
  /** Lo último que se enseñó: si la ficha seguida desaparece o el grupo se queda sin fichas, no se mueve */
  last: Framing | null
}

/** Lo que enseña la pantalla con esa cámara */
export function resolveFraming(camera: ScreenCamera, context: FramingContext): Framing {
  switch (camera.mode) {
    case 'follow':
      return context.master
    case 'fixed':
      return { center: camera.center, width: camera.width }
    case 'token': {
      const p = context.tokenPosition(camera.tokenId)
      return p ? { center: p, width: camera.width } : (context.last ?? context.master)
    }
    case 'group':
      return frameGroup(context.group, context.cellSize, context.aspect) ?? context.last ?? context.master
  }
}
