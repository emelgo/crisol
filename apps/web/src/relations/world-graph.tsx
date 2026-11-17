/**
 * El grafo de todo el mundo a pantalla entera (módulo 10, decisión 12; lienzo, pantalla 4), como la cronología o el
 * mapa: arriba «‹ Páginas», «Relaciones», cuántas páginas y relaciones salen, y el buscador (lleva a una página); a la
 * izquierda, los filtros (plantillas, relaciones, etiquetas y las páginas sueltas, ocultas de entrada), que se pliegan;
 * cada página, del color de su plantilla. Hasta ~800 páginas, en SVG; con más, en un lienzo. Se abre desde un icono en
 * la cabecera del árbol de páginas. La jugadora lo ve con lo que conoce su campaña (sin etiquetas: son del máster)
 */
import type { RelationNode } from '@crisol/contracts'
import { getRouteApi, Link, Navigate } from '@tanstack/react-router'
import { ChevronLeft, ChevronsLeft, Search, SlidersHorizontal } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { Loading } from '../components/brand.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
import { type ReadAs, ReadAsProvider, useOpenPage, useReadAs } from '../wiki/read-as.tsx'
import { tagDot, useAccountTags } from '../wiki/tags.tsx'
import { GraphCanvas } from './graph-canvas.tsx'
import { forceLayout } from './layout.ts'
import { type GraphEdge, LinksGraph } from './links-graph.tsx'
import { inWords, templateColor } from './model.ts'
import { boundsOf, usePanZoom } from './pan-zoom.ts'
import { NodeCard, Toggle, useSelection, ZoomControls } from './parts.tsx'
import { useTemplateLook, useWorldGraph } from './queries.ts'
import { colorOrder } from './relations-tab.tsx'
import styles from './world-graph.module.css'

/**
 * A partir de cuántas páginas se pinta en un lienzo (que se asienta a trozos, sin congelar la página): el SVG calcula
 * las fuerzas de una vez, y con 700 páginas se quedaba congelado unos segundos (audit de impeccable)
 */
export const CANVAS_FROM = 300
const NO_TEMPLATE = 'sin-plantilla'
const INSETS = { top: 16, bottom: 76 }

const route = getRouteApi('/mundos/$worldId/relaciones')
const playerRoute = getRouteApi('/mundos/$worldId/campanas/$campaignId/relaciones')

/** La pantalla del máster: Páginas › Relaciones */
export function WorldGraphScreen() {
  const { worldId } = route.useParams()
  const { account, pending } = useAccounts().useAccount()
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  return (
    <WorldGraph
      worldId={worldId}
      back={
        <Link to="/mundos/$worldId/wiki" params={{ worldId }} className={styles.back}>
          <ChevronLeft size={16} aria-hidden="true" />
          <BackText />
        </Link>
      }
    />
  )
}

/** La de quien juega: desde las páginas de su campaña, con lo que conoce */
export function PlayerWorldGraphScreen() {
  const { worldId, campaignId } = playerRoute.useParams()
  const { como } = playerRoute.useSearch() as { como?: string }
  const { account, pending } = useAccounts().useAccount()
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  const readAs: ReadAs = { campaignId, ...(como ? { asCharacterId: como } : {}) }
  return (
    <ReadAsProvider value={readAs}>
      <WorldGraph
        worldId={worldId}
        back={
          <Link
            to="/mundos/$worldId/campanas/$campaignId/paginas"
            params={{ worldId, campaignId }}
            search={como ? { como } : {}}
            className={styles.back}
          >
            <ChevronLeft size={16} aria-hidden="true" />
            <BackText />
          </Link>
        }
      />
    </ReadAsProvider>
  )
}

function BackText() {
  const { t } = useTranslation()
  return <>{t('relations.world.back')}</>
}

export function WorldGraph({ worldId, back }: { worldId: string; back: ReactNode }) {
  const { t } = useTranslation()
  const readAs = useReadAs()
  const openPage = useOpenPage()
  const look = useTemplateLook()
  const [tags, setTags] = useState<string[]>([])
  const graph = useWorldGraph(worldId, tags)
  const accountTags = useAccountTags(!readAs)
  const [hiddenTemplates, setHiddenTemplates] = useState<ReadonlySet<string>>(new Set())
  const [hiddenRelations, setHiddenRelations] = useState<ReadonlySet<string>>(new Set())
  const [orphans, setOrphans] = useState(false)
  const [folded, setFolded] = useState(false)
  const { selected, select: setSelected, close: closeCard, focusCard } = useSelection()
  const [focus, setFocus] = useState<{ id: string; at: number } | null>(null)

  const all = useMemo(() => graph.data?.nodes ?? [], [graph.data?.nodes])
  const relations = graph.data?.relations ?? []
  const order = useMemo(() => colorOrder(look.order, all), [look.order, all])
  const colorOf = useCallback((node: RelationNode) => templateColor(node.template, order), [order])
  // Las aristas, completas: el nombre y el papel de cada relación van una vez, en relations
  const fullEdges = useMemo<GraphEdge[]>(() => {
    const byKey = new Map(relations.map((relation) => [relation.key, relation]))
    return (graph.data?.edges ?? []).map((edge) => {
      const relation = byKey.get(edge.key)
      return {
        source: edge.source,
        target: edge.target,
        key: edge.key,
        kind: relation?.kind ?? 'field',
        name: relation?.name ?? '',
        ...(relation?.inverseName ? { inverseName: relation.inverseName } : {}),
        ...(relation?.role ? { role: relation.role } : {}),
        ...(edge.secret ? { secret: true as const } : {})
      }
    })
  }, [graph.data?.edges, relations])

  // Los filtros de plantillas y relaciones, aquí (al momento); las etiquetas, en el servidor
  const templateOf = (node: RelationNode) => node.template ?? NO_TEMPLATE
  const { nodes, edges, loose } = useMemo(() => {
    const kept = all.filter((node) => !hiddenTemplates.has(templateOf(node)))
    const present = new Set(kept.map((node) => node.id))
    const links = fullEdges.filter(
      (edge) => present.has(edge.source) && present.has(edge.target) && !hiddenRelations.has(edge.key)
    )
    const linked = new Set(links.flatMap((edge) => [edge.source, edge.target]))
    const looseCount = kept.filter((node) => !linked.has(node.id)).length
    return { nodes: orphans ? kept : kept.filter((node) => linked.has(node.id)), edges: links, loose: looseCount }
  }, [all, fullEdges, hiddenTemplates, hiddenRelations, orphans])

  const templates = useMemo(() => {
    const counts = new Map<string, number>()
    for (const node of all) counts.set(templateOf(node), (counts.get(templateOf(node)) ?? 0) + 1)
    return [...counts]
      .map(([id, count]) => ({
        id,
        count,
        name: id === NO_TEMPLATE ? t('relations.noTemplate') : (look.nameOf(id) ?? '')
      }))
      .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
      .map((each, index) => ({ ...each, name: each.name || t('relations.world.templateN', { n: index + 1 }) }))
  }, [all, look, order, t])

  const byId = useMemo(() => new Map(all.map((node) => [node.id, node])), [all])
  const titleOf = useCallback((id: string) => byId.get(id)?.title ?? '', [byId])
  const selectedNode = selected ? byId.get(selected) : undefined
  const pick = (id: string) => {
    setSelected(id)
    setFocus({ id, at: Date.now() })
    // Si la ocultan los filtros, se enseña
    const node = byId.get(id)
    if (node && hiddenTemplates.has(templateOf(node))) {
      const next = new Set(hiddenTemplates)
      next.delete(templateOf(node))
      setHiddenTemplates(next)
    }
    if (!orphans && !edges.some((edge) => edge.source === id || edge.target === id)) setOrphans(true)
  }
  const toggle = (set: ReadonlySet<string>, id: string, update: (next: ReadonlySet<string>) => void) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    update(next)
  }

  if (!graph.data)
    return failed(graph) ? <LoadError error={graph.error} onRetry={() => graph.refetch()} /> : <Loading />

  const card = selectedNode && (
    <NodeCard
      node={selectedNode}
      color={colorOf(selectedNode)}
      meta={[look.nameOf(selectedNode.template), selectedNode.subtitle].filter(Boolean).join(' · ')}
      rows={inWords(selectedNode.id, edges, titleOf, t)}
      primary="open"
      onOpen={() => openPage(worldId, selectedNode.id)}
      onCenter={() => setFocus({ id: selectedNode.id, at: Date.now() })}
      onClose={closeCard}
      autoFocus={focusCard}
    />
  )
  const label = t('relations.world.canvas', { count: nodes.length })

  return (
    <div className={styles.screen} data-heavy={nodes.length >= CANVAS_FROM || undefined}>
      <header className={styles.head}>
        {back}
        <PageTitle>{t('relations.world.title')}</PageTitle>
        <p className={styles.facts}>
          {t('relations.world.facts', { pages: nodes.length, relations: edges.length })}
          {!orphans && loose > 0 && <> · {t('relations.world.orphansHidden', { count: loose })}</>}
        </p>
        <FindPage nodes={all} templateName={(node) => look.nameOf(node.template)} onPick={pick} />
      </header>
      <div className={styles.frame} data-folded={folded || undefined}>
        {!folded && (
          <aside className={styles.filters} aria-label={t('relations.world.filters')} data-tour="grafo-filtros">
            <FilterGroup
              title={t('relations.world.templates')}
              onNone={() => setHiddenTemplates(new Set(templates.map((each) => each.id)))}
              onAll={() => setHiddenTemplates(new Set())}
              allShown={hiddenTemplates.size === 0}
            >
              {templates.map((each) => (
                <FilterRow
                  key={each.id}
                  label={each.name}
                  count={each.count}
                  checked={!hiddenTemplates.has(each.id)}
                  onChange={() => toggle(hiddenTemplates, each.id, setHiddenTemplates)}
                  mark={
                    <span
                      className={styles.dot}
                      style={{ background: templateColor(each.id === NO_TEMPLATE ? null : each.id, order) }}
                    />
                  }
                />
              ))}
            </FilterGroup>
            {relations.length > 0 && (
              <FilterGroup
                title={t('relations.world.relations')}
                onNone={() => setHiddenRelations(new Set(relations.map((each) => each.key)))}
                onAll={() => setHiddenRelations(new Set())}
                allShown={hiddenRelations.size === 0}
              >
                {relations.map((each) => (
                  <FilterRow
                    key={each.key}
                    label={each.kind === 'mention' ? t('relations.legend.mention') : each.name}
                    count={each.count}
                    checked={!hiddenRelations.has(each.key)}
                    onChange={() => toggle(hiddenRelations, each.key, setHiddenRelations)}
                    mark={
                      <svg width="20" height="8" aria-hidden="true">
                        <line x1="1" y1="4" x2="19" y2="4" className={styles.stroke} data-kind={each.kind} />
                      </svg>
                    }
                  />
                ))}
              </FilterGroup>
            )}
            {!readAs && (accountTags.data?.tags.length ?? 0) > 0 && (
              <section className={styles.group}>
                <h2>{t('relations.world.tags')}</h2>
                <div className={styles.tags}>
                  {accountTags.data?.tags.map((tag) => (
                    <button
                      key={tag.name}
                      type="button"
                      className={styles.tag}
                      style={tagDot(tag.color)}
                      aria-pressed={tags.includes(tag.name)}
                      onClick={() =>
                        setTags(
                          tags.includes(tag.name) ? tags.filter((each) => each !== tag.name) : [...tags, tag.name]
                        )
                      }
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </section>
            )}
            <div className={styles.orphans}>
              <Toggle label={t('relations.world.orphans')} checked={orphans} onChange={setOrphans} />
              <span className={styles.count}>{loose}</span>
            </div>
            <button type="button" className={styles.fold} onClick={() => setFolded(true)}>
              <ChevronsLeft size={16} aria-hidden="true" />
              {t('relations.world.fold')}
            </button>
          </aside>
        )}
        <div className={styles.graph} data-tour="grafo-mundo">
          {folded && (
            <button type="button" className={styles.unfold} onClick={() => setFolded(false)}>
              <SlidersHorizontal size={16} aria-hidden="true" />
              {t('relations.world.unfold')}
            </button>
          )}
          {all.length === 0 || (fullEdges.length === 0 && !orphans) ? (
            <p className={styles.empty}>{t('relations.world.empty')}</p>
          ) : nodes.length === 0 ? (
            <p className={styles.empty}>{t('relations.world.filtered')}</p>
          ) : nodes.length >= CANVAS_FROM ? (
            <GraphCanvas
              label={label}
              nodes={nodes}
              edges={edges}
              selected={selected}
              focus={focus}
              colorOf={colorOf}
              insets={INSETS}
              onSelect={setSelected}
              onOpen={(id) => openPage(worldId, id)}
            >
              {card}
            </GraphCanvas>
          ) : (
            <SvgWorld
              label={label}
              nodes={nodes}
              edges={edges}
              selected={selected}
              focus={focus}
              colorOf={colorOf}
              onSelect={setSelected}
              onOpen={(id) => openPage(worldId, id)}
            >
              {card}
            </SvgWorld>
          )}
        </div>
      </div>
      <Tour
        id="grafo-mundo"
        steps={[
          ...(folded ? [] : [{ target: '[data-tour="grafo-filtros"]', text: t('tour.worldGraph.filters') }]),
          { target: '[data-tour="grafo-buscar"]', text: t('tour.worldGraph.search') },
          { target: '[data-tour="grafo-mundo"]', text: t('tour.worldGraph.graph') }
        ]}
      />
    </div>
  )
}

/** Hasta ~800 páginas: el mismo SVG que la pestaña, con los nombres solo en las rayas de la elegida */
function SvgWorld({
  label,
  nodes,
  edges,
  selected,
  focus,
  colorOf,
  onSelect,
  onOpen,
  children
}: {
  label: string
  nodes: readonly RelationNode[]
  edges: readonly GraphEdge[]
  selected: string | null
  focus: { id: string; at: number } | null
  colorOf: (node: RelationNode) => string
  onSelect: (id: string | null, viaKeyboard?: boolean) => void
  onOpen: (id: string) => void
  children: ReactNode
}) {
  const [svg, setSvg] = useState<SVGSVGElement | null>(null)
  const { transform, zoomBy, fit, centerOn, keepFitted } = usePanZoom(svg, { insets: INSETS })
  const positions = useMemo(
    () =>
      forceLayout(
        nodes.map((node) => node.id),
        edges,
        { spread: 0.8 }
      ),
    [nodes, edges]
  )
  const bounds = useMemo(() => boundsOf(positions.values(), 70), [positions])
  // Se encuadra al llegar y con otros filtros; mientras no se toque, también si cambia el hueco
  const fittedFor = useRef<unknown>(null)
  useEffect(() => {
    if (!svg || !bounds || fittedFor.current === positions) return
    fittedFor.current = positions
    fit(bounds, 1.1)
  }, [svg, bounds, positions, fit])
  useEffect(() => keepFitted(bounds, 1.1), [keepFitted, bounds])
  // Al buscar una página, la vista va a ella
  const scale = useRef(transform.k)
  scale.current = transform.k
  useEffect(() => {
    const at = focus && positions.get(focus.id)
    if (at) centerOn(at, Math.max(scale.current, 1.2))
  }, [focus, positions, centerOn])
  return (
    <>
      <LinksGraph
        label={label}
        svgRef={setSvg}
        nodes={nodes}
        edges={edges}
        positions={positions}
        center={null}
        selected={selected}
        highlight={null}
        colorOf={colorOf}
        transform={transform}
        labels="selected"
        onSelect={onSelect}
        onOpen={onOpen}
      />
      {children}
      <ZoomControls scale={transform.k} onZoom={zoomBy} onFit={() => fit(bounds)} />
    </>
  )
}

function FilterGroup({
  title,
  onNone,
  onAll,
  allShown,
  children
}: {
  title: string
  onNone: () => void
  onAll: () => void
  allShown: boolean
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <section className={styles.group}>
      <div className={styles.groupHead}>
        <h2>{title}</h2>
        <button type="button" className={styles.link} onClick={allShown ? onNone : onAll}>
          {allShown ? t('relations.world.none') : t('relations.world.all')}
        </button>
      </div>
      <ul>{children}</ul>
    </section>
  )
}

function FilterRow({
  label,
  count,
  checked,
  mark,
  onChange
}: {
  label: string
  count: number
  checked: boolean
  mark: ReactNode
  onChange: () => void
}) {
  return (
    <li>
      <label className={styles.row} data-off={!checked || undefined}>
        <input type="checkbox" checked={checked} onChange={onChange} />
        {mark}
        <span className={styles.rowName}>{label}</span>
        <span className={styles.count}>{count}</span>
      </label>
    </li>
  )
}

/** El buscador de la cabecera: escribir saca las páginas que se llaman así; elegir una lleva la vista a ella */
function FindPage({
  nodes,
  templateName,
  onPick
}: {
  nodes: readonly RelationNode[]
  templateName: (node: RelationNode) => string | null
  onPick: (id: string) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listId = useId()
  const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()
  const matches = query.trim() ? nodes.filter((node) => fold(node.title).includes(fold(query.trim()))).slice(0, 8) : []
  const choose = (node: RelationNode | undefined) => {
    if (!node) return
    onPick(node.id)
    setQuery('')
  }
  return (
    <div className={styles.find} data-tour="grafo-buscar">
      <Search size={16} aria-hidden="true" />
      <input
        type="search"
        role="combobox"
        aria-expanded={matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={matches[active] ? `${listId}-${active}` : undefined}
        aria-label={t('relations.world.search')}
        placeholder={t('relations.world.search')}
        value={query}
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        onChange={(event) => {
          setQuery(event.currentTarget.value)
          setActive(0)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActive((active + 1) % Math.max(1, matches.length))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActive((active - 1 + matches.length) % Math.max(1, matches.length))
          } else if (event.key === 'Enter') {
            event.preventDefault()
            choose(matches[active])
          } else if (event.key === 'Escape') setQuery('')
        }}
      />
      {query.trim() &&
        (matches.length === 0 ? (
          <p className={styles.noMatch}>{t('relations.world.noMatch')}</p>
        ) : (
          <div id={listId} role="listbox" className={styles.matches} aria-label={t('relations.world.search')}>
            {matches.map((node, index) => (
              <div
                key={node.id}
                id={`${listId}-${index}`}
                role="option"
                tabIndex={-1}
                aria-selected={index === active}
                onPointerDown={(event) => {
                  event.preventDefault()
                  choose(node)
                }}
                onPointerEnter={() => setActive(index)}
              >
                <span>{node.title}</span>
                <small>{templateName(node) ?? ''}</small>
              </div>
            ))}
          </div>
        ))}
    </div>
  )
}
