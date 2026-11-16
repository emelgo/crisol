/**
 * La pestaña «Relaciones» de una página (módulo 10, docs/specs/modulo-10.md, decisiones 5 a 10; lienzo aprobado,
 * pantallas 1 a 3): fija y calculada, sale si la página tiene alguna relación. Tres modos en una píldora de cristal
 * abajo en el centro (solo los que tiene): Enlaces (el vecindario a 1–3 saltos, con «Solo campos»), Familia (por
 * generaciones) y Organigrama. Se abre en Familia u Organigrama si los hay y, si no, en Enlaces; el elegido se recuerda
 * por plantilla. Pulsar una página la elige (su ficha, arriba a la derecha) y el doble clic la abre; «Centrar aquí»
 * rehace el grafo desde ella, con «‹ Volver a…» arriba. Al pasar por una propiedad del panel se marcan sus rayas.
 * compact: la jugadora en el móvil (pantalla 7): el grafo en pequeño, en palabras debajo y a pantalla entera al ampliar
 */
import type { Page, RelationMode, RelationNode } from '@crisol/contracts'
import { ChevronLeft, Maximize2, X } from 'lucide-react'
import { type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useOpenPage, useReadAs } from '../wiki/read-as.tsx'
import { TabToolsSlot } from '../wiki/world-page.ts'
import { NodeGlyphBox } from './glyph.tsx'
import { familyLayout, forceLayout, orgLayout, type Point, type TreeLayout } from './layout.ts'
import { type GraphEdge, LinksGraph } from './links-graph.tsx'
import { inWords, openingMode, rememberedMode, rememberMode, templateColor, type WordsRow } from './model.ts'
import { boundsOf, usePanZoom } from './pan-zoom.ts'
import { Legend, ModePill, NodeCard, Segmented, Toggle, ZoomControls } from './parts.tsx'
import { FIRST_VIEW, useRelations, useTemplateLook } from './queries.ts'
import styles from './relations.module.css'
import { TreeView } from './tree-view.tsx'

const DEPTHS = [1, 2, 3] as const
/** Lo que tapan arriba «‹ Volver a…» y abajo la píldora, el zoom y la leyenda */
const INSETS = { top: 48, bottom: 76 }
const COMPACT_INSETS = { top: 8, bottom: 8 }
const GENERATIONS = [1, 2, 3] as const

/** Si la pantalla es la de un móvil (menos de 48 rem): la jugadora ve la pestaña en pequeño (compact) */
export function useCompactScreen() {
  const query = '(max-width: 47.99rem)'
  const [compact, setCompact] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches)
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const list = matchMedia(query)
    const change = () => setCompact(list.matches)
    list.addEventListener('change', change)
    return () => list.removeEventListener('change', change)
  }, [])
  return compact
}

/** El orden de los colores: el de las plantillas de la cuenta y, detrás, las que salen y no están (las de otro) */
export function colorOrder(order: readonly string[], nodes: readonly Pick<RelationNode, 'template'>[]) {
  const all = [...order]
  for (const node of nodes) if (node.template && !all.includes(node.template)) all.push(node.template)
  return all
}

export function RelationsTab({
  page,
  compact = false,
  onMode
}: {
  page: Page
  compact?: boolean
  /** El modo que se ve (para plegar el panel en Familia y Organigrama) */
  onMode?: (mode: RelationMode | null) => void
}) {
  const { t } = useTranslation()
  const readAs = useReadAs()
  const openPage = useOpenPage()
  const look = useTemplateLook()
  const slot = useContext(TabToolsSlot)
  const [center, setCenter] = useState(page.id)
  const [chosen, setChosen] = useState<RelationMode | null>(null)
  const [depth, setDepth] = useState<number>(1)
  // «Menciona» encendido de entrada (decisión pendiente: o «Solo campos» de entrada)
  const [fieldsOnly, setFieldsOnly] = useState(false)
  const [generations, setGenerations] = useState<number>(2)
  const [selected, setSelected] = useState<string | null>(null)
  const [wide, setWide] = useState(false)

  const base = useRelations(page.worldId, center, FIRST_VIEW)
  const modes = base.data?.pageId === center ? base.data.modes : []
  const remembered = useMemo(() => rememberedMode(page.template), [page.template])
  const mode = chosen && modes.includes(chosen) ? chosen : openingMode(modes, center === page.id ? remembered : null)
  const query = compact
    ? { mode: mode ?? 'links', depth: 1, fieldsOnly: false }
    : { mode: mode ?? 'links', depth, fieldsOnly }
  const view = useRelations(page.worldId, center, query, mode !== null)
  const data = view.data?.pageId === center && view.data.mode === query.mode ? view.data : null
  const choose = (next: RelationMode) => {
    setChosen(next)
    setSelected(null)
    if (center === page.id) rememberMode(page.template, next)
  }
  useEffect(() => {
    onMode?.(mode)
  }, [mode, onMode])
  useEffect(() => () => onMode?.(null), [onMode])

  // Sin icono propio, el de su plantilla (como en el árbol)
  const nodes = useMemo(
    () => (data?.nodes ?? []).map((node) => (node.icon ? node : { ...node, icon: look.iconOf(node.template) })),
    [data?.nodes, look]
  )
  const edges = (data?.edges ?? []) as GraphEdge[]
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
  const titleOf = useCallback((id: string) => byId.get(id)?.title ?? '', [byId])
  const order = useMemo(() => colorOrder(look.order, nodes), [look.order, nodes])
  const colorOf = useCallback((node: RelationNode) => templateColor(node.template, order), [order])
  const recenter = (id: string) => {
    setCenter(id)
    setSelected(null)
  }
  const open = (id: string) => openPage(page.worldId, id)
  const highlight = usePanelHighlight(!compact && mode === 'links' && center === page.id)

  const selectedNode = selected ? byId.get(selected) : undefined
  const card = selectedNode && (
    <NodeCard
      node={selectedNode}
      color={colorOf(selectedNode)}
      meta={[look.nameOf(selectedNode.template), selectedNode.subtitle].filter(Boolean).join(' · ')}
      rows={inWords(selectedNode.id, edges, titleOf, t)}
      primary={compact ? 'open' : 'center'}
      onOpen={() => open(selectedNode.id)}
      onCenter={selectedNode.id === center ? null : () => recenter(selectedNode.id)}
      onClose={() => setSelected(null)}
    />
  )

  const tools =
    compact || !mode ? null : mode === 'links' ? (
      <div className={styles.tools}>
        <Segmented
          label={t('relations.depth')}
          options={DEPTHS}
          value={depth as 1}
          text={String}
          name={(n) => t('relations.depthOf', { count: n })}
          onChange={setDepth}
        />
        <Toggle label={t('relations.fieldsOnly')} checked={fieldsOnly} onChange={setFieldsOnly} />
      </div>
    ) : mode === 'family' ? (
      <div className={styles.tools}>
        <Segmented
          label={t('relations.generations')}
          options={GENERATIONS}
          value={generations as 1}
          text={(n) => t('relations.generationsOf', { count: n })}
          name={(n) => t('relations.generationsOf', { count: n })}
          onChange={setGenerations}
        />
      </div>
    ) : null

  if (base.data && modes.length === 0 && center === page.id)
    return <p className={styles.nothing}>{t('relations.world.empty')}</p>

  const graph = (expanded: boolean) =>
    mode && data ? (
      <Canvas
        key={`${center}-${mode}`}
        label={t('relations.graph', { page: byId.get(center)?.title ?? page.title })}
        mode={mode}
        nodes={nodes}
        byId={byId}
        edges={edges}
        groups={data.groups}
        center={center}
        selected={selected}
        highlight={highlight}
        generations={compact ? 3 : generations}
        colorOf={colorOf}
        onSelect={setSelected}
        onOpen={open}
        compact={compact && !expanded}
      >
        {center !== page.id && (
          <button type="button" className={styles.back} onClick={() => recenter(page.id)}>
            <ChevronLeft size={16} aria-hidden="true" />
            {t('relations.backTo', { page: page.title })}
          </button>
        )}
        {data.truncated && <p className={styles.notice}>{t('relations.truncated')}</p>}
        {(!compact || expanded) && card}
        {!compact && mode === 'links' && <Legend secrets={!readAs && edges.some((edge) => edge.secret)} />}
        {!compact && <ModePill modes={modes} value={mode} onChange={choose} />}
      </Canvas>
    ) : null

  if (compact) {
    return (
      <div className={styles.compact}>
        {modes.length > 1 && mode && (
          // biome-ignore lint/a11y/useSemanticElements: un grupo de botones que eligen qué se ve, no un formulario
          <div className={styles.compactModes} role="group" aria-label={t('relations.modes.label')}>
            {modes.map((each) => (
              <button key={each} type="button" aria-pressed={each === mode} onClick={() => choose(each)}>
                {t(`relations.modes.${each}`)}
              </button>
            ))}
          </div>
        )}
        {mode === 'links' ? (
          <>
            <div className={styles.compactGraph}>
              {graph(false)}
              <button
                type="button"
                className={styles.expand}
                aria-label={t('relations.expand')}
                title={t('relations.expand')}
                onClick={() => setWide(true)}
              >
                <Maximize2 size={16} aria-hidden="true" />
              </button>
            </div>
            <Words rows={inWords(center, edges, titleOf, t)} onOpen={open} />
          </>
        ) : mode === 'family' ? (
          <FamilyRows nodes={nodes} center={center} onOpen={open} />
        ) : mode === 'org' && data ? (
          <OrgRows nodes={nodes} edges={edges} groups={data.groups} center={center} onOpen={open} />
        ) : null}
        {wide &&
          createPortal(
            <WideGraph title={t('relations.graph', { page: page.title })} onClose={() => setWide(false)}>
              {graph(true)}
            </WideGraph>,
            document.body
          )}
      </div>
    )
  }

  return (
    <>
      {tools && (slot ? createPortal(tools, slot) : <div className={styles.toolsRow}>{tools}</div>)}
      <div className={styles.area} data-mode={mode ?? undefined}>
        {graph(false)}
      </div>
    </>
  )
}

/** El grafo (o las tarjetas) con su zoom: se encuadra al llegar */
function Canvas({
  label,
  mode,
  nodes,
  byId,
  edges,
  groups,
  center,
  selected,
  highlight,
  generations,
  colorOf,
  onSelect,
  onOpen,
  compact,
  children
}: {
  label: string
  mode: RelationMode
  nodes: readonly RelationNode[]
  byId: ReadonlyMap<string, RelationNode>
  edges: readonly GraphEdge[]
  groups: readonly string[]
  center: string
  selected: string | null
  highlight: string | null
  generations: number
  colorOf: (node: RelationNode) => string
  onSelect: (id: string | null) => void
  onOpen: (id: string) => void
  compact: boolean
  children: ReactNode
}) {
  const [svg, setSvg] = useState<SVGSVGElement | null>(null)
  const { transform, zoomBy, fit, keepFitted } = usePanZoom(svg, { insets: compact ? COMPACT_INSETS : INSETS })
  // Las posiciones de antes: al cambiar la profundidad o «Solo campos», lo que ya estaba no salta
  const before = useRef<Map<string, Point> | undefined>(undefined)
  const positions = useMemo(() => {
    if (mode !== 'links') return null
    const placed = forceLayout(
      nodes.map((node) => node.id),
      edges,
      { center, initial: before.current }
    )
    before.current = placed
    return placed
  }, [mode, nodes, edges, center])
  const tree = useMemo<TreeLayout | null>(() => {
    if (mode === 'family') return familyLayout(nodes, edges, generations)
    if (mode === 'org') return orgLayout(nodes, edges, groups)
    return null
  }, [mode, nodes, edges, groups, generations])
  const bounds = useMemo(() => {
    if (positions) return boundsOf(positions.values(), 70)
    if (!tree || tree.cards.length === 0) return null
    return {
      minX: Math.min(...tree.cards.map((card) => card.x - card.width / 2)) - (tree.rows.length > 0 ? 120 : 30),
      minY: Math.min(...tree.cards.map((card) => card.y - card.height / 2)) - 30,
      maxX: Math.max(...tree.cards.map((card) => card.x + card.width / 2)) + 30,
      maxY: Math.max(...tree.cards.map((card) => card.y + card.height / 2)) + 30
    }
  }, [positions, tree])
  // Se encuadra al llegar y al cambiar lo que se ve
  const signature = `${mode}|${nodes.length}|${edges.length}|${generations}|${compact}`
  const fitted = useRef('')
  useEffect(() => {
    if (!svg || !bounds || fitted.current === signature) return
    fitted.current = signature
    fit(bounds, compact ? 0.9 : 1.1)
  }, [svg, bounds, signature, fit, compact])
  useEffect(() => keepFitted(bounds, compact ? 0.9 : 1.1), [keepFitted, bounds, compact])

  return (
    <>
      {positions ? (
        <LinksGraph
          label={label}
          svgRef={setSvg}
          nodes={nodes}
          edges={edges}
          positions={positions}
          center={center}
          selected={selected}
          highlight={highlight}
          colorOf={colorOf}
          transform={transform}
          labels="center"
          onSelect={onSelect}
          onOpen={onOpen}
        />
      ) : tree ? (
        <TreeView
          label={label}
          svgRef={setSvg}
          layout={tree}
          nodes={byId}
          center={center}
          selected={selected}
          colorOf={colorOf}
          transform={transform}
          onSelect={onSelect}
          onOpen={onOpen}
        />
      ) : null}
      {children}
      {!compact && <ZoomControls scale={transform.k} onZoom={zoomBy} onFit={() => fit(bounds)} />}
    </>
  )
}

/**
 * La relación de la propiedad del panel por la que pasa el ratón (o el foco): sus rayas se marcan en el grafo. Las
 * propiedades de enlace llevan data-relation-key (properties.tsx)
 */
function usePanelHighlight(enabled: boolean) {
  const [key, setKey] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) {
      setKey(null)
      return
    }
    const over = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null
      const row = target?.closest<HTMLElement>('[data-entry-panel] aside [data-relation-key]')
      setKey(row?.dataset.relationKey ?? null)
    }
    document.addEventListener('pointerover', over)
    document.addEventListener('focusin', over)
    return () => {
      document.removeEventListener('pointerover', over)
      document.removeEventListener('focusin', over)
    }
  }, [enabled])
  return key
}

/** Las relaciones en palabras, bajo el grafo pequeño del móvil: cada una, con sus páginas que se abren */
function Words({ rows, onOpen }: { rows: readonly WordsRow[]; onOpen: (id: string) => void }) {
  const { t } = useTranslation()
  if (rows.length === 0) return null
  return (
    <dl className={styles.wordsList} aria-label={t('relations.inWords')}>
      {rows.map((row) => (
        <div key={`${row.label}-${row.secret}`}>
          <dt>{row.label}</dt>
          <dd>
            {row.pages.map((page, index) => (
              <span key={page.id}>
                {index > 0 && ', '}
                <button type="button" className={styles.wordLink} onClick={() => onOpen(page.id)}>
                  {page.title}
                </button>
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** La familia en el móvil, en filas por generación (sus tarjetas, que abren su página) */
function FamilyRows({
  nodes,
  center,
  onOpen
}: {
  nodes: readonly RelationNode[]
  center: string
  onOpen: (id: string) => void
}) {
  const { t } = useTranslation()
  const rows = [...new Set(nodes.map((node) => node.generation ?? 0))].sort((a, b) => a - b)
  return (
    <div className={styles.rowsList}>
      {rows.map((generation) => (
        <section key={generation} aria-label={t(`relations.rows.${String(generation) as '0'}`)}>
          <h4>{t(`relations.rows.${String(generation) as '0'}`)}</h4>
          <ul>
            {nodes
              .filter((node) => (node.generation ?? 0) === generation)
              .map((node) => (
                <li key={node.id}>
                  <MiniCard node={node} current={node.id === center} onOpen={onOpen} />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** El organigrama en el móvil: cada grupo, quien lo dirige y sus miembros */
function OrgRows({
  nodes,
  edges,
  groups,
  center,
  onOpen
}: {
  nodes: readonly RelationNode[]
  edges: readonly GraphEdge[]
  groups: readonly string[]
  center: string
  onOpen: (id: string) => void
}) {
  const { t } = useTranslation()
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const list = (ids: string[]) => ids.flatMap((id) => byId.get(id) ?? [])
  return (
    <div className={styles.rowsList}>
      {groups.flatMap((group) => {
        const node = byId.get(group)
        if (!node) return []
        const leaders = list(edges.filter((e) => e.source === group && e.role === 'leads').map((e) => e.target))
        const members = list(
          edges
            .filter((e) => e.target === group && e.role === 'member-of')
            .map((e) => e.source)
            .filter((id) => !leaders.some((leader) => leader.id === id))
        )
        return [
          <section key={group} aria-label={node.title}>
            <MiniCard node={node} current={group === center} onOpen={onOpen} />
            {leaders.length > 0 && <h4>{t('relations.leads')}</h4>}
            <ul>
              {leaders.map((each) => (
                <li key={each.id}>
                  <MiniCard node={each} current={each.id === center} onOpen={onOpen} />
                </li>
              ))}
            </ul>
            {members.length > 0 && <h4>{t('relations.members', { count: members.length })}</h4>}
            <ul>
              {members.map((each) => (
                <li key={each.id}>
                  <MiniCard node={each} current={each.id === center} onOpen={onOpen} />
                </li>
              ))}
            </ul>
          </section>
        ]
      })}
    </div>
  )
}

function MiniCard({ node, current, onOpen }: { node: RelationNode; current: boolean; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      className={styles.miniCard}
      aria-current={current || undefined}
      onClick={() => onOpen(node.id)}
    >
      <NodeGlyphBox node={node} size="small" />
      <span>
        <strong>{node.title}</strong>
        {node.subtitle && <small>{node.subtitle}</small>}
      </span>
    </button>
  )
}

/** El grafo a pantalla entera (la jugadora en el móvil, al ampliar), con su X arriba */
function WideGraph({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation()
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    close.current?.focus()
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !(event.target as Element | null)?.closest?.('section')) onClose()
    }
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('keydown', onEscape)
      opener?.focus()
    }
  }, [onClose])
  return (
    <div className={styles.wide} role="dialog" aria-modal="true" aria-label={title} data-full="">
      <header>
        <h2>{title}</h2>
        <button ref={close} type="button" className={styles.close} aria-label={t('relations.close')} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className={styles.wideBody}>{children}</div>
    </div>
  )
}
