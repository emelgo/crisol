/**
 * El mapa de la escena en su pestaña: las teselas del nivel que toca (con el nivel más pequeño debajo), la rejilla en
 * un lienzo encima y, al alinearla, las dos esquinas que se marcan. Se mueve arrastrando y se acerca con la rueda
 * hacia el cursor, como el mapa de una página; durante el gesto el escenario va con `transform`, sin pintar React
 */
import type { SceneGrid } from '@crisol/contracts'
import {
  type Point,
  type Size,
  type TileRef,
  tileWorldRect,
  toWorld,
  type Viewport,
  wheelZoomFactor,
  zoomAt,
  zoomLimits
} from '@crisol/tabletop'
import { Maximize, Minus, Plus } from 'lucide-react'
import { type KeyboardEvent, type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { canvasViewOf, sceneViewportOfCanvas } from '../../tabletop/camera.ts'
import { masterTileUrl } from '../../tabletop/queries.ts'
import { fitCanvas, pyramidOf, screenGridLines, type TilesToDraw, tilesToDraw } from '../../tabletop/view.ts'
import { tabRegionLabel } from '../tabs/kinds.tsx'
import styles from './scene.module.css'
import { useSceneTab } from './scene-context.ts'

const tileKey = (ref: TileRef) => `${ref.level}/${ref.x}/${ref.y}`

/** La rejilla en el lienzo de encima, en píxeles de la pantalla; sin «Se ve en la mesa», tenue */
function drawGrid(canvas: HTMLCanvasElement | null, grid: SceneGrid, view: Viewport, size: Size, image: Size) {
  const context = canvas?.getContext('2d')
  if (!canvas || !context) return
  const dpr = window.devicePixelRatio || 1
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.clearRect(0, 0, size.width, size.height)
  const lines = screenGridLines(grid, view, size, image)
  if (lines.length === 0) return
  context.globalAlpha = grid.visible ? grid.opacity : grid.opacity * 0.3
  context.strokeStyle = grid.color
  context.lineWidth = 1
  context.beginPath()
  for (const [x1, y1, x2, y2] of lines) {
    context.moveTo(x1, y1)
    context.lineTo(x2, y2)
  }
  context.stroke()
}

type Gesture = { startX: number; startY: number; view: Viewport; travel: number; pinch: number | null }

export function SceneViewer() {
  const { t } = useTranslation()
  const { scene, name, aligning, setAligning, alignCorners, viewer } = useSceneTab()
  const image = scene?.image
  const tiles = image?.tiles
  const pyramid = useMemo(() => (image ? pyramidOf(image) : null), [image])
  const container = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const zoomText = useRef<HTMLSpanElement>(null)
  const view = useRef<Viewport>({ x: 0, y: 0, scale: 1 })
  const size = useRef<Size>({ width: 0, height: 0 })
  const placed = useRef(false)
  const frame = useRef(0)
  const drawn = useRef('')
  const [draw, setDraw] = useState<TilesToDraw | null>(null)
  const [corners, setCorners] = useState<Point[]>([])
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<Gesture | null>(null)
  const grid = useRef(scene?.grid)
  grid.current = scene?.grid

  // Lo que depende de la vista, una vez por fotograma: qué teselas, la rejilla y el zoom escrito
  const paint = useCallback(() => {
    frame.current = 0
    if (!pyramid || !image) return
    const next = tilesToDraw(pyramid, view.current, size.current, window.devicePixelRatio || 1)
    const key = [next.level, ...next.tiles.map(tileKey), ...next.under.map(tileKey)].join('|')
    if (key !== drawn.current) {
      drawn.current = key
      setDraw(next)
    }
    if (grid.current) drawGrid(canvas.current, grid.current, view.current, size.current, image)
    if (zoomText.current) zoomText.current.textContent = `${Math.round(view.current.scale * 100)} %`
  }, [pyramid, image])

  const apply = useCallback(() => {
    const element = stage.current
    if (!element) return
    const { x, y, scale } = view.current
    element.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
    element.style.setProperty('--inv-k', String(1 / scale))
    if (!frame.current) frame.current = requestAnimationFrame(paint)
  }, [paint])
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const fit = useCallback(() => {
    if (!image || size.current.width === 0) return
    view.current = fitCanvas(image, size.current)
    apply()
  }, [image, apply])

  // El tamaño del visor: al cambiar, el lienzo de la rejilla se ajusta; la primera vez, la vista inicial o encuadrado
  useEffect(() => {
    const element = container.current
    if (!element || !image) return
    const measure = () => {
      size.current = { width: element.clientWidth, height: element.clientHeight }
      const dpr = window.devicePixelRatio || 1
      if (canvas.current) {
        canvas.current.width = Math.round(size.current.width * dpr)
        canvas.current.height = Math.round(size.current.height * dpr)
      }
      if (!placed.current && size.current.width > 0) {
        placed.current = true
        view.current = scene?.initialView
          ? canvasViewOf(scene.initialView, size.current)
          : fitCanvas(image, size.current)
      }
      apply()
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [image, scene?.initialView, apply])

  // La rejilla cambia (al moverla en el panel): se vuelve a dibujar
  useEffect(() => {
    if (scene?.grid && !frame.current) frame.current = requestAnimationFrame(paint)
  }, [scene?.grid, paint])

  // «Usar este encuadre»: lo que se ve ahora
  useEffect(() => {
    viewer.current = () => (size.current.width > 0 ? sceneViewportOfCanvas(view.current, size.current) : null)
    return () => {
      viewer.current = null
    }
  }, [viewer])

  useEffect(() => {
    if (!aligning) setCorners([])
  }, [aligning])

  const zoomBy = (factor: number, point?: Point) => {
    if (!image) return
    const center = point ?? { x: size.current.width / 2, y: size.current.height / 2 }
    view.current = zoomAt(view.current, factor, center, zoomLimits(image, size.current))
    apply()
  }

  // La rueda acerca hacia el cursor: escucha nativa (no pasiva, para que la página no se desplace)
  useEffect(() => {
    const element = container.current
    if (!element || !image) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      view.current = zoomAt(
        view.current,
        wheelZoomFactor(event.deltaY, event.deltaMode, event.ctrlKey),
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        zoomLimits(image, size.current)
      )
      apply()
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [image, apply])

  const local = (event: { clientX: number; clientY: number }) => {
    const rect = container.current?.getBoundingClientRect()
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) }
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 1) return
    if (event.button === 1) event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 1)
      gesture.current = { startX: event.clientX, startY: event.clientY, view: view.current, travel: 0, pinch: null }
    else if (gesture.current) {
      const [a, b] = [...pointers.current.values()]
      gesture.current.travel = Number.POSITIVE_INFINITY
      gesture.current.pinch = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current
    if (!pointers.current.has(event.pointerId) || !current || !image) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      if (!a || !b || current.pinch === null) return
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      zoomBy(distance / current.pinch, local({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }))
      current.pinch = distance
      return
    }
    const dx = event.clientX - current.startX
    const dy = event.clientY - current.startY
    current.travel = Math.max(current.travel, Math.hypot(dx, dy))
    view.current = { ...current.view, x: current.view.x + dx, y: current.view.y + dy }
    apply()
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
    const current = gesture.current
    if (pointers.current.size > 0 || !current) return
    gesture.current = null
    if (current.travel > 4 || event.type === 'pointercancel' || !aligning) return
    // Marcando las esquinas: un clic sin moverse es una esquina, en píxeles del mapa
    const point = toWorld(view.current, local(event))
    const next = [...corners, point]
    if (next.length < 2) return setCorners(next)
    setCorners([])
    alignCorners([next[0] as Point, next[1] as Point])
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    const step = 80
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step]
    }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      view.current = { ...view.current, x: view.current.x + move[0], y: view.current.y + move[1] }
      apply()
    } else if (event.key === '+' || event.key === '=') zoomBy(1.25)
    else if (event.key === '-') zoomBy(0.8)
    else if (event.key === '0') fit()
    else if (event.key === 'Escape' && aligning) setAligning(false)
  }

  if (!scene || !image || !tiles || !pyramid) return null
  const url = masterTileUrl(scene.id, tiles.version)
  const shown = draw ? [...draw.base, ...draw.under, ...draw.tiles] : []
  const hex = scene.grid.type === 'hex-rows' || scene.grid.type === 'hex-columns'
  return (
    <div className={styles.viewerBox}>
      {/* Un control propio: se mueve con las flechas y se acerca con + y - */}
      <div
        ref={container}
        className={styles.viewer}
        data-aligning={aligning || undefined}
        role="application"
        aria-roledescription={t('scene.roleDescription')}
        aria-label={tabRegionLabel(t, 'scene', name)}
        aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown + - 0"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: es un control propio (role application), no un contenedor
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <div
          ref={stage}
          className={styles.stage}
          data-scene-stage=""
          style={{ inlineSize: image.width, blockSize: image.height }}
        >
          {[...new Map(shown.map((ref) => [tileKey(ref), ref])).values()].map((ref) => {
            const rect = tileWorldRect(pyramid, ref)
            // Un píxel de más hacia la derecha y abajo (salvo en el borde) tapa las rendijas entre teselas
            const width = Math.min(rect.width + 1, image.width - rect.x)
            const height = Math.min(rect.height + 1, image.height - rect.y)
            return (
              <img
                key={tileKey(ref)}
                src={url(ref.level, ref.x, ref.y)}
                alt=""
                draggable={false}
                decoding="async"
                data-level={ref.level}
                style={{ insetInlineStart: rect.x, insetBlockStart: rect.y, inlineSize: width, blockSize: height }}
              />
            )
          })}
          {corners.map((corner, index) => (
            <span
              key={index}
              className={styles.cross}
              style={{ insetInlineStart: corner.x, insetBlockStart: corner.y }}
            >
              <span>{index + 1}</span>
            </span>
          ))}
        </div>
        <canvas ref={canvas} className={styles.gridCanvas} />
        {aligning && (
          <p className={styles.hint} role="status">
            {t(hex ? 'scene.cornersHintHex' : 'scene.cornersHint')}
            <button type="button" className={styles.link} onClick={() => setAligning(false)}>
              {t('scene.cornersDone')}
            </button>
          </p>
        )}
      </div>
      <div className={styles.zoom} role="toolbar" aria-label={t('scene.tools')}>
        <button type="button" aria-label={t('scene.zoomOut')} title={t('scene.zoomOut')} onClick={() => zoomBy(0.8)}>
          <Minus aria-hidden="true" size={16} />
        </button>
        <span ref={zoomText} className={styles.zoomText} />
        <button type="button" aria-label={t('scene.zoomIn')} title={t('scene.zoomIn')} onClick={() => zoomBy(1.25)}>
          <Plus aria-hidden="true" size={16} />
        </button>
        <button type="button" aria-label={t('scene.fit')} title={t('scene.fit')} onClick={fit}>
          <Maximize aria-hidden="true" size={16} />
        </button>
      </div>
    </div>
  )
}
