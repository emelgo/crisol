/**
 * El grafo de relaciones en una ventana (bloque B de los ajustes tras los módulos 8 a 10), como Ajustes: encima de la
 * página, sin cambiar de vista. Va en la dirección (?grafo=mundo, el de todo el mundo; ?grafo=<página>, centrado en
 * ella): Escape, su X, pulsar fuera o el botón Atrás del navegador la cierran. Se abre desde el icono de la cabecera del
 * árbol de páginas (el del mundo) y desde el de «Mencionado en» (el de esa página), también para quien juega, con lo
 * que conoce su campaña. El de una página: el vecindario con su «Alcance» (directas, a dos pasos o a tres) y «Con lo
 * que menciona el texto» (encendido de entrada); «Centrar aquí» lo rehace desde otra página
 */
import type { RelationNode } from '@crisol/contracts'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { Waypoints, X } from 'lucide-react'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loading } from '../components/brand.tsx'
import windowStyles from '../components/window.module.css'
import { useOpenPage, useReadAs } from '../wiki/read-as.tsx'
import { forceLayout, type Point } from './layout.ts'
import { type GraphEdge, LinksGraph } from './links-graph.tsx'
import { colorOrder, inWords, templateColor } from './model.ts'
import { boundsOf, usePanZoom } from './pan-zoom.ts'
import { Legend, NodeCard, Segmented, Toggle, useSelection, ZoomControls } from './parts.tsx'
import { useRelations, useTemplateLook } from './queries.ts'
import relationStyles from './relations.module.css'
import styles from './world-graph.module.css'
import { WorldGraph } from './world-graph.tsx'

/** El grafo de todo el mundo, en la dirección */
export const WORLD_GRAPH = 'mundo'
const DEPTHS = [1, 2, 3] as const
const INSETS = { top: 16, bottom: 76 }

/** Abrir la ventana del grafo: el del mundo (WORLD_GRAPH) o el de una página (su id). null: aquí no hay ventana */
const GraphWindowContext = createContext<((target: string) => void) | null>(null)
export const useGraphWindow = () => useContext(GraphWindowContext)

/** El icono del grafo de todo el mundo, en la cabecera del árbol de páginas: abre su ventana (si aquí la hay) */
export function WorldGraphButton({ className }: { className?: string | undefined }) {
  const { t } = useTranslation()
  const open = useGraphWindow()
  if (!open) return null
  return (
    <button
      type="button"
      className={className}
      aria-label={t('relations.world.open')}
      title={t('relations.world.open')}
      aria-haspopup="dialog"
      onClick={() => open(WORLD_GRAPH)}
      data-tour="relaciones-mundo"
    >
      <Waypoints aria-hidden="true" size={15} />
    </button>
  )
}

/** Lo que va tras la ruta, sin el grafo (o con él) */
function searchWith(searchStr: string, grafo: string | null) {
  const params = new URLSearchParams(searchStr)
  if (grafo) params.set('grafo', grafo)
  else params.delete('grafo')
  const text = params.toString()
  return text ? `?${text}` : ''
}

/**
 * La ventana del grafo de un mundo, para lo que va dentro (las páginas del máster o las de quien juega, con su lectura)
 */
export function GraphWindowProvider({ worldId, children }: { worldId: string; children: ReactNode }) {
  const router = useRouter()
  const location = useRouterState({ select: (state) => state.location })
  const raw = (location.search as Record<string, unknown>).grafo
  const grafo = typeof raw === 'string' && raw ? raw : null
  // Si la abrió esta pestaña (con su entrada en el historial), cerrarla es volver atrás; si llegó así, se quita
  const pushed = useRef(false)
  const open = useCallback(
    (target: string) => {
      pushed.current = !grafo
      const href = `${location.pathname}${searchWith(location.searchStr, target)}`
      if (grafo) router.history.replace(href)
      else router.history.push(href)
    },
    [router, location.pathname, location.searchStr, grafo]
  )
  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false
      router.history.back()
    } else router.history.replace(`${location.pathname}${searchWith(location.searchStr, null)}`)
  }, [router, location.pathname, location.searchStr])
  return (
    <GraphWindowContext.Provider value={open}>
      {children}
      {grafo && <GraphDialog worldId={worldId} target={grafo} onClose={close} onCenter={open} />}
    </GraphWindowContext.Provider>
  )
}

function GraphDialog({
  worldId,
  target,
  onClose,
  onCenter
}: {
  worldId: string
  target: string
  onClose: () => void
  onCenter: (pageId: string) => void
}) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const opener = useRef<Element | null>(null)
  const [title, setTitle] = useState<string | null>(null)
  useEffect(() => {
    opener.current = document.activeElement
    if (!dialog.current?.open) dialog.current?.showModal()
    // El foco, dentro (en su X), como en los demás cuadros
    closeButton.current?.focus({ preventScroll: true })
    return () => {
      if (opener.current instanceof HTMLElement) opener.current.focus({ preventScroll: true })
    }
  }, [])
  const world = target === WORLD_GRAPH
  const heading = world ? t('relations.window.world') : title ? t('relations.graph', { page: title }) : ''
  return (
    <dialog
      ref={dialog}
      className={`${windowStyles.window} ${styles.window}`}
      aria-label={heading || t('relations.window.world')}
      // Escape la cierra quitando el grafo de la dirección (salvo vaciando el buscador, o con la ficha de una página
      // abierta, que se cierra antes); el cierre propio del dialog, igual
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        const target = event.target as HTMLElement
        if (target instanceof HTMLInputElement && target.value) return
        if (dialog.current?.querySelector('[data-node-card]')) return
        onClose()
      }}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <header className={styles.windowHead}>
        <h2>{heading}</h2>
        <button
          ref={closeButton}
          type="button"
          className={windowStyles.close}
          aria-label={t('window.close')}
          onClick={onClose}
        >
          <X aria-hidden="true" size={20} />
        </button>
      </header>
      <div className={styles.windowBody}>
        {world ? (
          <WorldGraph worldId={worldId} />
        ) : (
          <PageGraph key={target} worldId={worldId} pageId={target} onTitle={setTitle} onCenter={onCenter} />
        )}
      </div>
    </dialog>
  )
}

/** El vecindario de una página: su alcance (1 a 3 pasos) y si salen las menciones del texto */
function PageGraph({
  worldId,
  pageId,
  onTitle,
  onCenter
}: {
  worldId: string
  pageId: string
  onTitle: (title: string) => void
  onCenter: (pageId: string) => void
}) {
  const { t } = useTranslation()
  const readAs = useReadAs()
  const openPage = useOpenPage()
  const look = useTemplateLook()
  const [depth, setDepth] = useState<number>(1)
  const [mentions, setMentions] = useState(true)
  const { selected, select, close: closeCard, focusCard } = useSelection()
  const view = useRelations(worldId, pageId, { mode: 'links', depth, fieldsOnly: !mentions })
  const data = view.data?.pageId === pageId ? view.data : null
  const nodes = useMemo(() => data?.nodes ?? [], [data?.nodes])
  const edges = useMemo(() => (data?.edges ?? []) as GraphEdge[], [data?.edges])
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
  const titleOf = useCallback((id: string) => byId.get(id)?.title ?? '', [byId])
  const order = useMemo(() => colorOrder(look.order, nodes), [look.order, nodes])
  const colorOf = useCallback((node: RelationNode) => templateColor(node.template, order), [order])
  const title = byId.get(pageId)?.title
  useEffect(() => {
    if (title) onTitle(title)
  }, [title, onTitle])
  const chosen = selected ? byId.get(selected) : undefined
  const tools = (
    <div className={relationStyles.tools}>
      <Segmented
        label={t('relations.depth')}
        options={DEPTHS}
        value={depth as 1}
        text={(n) => t(`relations.depthOf.${n}` as 'relations.depthOf.1')}
        name={(n) => t(`relations.depthOf.${n}` as 'relations.depthOf.1')}
        onChange={setDepth}
      />
      <Toggle label={t('relations.withMentions')} checked={mentions} onChange={setMentions} />
    </div>
  )
  if (view.isError)
    return (
      <p role="alert" className={relationStyles.nothing}>
        {t('relations.failed')}{' '}
        <button type="button" className={relationStyles.retry} onClick={() => void view.refetch()}>
          {t('load.retry')}
        </button>
      </p>
    )
  if (!data) return <Loading />
  return (
    <div className={styles.pageGraph}>
      {tools}
      <div className={styles.graph} data-tour="grafo-pagina">
        {edges.length === 0 ? (
          <p className={styles.empty}>{t('relations.empty')}</p>
        ) : (
          <Neighbourhood
            label={t('relations.graph', { page: title ?? '' })}
            nodes={nodes}
            edges={edges}
            center={pageId}
            selected={selected}
            colorOf={colorOf}
            onSelect={select}
            onOpen={(id) => openPage(worldId, id)}
          >
            {data.truncated && <p className={relationStyles.notice}>{t('relations.truncated')}</p>}
            {chosen && (
              <NodeCard
                node={chosen}
                color={colorOf(chosen)}
                meta={[look.nameOf(chosen.template), chosen.subtitle].filter(Boolean).join(' · ')}
                rows={inWords(chosen.id, edges, titleOf, t)}
                primary="center"
                onOpen={() => openPage(worldId, chosen.id)}
                onCenter={
                  chosen.id === pageId
                    ? null
                    : () => {
                        closeCard()
                        onCenter(chosen.id)
                      }
                }
                onClose={closeCard}
                autoFocus={focusCard}
              />
            )}
            <Legend secrets={!readAs && edges.some((edge) => edge.secret)} />
          </Neighbourhood>
        )}
      </div>
    </div>
  )
}

/** El grafo de fuerzas con su zoom: se encuadra al llegar; al cambiar el alcance, lo que estaba no salta */
function Neighbourhood({
  label,
  nodes,
  edges,
  center,
  selected,
  colorOf,
  onSelect,
  onOpen,
  children
}: {
  label: string
  nodes: readonly RelationNode[]
  edges: readonly GraphEdge[]
  center: string
  selected: string | null
  colorOf: (node: RelationNode) => string
  onSelect: (id: string | null, viaKeyboard?: boolean) => void
  onOpen: (id: string) => void
  children: ReactNode
}) {
  const [svg, setSvg] = useState<SVGSVGElement | null>(null)
  const { transform, zoomBy, fit, keepFitted } = usePanZoom(svg, { insets: INSETS, minScale: 0.1 })
  const before = useRef<Map<string, Point> | undefined>(undefined)
  const positions = useMemo(() => {
    const placed = forceLayout(
      nodes.map((node) => node.id),
      edges,
      { center, initial: before.current }
    )
    before.current = placed
    return placed
  }, [nodes, edges, center])
  const bounds = useMemo(() => boundsOf(positions.values(), 70), [positions])
  const signature = `${nodes.length}|${edges.length}`
  const fitted = useRef('')
  useEffect(() => {
    if (!svg || !bounds || fitted.current === signature) return
    fitted.current = signature
    fit(bounds, 1.1)
  }, [svg, bounds, signature, fit])
  useEffect(() => keepFitted(bounds, 1.1), [keepFitted, bounds])
  return (
    <>
      <LinksGraph
        label={label}
        svgRef={setSvg}
        nodes={nodes}
        edges={edges}
        positions={positions}
        center={center}
        selected={selected}
        highlight={null}
        colorOf={colorOf}
        transform={transform}
        labels="center"
        onSelect={onSelect}
        onOpen={onOpen}
      />
      {children}
      <ZoomControls scale={transform.k} onZoom={zoomBy} onFit={() => fit(bounds)} />
    </>
  )
}
