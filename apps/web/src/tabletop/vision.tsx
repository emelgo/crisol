/**
 * La visión en la mesa del máster (docs/specs/vision.md): la columna de herramientas (con sus teclas), los muros,
 * puertas y luces de la escena (pedidos por su versión), lo que hace cada herramienta en el mapa (muros encadenados
 * clic a clic, mover sus extremos, poner y mover luces, destapar o tapar con pincel, rectángulo o lazo), las puertas que
 * se abren con un clic y lo que dibuja todo ello encima del mapa. Los paneles de cada herramienta, en vision-panel.tsx
 */
import type { CampaignTableView, SceneGrid, SceneVisionView, TileFit, WallView } from '@crisol/contracts'
import type { Point, Viewport } from '@crisol/tabletop'
import { useMutation, useQuery } from '@tanstack/react-query'
import { BrickWall, Cloud, DoorClosed, DoorOpen, EyeOff, Lightbulb, Lock, MousePointer2, Sun } from 'lucide-react'
import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import type { ActionInput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import type { OverlayShape, TableRenderer } from './renderer.ts'
import { cellSide } from './tokens.ts'
import styles from './vision.module.css'
import {
  type Chain,
  chainClick,
  chainSegments,
  type DrawKind,
  endpointAt,
  endpointsOf,
  feetToPixels,
  lightAt,
  moveEndpoint,
  snapPoint,
  WALL_COLORS,
  wallAt,
  wallShapes
} from './walls.ts'

export type TableTool = 'select' | 'fog' | 'walls' | 'lights'

/** Las herramientas de la columna, con su tecla (las de medir, dibujar… irán con herramientas-mesa) */
export const TOOLS: ReadonlyArray<{ key: TableTool; shortcut: string; icon: typeof Cloud; group: number }> = [
  { key: 'select', shortcut: 'V', icon: MousePointer2, group: 0 },
  { key: 'fog', shortcut: 'N', icon: Cloud, group: 1 },
  { key: 'walls', shortcut: 'M', icon: BrickWall, group: 1 },
  { key: 'lights', shortcut: 'L', icon: Lightbulb, group: 1 }
]

/** Lo que hace la herramienta con el botón izquierdo en el mapa (en píxeles del mapa) */
export interface ToolHandlers {
  /** true si lo lleva la herramienta (entonces le llegan el resto del gesto y su final) */
  down(world: Point, event: ReactPointerEvent): boolean
  move(world: Point, event: ReactPointerEvent): void
  up(world: Point, event: ReactPointerEvent): void
  /** El cursor sale del mapa */
  leave(): void
}

type FogInput = Omit<ActionInput<'changeFog'>, 'campaignId' | 'sceneId'>

export type FogShape = 'brush' | 'rectangle' | 'lasso'
export type FogMode = 'reveal' | 'cover'

/** Lo que trae un gesto en curso */
type Gesture =
  | { type: 'chain'; chain: Chain; cursor: Point | null }
  | { type: 'end'; from: Point; to: Point; moved: boolean }
  | { type: 'light'; id: string; to: Point; moved: boolean }
  | { type: 'rectangle'; from: Point; to: Point }
  | { type: 'brush' | 'lasso'; points: Point[] }

const FOG_COLORS = { reveal: 0x7cc4a4, cover: 0xe8746f } as const
/** Lo que se pasa de largo al pulsar un muro, un extremo o una luz, en píxeles de la pantalla */
const HIT = 8
const LIGHT_HIT = 14
/** Las luces nuevas: brillante 4 casillas, tenue 8 (20 y 40 pies en la de 5) */
const NEW_LIGHT = { bright: 4, dim: 8, color: '#ffb04a' }
/** Los puntos de un pincel o un lazo, como mucho (los que admite la API) */
const MAX_POINTS = 5000

/** Una forma dibujada con el ratón, con menos puntos si pasa de lo que admite la API */
function thin(points: readonly Point[]): Point[] {
  if (points.length <= MAX_POINTS) return points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))
  const step = points.length / MAX_POINTS
  return Array.from({ length: MAX_POINTS }, (_, i) => points[Math.floor(i * step)] as Point).map((p) => ({
    x: Math.round(p.x),
    y: Math.round(p.y)
  }))
}

/** La forma que se manda para destapar o tapar */
export function fogInput(gesture: Gesture, mode: FogMode, radius: number): FogInput | null {
  if (gesture.type === 'rectangle') {
    const x = Math.min(gesture.from.x, gesture.to.x)
    const y = Math.min(gesture.from.y, gesture.to.y)
    const width = Math.abs(gesture.to.x - gesture.from.x)
    const height = Math.abs(gesture.to.y - gesture.from.y)
    if (width < 1 || height < 1) return null
    return {
      mode,
      shape: 'rectangle',
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height)
    }
  }
  if (gesture.type === 'brush')
    return { mode, shape: 'brush', points: thin(gesture.points), radius: Math.round(radius) }
  if (gesture.type === 'lasso')
    return gesture.points.length >= 3 ? { mode, shape: 'lasso', points: thin(gesture.points) } : null
  return null
}

/** La columna de herramientas, a la izquierda del mapa */
export function ToolColumn({ tool, onTool }: { tool: TableTool; onTool: (tool: TableTool) => void }) {
  const { t } = useTranslation()
  return (
    <div
      className={styles.tools}
      role="toolbar"
      aria-label={t('vision.tools')}
      aria-orientation="vertical"
      data-tour="mesa-herramientas"
    >
      {TOOLS.map(({ key, shortcut, icon: Icon, group }, i) => (
        <span key={key} className={styles.toolSlot}>
          {i > 0 && group !== TOOLS[i - 1]?.group && <span className={styles.toolSep} aria-hidden="true" />}
          <button
            type="button"
            className={styles.tool}
            aria-pressed={tool === key}
            aria-label={t(`vision.${key}`)}
            aria-keyshortcuts={shortcut}
            title={t('vision.tool', { name: t(`vision.${key}`), key: shortcut })}
            onClick={() => onTool(key)}
          >
            <Icon aria-hidden="true" size={18} />
          </button>
        </span>
      ))}
    </div>
  )
}

/** Coloca las marcas (puertas, luces) sobre el mapa con la vista de ahora: cada una lleva su sitio en data-x, data-y */
export function placeMarkers(layer: HTMLElement | null, view: Viewport) {
  if (!layer) return
  for (const element of layer.children) {
    const marker = element as HTMLElement
    const x = Number(marker.dataset.x) * view.scale + view.x
    const y = Number(marker.dataset.y) * view.scale + view.y
    marker.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
  }
}

export type Vision = ReturnType<typeof useVision>

/**
 * Los muros, puertas y luces de la escena abierta, su estado en la campaña y lo que se hace con ellos: las acciones,
 * lo elegido y lo que hace cada herramienta en el mapa (con lo que dibuja)
 */
export function useVision({
  campaignId,
  table,
  tool,
  asGroup,
  view,
  renderer,
  ready,
  onTable
}: {
  campaignId: string
  table: CampaignTableView | null
  tool: TableTool
  asGroup: boolean
  view: RefObject<Viewport>
  renderer: RefObject<Pick<TableRenderer, 'setShapes'> | null>
  ready: boolean
  onTable: (table: CampaignTableView) => void
}) {
  const api = useApi()
  const open = table?.open ?? null
  const sceneId = open?.id ?? null
  const live = table?.vision && table.vision.sceneId === sceneId ? table.vision : null
  // Los muros y las luces, por la versión de la escena (si cambia, se vuelven a pedir); lo que devuelve una acción,
  // ya es lo último
  const query = useQuery({
    queryKey: ['sceneVision', sceneId, campaignId, live?.version ?? 0],
    queryFn: () => api.call('getSceneVision', { sceneId: sceneId as string, campaignId }),
    enabled: Boolean(sceneId)
  })
  const [latest, setLatest] = useState<SceneVisionView | null>(null)
  const data =
    latest && latest.sceneId === sceneId && latest.version >= (query.data?.version ?? 0) ? latest : (query.data ?? null)
  // Las puertas: las de la campaña (llegan con la mesa) y las que se acaban de pulsar, hasta que llega la mesa
  const [pressed, setPressed] = useState<Record<string, boolean>>({})
  useEffect(() => {
    if (live) setPressed({})
  }, [live])
  const doors = useMemo(() => ({ ...data?.doors, ...live?.doors, ...pressed }), [data, live, pressed])
  const walls = data?.walls ?? []
  const lights = data?.lights ?? []
  const grid: SceneGrid | null = open?.grid ?? null

  // Lo que se elige y cómo se dibuja
  const [kind, setKind] = useState<DrawKind>('wall')
  const [selectedWall, setSelectedWall] = useState<string | null>(null)
  const [selectedLight, setSelectedLight] = useState<string | null>(null)
  const [fogMode, setFogMode] = useState<FogMode>('reveal')
  const [fogShape, setFogShape] = useState<FogShape>('brush')
  const [brushCells, setBrushCells] = useState(2)
  const gesture = useRef<Gesture | null>(null)
  // La forma de la niebla que se mandó: se ve hasta que llega la respuesta
  const sent = useRef<Gesture | null>(null)
  const hover = useRef<Point | null>(null)

  const keep = (result: SceneVisionView) => setLatest({ ...result, doors: result.doors ?? data?.doors })
  const changeWalls = useMutation({
    mutationFn: (input: Omit<ActionInput<'changeWalls'>, 'sceneId'>) =>
      api.call('changeWalls', { sceneId: sceneId as string, ...input }),
    onSuccess: keep
  })
  const updateVision = useMutation({
    mutationFn: (input: { darkness?: number; automaticVision?: boolean }) =>
      api.call('updateSceneVision', { sceneId: sceneId as string, ...input }),
    onSuccess: keep
  })
  const placeImported = useMutation({
    mutationFn: (replace: boolean) => api.call('placeImportedWalls', { sceneId: sceneId as string, replace }),
    onSuccess: keep
  })
  const setDoor = useMutation({
    mutationFn: ({ wallId, open }: { wallId: string; open: boolean }) =>
      api.call('setDoor', { campaignId, wallId, open }),
    onMutate: ({ wallId, open }) => setPressed((current) => ({ ...current, [wallId]: open })),
    onError: (_error, { wallId }) =>
      setPressed((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== wallId)))
  })
  const changeFog = useMutation({
    mutationFn: (input: FogInput) => api.call('changeFog', { campaignId, ...(sceneId ? { sceneId } : {}), ...input }),
    onSettled: () => {
      sent.current = null
      redrawRef.current()
    }
  })
  const resetFog = useMutation({
    mutationFn: () => api.call('resetFog', { campaignId, ...(sceneId ? { sceneId } : {}) })
  })
  const setTileFit = useMutation({
    mutationFn: (tileFit: TileFit) => api.call('setTileFit', { campaignId, tileFit }),
    onSuccess: onTable
  })

  // Lo de ahora, para los gestos (que no esperan a volver a pintar)
  const state = useRef({
    walls,
    lights,
    grid,
    kind,
    tool,
    asGroup,
    doors,
    selectedWall,
    selectedLight,
    fogMode,
    fogShape,
    brushCells
  })
  state.current = {
    walls,
    lights,
    grid,
    kind,
    tool,
    asGroup,
    doors,
    selectedWall,
    selectedLight,
    fogMode,
    fogShape,
    brushCells
  }

  /** Lo que se dibuja encima del mapa con lo de ahora y el gesto en curso */
  const redraw = useCallback(() => {
    const now = state.current
    const scale = view.current?.scale ?? 1
    const g = gesture.current
    const shapes: OverlayShape[] = []
    if ((now.tool === 'walls' || now.asGroup) && now.grid) {
      const shown =
        g?.type === 'end'
          ? now.walls.map((wall) => {
              const moved = moveEndpoint([wall], g.from, g.to)[0]
              return moved ? { ...wall, ...moved } : wall
            })
          : now.walls
      shapes.push(
        ...wallShapes(shown, {
          doors: now.doors,
          selected: now.tool === 'walls' ? now.selectedWall : null,
          scale,
          endpoints: now.tool === 'walls',
          faint: now.tool !== 'walls'
        })
      )
      if (g?.type === 'chain') {
        const points = g.chain.points
        if (points.length > 1) shapes.push({ kind: 'polygon', points, color: WALL_COLORS.selected, width: 4 })
        const last = points.at(-1)
        if (last && g.cursor)
          shapes.push({ kind: 'line', a: last, b: g.cursor, color: WALL_COLORS.selected, width: 3, dash: [8, 6] })
        for (const p of points)
          shapes.push({ kind: 'dot', at: p, color: WALL_COLORS.selected, radius: 5, stroke: 0x0b0b0c })
      }
    }
    if (now.tool === 'lights' && now.grid) {
      const light = now.lights.find((each) => each.id === (g?.type === 'light' ? g.id : now.selectedLight))
      if (light) {
        const at = g?.type === 'light' ? g.to : light
        const color = Number.parseInt(light.color.slice(1), 16) || 0xffd36b
        const dim = feetToPixels(light.dim, now.grid)
        const bright = feetToPixels(light.bright, now.grid)
        if (light.angle >= 360) {
          shapes.push({ kind: 'circle', at, radius: dim, color, width: 2.5, fill: 0.06, dash: [3, 8] })
          shapes.push({ kind: 'circle', at, radius: bright, color, width: 3, fill: 0.1, dash: [14, 8] })
        } else {
          // Un cono: hacia «rotation» (0 arriba, 90 a la derecha), abierto «angle» grados
          const wedge = (radius: number) => {
            const from = ((light.rotation - light.angle / 2 - 90) * Math.PI) / 180
            const steps = Math.max(8, Math.round(light.angle / 6))
            return [
              at,
              ...Array.from({ length: steps + 1 }, (_, i) => {
                const a = from + ((light.angle * Math.PI) / 180) * (i / steps)
                return { x: at.x + radius * Math.cos(a), y: at.y + radius * Math.sin(a) }
              })
            ]
          }
          shapes.push({
            kind: 'polygon',
            points: wedge(dim),
            color,
            width: 2.5,
            fill: 0.06,
            closed: true,
            dash: [3, 8]
          })
          shapes.push({
            kind: 'polygon',
            points: wedge(bright),
            color,
            width: 3,
            fill: 0.1,
            closed: true,
            dash: [14, 8]
          })
        }
      }
    }
    if (now.tool === 'fog' && now.grid) {
      const radius = (now.brushCells * cellSide(now.grid)) / 2
      for (const shown of [sent.current, g]) {
        if (!shown) continue
        const color = FOG_COLORS[now.fogMode]
        if (shown.type === 'rectangle') {
          const { from, to } = shown
          const points = [from, { x: to.x, y: from.y }, to, { x: from.x, y: to.y }]
          shapes.push({ kind: 'polygon', points, color, width: 3, fill: 0.16, closed: true, dash: [10, 7] })
        } else if (shown.type === 'brush') {
          const points = shown.points.length === 1 ? [shown.points[0] as Point, shown.points[0] as Point] : shown.points
          shapes.push({ kind: 'polygon', points, color, width: Math.max(2, radius * 2 * scale), alpha: 0.28 })
        } else if (shown.type === 'lasso') {
          shapes.push({
            kind: 'polygon',
            points: shown.points,
            color,
            width: 2.5,
            fill: 0.16,
            closed: true,
            dash: [8, 6]
          })
        }
      }
      if (now.fogShape === 'brush' && hover.current && !g)
        shapes.push({ kind: 'circle', at: hover.current, radius, color: FOG_COLORS[now.fogMode], width: 2 })
    }
    renderer.current?.setShapes(shapes)
  }, [renderer, view])
  const redrawRef = useRef(redraw)
  redrawRef.current = redraw

  // Al cambiar algo (los muros, la herramienta, lo elegido) o al estar listo el lienzo
  useEffect(() => {
    if (ready) redraw()
  }, [ready, redraw, walls, lights, doors, tool, asGroup, selectedWall, selectedLight, fogMode, fogShape, brushCells])

  // Otra herramienta u otra escena: sin gesto ni nada elegido
  useEffect(() => {
    gesture.current = null
    hover.current = null
    setSelectedWall(null)
    setSelectedLight(null)
  }, [tool, sceneId])

  /** Acaba los muros encadenados: los manda si hay al menos un tramo */
  const finishChain = useCallback(() => {
    const g = gesture.current
    if (g?.type !== 'chain') return
    gesture.current = null
    const add = chainSegments(g.chain, state.current.kind)
    if (add.length > 0) changeWalls.mutate({ walls: { add } })
    redrawRef.current()
  }, [changeWalls])

  const handlers = useMemo((): ToolHandlers | null => {
    if (tool === 'select' || !grid) return null
    const tolerance = (px: number) => px / (view.current?.scale ?? 1)
    const snap = (p: Point, shift: boolean, except?: Point) =>
      snapPoint(p, {
        grid,
        shift,
        endpoints: endpointsOf(state.current.walls).filter((e) => !except || e.x !== except.x || e.y !== except.y),
        tolerance: tolerance(HIT)
      })
    if (tool === 'walls')
      return {
        down(world, event) {
          const g = gesture.current
          if (g?.type === 'chain') {
            const step = chainClick(g.chain, snap(world, event.shiftKey), tolerance(4))
            gesture.current = { type: 'chain', chain: step.chain, cursor: null }
            if (step.done) finishChain()
            else redrawRef.current()
            return true
          }
          const end = endpointAt(state.current.walls, world, tolerance(HIT))
          if (end) {
            gesture.current = { type: 'end', from: end, to: end, moved: false }
            return true
          }
          const hit = wallAt(state.current.walls, world, tolerance(HIT))
          if (hit) {
            setSelectedWall(hit.id)
            return true
          }
          setSelectedWall(null)
          gesture.current = { type: 'chain', chain: { points: [snap(world, event.shiftKey)] }, cursor: null }
          redrawRef.current()
          return true
        },
        move(world, event) {
          const g = gesture.current
          if (g?.type === 'chain') g.cursor = snap(world, event.shiftKey)
          else if (g?.type === 'end') {
            const to = snap(world, event.shiftKey, g.from)
            if (Math.hypot(to.x - g.from.x, to.y - g.from.y) * (view.current?.scale ?? 1) >= 3) g.moved = true
            g.to = to
          } else return
          redrawRef.current()
        },
        up() {
          const g = gesture.current
          if (g?.type !== 'end') return
          gesture.current = null
          if (g.moved) changeWalls.mutate({ walls: { update: moveEndpoint(state.current.walls, g.from, g.to) } })
          // Un clic en un extremo (sin moverlo) empieza ahí otro muro, seguido de los que ya llegan a él
          else gesture.current = { type: 'chain', chain: { points: [g.from] }, cursor: null }
          redrawRef.current()
        },
        leave() {
          const g = gesture.current
          if (g?.type === 'chain') {
            g.cursor = null
            redrawRef.current()
          }
        }
      }
    if (tool === 'lights')
      return {
        down(world, event) {
          const hit = lightAt(state.current.lights, world, tolerance(LIGHT_HIT))
          if (hit) {
            setSelectedLight(hit.id)
            gesture.current = { type: 'light', id: hit.id, to: { x: hit.x, y: hit.y }, moved: false }
            return true
          }
          const at = snapPoint(world, { grid, shift: event.shiftKey, endpoints: [], tolerance: 0 })
          const before = new Set(state.current.lights.map((l) => l.id))
          const centered =
            event.shiftKey && grid.type !== 'none' ? { x: at.x + grid.size / 2, y: at.y + grid.size / 2 } : at
          changeWalls.mutate(
            {
              lights: {
                add: [
                  {
                    ...centered,
                    bright: NEW_LIGHT.bright * grid.distance,
                    dim: NEW_LIGHT.dim * grid.distance,
                    color: NEW_LIGHT.color
                  }
                ]
              }
            },
            { onSuccess: (result) => setSelectedLight(result.lights.find((l) => !before.has(l.id))?.id ?? null) }
          )
          return true
        },
        move(world) {
          const g = gesture.current
          if (g?.type !== 'light') return
          const light = state.current.lights.find((l) => l.id === g.id)
          if (light && Math.hypot(world.x - light.x, world.y - light.y) * (view.current?.scale ?? 1) >= 3)
            g.moved = true
          if (!g.moved) return
          g.to = { x: Math.round(world.x), y: Math.round(world.y) }
          redrawRef.current()
          // La luz se ve donde va (su marca)
          const marker = document.querySelector<HTMLElement>(`[data-light="${g.id}"]`)
          if (marker) {
            marker.dataset.x = String(g.to.x)
            marker.dataset.y = String(g.to.y)
            placeMarkers(marker.parentElement, view.current)
          }
        },
        up() {
          const g = gesture.current
          if (g?.type !== 'light') return
          gesture.current = null
          if (g.moved) changeWalls.mutate({ lights: { update: [{ id: g.id, x: g.to.x, y: g.to.y }] } })
          redrawRef.current()
        },
        leave() {}
      }
    // La niebla a mano
    return {
      down(world) {
        const shape = state.current.fogShape
        gesture.current =
          shape === 'rectangle' ? { type: 'rectangle', from: world, to: world } : { type: shape, points: [world] }
        redrawRef.current()
        return true
      },
      move(world) {
        const g = gesture.current
        hover.current = world
        if (g?.type === 'rectangle') g.to = world
        else if (g?.type === 'brush' || g?.type === 'lasso') {
          const last = g.points.at(-1) as Point
          const radius = (state.current.brushCells * cellSide(grid)) / 2
          const step = g.type === 'brush' ? radius / 3 : tolerance(4)
          if (Math.hypot(world.x - last.x, world.y - last.y) >= step) g.points.push(world)
        }
        redrawRef.current()
      },
      up() {
        const g = gesture.current
        gesture.current = null
        if (!g) return
        const now = state.current
        const input = fogInput(g, now.fogMode, (now.brushCells * cellSide(grid)) / 2)
        if (input) {
          sent.current = g
          changeFog.mutate(input)
        }
        redrawRef.current()
      },
      leave() {
        hover.current = null
        if (!gesture.current) redrawRef.current()
      }
    }
  }, [tool, grid, view, changeWalls, changeFog, finishChain])

  /** Las teclas de la herramienta (Escape, Supr, Retroceso): true si las usó */
  const key = useCallback(
    (event: KeyboardEvent): boolean => {
      const g = gesture.current
      const now = state.current
      if (event.key === 'Escape') {
        if (g?.type === 'chain') {
          finishChain()
          return true
        }
        if (g) {
          gesture.current = null
          redrawRef.current()
          return true
        }
        if (now.selectedWall || now.selectedLight) {
          setSelectedWall(null)
          setSelectedLight(null)
          return true
        }
        return false
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') return false
      if (g?.type === 'chain') {
        // Quita el último punto
        const points = g.chain.points.slice(0, -1)
        gesture.current = points.length > 0 ? { ...g, chain: { points } } : null
        redrawRef.current()
        return true
      }
      if (now.tool === 'walls' && now.selectedWall) {
        changeWalls.mutate({ walls: { remove: [now.selectedWall] } })
        setSelectedWall(null)
        return true
      }
      if (now.tool === 'lights' && now.selectedLight) {
        changeWalls.mutate({ lights: { remove: [now.selectedLight] } })
        setSelectedLight(null)
        return true
      }
      return false
    },
    [changeWalls, finishChain]
  )

  const errors = [changeWalls, updateVision, placeImported, setDoor, changeFog, resetFog, setTileFit]
  const fresh = data && (!live || data.version > live.version) ? data : null
  return {
    sceneId,
    scene: open,
    grid,
    live,
    walls,
    lights,
    doors,
    // Lo que devolvió una acción, si es más nuevo que lo que trajo la mesa
    darkness: (fresh ?? live ?? data)?.darkness ?? 0,
    automaticVision: (fresh ?? live ?? data)?.automaticVision ?? false,
    tileFit: live?.tileFit ?? 'whole',
    kind,
    setKind,
    selectedWall: walls.find((w) => w.id === selectedWall) ?? null,
    setSelectedWall,
    selectedLight: lights.find((l) => l.id === selectedLight) ?? null,
    setSelectedLight,
    fogMode,
    setFogMode,
    fogShape,
    setFogShape,
    brushCells,
    setBrushCells,
    handlers,
    key,
    changeWalls,
    updateVision,
    placeImported,
    setDoor,
    changeFog,
    resetFog,
    setTileFit,
    error: errors.find((m) => m.error)?.error ?? null
  }
}

/** Una puerta vista en la mesa: su icono según si es secreta, si tiene llave y si está abierta */
function DoorIcon({ wall, open }: { wall: WallView; open: boolean }) {
  if (wall.door === 'secret') return <EyeOff aria-hidden="true" size={13} />
  if (wall.locked && !open) return <Lock aria-hidden="true" size={13} />
  return open ? <DoorOpen aria-hidden="true" size={13} /> : <DoorClosed aria-hidden="true" size={13} />
}

/**
 * Las marcas encima del mapa: las puertas (un clic las abre o las cierra; editando muros, las elige) y, con las luces,
 * cada luz (se elige; se arrastra en el mapa)
 */
export function VisionMarkers({
  layer,
  view,
  vision,
  tool
}: {
  layer: RefObject<HTMLDivElement | null>
  view: RefObject<Viewport>
  vision: Vision
  tool: TableTool
}) {
  const { t } = useTranslation()
  const { walls, lights, doors } = vision
  const showDoors = tool !== 'lights' && vision.grid
  const editing = tool === 'walls'
  useLayoutEffect(() => placeMarkers(layer.current, view.current))
  return (
    <div ref={layer} className={styles.markers} data-editing={editing || tool === 'lights' || undefined}>
      {showDoors &&
        walls
          .filter((wall) => wall.door)
          .map((wall) => {
            const open = doors[wall.id] ?? wall.open
            const name =
              wall.door === 'secret' ? t('vision.secretDoor') : wall.locked ? t('vision.lockedDoor') : t('vision.door')
            return (
              <button
                key={wall.id}
                type="button"
                className={styles.door}
                data-kind={wall.door === 'secret' ? 'secret' : wall.locked ? 'locked' : 'door'}
                data-selected={(editing && vision.selectedWall?.id === wall.id) || undefined}
                data-x={(wall.a.x + wall.b.x) / 2}
                data-y={(wall.a.y + wall.b.y) / 2}
                data-door={wall.id}
                aria-pressed={editing ? undefined : open}
                aria-label={editing ? name : `${name}, ${open ? t('vision.open') : t('vision.closed')}`}
                title={name}
                onClick={() =>
                  editing ? vision.setSelectedWall(wall.id) : vision.setDoor.mutate({ wallId: wall.id, open: !open })
                }
              >
                <DoorIcon wall={wall} open={open} />
              </button>
            )
          })}
      {tool === 'lights' &&
        lights.map((light, i) => (
          <button
            key={light.id}
            type="button"
            className={styles.light}
            data-selected={vision.selectedLight?.id === light.id || undefined}
            data-off={!light.enabled || undefined}
            data-x={light.x}
            data-y={light.y}
            data-light={light.id}
            aria-pressed={vision.selectedLight?.id === light.id}
            aria-label={t('vision.lightName', { n: i + 1 })}
            onClick={() => vision.setSelectedLight(light.id)}
          >
            <Sun aria-hidden="true" size={14} />
          </button>
        ))}
    </div>
  )
}
