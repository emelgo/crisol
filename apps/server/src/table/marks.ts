/**
 * Las herramientas de la mesa en la proyección (docs/specs/herramientas-mesa.md): lo que el máster ve de las marcas
 * (de las plantillas, también las fichas que quedan dentro) y de los widgets, y lo que llega a la pantalla: ni lo del
 * máster, ni lo que cae en la niebla (de un dibujo, solo sus trozos en lo que ve o vio el grupo), ni la página de un
 * pin, ni los widgets con el ojo cerrado
 */
import type { MarkView, SceneGrid, ScreenMark, ScreenWidget, TokenView, WidgetView } from '@crisol/contracts'
import type { tableToolsRepo } from '@crisol/db'
import {
  type AreaTemplate,
  FOG_CELL_SIZE,
  type Grid,
  insideTemplate,
  type Point,
  strokeInside,
  type TemplateShape,
  templateBounds,
  toGrid,
  tokensInTemplate
} from '@crisol/tabletop'

/** Lo que se mira de una zona: si un punto cae dentro */
export interface Sight {
  hasPoint(p: Point): boolean
}

/** La rejilla de una escena para la geometría, y el lado de su casilla (sin rejilla, 100 px) */
export function gridOf(grid: SceneGrid): { grid: Grid | null; cell: number } {
  if (grid.type === 'none') return { grid: null, cell: 100 }
  return { grid: toGrid(grid), cell: grid.size }
}

/** La plantilla de una marca, para la geometría */
export function templateOf(data: Record<string, unknown>): AreaTemplate {
  return {
    shape: data.shape as TemplateShape,
    a: data.a as Point,
    b: data.b as Point,
    angle: typeof data.angle === 'number' ? data.angle : undefined,
    width: typeof data.width === 'number' ? data.width : undefined
  }
}

/** Las fichas que quedan dentro de una plantilla */
export function tokensInside<T extends Pick<TokenView, 'id' | 'x' | 'y' | 'size'>>(
  data: Record<string, unknown>,
  tokens: readonly T[],
  sceneGrid: SceneGrid
): T[] {
  const { grid, cell } = gridOf(sceneGrid)
  return tokensInTemplate(templateOf(data), tokens, grid, cell)
}

/** Lo que el máster ve de una marca */
export function markViewOf(
  row: tableToolsRepo.MarkRow,
  tokens: readonly TokenView[] | null,
  sceneGrid: SceneGrid
): MarkView {
  const base = {
    ...row.data,
    kind: row.kind,
    id: row.id,
    sceneId: row.sceneId,
    hidden: row.hidden,
    version: row.version
  }
  if (row.kind === 'template' && tokens)
    return { ...base, tokenIds: tokensInside(row.data, tokens, sceneGrid).map((t) => t.id) } as MarkView
  return base as MarkView
}

/** El largo de un trazo, en píxeles */
const lengthOf = (points: readonly Point[]) =>
  points.reduce((sum, p, i) => {
    const prev = points[i - 1]
    return prev ? sum + Math.hypot(p.x - prev.x, p.y - prev.y) : sum
  }, 0)

/** Lo más que se mira de un trazo para recortarlo con la niebla */
const MAX_CLIP_SAMPLES = 20_000

/** Cuántos puntos por lado se miran, como mucho, de la huella de una marca */
const FOOTPRINT_SAMPLES = 16

/**
 * Unos puntos repartidos por una caja (cada celda de la niebla, o espaciados si es muy grande), con sus esquinas; media
 * celda hacia dentro (lo que pisa justo el borde de lo visto, como una pared, no cuenta)
 */
function boxPoints(x: number, y: number, width: number, height: number, keep: (p: Point) => boolean = () => true) {
  const inset = Math.min(FOG_CELL_SIZE / 2, width / 2, height / 2)
  const [x0, y0, x1, y1] = [x + inset, y + inset, x + width - inset, y + height - inset]
  const step = Math.max(FOG_CELL_SIZE, Math.max(width, height) / FOOTPRINT_SAMPLES)
  const out: Point[] = []
  for (let px = x0; px <= x1 + 1e-6; px += step)
    for (let py = y0; py <= y1 + 1e-6; py += step) out.push({ x: Math.min(px, x1), y: Math.min(py, y1) })
  out.push({ x: x1, y: y0 }, { x: x0, y: y1 }, { x: x1, y: y1 })
  return out.filter(keep)
}

/** Lo que ocupa una marca de un punto (centrada en él, girada o no: la caja que la contiene en cualquier giro) */
function aroundPoint(center: Point, halfWidth: number, halfHeight: number) {
  const r = Math.hypot(halfWidth, halfHeight)
  const inner = Math.max(0, r - FOG_CELL_SIZE / 2)
  return [
    center,
    ...boxPoints(center.x - r, center.y - r, 2 * r, 2 * r, (p) => Math.hypot(p.x - center.x, p.y - center.y) <= inner)
  ]
}

/** `b`, acercado a `a` esa distancia */
function towards(a: Point, b: Point, by: number): Point {
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  if (length <= by) return a
  const k = (length - by) / length
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
}

/** Los puntos que tienen que verse para que una marca llegue a la pantalla */
function footprintOf(kind: tableToolsRepo.MarkRow['kind'], data: Record<string, unknown>): Point[] {
  const center = { x: Number(data.x ?? 0), y: Number(data.y ?? 0) }
  if (kind === 'template') {
    // Lo de dentro de la plantilla, media celda hacia dentro de su borde (su punta y su borde pueden pisar una pared)
    const template = templateOf(data)
    const box = templateBounds(template)
    const inner = { ...template, b: towards(template.a, template.b, FOG_CELL_SIZE / 2) }
    return [template.a, ...boxPoints(box.x, box.y, box.width, box.height, (p) => insideTemplate(inner, p))]
  }
  if (kind === 'image') return aroundPoint(center, Number(data.width) / 2, Number(data.height) / 2)
  if (kind === 'stamp') return aroundPoint(center, Number(data.size) / 2, Number(data.size) / 2)
  if (kind === 'text') {
    // Su caja, a ojo: unas seis décimas de la letra por carácter de ancho
    const size = Number(data.size)
    return aroundPoint(center, (size * String(data.text ?? '').length * 0.6) / 2, size / 2)
  }
  return [center]
}

/** Lo que la pantalla ve de las marcas: las que no son del máster y caen en lo que el grupo ve o vio */
export function screenMarksOf(rows: readonly tableToolsRepo.MarkRow[], sight: Sight): ScreenMark[] {
  return rows.flatMap((row): ScreenMark[] => {
    if (row.hidden) return []
    const data = row.data
    const head = { kind: row.kind, id: row.id }
    if (row.kind === 'drawing') {
      const points = (data.points as Point[] | undefined) ?? []
      const { points: _all, ...rest } = data
      if (points.every((p) => sight.hasPoint(p)) && points.length > 0)
        return [{ ...rest, ...head, strokes: [points] } as ScreenMark]
      const step = Math.max(FOG_CELL_SIZE, lengthOf(points) / MAX_CLIP_SAMPLES)
      const strokes = strokeInside(points, (p) => sight.hasPoint(p), step)
      // Recortado ya no es una forma cerrada: sin relleno
      return strokes.length > 0 ? [{ ...rest, ...head, fill: null, strokes } as ScreenMark] : []
    }
    // Entera en lo que ve o vio el grupo: una imagen grande o una plantilla no asoman a la niebla por su centro
    if (!footprintOf(row.kind, data).every((p) => sight.hasPoint(p))) return []
    if (row.kind === 'pin') {
      const { pageId: _page, ...rest } = data
      return [{ ...rest, ...head } as ScreenMark]
    }
    return [{ ...data, ...head } as ScreenMark]
  })
}

/** Lo que el máster ve de un widget */
export function widgetViewOf(row: tableToolsRepo.WidgetRow): WidgetView {
  const s = row.settings
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    icon: row.icon,
    color: row.color,
    shown: row.shown,
    sort: row.sort,
    value: row.value,
    min: s.min ?? null,
    max: s.max ?? null,
    segments: s.segments ?? null,
    showCount: s.showCount === true,
    duration: s.duration ?? null,
    running: s.running ?? null,
    version: row.version
  }
}

/** Lo que la pantalla ve de los widgets: los que tienen el ojo abierto */
export function screenWidgetsOf(widgets: readonly WidgetView[]): ScreenWidget[] {
  return widgets.filter((w) => w.shown).map(({ shown: _shown, sort: _sort, version: _version, ...rest }) => rest)
}
