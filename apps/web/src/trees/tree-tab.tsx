/**
 * La pestaña «Árbol genealógico» (u «Organigrama») de una página (bloque B de los ajustes tras los módulos 8 a 10): a
 * sangre como el mapa, con las tarjetas de Familia y Organigrama (relations/). Cada nodo es una página del mundo o solo
 * un nombre (con la raya discontinua), que se convierte en página cuando haga falta. Pulsar un nodo lo elige (su ficha,
 * arriba a la derecha): desde ella se añade su padre o su madre, su pareja o sus hijos (en el organigrama, sus miembros
 * o quien lo dirige), se abre su página, se crea la de uno suelto, se le cambia el nombre o se quita. El doble clic abre
 * su página. Vacío, una sola pieza en el centro (y «Empezar desde los campos» si la página tiene campos con papel).
 * Quien juega lo ve con lo que conoce, sin editar
 */
import type { Page, PageTabView, RelationEdge, TreeEdgeView, TreeNodeView, TreeView } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, FilePlus2, ListPlus, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import dialogStyles from '../components/dialog.module.css'
import { EmptyState } from '../components/empty-state.tsx'
import form from '../components/form.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { Modal } from '../components/modal.tsx'
import { Tour } from '../components/tour.tsx'
import { NodeGlyphBox } from '../relations/glyph.tsx'
import { colorOrder, templateColor } from '../relations/model.ts'
import { boundsOf, usePanZoom } from '../relations/pan-zoom.ts'
import { useSelection, ZoomControls } from '../relations/parts.tsx'
import { useRelationModes, useTemplateLook } from '../relations/queries.ts'
import relationStyles from '../relations/relations.module.css'
import { TreeView as Cards } from '../relations/tree-view.tsx'
import { readAsInput, readAsKey, useOpenPage, useReadAs } from '../wiki/read-as.tsx'
import { TabToolsSlot } from '../wiki/world-page.ts'
import { treeTabLayout } from './layout.ts'
import styles from './trees.module.css'

/** Lo que cuelga de ['pages', mundo]: se pone al día con los avisos de páginas */
export const treeKey = (worldId: string, tabId: string) => ['pages', worldId, 'tree', tabId]

/** Lo que se añade desde un nodo (o el primero, en un árbol vacío) */
type AddKind = 'first' | 'parent' | 'partner' | 'child' | 'member' | 'leader'

const shortId = () => crypto.randomUUID().slice(0, 8)

/** Un nodo como los de las relaciones (lo que pintan las tarjetas): su nombre, su icono, su plantilla y su nota */
const asCard = (node: TreeNodeView) => ({
  id: node.id,
  title: node.name,
  icon: node.icon,
  template: node.template,
  ...(node.note ? { subtitle: node.note } : {})
})

/** Las líneas nuevas al añadir a target desde source (al hijo de alguien con una sola pareja, la pareja también) */
export function edgesFor(kind: AddKind, source: string | null, target: string, edges: readonly TreeEdgeView[]) {
  if (!source || kind === 'first') return []
  if (kind === 'parent') return [{ from: target, to: source, type: 'parent' as const }]
  if (kind === 'partner') return [{ from: source, to: target, type: 'partner' as const }]
  if (kind === 'member') return [{ from: target, to: source, type: 'member' as const }]
  if (kind === 'leader') return [{ from: target, to: source, type: 'leads' as const }]
  const partners = edges
    .filter((edge) => edge.type === 'partner' && (edge.from === source || edge.to === source))
    .map((edge) => (edge.from === source ? edge.to : edge.from))
  return [
    { from: source, to: target, type: 'parent' as const },
    ...(partners.length === 1 && partners[0] !== target
      ? [{ from: partners[0] as string, to: target, type: 'parent' as const }]
      : [])
  ]
}

/** Un árbol a partir de las relaciones con papel de la página (sus campos): los nodos, sus páginas */
export function treeFromRelations(
  nodes: readonly { id: string; title: string }[],
  edges: readonly Pick<RelationEdge, 'source' | 'target' | 'role'>[]
) {
  const ids = new Map(nodes.map((node) => [node.id, shortId()]))
  const out: TreeEdgeView[] = []
  const add = (edge: TreeEdgeView) => {
    const same = out.some(
      (other) =>
        other.type === edge.type &&
        ((other.from === edge.from && other.to === edge.to) ||
          (edge.type === 'partner' && other.from === edge.to && other.to === edge.from))
    )
    if (!same && edge.from !== edge.to) out.push(edge)
  }
  for (const edge of edges) {
    const source = ids.get(edge.source)
    const target = ids.get(edge.target)
    if (!source || !target) continue
    if (edge.role === 'parent') add({ from: target, to: source, type: 'parent' })
    else if (edge.role === 'partner') add({ from: source, to: target, type: 'partner' })
    else if (edge.role === 'member-of') add({ from: source, to: target, type: 'member' })
    else if (edge.role === 'leads') add({ from: target, to: source, type: 'leads' })
  }
  return {
    nodes: nodes.map((node) => ({ id: ids.get(node.id) as string, pageId: node.id, name: node.title })),
    edges: out
  }
}

export function TreeTab({ page, tab, editable }: { page: Page; tab: PageTabView; editable: boolean }) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const readAs = useReadAs()
  const openPage = useOpenPage()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const look = useTemplateLook()
  const slot = useContext(TabToolsSlot)
  const key = [...treeKey(page.worldId, tab.id), ...readAsKey(readAs)]
  const tree = useQuery({
    queryKey: key,
    queryFn: () => api.call('getTree', { tabId: tab.id, ...readAsInput(readAs) })
  })
  const canEdit = editable && !readAs && !page.locked
  const { selected, select, close: closeCard, focusCard } = useSelection()
  const [adding, setAdding] = useState<{ kind: AddKind; from: string | null } | null>(null)
  const [renaming, setRenaming] = useState<TreeNodeView | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: (next: Pick<TreeView, 'nodes' | 'edges'>) =>
      api.call('updateTree', {
        tabId: tab.id,
        nodes: next.nodes.map((node) => ({
          id: node.id,
          pageId: node.pageId,
          name: node.name,
          ...(node.note ? { note: node.note } : {})
        })),
        edges: next.edges
      }),
    // Se ve ya, sin esperar al servidor
    onMutate: (next) => {
      setFailure(null)
      const before = client.getQueryData<TreeView>(key)
      client.setQueryData<TreeView>(key, (current) => (current ? { ...current, ...next } : current))
      return { before }
    },
    onError: (error, _next, context) => {
      if (context?.before) client.setQueryData(key, context.before)
      const text = errorText(error)
      setFailure(text)
      announce(text)
    },
    onSuccess: (saved) => client.setQueryData(key, saved)
  })
  const convert = useMutation({
    mutationFn: (nodeId: string) => api.call('convertTreeNodeToPage', { tabId: tab.id, nodeId }),
    onSuccess: ({ tree: saved }, nodeId) => {
      client.setQueryData(key, saved)
      void client.invalidateQueries({ queryKey: ['pages', page.worldId] })
      announce(t('trees.converted', { name: saved.nodes.find((node) => node.id === nodeId)?.name ?? '' }))
    },
    onError: (error) => setFailure(errorText(error))
  })

  const data = tree.data
  const nodes = useMemo(() => data?.nodes ?? [], [data?.nodes])
  const edges = useMemo(() => data?.edges ?? [], [data?.edges])
  const layout = data?.layout ?? 'family'
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, asCard(node)])), [nodes])
  const loose = useMemo(() => new Set(nodes.filter((node) => !node.pageId).map((node) => node.id)), [nodes])
  const order = useMemo(() => colorOrder(look.order, nodes), [look.order, nodes])
  const colorOf = useCallback((node: { template: string | null }) => templateColor(node.template, order), [order])
  const placed = useMemo(() => treeTabLayout(layout, nodes, edges), [layout, nodes, edges])
  // La de la página del árbol, marcada (si está)
  const center = nodes.find((node) => node.pageId === page.id)?.id ?? ''
  const chosen = selected ? nodes.find((node) => node.id === selected) : undefined

  const remove = (node: TreeNodeView) => {
    closeCard()
    save.mutate({
      nodes: nodes.filter((each) => each.id !== node.id),
      edges: edges.filter((edge) => edge.from !== node.id && edge.to !== node.id)
    })
    announce(t('trees.removed', { name: node.name }))
  }
  const removeEdge = (edge: TreeEdgeView) => save.mutate({ nodes, edges: edges.filter((each) => each !== edge) })

  const tools = canEdit && nodes.length > 0 && (
    <div className={relationStyles.tools}>
      <button
        type="button"
        className={styles.toolButton}
        onClick={() => setAdding({ kind: 'first', from: null })}
        data-tour="arbol-anadir"
      >
        <Plus size={16} aria-hidden="true" />
        {t('trees.add')}
      </button>
    </div>
  )

  if (!data) return failed(tree) ? <LoadError error={tree.error} onRetry={() => tree.refetch()} /> : <Loading />
  const label = t(layout === 'org' ? 'trees.labelOrg' : 'trees.label', { name: tab.name })

  return (
    // Una sola caja: los cuadros de añadir y de editar van dentro (como hijos directos de la página a sangre, se estiraban)
    <div className={styles.tab}>
      {tools && (slot ? createPortal(tools, slot) : <div className={relationStyles.toolsRow}>{tools}</div>)}
      <div className={relationStyles.area} data-tour="arbol">
        {failure && (
          <p className={styles.failure} role="alert">
            {failure}
            <button
              type="button"
              className={relationStyles.close}
              aria-label={t('trees.closeFailure')}
              onClick={() => setFailure(null)}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </p>
        )}
        {nodes.length === 0 ? (
          <Empty
            page={page}
            layout={layout}
            canEdit={canEdit}
            onAdd={() => setAdding({ kind: 'first', from: null })}
            onFromFields={(next) => save.mutate(next)}
          />
        ) : (
          <Canvas
            label={label}
            layout={placed}
            nodes={byId}
            loose={loose}
            center={center}
            selected={selected}
            colorOf={colorOf}
            onSelect={select}
            onOpen={(id) => {
              const pageId = nodes.find((node) => node.id === id)?.pageId
              if (pageId) openPage(page.worldId, pageId)
            }}
          >
            {chosen && (
              <NodeCard
                node={chosen}
                layout={layout}
                nodes={nodes}
                edges={edges}
                color={colorOf(chosen)}
                canEdit={canEdit}
                autoFocus={focusCard}
                onClose={closeCard}
                onOpen={chosen.pageId ? () => openPage(page.worldId, chosen.pageId as string) : null}
                onAdd={(kind) => setAdding({ kind, from: chosen.id })}
                onConvert={() => convert.mutate(chosen.id)}
                converting={convert.isPending}
                onRename={() => setRenaming(chosen)}
                onRemove={() => remove(chosen)}
                onRemoveEdge={removeEdge}
              />
            )}
          </Canvas>
        )}
      </div>
      {adding && (
        <AddDialog
          worldId={page.worldId}
          kind={adding.kind}
          from={adding.from ? (nodes.find((node) => node.id === adding.from) ?? null) : null}
          nodes={nodes}
          onClose={() => setAdding(null)}
          onPick={(pick) => {
            const existing = pick.nodeId ? nodes.find((node) => node.id === pick.nodeId) : undefined
            const id = existing?.id ?? shortId()
            const added: TreeNodeView[] = existing
              ? []
              : [{ id, pageId: pick.pageId ?? null, name: pick.name, icon: null, template: null }]
            const extra = edgesFor(adding.kind, adding.from, id, edges).filter(
              (edge) =>
                !edges.some((other) => other.from === edge.from && other.to === edge.to && other.type === edge.type)
            )
            save.mutate({ nodes: [...nodes, ...added], edges: [...edges, ...extra] })
            announce(t('trees.added', { name: pick.name }))
            setAdding(null)
            // Su ficha, con el foco (el botón que abrió el cuadro era de la ficha de antes)
            select(id, true)
          }}
        />
      )}
      {renaming && (
        <RenameDialog
          node={renaming}
          onClose={() => setRenaming(null)}
          onSave={(name, note) => {
            save.mutate({
              nodes: nodes.map((node) =>
                node.id === renaming.id
                  ? { ...node, ...(node.pageId ? {} : { name }), ...(note ? { note } : { note: undefined }) }
                  : node
              ),
              edges
            })
            setRenaming(null)
          }}
        />
      )}
      <Tour
        id={canEdit ? 'arbol' : 'arbol-lectura'}
        steps={[
          { target: '[data-tour="arbol"]', text: t(canEdit ? 'tour.tree.cards' : 'tour.tree.read') },
          ...(tools ? [{ target: '[data-tour="arbol-anadir"]', text: t('tour.tree.add') }] : [])
        ]}
      />
    </div>
  )
}

/** Las tarjetas con su zoom: se encuadran al llegar y al cambiar lo que hay */
function Canvas({
  label,
  layout,
  nodes,
  loose,
  center,
  selected,
  colorOf,
  onSelect,
  onOpen,
  children
}: {
  label: string
  layout: ReturnType<typeof treeTabLayout>
  nodes: ReadonlyMap<string, ReturnType<typeof asCard>>
  loose: ReadonlySet<string>
  center: string
  selected: string | null
  colorOf: (node: { template: string | null }) => string
  onSelect: (id: string | null, viaKeyboard?: boolean) => void
  onOpen: (id: string) => void
  children: ReactNode
}) {
  const [svg, setSvg] = useState<SVGSVGElement | null>(null)
  const { transform, zoomBy, fit, keepFitted } = usePanZoom(svg, { insets: { top: 16, bottom: 76 }, minScale: 0.3 })
  const bounds = useMemo(() => {
    if (layout.cards.length === 0) return null
    return boundsOf(
      layout.cards.flatMap((card) => [
        { x: card.x - card.width / 2, y: card.y - card.height / 2 },
        { x: card.x + card.width / 2, y: card.y + card.height / 2 }
      ]),
      30
    )
  }, [layout])
  // Se encuadra al llegar y al cambiar cuántas tarjetas hay (no al mover la vista)
  const signature = `${layout.cards.length}|${layout.wires.length}`
  const fitted = useRef('')
  useEffect(() => {
    if (!svg || !bounds || fitted.current === signature) return
    fitted.current = signature
    fit(bounds, 1.1)
  }, [svg, bounds, signature, fit])
  useEffect(() => keepFitted(bounds, 1.1), [keepFitted, bounds])
  return (
    <>
      <Cards
        label={label}
        svgRef={setSvg}
        layout={layout}
        nodes={nodes}
        loose={loose}
        center={center}
        selected={selected}
        colorOf={colorOf}
        transform={transform}
        onSelect={onSelect}
        onOpen={onOpen}
      />
      {children}
      <ZoomControls scale={transform.k} onZoom={zoomBy} onFit={() => fit(bounds)} />
    </>
  )
}

/** Vacío: una sola pieza en el centro; con campos con papel en la página, también empezar desde ellos */
function Empty({
  page,
  layout,
  canEdit,
  onAdd,
  onFromFields
}: {
  page: Page
  layout: 'family' | 'org'
  canEdit: boolean
  onAdd: () => void
  onFromFields: (tree: Pick<TreeView, 'nodes' | 'edges'>) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const modes = useRelationModes(page.worldId, page.id, canEdit)
  const mode = layout === 'org' ? 'org' : 'family'
  const fromFields = useMutation({
    mutationFn: () => api.call('getRelations', { pageId: page.id, mode, depth: 1 }),
    onSuccess: (result) => {
      const built = treeFromRelations(result.nodes, result.edges)
      onFromFields({
        nodes: built.nodes.map((node) => ({ ...node, icon: null, template: null })),
        edges: built.edges
      })
    }
  })
  if (!canEdit) return <p className={styles.emptyRead}>{t('trees.emptyRead')}</p>
  return (
    <div className={styles.empty}>
      <EmptyState
        kind="capitulos"
        action={
          <div className={styles.emptyActions}>
            <button type="button" className={styles.emptyButton} onClick={onAdd} data-tour="arbol-vacio">
              <Plus size={20} aria-hidden="true" />
              {t(layout === 'org' ? 'trees.firstOrg' : 'trees.first')}
            </button>
            {modes.includes(mode) && (
              <BusyButton className={styles.fromFields} busy={fromFields.isPending} onClick={() => fromFields.mutate()}>
                <ListPlus size={16} aria-hidden="true" />
                {t('trees.fromFields')}
              </BusyButton>
            )}
          </div>
        }
      >
        <p>{t(layout === 'org' ? 'trees.emptyOrg' : 'trees.empty')}</p>
      </EmptyState>
    </div>
  )
}

/** La ficha del nodo elegido: su página, sus líneas y lo que se hace con él */
function NodeCard({
  node,
  layout,
  nodes,
  edges,
  color,
  canEdit,
  autoFocus,
  onClose,
  onOpen,
  onAdd,
  onConvert,
  converting,
  onRename,
  onRemove,
  onRemoveEdge
}: {
  node: TreeNodeView
  layout: 'family' | 'org'
  nodes: readonly TreeNodeView[]
  edges: readonly TreeEdgeView[]
  color: string
  canEdit: boolean
  autoFocus: boolean
  onClose: () => void
  onOpen: (() => void) | null
  onAdd: (kind: AddKind) => void
  onConvert: () => void
  converting: boolean
  onRename: () => void
  onRemove: () => void
  onRemoveEdge: (edge: TreeEdgeView) => void
}) {
  const { t } = useTranslation()
  const box = useRef<HTMLElement>(null)
  useEffect(() => {
    if (autoFocus) box.current?.focus({ preventScroll: true })
  }, [autoFocus])
  const nameOf = (id: string) => nodes.find((each) => each.id === id)?.name ?? ''
  // Sus líneas, leídas desde él: «Padre o madre de Ilsa», «Pareja de Varn», «Dirige La Orden»…
  const lines = edges
    .filter((edge) => edge.from === node.id || edge.to === node.id)
    .map((edge) => {
      const mine = edge.from === node.id
      const other = nameOf(mine ? edge.to : edge.from)
      const text =
        edge.type === 'partner'
          ? t('trees.lines.partner', { name: other })
          : t(`trees.lines.${edge.type}${mine ? '' : 'Of'}` as 'trees.lines.parent', { name: other })
      return { edge, text }
    })
  const adds: AddKind[] = layout === 'org' ? ['member', 'leader'] : ['parent', 'partner', 'child']
  return (
    <section
      ref={box}
      tabIndex={-1}
      className={relationStyles.card}
      aria-label={node.name}
      style={{ '--node-color': color } as CSSProperties}
    >
      <header className={relationStyles.cardHead}>
        <NodeGlyphBox node={asCard(node)} />
        <div>
          <h3>{node.name}</h3>
          <p>{node.pageId ? (node.note ?? '') : [t('trees.noPage'), node.note].filter(Boolean).join(' · ')}</p>
        </div>
        <button
          type="button"
          className={relationStyles.close}
          aria-label={t('trees.closeCard')}
          title={t('trees.closeCard')}
          onClick={onClose}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      {lines.length > 0 && (
        <ul className={styles.lines} aria-label={t('trees.linesLabel')}>
          {lines.map(({ edge, text }) => (
            <li key={`${edge.from}-${edge.to}-${edge.type}`}>
              <span>{text}</span>
              {canEdit && (
                <button
                  type="button"
                  className={relationStyles.close}
                  aria-label={t('trees.removeLine', { line: text })}
                  title={t('trees.removeLine', { line: text })}
                  onClick={() => onRemoveEdge(edge)}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        // biome-ignore lint/a11y/useSemanticElements: un grupo de botones que añaden, no un formulario
        <div className={styles.adds} role="group" aria-label={t('trees.addLabel', { name: node.name })}>
          {adds.map((kind) => (
            <button key={kind} type="button" onClick={() => onAdd(kind)}>
              <Plus size={14} aria-hidden="true" />
              {t(`trees.adds.${kind}` as 'trees.adds.parent')}
            </button>
          ))}
        </div>
      )}
      <div className={relationStyles.cardActions}>
        {onOpen && (
          <button type="button" className={relationStyles.primary} onClick={onOpen}>
            <ExternalLink size={16} aria-hidden="true" />
            {t('trees.open')}
          </button>
        )}
        {canEdit && !node.pageId && (
          <BusyButton className={relationStyles.primary} busy={converting} onClick={onConvert}>
            <FilePlus2 size={16} aria-hidden="true" />
            {t('trees.createPage')}
          </BusyButton>
        )}
        {canEdit && (
          <>
            <button type="button" className={relationStyles.secondary} onClick={onRename}>
              <Pencil size={14} aria-hidden="true" />
              {node.pageId ? t('trees.note') : t('trees.rename')}
            </button>
            <button type="button" className={`${relationStyles.secondary} ${styles.danger}`} onClick={onRemove}>
              <Trash2 size={14} aria-hidden="true" />
              {t('trees.remove')}
            </button>
          </>
        )}
      </div>
    </section>
  )
}

/**
 * Añadir a alguien: se escribe su nombre y se elige una página del mundo (o alguien que ya está en el árbol, para unirlo
 * con una línea) o se añade solo con su nombre
 */
function AddDialog({
  worldId,
  kind,
  from,
  nodes,
  onClose,
  onPick
}: {
  worldId: string
  kind: AddKind
  from: TreeNodeView | null
  nodes: readonly TreeNodeView[]
  onClose: () => void
  onPick: (pick: { nodeId?: string; pageId?: string; name: string }) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const names = useQuery({
    queryKey: ['pages', worldId, 'names'],
    queryFn: () => api.call('listPageNames', { worldId })
  })
  const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es')
  const wanted = fold(query.trim())
  const inTree = new Set(nodes.flatMap((node) => (node.pageId ? [node.pageId] : [])))
  const options = useMemo(() => {
    const here = nodes
      .filter((node) => node.id !== from?.id && (!wanted || fold(node.name).includes(wanted)))
      .slice(0, 5)
      .map((node) => ({ key: `n:${node.id}`, nodeId: node.id, name: node.name, hint: t('trees.inTree') }))
    const pages = (names.data?.pages ?? [])
      .filter((page) => !inTree.has(page.id) && wanted && fold(page.title).includes(wanted))
      .slice(0, 8)
      .map((page) => ({
        key: `p:${page.id}`,
        pageId: page.id,
        name: page.title,
        hint: page.path.slice(0, -1).join(' › ')
      }))
    return [...(kind === 'first' ? [] : here), ...pages]
  }, [nodes, names.data, wanted, from?.id, kind, inTree, t])
  const loose = query.trim()
  const all = [...options, ...(loose ? [{ key: 'loose', name: loose, hint: t('trees.withoutPage') }] : [])]
  const choose = (option: (typeof all)[number] | undefined) => {
    if (!option) return
    onPick({
      ...('nodeId' in option && option.nodeId ? { nodeId: option.nodeId } : {}),
      ...('pageId' in option && option.pageId ? { pageId: option.pageId } : {}),
      name: option.name
    })
    dialog.current?.close()
  }
  const title = from
    ? t(`trees.addTitle.${kind}` as 'trees.addTitle.parent', { name: from.name })
    : t('trees.addTitle.first')
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={dialogStyles.dialog} onClose={onClose}>
      <form
        className={dialogStyles.body}
        onSubmit={(event) => {
          event.preventDefault()
          choose(all[active])
        }}
      >
        <h2 id={titleId}>{title}</h2>
        <div className={form.field}>
          <input
            role="combobox"
            aria-expanded={all.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={all[active] ? `${listId}-${active}` : undefined}
            aria-label={t('trees.search')}
            placeholder={t('trees.search')}
            value={query}
            maxLength={200}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-autofocus=""
            onChange={(event) => {
              setQuery(event.currentTarget.value)
              setActive(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActive((active + 1) % Math.max(1, all.length))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((active - 1 + all.length) % Math.max(1, all.length))
              }
            }}
          />
        </div>
        {all.length > 0 && (
          <div id={listId} role="listbox" className={styles.options} aria-label={t('trees.search')}>
            {all.map((option, index) => (
              <div
                key={option.key}
                id={`${listId}-${index}`}
                role="option"
                tabIndex={-1}
                aria-selected={index === active}
                data-loose={option.key === 'loose' || undefined}
                onPointerDown={(event) => {
                  event.preventDefault()
                  choose(option)
                }}
                onPointerEnter={() => setActive(index)}
              >
                <span>{option.key === 'loose' ? t('trees.addLoose', { name: option.name }) : option.name}</span>
                {option.key !== 'loose' && <small>{option.hint}</small>}
              </div>
            ))}
          </div>
        )}
        <div className={dialogStyles.actions}>
          <button type="submit" className={form.button} disabled={all.length === 0}>
            {t('trees.addSubmit')}
          </button>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('trees.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Cambiar el nombre de un nodo suelto (o la línea bajo el nombre de uno con página) */
function RenameDialog({
  node,
  onClose,
  onSave
}: {
  node: TreeNodeView
  onClose: () => void
  onSave: (name: string, note: string) => void
}) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const id = useId()
  const [name, setName] = useState(node.name)
  const [note, setNote] = useState(node.note ?? '')
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={dialogStyles.dialog} onClose={onClose}>
      <form
        className={dialogStyles.body}
        onSubmit={(event) => {
          event.preventDefault()
          if (!node.pageId && !name.trim()) return
          onSave(name.trim(), note.trim())
          dialog.current?.close()
        }}
      >
        <h2 id={titleId}>{node.name}</h2>
        {!node.pageId && (
          <div className={form.field}>
            <label htmlFor={`${id}-name`}>{t('trees.name')}</label>
            <input
              id={`${id}-name`}
              value={name}
              maxLength={200}
              required
              data-autofocus=""
              autoComplete="off"
              data-1p-ignore
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </div>
        )}
        <div className={form.field}>
          <label htmlFor={`${id}-note`}>{t('trees.noteLabel')}</label>
          <input
            id={`${id}-note`}
            value={note}
            maxLength={300}
            placeholder={t('trees.notePlaceholder')}
            data-autofocus={node.pageId ? '' : undefined}
            autoComplete="off"
            data-1p-ignore
            onChange={(event) => setNote(event.currentTarget.value)}
          />
        </div>
        <div className={dialogStyles.actions}>
          <button type="submit" className={form.button}>
            {t('trees.save')}
          </button>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('trees.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
