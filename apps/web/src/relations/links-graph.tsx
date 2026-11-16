/**
 * El grafo de Enlaces en SVG (módulo 10): cada página, un círculo con su icono (o sus iniciales) del color de su
 * plantilla y su nombre debajo; cada relación, una raya sin flecha (los campos, continua; las menciones, de puntos; lo
 * de un secreto, discontinua). Los nombres, solo en las rayas del centro y en las de la elegida (con todos no se lee
 * nada). Al pasar por una propiedad del panel se marcan sus rayas. Se mueve y se acerca (pan-zoom.ts); pulsar una
 * página la elige y el doble clic la abre
 */
import type { RelationEdge, RelationNode } from '@crisol/contracts'
import type { ZoomTransform } from 'd3-zoom'
import { type CSSProperties, type KeyboardEvent, memo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '../components/icon.tsx'
import type { Point } from './layout.ts'
import { edgeLabel, initials, type ReadableEdge } from './model.ts'
import styles from './relations.module.css'

export type GraphEdge = ReadableEdge & Pick<RelationEdge, 'key' | 'role'>

/**
 * El dibujo de una página dentro de su círculo: su icono o sus iniciales. Las iniciales, como contenido de CSS: se ven
 * pero no son texto (el nombre de la página ya lo dice su etiqueta, y no lo repite)
 */
export function NodeGlyph({ node, size }: { node: Pick<RelationNode, 'icon' | 'title'>; size: number }) {
  return (
    <foreignObject x={-size / 2} y={-size / 2} width={size} height={size} className={styles.glyph}>
      {node.icon ? (
        <Icon value={node.icon} size={size * 0.8} />
      ) : (
        <span className={styles.initials} data-initials={initials(node.title)} style={{ fontSize: size * 0.48 }} />
      )}
    </foreignObject>
  )
}

/** Un título largo, en dos líneas (cortado por la palabra más cercana a la mitad) */
export function titleLines(title: string, width = 16): string[] {
  if (title.length <= width) return [title]
  const words = title.split(' ')
  let best = 1
  let bestGap = Number.POSITIVE_INFINITY
  for (let i = 1; i < words.length; i++) {
    const gap = Math.abs(words.slice(0, i).join(' ').length - title.length / 2)
    if (gap < bestGap) {
      best = i
      bestGap = gap
    }
  }
  return words.length > 1 ? [words.slice(0, best).join(' '), words.slice(best).join(' ')] : [title]
}

/** Si se pulsa con Intro o Espacio (para lo que se elige con el teclado) */
export const activates = (event: KeyboardEvent) => event.key === 'Enter' || event.key === ' '

interface LinksGraphProps {
  label: string
  nodes: readonly RelationNode[]
  edges: readonly GraphEdge[]
  positions: ReadonlyMap<string, Point>
  center: string | null
  selected: string | null
  /** La relación (su key) de la propiedad del panel por la que pasa el ratón */
  highlight: string | null
  colorOf: (node: RelationNode) => string
  transform: ZoomTransform
  /** Las rayas con su nombre: las del centro y la elegida, o solo las de la elegida (el grafo del mundo) */
  labels: 'center' | 'selected'
  onSelect: (id: string | null) => void
  onOpen: (id: string) => void
  svgRef: (element: SVGSVGElement | null) => void
  children?: ReactNode
}

export function LinksGraph({ transform, svgRef, label, children, onSelect, ...rest }: LinksGraphProps) {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: pulsar el fondo deja de elegir (con el teclado, Escape en la ficha)
    <svg
      ref={svgRef}
      className={styles.svg}
      aria-label={label}
      onClick={(event) => {
        if (event.target === event.currentTarget) onSelect(null)
      }}
    >
      <g transform={transform.toString()}>
        <GraphBody {...rest} onSelect={onSelect} />
      </g>
      {children}
    </svg>
  )
}

/** Lo que se dibuja (sin la transformación: mover y acercar no lo vuelve a pintar) */
const GraphBody = memo(function GraphBody({
  nodes,
  edges,
  positions,
  center,
  selected,
  highlight,
  colorOf,
  labels,
  onSelect,
  onOpen
}: Omit<LinksGraphProps, 'transform' | 'svgRef' | 'label' | 'children'>) {
  const { t } = useTranslation()
  const lit = (edge: GraphEdge) =>
    (highlight !== null && edge.key === highlight && (edge.source === center || edge.target === center)) ||
    (selected !== null && (edge.source === selected || edge.target === selected))
  const named = (edge: GraphEdge) =>
    (labels === 'center' && center !== null && (edge.source === center || edge.target === center)) ||
    (selected !== null && (edge.source === selected || edge.target === selected))
  // Se lee desde la elegida si la toca; si no, desde el centro
  const from = (edge: GraphEdge) =>
    selected !== null && (edge.source === selected || edge.target === selected) ? selected : (center ?? edge.source)
  // Los nombres de las rayas encendidas, encima de las demás
  const ordered = [...edges].sort((a, b) => Number(lit(a)) - Number(lit(b)))
  return (
    <>
      <g className={styles.edges}>
        {ordered.map((edge) => {
          const a = positions.get(edge.source)
          const b = positions.get(edge.target)
          if (!a || !b) return null
          return (
            <line
              key={`${edge.source}-${edge.target}-${edge.key}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={styles.edge}
              data-kind={edge.kind}
              data-secret={edge.secret || undefined}
              data-lit={lit(edge) || undefined}
            />
          )
        })}
      </g>
      <g className={styles.edgeLabels}>
        {ordered.map((edge) => {
          if (edge.kind === 'mention' || !named(edge)) return null
          const a = positions.get(edge.source)
          const b = positions.get(edge.target)
          if (!a || !b) return null
          return (
            <text
              key={`${edge.source}-${edge.target}-${edge.key}`}
              x={(a.x + b.x) / 2}
              y={(a.y + b.y) / 2}
              dy="0.35em"
              className={styles.edgeLabel}
              data-lit={lit(edge) || undefined}
            >
              {edgeLabel(edge, from(edge), t)}
            </text>
          )
        })}
      </g>
      <g className={styles.nodes}>
        {nodes.map((node) => {
          const at = positions.get(node.id)
          if (!at) return null
          const isCenter = node.id === center
          const radius = isCenter ? 24 : 17
          const lines = titleLines(node.title)
          return (
            // biome-ignore lint/a11y/useSemanticElements: un nodo de SVG no puede ser un <button>
            <g
              key={node.id}
              transform={`translate(${at.x},${at.y})`}
              className={styles.node}
              role="button"
              tabIndex={0}
              aria-label={node.title}
              aria-pressed={selected === node.id}
              data-center={isCenter || undefined}
              style={{ '--node-color': colorOf(node) } as CSSProperties}
              onClick={(event) => {
                event.stopPropagation()
                onSelect(selected === node.id ? null : node.id)
              }}
              onDoubleClick={() => onOpen(node.id)}
              onKeyDown={(event) => {
                if (!activates(event)) return
                event.preventDefault()
                onSelect(node.id)
              }}
            >
              <circle r={radius + 4} className={styles.halo} />
              <circle r={radius} className={styles.ring} />
              <NodeGlyph node={node} size={isCenter ? 26 : 18} />
              <text className={styles.nodeTitle} y={radius + 15}>
                {lines.map((line, index) => (
                  <tspan key={line} x={0} dy={index === 0 ? 0 : '1.15em'}>
                    {/* Con su espacio: el nombre se lee seguido («Guerra de las Brumas») */}
                    {index < lines.length - 1 ? `${line} ` : line}
                  </tspan>
                ))}
              </text>
            </g>
          )
        })}
      </g>
    </>
  )
})
