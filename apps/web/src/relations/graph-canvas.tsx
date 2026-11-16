/**
 * El grafo del mundo en un lienzo (canvas), a partir de ~800 páginas (decisión 12 de la spec): con miles de nodos, el
 * SVG se arrastra. Las fuerzas avanzan a trozos en cada fotograma (sin bloquear la página) y se pinta al momento; los
 * nombres, al acercarse (y siempre el de la elegida). Pulsar elige, el doble clic abre. Para el teclado, el buscador de
 * la cabecera lleva a cada página
 */
import type { RelationNode } from '@crisol/contracts'
import type { ZoomTransform } from 'd3-zoom'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type Body, forceSimulationOf, type Point } from './layout.ts'
import type { GraphEdge } from './links-graph.tsx'
import { boundsOf, type Insets, usePanZoom } from './pan-zoom.ts'
import { ZoomControls } from './parts.tsx'
import styles from './relations.module.css'

/** Lo que tarda como mucho cada trozo de fuerzas por fotograma */
const FRAME_BUDGET_MS = 12

/** El color de una variable del tema (el lienzo no entiende var(--…)) */
function resolveColor(element: Element, value: string) {
  const match = /^var\((--[\w-]+)\)$/.exec(value)
  return match?.[1] ? getComputedStyle(element).getPropertyValue(match[1]).trim() || '#a1a1aa' : value
}

export function GraphCanvas({
  label,
  nodes,
  edges,
  selected,
  focus,
  colorOf,
  insets,
  onSelect,
  onOpen,
  children
}: {
  label: string
  nodes: readonly RelationNode[]
  edges: readonly GraphEdge[]
  selected: string | null
  /** Una página a la que llevar la vista (al buscarla) */
  focus: { id: string; at: number } | null
  colorOf: (node: RelationNode) => string
  insets: Insets
  onSelect: (id: string | null) => void
  onOpen: (id: string) => void
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const bodies = useRef<Body[]>([])
  const transformRef = useRef<ZoomTransform | null>(null)
  const draw = useRef<() => void>(() => undefined)
  const { transform, zoomBy, fit, refit, centerOn } = usePanZoom(canvas, {
    insets,
    onChange: (next) => {
      transformRef.current = next
      draw.current()
    }
  })

  // Pintar: las rayas (por su trazo), las páginas y, al acercarse, sus nombres
  draw.current = () => {
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const ratio = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
    }
    const view = transformRef.current
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, height)
    if (!view) return
    context.translate(view.x, view.y)
    context.scale(view.k, view.k)
    const at = new Map(bodies.current.map((body) => [body.id, body]))
    const line = resolveColor(canvas, 'var(--color-muted)')
    const secret = resolveColor(canvas, 'var(--color-secret-text)')
    const lit = resolveColor(canvas, 'var(--color-series-1)')
    const groups: [string, (edge: GraphEdge) => boolean, number[], string, number][] = [
      ['field', (e) => e.kind === 'field' && !e.secret, [], line, 0.35],
      ['mention', (e) => e.kind === 'mention' && !e.secret, [2, 4], line, 0.35],
      ['secret', (e) => e.secret === true, [7, 5], secret, 0.6]
    ]
    context.lineWidth = 1.2 / view.k
    for (const [, test, dash, color, alpha] of groups) {
      context.beginPath()
      context.setLineDash(dash.map((d) => d / view.k))
      context.strokeStyle = color
      context.globalAlpha = alpha
      for (const edge of edges) {
        if (!test(edge)) continue
        const a = at.get(edge.source)
        const b = at.get(edge.target)
        if (!a || !b) continue
        context.moveTo(a.x ?? 0, a.y ?? 0)
        context.lineTo(b.x ?? 0, b.y ?? 0)
      }
      context.stroke()
    }
    context.setLineDash([])
    context.globalAlpha = 1
    if (selected) {
      context.beginPath()
      context.strokeStyle = lit
      context.lineWidth = 2.2 / view.k
      for (const edge of edges) {
        if (edge.source !== selected && edge.target !== selected) continue
        const a = at.get(edge.source)
        const b = at.get(edge.target)
        if (!a || !b) continue
        context.moveTo(a.x ?? 0, a.y ?? 0)
        context.lineTo(b.x ?? 0, b.y ?? 0)
      }
      context.stroke()
    }
    const radius = 7
    const colors = new Map<string, string>()
    for (const node of nodes) {
      const body = at.get(node.id)
      if (!body) continue
      const raw = colorOf(node)
      const color = colors.get(raw) ?? resolveColor(canvas, raw)
      colors.set(raw, color)
      context.beginPath()
      context.arc(body.x ?? 0, body.y ?? 0, node.id === selected ? radius * 1.5 : radius, 0, Math.PI * 2)
      context.fillStyle = color
      context.fill()
    }
    // Los nombres: al acercarse, o el de la elegida
    const text = resolveColor(canvas, 'var(--color-text)')
    const halo = resolveColor(canvas, 'var(--color-bg)')
    context.font = `600 ${12 / view.k}px Barlow, system-ui, sans-serif`
    context.textAlign = 'center'
    context.lineJoin = 'round'
    context.lineWidth = 4 / view.k
    context.strokeStyle = halo
    context.fillStyle = text
    for (const node of nodes) {
      if (view.k < 0.9 && node.id !== selected) continue
      const body = at.get(node.id)
      if (!body) continue
      const y = (body.y ?? 0) + radius + 14 / view.k
      context.strokeText(node.title, body.x ?? 0, y)
      context.fillText(node.title, body.x ?? 0, y)
    }
  }

  // Las fuerzas, a trozos: cada fotograma avanza lo que cabe en su tiempo y se pinta
  const fitted = useRef(false)
  useEffect(() => {
    if (!canvas) return
    const before = new Map(bodies.current.map((body) => [body.id, { x: body.x ?? 0, y: body.y ?? 0 } as Point]))
    const { simulation, bodies: next } = forceSimulationOf(
      nodes.map((node) => node.id),
      edges,
      { spread: 0.6, initial: before }
    )
    bodies.current = next
    fitted.current = false
    let frame = 0
    const step = () => {
      const start = performance.now()
      while (simulation.alpha() > simulation.alphaMin() && performance.now() - start < FRAME_BUDGET_MS)
        simulation.tick()
      if (!fitted.current && simulation.alpha() < 0.3) {
        fitted.current = true
        fit(boundsOf(next.map((body) => ({ x: body.x ?? 0, y: body.y ?? 0 }))), 1)
      }
      draw.current()
      if (simulation.alpha() > simulation.alphaMin()) frame = requestAnimationFrame(step)
      // Ya quieto: se encuadra otra vez lo que ocupa al final (si no se ha tocado)
      else refit(boundsOf(next.map((body) => ({ x: body.x ?? 0, y: body.y ?? 0 }))), 1)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [canvas, nodes, edges, fit, refit])

  // Lo elegido o los colores cambian: se repinta
  useEffect(() => {
    draw.current()
  }, [selected, colorOf])

  // Al buscar una página, la vista va a ella
  useEffect(() => {
    if (!focus) return
    const body = bodies.current.find((each) => each.id === focus.id)
    if (body) centerOn({ x: body.x ?? 0, y: body.y ?? 0 }, Math.max(transformRef.current?.k ?? 1, 1.2))
  }, [focus, centerOn])

  /** La página bajo el puntero (a menos de su radio y un poco) */
  const hit = useCallback(
    (clientX: number, clientY: number) => {
      const view = transformRef.current
      if (!canvas || !view) return null
      const rect = canvas.getBoundingClientRect()
      const [x, y] = view.invert([clientX - rect.left, clientY - rect.top])
      let best: string | null = null
      let distance = 14 / view.k
      for (const body of bodies.current) {
        const d = Math.hypot((body.x ?? 0) - x, (body.y ?? 0) - y)
        if (d < distance) {
          distance = d
          best = body.id
        }
      }
      return best
    },
    [canvas]
  )

  return (
    <>
      <canvas
        ref={setCanvas}
        className={styles.svg}
        role="img"
        aria-label={label}
        onClick={(event) => onSelect(hit(event.clientX, event.clientY))}
        onDoubleClick={(event) => {
          const id = hit(event.clientX, event.clientY)
          if (id) onOpen(id)
        }}
      >
        {t('relations.world.canvas', { count: nodes.length })}
      </canvas>
      {children}
      <ZoomControls
        scale={transform.k}
        onZoom={zoomBy}
        onFit={() => fit(boundsOf(bodies.current.map((body) => ({ x: body.x ?? 0, y: body.y ?? 0 }))), 1)}
      />
    </>
  )
}
