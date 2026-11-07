/**
 * Las herramientas de la mesa del máster (docs/specs/herramientas-mesa.md): lo dejado en el mapa de la escena abierta
 * (con lo que devuelve cada acción al momento, hasta que llega la mesa) y lo que hace cada herramienta en él: medir
 * (con la medida en vivo por el canal), dejar y mover o girar plantillas, dibujar y borrar con la goma, poner textos,
 * sellos, pines e imágenes (moverlas; las imágenes, también su tamaño y su giro) y el láser. Lo pinta en el lienzo
 * (lo dejado debajo de las fichas; la medida, el láser y lo que se está haciendo, encima) y dice qué fichas caen en
 * la plantilla elegida o en la que se está midiendo
 */
import {
  type CampaignTableView,
  MAX_STROKE_POINTS,
  type MarkInput,
  type MarkView,
  type TokenView
} from '@crisol/contracts'
import {
  circlePoints,
  followStroke,
  handleAt,
  imageCorners,
  liveTrail,
  type Point,
  rectanglePoints,
  resizeImage,
  rotationHandle,
  rotationToward,
  type Viewport
} from '@crisol/tabletop'
import { useMutation } from '@tanstack/react-query'
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ActionInput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import type { TableChannel } from './channel.ts'
import type { MapImageDraw, MapLabel, OverlayShape, TableRenderer } from './renderer.ts'
import { cellSide } from './tokens.ts'
import {
  drawingShapes,
  erase,
  hex,
  liveMeasureOf,
  MARK_COLORS,
  type Measure,
  markShapes,
  measureLabels,
  measureShapes,
  movedMark,
  newStampSize,
  placedAt,
  rotateToward,
  snapMeasure,
  type TemplateShape,
  targetsOf,
  templateAt,
  templateOf,
  thinStroke
} from './tools.ts'
import type { ToolHandlers } from './vision.tsx'

export const MARK_TOOLS = ['measure', 'template', 'laser', 'draw', 'text', 'stamp', 'pin', 'image'] as const
export type MarkTool = (typeof MARK_TOOLS)[number]
export const isMarkTool = (tool: string): tool is MarkTool => (MARK_TOOLS as readonly string[]).includes(tool)

export type DrawTool = 'pen' | 'line' | 'rectangle' | 'circle' | 'eraser'
export const DRAW_WIDTHS = { thin: 3, medium: 6, thick: 12 } as const
export type DrawWidth = keyof typeof DRAW_WIDTHS

/** Una imagen elegida para ponerla con un clic: el archivo y su tamaño de verdad */
export type ArmedImage = { fileId: string; url: string; width: number; height: number }

/** Lo que trae un gesto en curso */
type Gesture =
  | { type: 'measure'; dragging: boolean; moved: boolean }
  | { type: 'move'; id: string; from: Point; to: Point; moved: boolean }
  | { type: 'rotate'; id: string; to: Point }
  | { type: 'image'; id: string; handle: { handle: 'size'; corner: number } | { handle: 'rotation' }; to: Point }
  | { type: 'stroke'; points: Point[] }
  | { type: 'shape'; from: Point; to: Point }
  | { type: 'erase'; points: Point[] }
  | { type: 'laser' }

/** Lo que se pasa de largo al pulsar el asa de una plantilla o de una imagen, en píxeles de la pantalla */
const HANDLE = 10
/** El asa de giro de una imagen, por encima de su lado de arriba */
const TURN = 28
/** Lo que mide la goma, en píxeles de la pantalla */
const ERASER = 14

const LASER_COLOR = 0xff3b3b
const LASER_FRAME_MS = 40

type ChangeMarks = Omit<ActionInput<'changeMarks'>, 'campaignId' | 'sceneId'>

export type TableTools = ReturnType<typeof useTableTools>

export function useTableTools({
  campaignId,
  table,
  tool,
  view,
  renderer,
  ready,
  channel,
  tokens
}: {
  campaignId: string
  table: CampaignTableView | null
  tool: string
  view: RefObject<Viewport>
  renderer: RefObject<Pick<TableRenderer, 'setShapes' | 'setLabels' | 'setImages'> | null>
  ready: boolean
  channel: RefObject<TableChannel | null>
  tokens: TokenView[]
}) {
  const api = useApi()
  const open = table?.open ?? null
  const sceneId = open?.id ?? null
  const grid = open?.grid ?? null

  // Lo dejado en el mapa: lo de la mesa, con lo que devuelven las acciones hasta que llega otra
  const fromTable = table?.marks
  const [local, setLocal] = useState<{ base: MarkView[] | undefined; marks: MarkView[] } | null>(null)
  const all = local && local.base === fromTable ? local.marks : (fromTable ?? [])
  const marks = useMemo(() => all.filter((mark) => mark.sceneId === sceneId), [all, sceneId])
  const marksRef = useRef(marks)
  marksRef.current = marks

  // Lo que se elige para lo nuevo
  const [shape, setShape] = useState<TemplateShape>('line')
  const [color, setColor] = useState<string>(MARK_COLORS[0])
  const [damageType, setDamageType] = useState<string | null>(null)
  const [drawTool, setDrawTool] = useState<DrawTool>('pen')
  const [drawWidth, setDrawWidth] = useState<DrawWidth>('medium')
  /** Lo nuevo, solo del máster (no llega a la tele) */
  const [secret, setSecret] = useState(false)
  const [stamp, setStamp] = useState<{ icon: string | null; fileId: string | null }>({ icon: 'skull', fileId: null })
  const [armedImage, setArmedImage] = useState<ArmedImage | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  /** Dónde se escribe un texto nuevo (en píxeles del mapa) */
  const [writing, setWriting] = useState<Point | null>(null)
  // La medida en curso o acabada (se queda hasta la siguiente o hasta Escape)
  const measure = useRef<Measure | null>(null)
  const [measured, setMeasured] = useState<Measure | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const hover = useRef<Point | null>(null)
  // Lo que recorre una ficha al arrastrarla
  const dragPath = useRef<Measure | null>(null)
  // La estela del láser: sus puntos, con cuándo se pusieron
  const laser = useRef<Array<Point & { t: number }>>([])
  const laserFrame = useRef(0)
  // Las fichas que caen en la plantilla que se está midiendo
  const [liveTargets, setLiveTargets] = useState<string[]>([])

  const apply = useCallback(
    (result: { marks: MarkView[]; removed: string[] }) => {
      setLocal((current) => {
        const base = current && current.base === fromTable ? current.marks : (fromTable ?? [])
        const changed = new Map(result.marks.map((mark) => [mark.id, mark]))
        const kept = base
          .filter((mark) => !result.removed.includes(mark.id))
          .map((mark) => changed.get(mark.id) ?? mark)
        const added = result.marks.filter((mark) => !base.some((each) => each.id === mark.id))
        return { base: fromTable, marks: [...kept, ...added] }
      })
    },
    [fromTable]
  )
  const change = useMutation({
    mutationFn: (input: ChangeMarks) =>
      api.call('changeMarks', { campaignId, ...(sceneId ? { sceneId } : {}), ...input }),
    onSuccess: apply
  })
  const [onScreen, setOnScreen] = useState<{ base: boolean | undefined; on: boolean } | null>(null)
  const measureOnScreen =
    onScreen && onScreen.base === table?.measureOnScreen ? onScreen.on : (table?.measureOnScreen ?? false)
  const setMeasureOnScreen = useMutation({
    mutationFn: (on: boolean) => api.call('setMeasureOnScreen', { campaignId, on }),
    onMutate: (on) => setOnScreen({ base: table?.measureOnScreen, on })
  })
  const setDiagonals = useMutation({
    mutationFn: (diagonals: 'equal' | 'alternate' | 'euclidean') =>
      api.call('updateScene', { sceneId: sceneId as string, grid: { diagonals } })
  })

  // Lo de ahora, para los gestos (que no esperan a volver a pintar)
  const state = useRef({ tool, shape, color, damageType, drawTool, drawWidth, secret, stamp, armedImage, selected })
  state.current = { tool, shape, color, damageType, drawTool, drawWidth, secret, stamp, armedImage, selected }
  const tokensRef = useRef(tokens)
  tokensRef.current = tokens

  const scale = () => view.current?.scale ?? 1

  /** Lo que se pinta encima de las fichas (la medida, el láser, lo que se está haciendo) y debajo (lo dejado) */
  const redraw = useCallback(() => {
    const target = renderer.current
    if (!target || !grid) return
    const now = state.current
    const g = gesture.current
    const k = view.current?.scale ?? 1
    // Lo dejado, con lo que se está moviendo donde va
    const shown = marksRef.current.map((mark) => {
      if (g?.type === 'move' && g.id === mark.id) return movedMark(mark, g.to.x - g.from.x, g.to.y - g.from.y)
      if (g?.type === 'rotate' && g.id === mark.id && mark.kind === 'template')
        return { ...mark, b: rotateToward(mark, g.to) }
      if (g?.type === 'image' && g.id === mark.id && mark.kind === 'image') {
        if (g.handle.handle === 'rotation') return { ...mark, rotation: rotationToward(mark, g.to) }
        return { ...mark, ...resizeImage(mark, g.handle.corner, g.to) }
      }
      return mark
    })
    target.setShapes(markShapes(shown, grid, now.selected), 'marks')
    target.setImages(
      [...shown.filter((m) => m.kind === 'image' && !m.above), ...shown.filter((m) => m.kind === 'image' && m.above)]
        .filter((m): m is Extract<MarkView, { kind: 'image' }> => m.kind === 'image')
        .map(
          (m): MapImageDraw => ({
            id: m.id,
            url: `/api/files/${m.fileId}`,
            x: m.x,
            y: m.y,
            width: m.width,
            height: m.height,
            rotation: m.rotation,
            above: m.above ?? false,
            alpha: m.hidden ? 0.6 : 1
          })
        )
    )
    const live: OverlayShape[] = []
    const labels: MapLabel[] = []
    for (const current of [measure.current, dragPath.current]) {
      if (!current) continue
      live.push(...measureShapes(current, grid))
      labels.push(...measureLabels(current, grid))
    }
    // La imagen elegida: su marco y sus asas
    const image = shown.find((m) => m.id === now.selected && m.kind === 'image')
    if (image?.kind === 'image' && now.tool === 'image') {
      const corners = imageCorners(image)
      live.push({ kind: 'polygon', points: corners, color: 0xf2c260, width: 2, closed: true, dash: [8, 5] })
      for (const corner of corners) live.push({ kind: 'dot', at: corner, color: 0xf2c260, radius: 6, stroke: 0x0b0b0c })
      const turn = rotationHandle(image, TURN / k)
      live.push({ kind: 'dot', at: turn, color: 0xffffff, radius: 6, stroke: 0x0b0b0c })
    }
    // La marca suelta elegida (texto, sello, pin): un recuadro a trazos
    const placed = shown.find((m) => m.id === now.selected && (m.kind === 'text' || m.kind === 'stamp'))
    if (placed && (placed.kind === 'text' || placed.kind === 'stamp')) {
      const half =
        placed.kind === 'stamp'
          ? { x: placed.size / 2 + 6 / k, y: placed.size / 2 + 6 / k }
          : { x: placed.text.length * placed.size * 0.28 + 6 / k, y: placed.size * 0.6 + 6 / k }
      live.push({
        kind: 'polygon',
        points: rectanglePoints(
          { x: placed.x - half.x, y: placed.y - half.y },
          { x: placed.x + half.x, y: placed.y + half.y }
        ),
        color: 0xf2c260,
        width: 1.5,
        dash: [6, 4]
      })
    }
    if (g?.type === 'stroke')
      live.push(...drawingShapes({ points: g.points, color: now.color, width: DRAW_WIDTHS[now.drawWidth], opacity: 1 }))
    if (g?.type === 'shape') {
      const points = shapePoints(now.drawTool, g.from, g.to)
      if (points)
        live.push(...drawingShapes({ points, color: now.color, width: DRAW_WIDTHS[now.drawWidth], opacity: 1 }))
    }
    if (now.tool === 'draw' && now.drawTool === 'eraser' && hover.current)
      live.push({ kind: 'circle', at: hover.current, radius: ERASER / k, color: 0xffffff, width: 1.5, dash: [4, 4] })
    // El láser: cada tramo, más fino y más tenue cuanto más viejo
    const trail = liveTrail(laser.current, performance.now())
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1] as Point & { life: number }
      const b = trail[i] as Point & { life: number }
      live.push({ kind: 'line', a, b, color: LASER_COLOR, width: 2 + 5 * b.life, alpha: b.life })
    }
    const head = trail.at(-1)
    if (head) live.push({ kind: 'dot', at: head, color: LASER_COLOR, radius: 7, alpha: head.life })
    target.setShapes(live, 'live')
    target.setLabels(labels)
  }, [renderer, grid, view])
  const redrawRef = useRef(redraw)
  redrawRef.current = redraw

  useEffect(() => {
    if (ready) redraw()
  }, [ready, redraw, marks, tool, selected, color, drawTool, drawWidth])

  // Otra herramienta u otra escena: sin gesto, sin medida y sin nada elegido
  useEffect(() => {
    gesture.current = null
    hover.current = null
    setWriting(null)
    setSelected(null)
    if (measure.current) {
      measure.current = null
      setMeasured(null)
      setLiveTargets([])
      channel.current?.sendMeasure(null)
    }
    redrawRef.current()
  }, [tool, sceneId])

  /** La medida cambia: se pinta, va por el canal y dice qué fichas caen en su forma */
  const measureChanged = useCallback(() => {
    const current = measure.current
    if (!grid) return
    channel.current?.sendMeasure(current ? liveMeasureOf(current, grid) : null)
    const template = current && current.shape !== 'line' ? templateOf(current, grid) : null
    const inside = template ? targetsOf(template, tokensRef.current, grid).map((token) => token.id) : []
    setLiveTargets((before) => (before.join() === inside.join() ? before : inside))
    redrawRef.current()
  }, [grid, channel])

  const clearMeasure = useCallback(() => {
    if (!measure.current) return false
    measure.current = null
    gesture.current = null
    setMeasured(null)
    measureChanged()
    return true
  }, [measureChanged])

  /** Lo que recorre una ficha que se arrastra (null: se soltó) */
  const showDrag = useCallback(
    (from: Point | null, to?: Point) => {
      if (!grid) return
      dragPath.current = from && to ? { shape: 'line', points: [from, to] } : null
      channel.current?.sendMeasure(dragPath.current ? liveMeasureOf(dragPath.current, grid) : null)
      redrawRef.current()
    },
    [grid, channel]
  )

  /** La estela del láser se apaga sola: se repinta mientras quede algo */
  const animateLaser = useCallback(() => {
    if (laserFrame.current) return
    let painted = 0
    const step = (now: number) => {
      laserFrame.current = 0
      // Unos 25 por segundo bastan para la estela (repintar es repintar toda la mesa)
      if (now - painted >= LASER_FRAME_MS) {
        painted = now
        redrawRef.current()
      }
      if (liveTrail(laser.current, performance.now()).length > 0) laserFrame.current = requestAnimationFrame(step)
      else {
        laser.current = []
        redrawRef.current()
      }
    }
    laserFrame.current = requestAnimationFrame(step)
  }, [])
  useEffect(() => () => cancelAnimationFrame(laserFrame.current), [])

  const add = useCallback(
    (input: MarkInput, select = true) =>
      change.mutate(
        { add: [input] },
        {
          onSuccess: (result) => {
            if (select) setSelected(result.marks[0]?.id ?? null)
          }
        }
      ),
    [change]
  )

  /** Deja la medida como plantilla, con el color o el tipo de daño elegidos */
  const keepAsTemplate = useCallback(() => {
    const current = measure.current
    if (!current || !grid) return
    const template = templateOf(current, grid)
    if (!template) return
    const now = state.current
    add({
      kind: 'template',
      ...template,
      color: now.color,
      ...(now.damageType ? { damageType: now.damageType } : {}),
      hidden: now.secret
    })
    clearMeasure()
  }, [grid, add, clearMeasure])

  const handlers = useMemo((): ToolHandlers | null => {
    if (!grid || !isMarkTool(tool)) return null
    const k = () => scale()
    const free = (event: { altKey: boolean }) => event.altKey
    /** Empezar a mover (o girar) lo que hay bajo el puntero: true si había algo */
    const grab = (world: Point, kinds: ReadonlyArray<MarkView['kind']>) => {
      const now = state.current
      const own = marksRef.current.filter((mark) => kinds.includes(mark.kind))
      // El asa de la plantilla elegida la gira; la de una imagen elegida, su tamaño o su giro
      const chosen = own.find((mark) => mark.id === now.selected)
      if (chosen?.kind === 'template' && Math.hypot(world.x - chosen.b.x, world.y - chosen.b.y) <= HANDLE / k()) {
        gesture.current = { type: 'rotate', id: chosen.id, to: world }
        return true
      }
      if (chosen?.kind === 'image') {
        const handle = handleAt(chosen, world, HANDLE / k(), TURN / k())
        if (handle) {
          gesture.current = { type: 'image', id: chosen.id, handle, to: world }
          return true
        }
      }
      const templates = own.filter((mark) => mark.kind === 'template')
      const hit =
        placedAt(
          own.filter((mark) => mark.kind !== 'template'),
          world,
          k()
        ) ?? templateAt(templates, world, cellSide(grid))
      if (!hit) return false
      setSelected(hit.id)
      gesture.current = { type: 'move', id: hit.id, from: world, to: world, moved: false }
      redrawRef.current()
      return true
    }
    /** Acaba de mover, girar o cambiar el tamaño: true si lo llevaba */
    const release = () => {
      const g = gesture.current
      if (g?.type === 'move') {
        gesture.current = null
        if (g.moved) change.mutate({ update: [{ id: g.id, move: { dx: g.to.x - g.from.x, dy: g.to.y - g.from.y } }] })
        redrawRef.current()
        return true
      }
      if (g?.type === 'rotate') {
        gesture.current = null
        const mark = marksRef.current.find((each) => each.id === g.id)
        if (mark?.kind === 'template') change.mutate({ update: [{ id: g.id, set: { b: rotateToward(mark, g.to) } }] })
        redrawRef.current()
        return true
      }
      if (g?.type === 'image') {
        gesture.current = null
        const mark = marksRef.current.find((each) => each.id === g.id)
        if (mark?.kind === 'image') {
          const set =
            g.handle.handle === 'rotation'
              ? { rotation: rotationToward(mark, g.to) }
              : roundedSize(resizeImage(mark, g.handle.corner, g.to))
          change.mutate({ update: [{ id: g.id, set }] })
        }
        redrawRef.current()
        return true
      }
      return false
    }
    /** Mover, girar o cambiar el tamaño mientras se arrastra: true si lo llevaba */
    const drag = (world: Point) => {
      const g = gesture.current
      if (g?.type === 'move') {
        if (!g.moved && Math.hypot(world.x - g.from.x, world.y - g.from.y) * k() < 4) return true
        g.moved = true
        g.to = { x: Math.round(world.x), y: Math.round(world.y) }
      } else if (g?.type === 'rotate' || g?.type === 'image') g.to = world
      else return false
      redrawRef.current()
      return true
    }

    if (tool === 'measure' || tool === 'template')
      return {
        down(world, event) {
          const g = gesture.current
          const at = snapMeasure(world, grid, free(event))
          // Un camino a clics: cada uno pone un punto; uno en el mismo sitio (doble clic) lo acaba
          if (g?.type === 'measure' && !g.dragging && measure.current) {
            const points = measure.current.points
            const last = points.at(-2)
            if (last && last.x === at.x && last.y === at.y) {
              measure.current = { ...measure.current, points: points.slice(0, -1) }
              gesture.current = null
            } else measure.current = { ...measure.current, points: [...points.slice(0, -1), at, at] }
            setMeasured(measure.current)
            measureChanged()
            return true
          }
          if (grab(world, ['template'])) return true
          setSelected(null)
          measure.current = { shape: state.current.shape, points: [at, at] }
          gesture.current = { type: 'measure', dragging: true, moved: false }
          setMeasured(null)
          measureChanged()
          return true
        },
        move(world, event) {
          if (drag(world)) return
          const g = gesture.current
          const current = measure.current
          if (g?.type !== 'measure' || !current) return
          const at = snapMeasure(world, grid, free(event))
          const last = current.points.at(-1)
          if (last && last.x === at.x && last.y === at.y) return
          if (current.points[0] && Math.hypot(at.x - current.points[0].x, at.y - current.points[0].y) > 0)
            g.moved = true
          measure.current = { ...current, points: [...current.points.slice(0, -1), at] }
          measureChanged()
        },
        up(_world, event) {
          if (release()) return
          const g = gesture.current
          const current = measure.current
          if (g?.type !== 'measure' || !current) return
          if (!g.dragging) return
          if (current.shape === 'line' && (!g.moved || event.shiftKey)) {
            // Un clic sin arrastrar (o soltar con Mayús): sigue a clics, desde aquí
            const end = current.points.at(-1) as Point
            measure.current = { ...current, points: g.moved ? [...current.points, end] : current.points }
            gesture.current = { type: 'measure', dragging: false, moved: true }
            setMeasured(measure.current)
            measureChanged()
            return
          }
          gesture.current = null
          if (!g.moved) {
            clearMeasure()
            return
          }
          setMeasured(current)
          // Con la herramienta de plantillas, la forma queda al soltar
          if (state.current.tool === 'template') keepAsTemplate()
          else measureChanged()
        },
        leave() {}
      }

    if (tool === 'laser')
      return {
        down(world) {
          gesture.current = { type: 'laser' }
          const point = { x: world.x, y: world.y, t: performance.now() }
          laser.current = [...liveTrail(laser.current, point.t).map((p) => ({ ...p, t: point.t })), point]
          channel.current?.sendLaser([world])
          animateLaser()
          return true
        },
        move(world) {
          if (gesture.current?.type !== 'laser') return
          const last = laser.current.at(-1)
          if (last && Math.hypot(world.x - last.x, world.y - last.y) * k() < 3) return
          laser.current = [...laser.current.slice(-60), { x: world.x, y: world.y, t: performance.now() }]
          channel.current?.sendLaser([world])
          animateLaser()
        },
        up() {
          gesture.current = null
        },
        leave() {}
      }

    if (tool === 'draw')
      return {
        down(world) {
          const now = state.current
          if (now.drawTool === 'eraser') gesture.current = { type: 'erase', points: [world] }
          else if (now.drawTool === 'pen') gesture.current = { type: 'stroke', points: [world] }
          else gesture.current = { type: 'shape', from: world, to: world }
          redrawRef.current()
          return true
        },
        move(world) {
          hover.current = world
          const g = gesture.current
          if (g?.type === 'stroke') g.points = followStroke(g.points, world)
          else if (g?.type === 'shape') g.to = world
          else if (g?.type === 'erase') g.points.push(world)
          redrawRef.current()
        },
        up() {
          const g = gesture.current
          gesture.current = null
          const now = state.current
          const style = { color: now.color, width: DRAW_WIDTHS[now.drawWidth], opacity: 1, hidden: now.secret }
          if (g?.type === 'stroke' && g.points.length > 0)
            add({ kind: 'drawing', tool: 'pen', points: thinStroke(g.points, MAX_STROKE_POINTS), ...style }, false)
          else if (g?.type === 'shape') {
            const points = shapePoints(now.drawTool, g.from, g.to)
            if (points && now.drawTool !== 'eraser' && now.drawTool !== 'pen')
              add(
                { kind: 'drawing', tool: now.drawTool, points: thinStroke(points, MAX_STROKE_POINTS), ...style },
                false
              )
          } else if (g?.type === 'erase') {
            // Toda la pasada de la goma, en una operación: se quitan los dibujos que tocó y entran sus trozos
            type Piece = Extract<MarkView, { kind: 'drawing' }>
            let current: Piece[] = marksRef.current.filter((m): m is Piece => m.kind === 'drawing')
            const remove = new Set<string>()
            const radius = ERASER / k()
            for (const point of g.points) {
              const result = erase(current, point, radius)
              if (result.remove.length === 0) continue
              for (const id of result.remove) if (!id.startsWith('new:')) remove.add(id)
              current = [
                ...current.filter((d) => !result.remove.includes(d.id)),
                ...result.add.map((piece) => ({ ...piece, id: `new:${crypto.randomUUID()}`, sceneId: '', version: 0 }))
              ]
            }
            const pieces = current
              .filter((d) => d.id.startsWith('new:'))
              .map(({ id: _, sceneId: __, version: ___, ...piece }): MarkInput => piece)
            if (remove.size > 0) change.mutate({ remove: [...remove], ...(pieces.length > 0 ? { add: pieces } : {}) })
          }
          redrawRef.current()
        },
        leave() {
          hover.current = null
          if (!gesture.current) redrawRef.current()
        }
      }

    // Texto, sellos, pines e imágenes: un clic en lo que hay lo elige (y se arrastra); fuera, pone uno nuevo
    const kind = tool === 'text' ? 'text' : tool === 'stamp' ? 'stamp' : tool === 'pin' ? 'pin' : 'image'
    return {
      down(world) {
        if (grab(world, [kind])) return true
        const now = state.current
        setSelected(null)
        const at = { x: Math.round(world.x), y: Math.round(world.y) }
        if (kind === 'text') setWriting(at)
        else if (kind === 'stamp')
          add({
            kind: 'stamp',
            ...at,
            icon: now.stamp.fileId ? null : (now.stamp.icon ?? 'skull'),
            ...(now.stamp.fileId ? { fileId: now.stamp.fileId } : {}),
            size: newStampSize(grid),
            color: '#f3e7c9',
            hidden: now.secret
          })
        else if (kind === 'pin') {
          const used = marksRef.current.filter((m) => m.kind === 'pin').map((m) => (m.kind === 'pin' ? m.label : ''))
          let n = 1
          while (used.includes(String(n))) n++
          add({ kind: 'pin', ...at, pageId: null, label: String(n), icon: 'number', color: '#c9302c', hidden: true })
        } else if (now.armedImage) {
          const side = cellSide(grid) * 2
          const ratio = now.armedImage.width / Math.max(1, now.armedImage.height)
          const size = ratio >= 1 ? { width: side, height: side / ratio } : { width: side * ratio, height: side }
          add({
            kind: 'image',
            ...at,
            width: Math.max(8, Math.round(size.width)),
            height: Math.max(8, Math.round(size.height)),
            rotation: 0,
            fileId: now.armedImage.fileId,
            hidden: now.secret
          })
        }
        return true
      },
      move(world) {
        drag(world)
      },
      up() {
        release()
      },
      leave() {}
    }
  }, [tool, grid, change, add, measureChanged, clearMeasure, keepAsTemplate, animateLaser, channel])

  const selectedMark = marks.find((mark) => mark.id === selected) ?? null

  /** Las teclas de la herramienta (Escape, Supr, Intro): true si las usó */
  const key = useCallback(
    (event: KeyboardEvent): boolean => {
      if (!isMarkTool(state.current.tool)) return false
      if (event.key === 'Escape') {
        if (gesture.current?.type === 'measure' && measure.current && !gesture.current.dragging) {
          // Acaba el camino a clics (sin el punto del cursor)
          measure.current = { ...measure.current, points: measure.current.points.slice(0, -1) }
          gesture.current = null
          if (measure.current.points.length < 2) return clearMeasure()
          setMeasured(measure.current)
          measureChanged()
          return true
        }
        if (clearMeasure()) return true
        if (state.current.selected) {
          setSelected(null)
          return true
        }
        return false
      }
      if (event.key === 'Enter' && measure.current && state.current.tool === 'measure') {
        keepAsTemplate()
        return true
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && state.current.selected) {
        change.mutate({ remove: [state.current.selected] })
        setSelected(null)
        return true
      }
      return false
    },
    [change, clearMeasure, measureChanged, keepAsTemplate]
  )

  /** Las fichas que se marcan: las de la plantilla que se mide o las de la elegida */
  const targets = useMemo(() => {
    if (liveTargets.length > 0) return liveTargets
    if (selectedMark?.kind !== 'template' || !grid) return []
    return targetsOf(selectedMark, tokens, grid).map((token) => token.id)
  }, [liveTargets, selectedMark, tokens, grid])

  return {
    marks,
    selected: selectedMark,
    setSelected,
    targets,
    shape,
    setShape: (next: TemplateShape) => {
      setShape(next)
      clearMeasure()
    },
    color,
    setColor,
    damageType,
    setDamageType,
    drawTool,
    setDrawTool,
    drawWidth,
    setDrawWidth,
    secret,
    setSecret,
    stamp,
    setStamp,
    armedImage,
    setArmedImage,
    writing,
    setWriting,
    measured,
    keepAsTemplate,
    measureOnScreen,
    setMeasureOnScreen,
    setDiagonals,
    showDrag,
    handlers,
    key,
    add,
    change,
    redraw,
    error: [change, setMeasureOnScreen, setDiagonals].find((m) => m.error)?.error ?? null
  }
}

/** Los puntos de una forma dibujada de `from` a `to` (null si no tiene tamaño) */
function shapePoints(tool: DrawTool, from: Point, to: Point): Point[] | null {
  if (Math.hypot(to.x - from.x, to.y - from.y) < 2) return null
  if (tool === 'line') return [from, to]
  if (tool === 'rectangle') return rectanglePoints(from, to)
  if (tool === 'circle') return circlePoints(from, to)
  return null
}

const roundedSize = (size: { x: number; y: number; width: number; height: number }) => ({
  x: Math.round(size.x),
  y: Math.round(size.y),
  width: Math.max(8, Math.round(size.width)),
  height: Math.max(8, Math.round(size.height))
})

export { hex }
