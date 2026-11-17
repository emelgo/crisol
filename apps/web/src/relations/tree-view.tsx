/**
 * Familia y Organigrama en tarjetas (módulo 10), con lo que dispone layout.ts: cada página, su círculo con el color de
 * su plantilla, su nombre y, debajo, su primer campo de texto (en un grupo, cuántos miembros tiene); quien dirige un
 * grupo, con «Lo dirige» encima. La de la página, marcada. En Familia, el nombre de cada generación a la izquierda.
 * Pulsar una tarjeta la elige y el doble clic la abre
 */
import type { RelationNode } from '@crisol/contracts'
import type { ZoomTransform } from 'd3-zoom'
import { type CSSProperties, memo, type ReactNode, useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { TreeLayout } from './layout.ts'
import { activates, NodeGlyph } from './links-graph.tsx'
import styles from './relations.module.css'

interface TreeViewProps {
  label: string
  layout: TreeLayout
  nodes: ReadonlyMap<string, RelationNode>
  center: string
  selected: string | null
  colorOf: (node: RelationNode) => string
  transform: ZoomTransform
  onSelect: (id: string | null, viaKeyboard?: boolean) => void
  onOpen: (id: string) => void
  svgRef: (element: SVGSVGElement | null) => void
  children?: ReactNode
}

export function TreeView({ transform, svgRef, label, children, onSelect, ...rest }: TreeViewProps) {
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
        <TreeBody {...rest} onSelect={onSelect} />
      </g>
      {children}
    </svg>
  )
}

const TreeBody = memo(function TreeBody({
  layout,
  nodes,
  center,
  selected,
  colorOf,
  onSelect,
  onOpen
}: Omit<TreeViewProps, 'transform' | 'svgRef' | 'label' | 'children'>) {
  const { t } = useTranslation()
  const left = Math.min(...layout.cards.map((card) => card.x - card.width / 2))
  // Lo que no cabe en una tarjeta se funde por la derecha (entero, al pasar el ratón y en la ficha al elegirla)
  const fade = useId()
  const widths = [...new Set(layout.cards.map((card) => card.width))]
  return (
    <>
      <defs>
        <linearGradient id={`${fade}-g`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0.86" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        {widths.map((width) => (
          <mask
            key={width}
            id={`${fade}-${width}`}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={width - 8}
            height="80"
          >
            <rect x="0" y="0" width={width - 8} height="80" fill={`url(#${fade}-g)`} />
          </mask>
        ))}
      </defs>
      {layout.rows.map((row) => (
        <text key={row.generation} className={styles.rowLabel} x={left - 24} y={row.y} dy="0.35em">
          {t(`relations.rows.${String(Math.max(-3, Math.min(3, row.generation))) as '0'}`)}
        </text>
      ))}
      <g className={styles.wires}>
        {layout.wires.map((wire) => (
          <polyline
            key={wire.points.map((p) => `${p.x},${p.y}`).join(' ')}
            points={wire.points.map((p) => `${p.x},${p.y}`).join(' ')}
            className={styles.wire}
            data-kind={wire.kind}
          />
        ))}
      </g>
      {layout.cards.map((card) => {
        const node = nodes.get(card.id)
        if (!node) return null
        const x = card.x - card.width / 2
        const y = card.y - card.height / 2
        const below =
          card.kind === 'group' && card.members !== undefined
            ? node.subtitle
              ? `${node.subtitle} · ${t('relations.members', { count: card.members })}`
              : t('relations.members', { count: card.members })
            : (node.subtitle ?? '')
        const avatar = card.height / 2 - 2
        return (
          // biome-ignore lint/a11y/useSemanticElements: una tarjeta de SVG no puede ser un <button>
          <g
            key={card.id}
            transform={`translate(${x},${y})`}
            className={styles.treeCard}
            data-node-id={card.id}
            role="button"
            tabIndex={0}
            aria-label={[card.kind === 'leader' ? t('relations.leads') : '', node.title, below]
              .filter(Boolean)
              .join(', ')}
            aria-pressed={selected === card.id}
            data-center={card.id === center || undefined}
            data-kind={card.kind}
            style={{ '--node-color': colorOf(node) } as CSSProperties}
            onClick={(event) => {
              event.stopPropagation()
              onSelect(selected === card.id ? null : card.id)
            }}
            onDoubleClick={() => onOpen(card.id)}
            onKeyDown={(event) => {
              if (!activates(event)) return
              event.preventDefault()
              onSelect(card.id, true)
            }}
          >
            <title>
              {[card.kind === 'leader' ? t('relations.leads') : '', node.title, below].filter(Boolean).join(', ')}
            </title>
            <rect width={card.width} height={card.height} rx={10} className={styles.cardBox} />
            <g transform={`translate(${avatar + 8},${card.height / 2})`}>
              <circle r={avatar - 6} className={styles.ring} />
              <NodeGlyph node={node} size={avatar} />
            </g>
            <text
              x={avatar * 2 + 12}
              y={card.height / 2}
              className={styles.cardText}
              mask={`url(#${fade}-${card.width})`}
            >
              {card.kind === 'leader' && (
                <tspan x={avatar * 2 + 12} dy="-1.35em" className={styles.cardBadge}>
                  {`${t('relations.leads')} `}
                </tspan>
              )}
              <tspan
                x={avatar * 2 + 12}
                dy={card.kind === 'leader' ? '1.2em' : below ? '-0.2em' : '0.35em'}
                className={styles.cardTitle}
              >
                {/* Con su espacio: lo que se ve se lee seguido, como su nombre */}
                {below ? `${node.title} ` : node.title}
              </tspan>
              {below && (
                <tspan x={avatar * 2 + 12} dy="1.25em" className={styles.cardSub}>
                  {below}
                </tspan>
              )}
            </text>
          </g>
        )
      })}
    </>
  )
})
