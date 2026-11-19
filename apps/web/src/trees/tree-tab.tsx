/**
 * La pestaña «Árbol» de una página (bloque B de los ajustes tras los módulos 8 a 10, como la genealogía de Everlore): a
 * sangre como el mapa, con las tarjetas de Familia (relations/). Un solo árbol para todo (un organigrama es un árbol con
 * «dirige» y «miembro de»): cada línea se pone a mano y de un tipo que no es fijo (padre o madre, pareja, hijastro,
 * adopción, expareja, hermanos, dirige, miembro u otra con su nombre); no se deduce ninguna. Cada nodo es una página del
 * mundo o solo un nombre (con la raya discontinua), que se convierte en página cuando haga falta. Pulsar un nodo lo
 * elige (su ficha, arriba a la derecha): desde ella se le añade alguien con su relación, se abre su página, se crea la de
 * uno suelto, se le cambia el nombre o se quita. El doble clic abre su página. «Añadir al árbol» (suelta, sin línea), en
 * la píldora de abajo en el centro, como el «+» de la cronología. Vacío, una sola pieza en el centro (y «Empezar desde
 * los campos» si la página tiene campos con papel). Quien juega lo ve con lo que conoce, sin editar
 */
import type { Page, PageTabView, RelationEdge, TreeEdgeView, TreeNodeView, TreeView } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { ExternalLink, FilePlus2, ListPlus, Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react'
import { type CSSProperties, type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
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
import { treeTabLayout } from './layout.ts'
import styles from './trees.module.css'

/** Lo que cuelga de ['pages', mundo]: se pone al día con los avisos de páginas */
export const treeKey = (worldId: string, tabId: string) => ['pages', worldId, 'tree', tabId]

/** Lo que se añade desde un nodo: la relación del nuevo con él (en el orden del desplegable) */
export const ADD_KINDS = [
  'parent',
  'child',
  'partner',
  'ex-partner',
  'sibling',
  'stepparent',
  'stepchild',
  'adopter',
  'adopted',
  'leader',
  'led',
  'member',
  'group',
  'other'
] as const
export type AddKind = (typeof ADD_KINDS)[number]
/** Las de un clic en la ficha del nodo; las demás, en «Otra relación» */
const QUICK_ADDS: readonly AddKind[] = ['parent', 'partner', 'child']

/** Una relación libre: su nombre y dónde va el nuevo respecto al nodo */
export interface CustomRelation {
  label: string
  place: 'above' | 'below' | 'beside'
}

const shortId = () => crypto.randomUUID().slice(0, 8)

/** Un nodo como los de las relaciones (lo que pintan las tarjetas): su nombre, su icono, su plantilla y su nota */
const asCard = (node: TreeNodeView) => ({
  id: node.id,
  title: node.name,
  icon: node.icon,
  template: node.template,
  ...(node.note ? { subtitle: node.note } : {})
})

/**
 * La línea nueva al añadir a added junto a node, con su relación: solo esa (no se deduce nada, como en Everlore: el hijo
 * de una pareja no lo es de los dos hasta que se dice)
 */
export function edgeFor(kind: AddKind, node: string, added: string, custom?: CustomRelation): TreeEdgeView {
  switch (kind) {
    case 'parent':
      return { from: added, to: node, type: 'parent' }
    case 'child':
      return { from: node, to: added, type: 'parent' }
    case 'partner':
    case 'ex-partner':
    case 'sibling':
      return { from: node, to: added, type: kind }
    case 'stepparent':
      return { from: added, to: node, type: 'stepparent' }
    case 'stepchild':
      return { from: node, to: added, type: 'stepparent' }
    case 'adopter':
      return { from: added, to: node, type: 'adoptive' }
    case 'adopted':
      return { from: node, to: added, type: 'adoptive' }
    case 'leader':
      return { from: added, to: node, type: 'leads' }
    case 'led':
      return { from: node, to: added, type: 'leads' }
    case 'member':
      return { from: added, to: node, type: 'member' }
    case 'group':
      return { from: node, to: added, type: 'member' }
    case 'other': {
      const label = custom?.label.trim() ?? ''
      if (custom?.place === 'beside') return { from: node, to: added, type: 'other', label, beside: true }
      return custom?.place === 'below'
        ? { from: node, to: added, type: 'other', label }
        : { from: added, to: node, type: 'other', label }
    }
  }
}

/** Si dos líneas son la misma (las de lado, en los dos sentidos; las libres, por su nombre) */
const sameLine = (a: TreeEdgeView, b: TreeEdgeView) =>
  a.type === b.type &&
  (a.type !== 'other' || (a.label ?? '').toLowerCase() === (b.label ?? '').toLowerCase()) &&
  ((a.from === b.from && a.to === b.to) ||
    ((['partner', 'ex-partner', 'sibling'].includes(a.type) || (a.type === 'other' && a.beside)) &&
      a.from === b.to &&
      a.to === b.from))

/** Una línea leída desde un nodo: «Padre o madre de Ilsa», «Hijastra de Varn», «Padrino de Doran»… */
export function lineText(t: TFunction, edge: TreeEdgeView, mine: boolean, name: string) {
  if (edge.type === 'other') {
    const label = edge.label ?? ''
    return mine || edge.beside
      ? t('trees.lines.other', { label, name })
      : t('trees.lines.otherOf', { label: label.toLocaleLowerCase('es'), name })
  }
  if (edge.type === 'partner' || edge.type === 'ex-partner' || edge.type === 'sibling')
    return t(`trees.lines.${edge.type}` as 'trees.lines.partner', { name })
  return t(`trees.lines.${edge.type}${mine ? '' : 'Of'}` as 'trees.lines.parent', { name })
}

/** El nombre que va junto a una línea en el dibujo (las de sangre y pareja, y «miembro de», sin nombre) */
const wireLabel = (t: TFunction) => (edge: TreeEdgeView) =>
  edge.type === 'parent' || edge.type === 'partner' || edge.type === 'member'
    ? null
    : edge.type === 'other'
      ? (edge.label ?? null)
      : t(`trees.wires.${edge.type}` as 'trees.wires.leads')

/** Un árbol a partir de las relaciones con papel de la página (sus campos de familia y de organización): sus páginas */
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
  const key = [...treeKey(page.worldId, tab.id), ...readAsKey(readAs)]
  const tree = useQuery({
    queryKey: key,
    queryFn: () => api.call('getTree', { tabId: tab.id, ...readAsInput(readAs) })
  })
  const canEdit = editable && !readAs && !page.locked
  const { selected, select, close: closeCard, focusCard } = useSelection()
  /** Añadir: suelto (from null) o junto a un nodo, con la relación que se elija (kind, la de partida) */
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
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, asCard(node)])), [nodes])
  const loose = useMemo(() => new Set(nodes.filter((node) => !node.pageId).map((node) => node.id)), [nodes])
  const order = useMemo(() => colorOrder(look.order, nodes), [look.order, nodes])
  const colorOf = useCallback((node: { template: string | null }) => templateColor(node.template, order), [order])
  const placed = useMemo(() => treeTabLayout(nodes, edges, wireLabel(t)), [nodes, edges, t])
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

  // «Añadir al árbol», abajo en el centro como el «+» de la cronología (suelta: sus líneas, desde su ficha)
  const pill = canEdit && nodes.length > 0 && (
    <div className={relationStyles.pill}>
      <button
        type="button"
        className={styles.addPerson}
        onClick={() => setAdding({ kind: 'child', from: null })}
        data-tour="arbol-anadir"
      >
        <UserPlus size={16} aria-hidden="true" />
        {t('trees.add')}
      </button>
    </div>
  )

  if (!data) return failed(tree) ? <LoadError error={tree.error} onRetry={() => tree.refetch()} /> : <Loading />
  const label = t('trees.label', { name: tab.name })

  return (
    // Una sola caja: los cuadros de añadir y de editar van dentro (como hijos directos de la página a sangre, se estiraban)
    <div className={styles.tab}>
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
            canEdit={canEdit}
            onAdd={() => setAdding({ kind: 'child', from: null })}
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
        {pill}
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
            const line = adding.from ? edgeFor(pick.kind, adding.from, id, pick.custom) : null
            const extra = line && !edges.some((other) => sameLine(other, line)) ? [line] : []
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
          ...(pill ? [{ target: '[data-tour="arbol-anadir"]', text: t('tour.tree.add') }] : [])
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
  canEdit,
  onAdd,
  onFromFields
}: {
  page: Page
  canEdit: boolean
  onAdd: () => void
  onFromFields: (tree: Pick<TreeView, 'nodes' | 'edges'>) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const modes = useRelationModes(page.worldId, page.id, canEdit)
  // Sus campos de familia y de organización, juntos
  const wanted = (['family', 'org'] as const).filter((mode) => modes.includes(mode))
  const fromFields = useMutation({
    mutationFn: async () => {
      const results = await Promise.all(
        wanted.map((mode) => api.call('getRelations', { pageId: page.id, mode, depth: 1 }))
      )
      const nodes = new Map(results.flatMap((result) => result.nodes).map((node) => [node.id, node]))
      return { nodes: [...nodes.values()], edges: results.flatMap((result) => result.edges) }
    },
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
              {t('trees.first')}
            </button>
            {wanted.length > 0 && (
              <BusyButton className={styles.fromFields} busy={fromFields.isPending} onClick={() => fromFields.mutate()}>
                <ListPlus size={16} aria-hidden="true" />
                {t('trees.fromFields')}
              </BusyButton>
            )}
          </div>
        }
      >
        <p>{t('trees.empty')}</p>
      </EmptyState>
    </div>
  )
}

/** La ficha del nodo elegido: su página, sus líneas y lo que se hace con él */
function NodeCard({
  node,
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
      return { edge, text: lineText(t, edge, mine, nameOf(mine ? edge.to : edge.from)) }
    })
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
            <li key={`${edge.from}-${edge.to}-${edge.type}-${edge.label ?? ''}`}>
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
          {QUICK_ADDS.map((kind) => (
            <button key={kind} type="button" onClick={() => onAdd(kind)}>
              <Plus size={14} aria-hidden="true" />
              {t(`trees.adds.${kind}` as 'trees.adds.parent')}
            </button>
          ))}
          <button type="button" onClick={() => onAdd('other')}>
            <Plus size={14} aria-hidden="true" />
            {t('trees.adds.more')}
          </button>
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
 * Añadir a alguien: junto a un nodo, primero su relación con él (un desplegable con todas; «Otra», con su nombre y dónde
 * va); luego se escribe su nombre y se elige una página del mundo (o alguien que ya está en el árbol, para unirlo con esa
 * línea) o se añade solo con su nombre. Sin nodo («Añadir al árbol»), solo el buscador
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
  onPick: (pick: {
    nodeId?: string
    pageId?: string
    name: string
    kind: AddKind
    custom?: CustomRelation | undefined
  }) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const listId = useId()
  const fieldId = useId()
  const [relation, setRelation] = useState<AddKind>(kind)
  const [custom, setCustom] = useState<CustomRelation>({ label: '', place: 'above' })
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
    return [...(from ? here : []), ...pages]
  }, [nodes, names.data, wanted, from, inTree, t])
  const loose = query.trim()
  const all = [...options, ...(loose ? [{ key: 'loose', name: loose, hint: t('trees.withoutPage') }] : [])]
  // Una libre necesita su nombre
  const ready = !from || relation !== 'other' || custom.label.trim() !== ''
  const choose = (option: (typeof all)[number] | undefined) => {
    if (!option || !ready) return
    onPick({
      ...('nodeId' in option && option.nodeId ? { nodeId: option.nodeId } : {}),
      ...('pageId' in option && option.pageId ? { pageId: option.pageId } : {}),
      name: option.name,
      kind: relation,
      ...(relation === 'other' ? { custom } : {})
    })
    dialog.current?.close()
  }
  const title = from
    ? t(`trees.addTitle.${relation}` as 'trees.addTitle.parent', { name: from.name })
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
        {from && (
          <div className={styles.relation}>
            <div className={form.field}>
              <label htmlFor={`${fieldId}-relation`}>{t('trees.relation')}</label>
              <select
                id={`${fieldId}-relation`}
                value={relation}
                onChange={(event) => setRelation(event.currentTarget.value as AddKind)}
              >
                {ADD_KINDS.map((each) => (
                  <option key={each} value={each}>
                    {t(`trees.relations.${each}` as 'trees.relations.parent')}
                  </option>
                ))}
              </select>
            </div>
            {relation === 'other' && (
              <>
                <div className={form.field}>
                  <label htmlFor={`${fieldId}-label`}>{t('trees.customLabel')}</label>
                  <input
                    id={`${fieldId}-label`}
                    value={custom.label}
                    maxLength={60}
                    required
                    placeholder={t('trees.customPlaceholder')}
                    autoComplete="off"
                    data-1p-ignore
                    onChange={(event) => setCustom({ ...custom, label: event.currentTarget.value })}
                  />
                </div>
                <div className={form.field}>
                  <label htmlFor={`${fieldId}-place`}>{t('trees.customPlace')}</label>
                  <select
                    id={`${fieldId}-place`}
                    value={custom.place}
                    onChange={(event) =>
                      setCustom({ ...custom, place: event.currentTarget.value as CustomRelation['place'] })
                    }
                  >
                    {(['above', 'below', 'beside'] as const).map((place) => (
                      <option key={place} value={place}>
                        {t(`trees.places.${place}` as 'trees.places.above', { name: from.name })}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        )}
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
          <button type="submit" className={form.button} disabled={all.length === 0 || !ready}>
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
