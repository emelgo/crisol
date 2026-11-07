/**
 * Las herramientas de la mesa (docs/specs/herramientas-mesa.md), lo que no es dibujo de React: dónde cae un punto al
 * medir, lo que dice una medida y dónde, el contorno de una plantilla con su color o la trama de su tipo de daño, las
 * formas de un dibujo, la goma, girar una plantilla y lo que va en vivo por el canal. Puro: lo usan la mesa, la tele y
 * sus pruebas
 */
import type { LiveMeasure, MarkView, SceneGrid, ScreenMark } from '@crisol/contracts'
import {
  type AreaTemplate,
  cellAt,
  cellCenter,
  DEFAULT_CONE_ANGLE,
  distanceText,
  insideTemplate,
  measurePath,
  type Point,
  splitByEraser,
  squareOf,
  tokensInTemplate
} from '@crisol/tabletop'
import type { MapLabel, OverlayShape } from './renderer.ts'
import { cellSide } from './tokens.ts'
import { coreGrid } from './view.ts'

export type TemplateShape = LiveMeasure['shape']

/** Una medida en curso: un camino (line, con sus puntos de paso y el último donde está el cursor) o una forma de a a b */
export interface Measure {
  shape: TemplateShape
  points: Point[]
}

const round = (n: number) => Math.round(n * 10) / 10

/**
 * Dónde cae un punto al medir: en la cuadrada, en el centro o en la esquina de casilla más cerca (media casilla); en la
 * hexagonal, en el centro de su casilla; sin rejilla (o con Alt), donde está
 */
export function snapMeasure(p: Point, grid: SceneGrid, free = false): Point {
  const core = coreGrid(grid)
  if (!core || free) return { x: round(p.x), y: round(p.y) }
  if (core.type !== 'square') return cellCenter(core, cellAt(core, p))
  const half = core.size / 2
  return {
    x: round(core.offsetX + Math.round((p.x - core.offsetX) / half) * half),
    y: round(core.offsetY + Math.round((p.y - core.offsetY) / half) * half)
  }
}

const scaleOf = (grid: SceneGrid) => ({ distance: grid.distance, units: grid.units })

/** Lo que mide una forma: su largo (el radio, el del cono o la línea, el lado del cuadrado) en línea recta */
export function shapeCells(shape: TemplateShape, a: Point, b: Point, grid: SceneGrid): number {
  const cell = cellSide(grid)
  if (shape === 'square') return squareOf(a, b).side / cell
  return Math.hypot(b.x - a.x, b.y - a.y) / cell
}

/** El total, abajo a la derecha de su punto (como el lienzo), sin tapar la ficha */
const TOTAL_OFFSET = { x: 44, y: 30 }

/** Las casillas, a media casilla (las formas no tienen por qué caer en la rejilla) */
const halfCells = (cells: number) => Math.round(cells * 2) / 2

/**
 * Los rótulos de una medida: de un camino, cada tramo en su mitad (si hay más de uno) y el total al final; de una
 * forma, su largo junto a su punto final. En la unidad de la escena y con su regla de diagonales
 */
export function measureLabels(measure: Measure, grid: SceneGrid): MapLabel[] {
  const { points } = measure
  const first = points[0]
  const last = points.at(-1)
  if (!first || !last || points.length < 2) return []
  const scale = scaleOf(grid)
  if (measure.shape !== 'line') {
    const cells = halfCells(shapeCells(measure.shape, first, last, grid))
    return cells > 0 ? [{ at: last, text: distanceText(cells, scale), strong: true, offset: TOTAL_OFFSET }] : []
  }
  const { segments, cells } = measurePath(coreGrid(grid), points, grid.diagonals, cellSide(grid))
  const labels: MapLabel[] = []
  if (segments.length > 1)
    segments.forEach((n, i) => {
      const a = points[i] as Point
      const b = points[i + 1] as Point
      labels.push({ at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, text: distanceText(n, scale) })
    })
  labels.push({ at: last, text: distanceText(cells, scale), strong: true, offset: TOTAL_OFFSET })
  return labels
}

/** La plantilla de una medida (una forma de su primer punto al último) */
export function templateOf(measure: Measure, grid: SceneGrid): AreaTemplate | null {
  const a = measure.points[0]
  const b = measure.points.at(-1)
  if (!a || !b || (a.x === b.x && a.y === b.y)) return null
  return {
    shape: measure.shape,
    a,
    b,
    ...(measure.shape === 'cone' ? { angle: DEFAULT_CONE_ANGLE } : {}),
    ...(measure.shape === 'line' ? { width: cellSide(grid) } : {})
  }
}

/** El contorno de una plantilla, en puntos del mapa (un polígono cerrado) */
export function templateOutline(t: AreaTemplate, cell: number): Point[] {
  const { a, b } = t
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  const direction = Math.atan2(b.y - a.y, b.x - a.x)
  if (t.shape === 'square') {
    const r = squareOf(a, b)
    return [
      { x: r.x, y: r.y },
      { x: r.x + r.side, y: r.y },
      { x: r.x + r.side, y: r.y + r.side },
      { x: r.x, y: r.y + r.side }
    ]
  }
  if (t.shape === 'line') {
    const half = (t.width ?? cell) / 2
    const nx = -Math.sin(direction) * half
    const ny = Math.cos(direction) * half
    return [
      { x: a.x + nx, y: a.y + ny },
      { x: b.x + nx, y: b.y + ny },
      { x: b.x - nx, y: b.y - ny },
      { x: a.x - nx, y: a.y - ny }
    ]
  }
  if (t.shape === 'circle') {
    const sides = 72
    return Array.from({ length: sides }, (_, i) => ({
      x: a.x + length * Math.cos((i / sides) * Math.PI * 2),
      y: a.y + length * Math.sin((i / sides) * Math.PI * 2)
    }))
  }
  const half = ((t.angle ?? DEFAULT_CONE_ANGLE) * Math.PI) / 360
  const steps = 24
  return [
    { x: a.x, y: a.y },
    ...Array.from({ length: steps + 1 }, (_, i) => {
      const angle = direction - half + (2 * half * i) / steps
      return { x: a.x + length * Math.cos(angle), y: a.y + length * Math.sin(angle) }
    })
  ]
}

/**
 * Las rayas de una trama dentro de un polígono convexo: paralelas, cada `gap` píxeles y con ese ángulo (en grados),
 * recortadas por su borde
 */
export function hatchLines(polygon: readonly Point[], gap: number, angle: number): Array<[Point, Point]> {
  if (polygon.length < 3 || gap <= 0) return []
  const rad = (angle * Math.PI) / 180
  // Se giran los puntos para que las rayas sean horizontales; se recortan y se devuelven girados al revés
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const turn = (p: Point) => ({ x: p.x * cos + p.y * sin, y: -p.x * sin + p.y * cos })
  const back = (p: Point) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos })
  const turned = polygon.map(turn)
  const ys = turned.map((p) => p.y)
  const top = Math.min(...ys)
  const bottom = Math.max(...ys)
  const lines: Array<[Point, Point]> = []
  for (let y = Math.ceil(top / gap) * gap; y <= bottom; y += gap) {
    const xs: number[] = []
    for (let i = 0; i < turned.length; i++) {
      const p = turned[i] as Point
      const q = turned[(i + 1) % turned.length] as Point
      if (p.y === q.y || y < Math.min(p.y, q.y) || y > Math.max(p.y, q.y)) continue
      xs.push(p.x + ((y - p.y) * (q.x - p.x)) / (q.y - p.y))
    }
    if (xs.length < 2) continue
    const from = Math.min(...xs)
    const to = Math.max(...xs)
    if (to - from < 1e-6) continue
    lines.push([back({ x: from, y }), back({ x: to, y })])
  }
  return lines
}

/** Los tipos de daño que se ofrecen para la trama, con su color y el ángulo de sus rayas */
export const DAMAGE_TYPES = {
  acid: { color: '#8fd14f', angle: 45 },
  bludgeoning: { color: '#b8a48a', angle: 0 },
  cold: { color: '#8ad4ff', angle: -45 },
  fire: { color: '#ff7a3d', angle: 45 },
  force: { color: '#c39bff', angle: 90 },
  lightning: { color: '#f2e45c', angle: -30 },
  necrotic: { color: '#7d6b9e', angle: -45 },
  piercing: { color: '#c8c8d0', angle: 60 },
  poison: { color: '#5fae5f', angle: 30 },
  psychic: { color: '#ff7ac6', angle: -60 },
  radiant: { color: '#ffe08a', angle: 0 },
  slashing: { color: '#d8d8e0', angle: -15 },
  thunder: { color: '#6f9cff', angle: 15 }
} as const

export type DamageType = keyof typeof DAMAGE_TYPES

/** Los colores de las plantillas y de los dibujos (como el lienzo) */
export const MARK_COLORS = ['#ff6b5b', '#f2c260', '#8ab4f8', '#f3f1ec'] as const

export const hex = (color: string) => Number.parseInt(color.replace('#', ''), 16) || 0xffffff

type TemplateLike = AreaTemplate & { color: string; damageType?: string | null | undefined }

/**
 * Cómo se pinta una plantilla: su relleno (o, con un tipo de daño conocido, la trama de su color), su borde (a trazos
 * si es del máster) y, elegida, el asa de su punto final para girarla
 */
export function templateShapes(
  t: TemplateLike,
  options: { cell: number; selected?: boolean; hidden?: boolean; live?: boolean }
): OverlayShape[] {
  const outline = templateOutline(t, options.cell)
  const style = t.damageType && t.damageType in DAMAGE_TYPES ? DAMAGE_TYPES[t.damageType as DamageType] : null
  const color = hex(style?.color ?? t.color)
  const shapes: OverlayShape[] = [
    {
      kind: 'polygon',
      points: outline,
      color,
      width: 0,
      fill: style ? 0.12 : 0.22,
      closed: true
    }
  ]
  if (style)
    for (const [a, b] of hatchLines(outline, options.cell / 5, style.angle))
      shapes.push({ kind: 'line', a, b, color, width: 1.5, alpha: 0.7 })
  shapes.push({
    kind: 'polygon',
    points: outline,
    color,
    width: options.selected ? 3 : 2.5,
    closed: true,
    ...(options.hidden || options.live ? { dash: [10, 7] as const } : {})
  })
  if (options.selected) shapes.push({ kind: 'dot', at: t.b, color, radius: 7, stroke: 0x0b0b0c })
  return shapes
}

/** Cómo se pinta una medida en curso: un camino con sus puntos o la forma a trazos */
export function measureShapes(measure: Measure, grid: SceneGrid): OverlayShape[] {
  const gold = 0xf2c260
  if (measure.shape !== 'line') {
    const template = templateOf(measure, grid)
    return template ? templateShapes({ ...template, color: '#f2c260' }, { cell: cellSide(grid), live: true }) : []
  }
  const shapes: OverlayShape[] = []
  if (measure.points.length > 1) shapes.push({ kind: 'polygon', points: measure.points, color: gold, width: 4 })
  measure.points.forEach((p, i) => {
    if (i === 0 || i === measure.points.length - 1)
      shapes.push({ kind: 'dot', at: p, color: gold, radius: 5, stroke: 0x0b0b0c })
    else shapes.push({ kind: 'dot', at: p, color: 0x111214, radius: 7, stroke: gold })
  })
  return shapes
}

/** Lo que va por el canal de una medida en curso */
export function liveMeasureOf(measure: Measure, grid: SceneGrid): LiveMeasure | null {
  if (measure.points.length < 2) return null
  return {
    shape: measure.shape,
    points: measure.points.slice(-50),
    ...(measure.shape === 'cone' ? { angle: DEFAULT_CONE_ANGLE } : {}),
    ...(measure.shape === 'line' ? { width: cellSide(grid) } : {})
  }
}

/** Cómo se pinta un dibujo: su trazo con su grosor en píxeles del mapa y, si lo tiene, su relleno */
export function drawingShapes(
  d: { points: readonly Point[]; color: string; width: number; opacity: number; fill?: string | null | undefined },
  hidden = false
): OverlayShape[] {
  const closed = d.points.length > 2 && Boolean(d.fill)
  return [
    {
      kind: 'polygon',
      points: d.points.length === 1 ? [d.points[0] as Point, d.points[0] as Point] : d.points,
      color: hex(d.color),
      width: d.width,
      scaled: true,
      alpha: d.opacity * (hidden ? 0.55 : 1),
      ...(d.fill ? { fill: 0.25 * d.opacity, fillColor: hex(d.fill), closed } : {}),
      ...(hidden ? { dash: [10, 7] as const } : {})
    }
  ]
}

/** Lo que se pinta de lo dejado en el mapa (plantillas y dibujos): para la mesa y para la tele */
export function markShapes(
  marks: ReadonlyArray<MarkView | ScreenMark>,
  grid: SceneGrid,
  selected: string | null = null
): OverlayShape[] {
  const cell = cellSide(grid)
  const shapes: OverlayShape[] = []
  for (const mark of marks) {
    const hidden = 'hidden' in mark && mark.hidden
    if (mark.kind === 'template') shapes.push(...templateShapes(mark, { cell, selected: mark.id === selected, hidden }))
    else if (mark.kind === 'drawing') {
      const strokes = 'strokes' in mark ? mark.strokes : [mark.points]
      for (const points of strokes) shapes.push(...drawingShapes({ ...mark, points }, hidden))
    }
  }
  return shapes
}

/** La plantilla bajo un punto (la de encima, la última) */
export function templateAt<T extends TemplateLike>(templates: readonly T[], p: Point, cell: number): T | null {
  for (let i = templates.length - 1; i >= 0; i--) {
    const t = templates[i] as T
    if (insideTemplate(t, p, cell)) return t
  }
  return null
}

/** Girar una plantilla hacia un punto: el mismo largo desde su origen, hacia allí */
export function rotateToward(t: Pick<AreaTemplate, 'a' | 'b'>, toward: Point): Point {
  const length = Math.hypot(t.b.x - t.a.x, t.b.y - t.a.y)
  const angle = Math.atan2(toward.y - t.a.y, toward.x - t.a.x)
  return { x: round(t.a.x + length * Math.cos(angle)), y: round(t.a.y + length * Math.sin(angle)) }
}

/** Las fichas que quedan dentro de una plantilla (como el servidor: basta una casilla de su huella) */
export function targetsOf<T extends { id: string; x: number; y: number; size: number }>(
  t: AreaTemplate,
  tokens: readonly T[],
  grid: SceneGrid
): T[] {
  return tokensInTemplate(t, tokens, coreGrid(grid), cellSide(grid))
}

type DrawingMark = Extract<MarkView, { kind: 'drawing' }>

/**
 * Lo que hace la goma (un círculo) con los dibujos: los que toca se quitan y lo que queda de cada uno (sus tramos de
 * más de un punto) entra como dibujos nuevos, con lo mismo que tenía. Todo en una operación
 */
export function erase(
  drawings: readonly DrawingMark[],
  center: Point,
  radius: number
): { remove: string[]; add: Array<Omit<DrawingMark, 'id' | 'sceneId' | 'version'>> } {
  const remove: string[] = []
  const add: Array<Omit<DrawingMark, 'id' | 'sceneId' | 'version'>> = []
  for (const drawing of drawings) {
    const pieces = splitByEraser(drawing.points, center, radius, drawing.width)
    if (!pieces) continue
    remove.push(drawing.id)
    const { id: _, sceneId: __, version: ___, ...rest } = drawing
    for (const piece of pieces)
      if (piece.length > 1)
        add.push({ ...rest, tool: 'pen', fill: null, points: piece.map((p) => ({ x: round(p.x), y: round(p.y) })) })
  }
  return { remove, add }
}

/** Los puntos de un trazo, como mucho `max` (se quitan los de en medio a partes iguales) */
export function thinStroke(points: readonly Point[], max: number): Point[] {
  const rounded = points.map((p) => ({ x: round(p.x), y: round(p.y) }))
  if (rounded.length <= max) return rounded
  const step = (rounded.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => rounded[Math.round(i * step)] as Point)
}

/** El tamaño de la letra de un texto nuevo y el lado de un sello nuevo, en píxeles del mapa */
export const newTextSize = (grid: SceneGrid) => Math.round(cellSide(grid) * 0.45)
export const newStampSize = (grid: SceneGrid) => Math.round(cellSide(grid) * 0.7)

type PlacedMark = Extract<MarkView, { kind: 'text' | 'stamp' | 'pin' | 'image' }>

/** Lo que ocupa un pin en la pantalla (se clava por la punta), en píxeles de la pantalla */
export const PIN_SIZE = 30

/**
 * La marca suelta (texto, sello, pin o imagen) bajo un punto del mapa, la de encima: un texto en su caja aproximada, un
 * sello en su cuadrado, un pin en su gota (de tamaño fijo en la pantalla, `scale`) y una imagen girada
 */
export function placedAt(marks: readonly MarkView[], p: Point, scale: number): PlacedMark | null {
  for (let i = marks.length - 1; i >= 0; i--) {
    const mark = marks[i] as MarkView
    if (mark.kind === 'text') {
      const lines = mark.text.split('\n')
      const width = Math.max(...lines.map((line) => line.length)) * mark.size * 0.55
      const height = lines.length * mark.size * 1.2
      if (Math.abs(p.x - mark.x) <= width / 2 + 4 / scale && Math.abs(p.y - mark.y) <= height / 2 + 4 / scale)
        return mark
    } else if (mark.kind === 'stamp') {
      if (Math.abs(p.x - mark.x) <= mark.size / 2 && Math.abs(p.y - mark.y) <= mark.size / 2) return mark
    } else if (mark.kind === 'pin') {
      const r = PIN_SIZE / 2 / scale
      if (Math.hypot(p.x - mark.x, p.y - (mark.y - r)) <= r) return mark
    } else if (mark.kind === 'image') {
      const l = { x: p.x - mark.x, y: p.y - mark.y }
      const a = (-mark.rotation * Math.PI) / 180
      const x = l.x * Math.cos(a) - l.y * Math.sin(a)
      const y = l.x * Math.sin(a) + l.y * Math.cos(a)
      if (Math.abs(x) <= mark.width / 2 && Math.abs(y) <= mark.height / 2) return mark
    }
  }
  return null
}

/** Una marca movida: sus puntos o su sitio (como lo hace el servidor con `move`) */
export function movedMark<T extends MarkView>(mark: T, dx: number, dy: number): T {
  const move = (p: Point) => ({ x: round(p.x + dx), y: round(p.y + dy) })
  if (mark.kind === 'template') return { ...mark, a: move(mark.a), b: move(mark.b) }
  if (mark.kind === 'drawing') return { ...mark, points: mark.points.map(move) }
  return { ...mark, x: round(mark.x + dx), y: round(mark.y + dy) }
}

/** El nombre de una plantilla: su forma y su largo («Cono de 30 pies») */
export function templateSize(t: Pick<AreaTemplate, 'shape' | 'a' | 'b'>, grid: SceneGrid): string {
  return distanceText(halfCells(shapeCells(t.shape, t.a, t.b, grid)), scaleOf(grid))
}
