/**
 * Los árboles genealógicos y los organigramas (la pestaña tree; bloque B de los ajustes tras los módulos 8 a 10): leerlos
 * con lo que ve quien pregunta, cambiarlos enteros, crearlos (en una página o en una nueva) y convertir un nodo suelto en
 * página. Los lleva quien escribe la página. Un jugador (ADR-0017) ve el árbol si ve su pestaña y, dentro, los nodos de
 * las páginas que conoce y los sueltos; un nodo de una página que no conoce no deja rastro
 */
import { convertTreeNodeToPage, createTree, getTree, MAX_PAGE_TABS, type TreeView, updateTree } from '@crisol/contracts'
import { chronologiesRepo, mapsRepo, operation, schema, treesRepo } from '@crisol/db'
import {
  type FamilyTreeEdge,
  type FamilyTreeNode,
  keyBetween,
  NotFoundError,
  type TreeLayout,
  treeProblem,
  visibleTree
} from '@crisol/domain'
import { pagesChanged } from '../realtime/events.ts'
import { viewedPage } from '../wiki/projection.ts'
import { knownBySomeone, type WikiView } from '../wiki/reader.ts'
import { authorizedPage, authorizedWiki, type WikiTarget } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { authorizedTab } from './maps.ts'
import { implement } from './registry.ts'

type TreeRow = treesRepo.TreeRow

/** El nombre de la pestaña al crearla, por su forma */
const TREE_TAB = { family: 'Árbol genealógico', org: 'Organigrama' } as const

/** El árbol para quien lee: los nodos con el título, el icono y la plantilla de su página (si sigue), y lo que ve */
async function treeView(ctx: ActionContext, worldId: string, row: TreeRow, pageId: string, view: WikiView | null) {
  const heads = await treesRepo.nodePages(
    ctx.db,
    worldId,
    row.nodes.flatMap((node) => (node.pageId ? [node.pageId] : []))
  )
  // Una página que ya no está (borrada o en la papelera): el nodo se queda suelto, con el nombre que tenía
  const nodes = row.nodes.map((node) => {
    const head = node.pageId ? heads.get(node.pageId) : undefined
    return { ...node, pageId: head ? (node.pageId ?? null) : null, head }
  })
  const seen =
    view && !view.full ? visibleTree(nodes, row.edges, (id) => view.seesPage(id)) : { nodes, edges: row.edges }
  const out: TreeView = {
    tabId: row.tabId,
    pageId,
    layout: row.layout,
    nodes: seen.nodes.map((node) => ({
      id: node.id,
      pageId: node.pageId,
      name: node.head?.title ?? node.name,
      ...(node.note ? { note: node.note } : {}),
      icon: node.head?.icon ?? null,
      template: node.head?.template ?? null
    })),
    edges: seen.edges,
    version: row.version
  }
  return out
}

/** La pestaña de un árbol que la cuenta puede escribir, con su árbol */
async function authorizedTree(ctx: ActionContext, tabId: string) {
  const { tab, page, wiki } = await authorizedTab(ctx, 'page.write', tabId)
  const tree = tab.kind === 'tree' ? await treesRepo.treeOfTab(ctx.db, tabId) : null
  if (!tree) throw new NotFoundError('tab')
  return { tab, page, wiki, tree }
}

/**
 * Lo escrito de un árbol, comprobado: los nodos con página, de este mundo y fuera de la papelera (y con el nombre de la
 * página, por si un día se va), y que todo cuadre (treeProblem). Si algo no vale, BAD_TREE con lo que es
 */
async function checkedTree(
  ctx: ActionContext,
  wiki: WikiTarget,
  nodes: readonly { id: string; pageId?: string | null | undefined; name: string; note?: string | undefined }[],
  edges: readonly FamilyTreeEdge[]
): Promise<FamilyTreeNode[]> {
  const ids = nodes.flatMap((node) => (node.pageId ? [node.pageId] : []))
  const heads = await treesRepo.nodePages(ctx.db, wiki.worldId, ids)
  const missing = ids.filter((id) => !heads.has(id))
  if (missing.length > 0)
    throw new InvalidRequestError('BAD_TREE', `no son páginas de este mundo: ${[...new Set(missing)].join(', ')}`)
  const clean: FamilyTreeNode[] = nodes.map((node) => {
    const head = node.pageId ? heads.get(node.pageId) : undefined
    const name = (head?.title ?? node.name).trim()
    return {
      id: node.id.trim(),
      ...(node.pageId ? { pageId: node.pageId } : {}),
      name,
      ...(node.note?.trim() ? { note: node.note.trim() } : {})
    }
  })
  const unnamed = clean.find((node) => !node.pageId && !node.name)
  if (unnamed) throw new InvalidRequestError('BAD_TREE', `el nodo «${unnamed.id}» necesita un nombre o una página`)
  const problem = treeProblem(clean, edges)
  if (problem) throw new InvalidRequestError('BAD_TREE', problem)
  return clean
}

export const treeActions = [
  implement(getTree, async (ctx, { tabId, ...as }) => {
    const tab = await mapsRepo.findTab(ctx.db, tabId)
    const { wiki, view } = await viewedPage(ctx, tab?.pageId ?? '', as)
    if (tab?.kind !== 'tree' || !view.seesTab({ id: tab.id, pageId: tab.pageId, hidden: tab.hidden }))
      throw new NotFoundError('tab')
    const tree = await treesRepo.treeOfTab(ctx.db, tabId)
    if (!tree) throw new NotFoundError('tab')
    return treeView(ctx, wiki.worldId, tree, tab.pageId, view)
  }),

  implement(updateTree, async (ctx, { tabId, layout, nodes, edges }) => {
    const { tab, page, wiki, tree } = await authorizedTree(ctx, tabId)
    const nextEdges = edges ?? tree.edges
    const nextNodes = await checkedTree(ctx, wiki, nodes ?? tree.nodes, nextEdges)
    const patch: { layout?: TreeLayout; nodes?: FamilyTreeNode[]; edges?: FamilyTreeEdge[] } = {}
    if (layout !== undefined && layout !== tree.layout) patch.layout = layout
    if (nodes !== undefined) patch.nodes = nextNodes
    if (edges !== undefined) patch.edges = nextEdges
    const saved =
      Object.keys(patch).length === 0
        ? tree
        : await operation(ctx.db, historyContext(ctx, 'updateTree', { title: page.title, name: tab.name }, wiki), (w) =>
            w.update(schema.trees, tree.id, patch)
          )
    // Sus líneas son relaciones: el grafo y «Mencionado en» se ponen al día con los avisos de páginas
    ctx.realtime.publish(pagesChanged(wiki))
    return treeView(ctx, wiki.worldId, saved, tab.pageId, null)
  }),

  // En una página que ya hay (una pestaña más) o en una nueva con su nombre, en una sola operación
  implement(createTree, async (ctx, { worldId, name, pageId, parentId, layout, nodes, edges }) => {
    const wiki = await authorizedWiki(ctx, 'page.write', worldId)
    const shape = layout ?? 'family'
    const lists = await checkedTree(ctx, wiki, nodes ?? [], edges ?? [])
    const tree = { layout: shape, nodes: lists, edges: edges ?? [] }
    let tabId: string
    let treePage: string
    if (pageId) {
      const { page } = await authorizedPage(ctx, 'page.write', pageId)
      if (page.worldId !== worldId) throw new NotFoundError('page')
      const tabs = await mapsRepo.listTabs(ctx.db, pageId)
      if (tabs.length >= MAX_PAGE_TABS) throw new InvalidRequestError('TOO_MANY_TABS', `como mucho ${MAX_PAGE_TABS}`)
      const tab = await mapsRepo.createTab(
        ctx.db,
        historyContext(ctx, 'createTree', { name, title: page.title }, wiki),
        { worldId, pageId, kind: 'tree', name, position: keyBetween(tabs.at(-1)?.position ?? null, null) },
        { tree }
      )
      tabId = tab.id
      treePage = pageId
    } else {
      if (parentId) {
        const { page } = await authorizedPage(ctx, 'page.write', parentId)
        if (page.worldId !== worldId) throw new NotFoundError('page')
      }
      const hidden = parentId ? await knownBySomeone(ctx, worldId, parentId) : false
      ;[tabId, treePage] = await operation(ctx.db, historyContext(ctx, 'createTree', { name }, wiki), async (w) => {
        const page = await chronologiesRepo.insertEventPage(w, {
          worldId,
          parentId: parentId ?? null,
          title: name,
          hidden,
          actorId: ctx.actor.userId
        })
        const tab = await w.insert(schema.pageTabs, {
          worldId,
          pageId: page.id,
          kind: 'tree',
          name: TREE_TAB[shape],
          position: keyBetween(null, null)
        })
        await w.insert(schema.trees, { worldId, tabId: tab.id, ...tree })
        return [tab.id, page.id] as const
      })
    }
    ctx.realtime.publish(pagesChanged(wiki))
    const saved = await treesRepo.treeOfTab(ctx.db, tabId)
    if (!saved) throw new NotFoundError('tab')
    return treeView(ctx, worldId, saved, treePage, null)
  }),

  // «Crear página»: el nodo suelto pasa a ser una página nueva con su nombre (bajo la del árbol, si no se dice otra) y
  // queda enlazado a ella, en la misma operación (deshacer quita las dos cosas)
  implement(convertTreeNodeToPage, async (ctx, { tabId, nodeId, parentId }) => {
    const { tab, page, wiki, tree } = await authorizedTree(ctx, tabId)
    const node = tree.nodes.find((each) => each.id === nodeId)
    if (!node) throw new NotFoundError('node')
    if (node.pageId) {
      const live = await treesRepo.nodePages(ctx.db, wiki.worldId, [node.pageId])
      if (live.has(node.pageId)) throw new InvalidRequestError('NODE_HAS_PAGE', 'ese nodo ya es una página')
    }
    const where = parentId === undefined ? page.id : parentId
    if (where) {
      const { page: parent } = await authorizedPage(ctx, 'page.write', where)
      if (parent.worldId !== wiki.worldId) throw new NotFoundError('page')
    }
    const hidden = where ? await knownBySomeone(ctx, wiki.worldId, where) : false
    const created = await operation(
      ctx.db,
      historyContext(ctx, 'convertTreeNodeToPage', { title: node.name, name: tab.name }, wiki),
      async (w) => {
        const created = await chronologiesRepo.insertEventPage(w, {
          worldId: wiki.worldId,
          parentId: where,
          title: node.name,
          hidden,
          actorId: ctx.actor.userId
        })
        await w.update(schema.trees, tree.id, {
          nodes: tree.nodes.map((each) => (each.id === nodeId ? { ...each, pageId: created.id } : each))
        })
        return created
      }
    )
    ctx.realtime.publish(pagesChanged(wiki))
    const saved = await treesRepo.treeOfTab(ctx.db, tabId)
    if (!saved) throw new NotFoundError('tab')
    return { pageId: created.id, tree: await treeView(ctx, wiki.worldId, saved, tab.pageId, null) }
  })
]
