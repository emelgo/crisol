/**
 * Lo que pinta un lienzo de la mesa (el del máster, la tele o la pestaña de la página): qué teselas pedir según lo que
 * se ve y la escala, y las líneas de la rejilla en la pantalla. Puro: lo usan PixiJS y el visor de la página
 */
import type { SceneGrid } from '@crisol/contracts'
import {
  clipSegment,
  fitView,
  type Grid,
  gridLines,
  levelForScale,
  type Rect,
  type Segment,
  type Size,
  type TilePyramid,
  type TileRef,
  tilePyramid,
  tilesInRect,
  type Viewport
} from '@crisol/tabletop'

/** La pirámide de teselas de la imagen de una escena; null si aún no se ha troceado */
export function pyramidOf(
  image: { width: number; height: number; tiles: { size: number; levels: number; version?: string } | null } | null
): TilePyramid | null {
  if (!image?.tiles) return null
  const pyramid = tilePyramid(image.width, image.height, image.tiles.size)
  // Por si se troceó con otro tope: solo los niveles que se subieron
  return { ...pyramid, levels: pyramid.levels.slice(0, image.tiles.levels) }
}

/** Lo que se ve del mapa, en sus píxeles */
export const visibleRect = (view: Viewport, canvas: Size): Rect => ({
  x: -view.x / view.scale,
  y: -view.y / view.scale,
  width: canvas.width / view.scale,
  height: canvas.height / view.scale
})

/** El mapa entero en el lienzo, con un margen */
export const fitCanvas = (image: Size, canvas: Size): Viewport => fitView(image, canvas, 24)

export interface TilesToDraw {
  level: number
  /** Las del nivel que toca, que se ven */
  tiles: TileRef[]
  /** Las del nivel siguiente (más reducido) que cubren lo mismo, debajo, mientras llegan las de arriba */
  under: TileRef[]
  /** El nivel más pequeño, entero: lo primero que se carga y lo que se ve siempre debajo */
  base: TileRef[]
}

/** Las teselas que pintar con esa vista (dpr: la densidad de la pantalla) */
export function tilesToDraw(pyramid: TilePyramid, view: Viewport, canvas: Size, dpr: number): TilesToDraw {
  const top = pyramid.levels.length - 1
  const level = levelForScale(pyramid, view.scale * Math.max(1, dpr))
  const rect = visibleRect(view, canvas)
  const whole = { x: 0, y: 0, width: pyramid.width, height: pyramid.height }
  return {
    level,
    tiles: tilesInRect(pyramid, level, rect),
    under: level + 1 < top ? tilesInRect(pyramid, level + 1, rect) : [],
    base: tilesInRect(pyramid, top, whole)
  }
}

/** Una casilla que se ve más pequeña que esto (px de pantalla) no se dibuja: sería una mancha */
const MIN_SCREEN_CELL = 6

/** La rejilla del núcleo de la de una escena; null sin rejilla */
export const coreGrid = (grid: SceneGrid): Grid | null =>
  grid.type === 'none' ? null : { type: grid.type, size: grid.size, offsetX: grid.offsetX, offsetY: grid.offsetY }

/** Las líneas de la rejilla que se ven, dentro del mapa, en píxeles de la pantalla */
export function screenGridLines(grid: SceneGrid, view: Viewport, canvas: Size, image: Size): Segment[] {
  const core = coreGrid(grid)
  if (!core || core.size * view.scale < MIN_SCREEN_CELL) return []
  const seen = visibleRect(view, canvas)
  const x0 = Math.max(0, seen.x)
  const y0 = Math.max(0, seen.y)
  const x1 = Math.min(image.width, seen.x + seen.width)
  const y1 = Math.min(image.height, seen.y + seen.height)
  if (x1 <= x0 || y1 <= y0) return []
  const box = { minX: x0, minY: y0, maxX: x1, maxY: y1 }
  const k = view.scale
  return gridLines(core, { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }).flatMap(([ax, ay, bx, by]): Segment[] => {
    const clipped = clipSegment({ x: ax, y: ay }, { x: bx, y: by }, box)
    if (!clipped) return []
    const [a, b] = clipped
    return [[a.x * k + view.x, a.y * k + view.y, b.x * k + view.x, b.y * k + view.y]]
  })
}
