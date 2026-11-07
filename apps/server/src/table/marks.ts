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
  type Point,
  strokeInside,
  type TemplateShape,
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
    const anchor = row.kind === 'template' ? (data.a as Point) : { x: data.x as number, y: data.y as number }
    if (!sight.hasPoint(anchor)) return []
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
