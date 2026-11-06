/**
 * Lo que ve un jugador de la wiki (ADR-0017): la página sin lo oculto (campos y bloques «Oculto», enlaces de sus
 * propiedades a lo que no ve, la ruta por las que no ve) y su árbol, con cada página colgando de la primera antecesora
 * que ve. Para el máster, todo como estaba
 */
import type { Page, PanelBlock } from '@crisol/contracts'
import { pagesRepo } from '@crisol/db'
import { NotFoundError, type PageProperty } from '@crisol/domain'
import type { JSONContent } from '@tiptap/core'
import type { WikiTarget } from '../actions/access.ts'
import type { ActionContext } from '../actions/context.ts'
import { authorizedView, type ReadAs, type WikiView } from './reader.ts'

/** Las propiedades que ve: sin las ocultas y, en las de enlace, solo las páginas que ve */
export function visibleProperties<P extends PageProperty>(properties: readonly P[], view: WikiView): P[] {
  if (view.full) return [...properties]
  return properties
    .filter((p) => !p.hidden)
    .map((p) => (p.type === 'pages' ? { ...p, value: p.value.filter((id) => view.seesPage(id)) } : p))
}

/** Los bloques del panel que ve: sin los ocultos */
export function visiblePanel<B extends PanelBlock>(panel: readonly B[], view: WikiView): B[] {
  return view.full ? [...panel] : panel.filter((block) => !block.hidden)
}

/** La página, si quien la pide la ve (si no, 404, como si no existiera), con su mundo y lo que ve */
export async function viewedPage(ctx: ActionContext, pageId: string, as: ReadAs = {}) {
  const page = pageId ? await pagesRepo.findPage(ctx.db, pageId) : null
  const { wiki, view } = await authorizedView(ctx, page?.worldId ?? '', as)
  if (!page || !view.seesPage(page.id)) throw new NotFoundError('page')
  return { page, wiki, view }
}

/** Una fila del árbol de un jugador */
export interface TreeRow {
  id: string
  parentId: string | null
  title: string
  icon: string | null
  template: string | null
  version: number
  hasChildren: boolean
}

/** El árbol de lo que ve, en orden de lectura: cada página colgando de la primera antecesora que ve */
export async function viewTree(ctx: ActionContext, wiki: WikiTarget, view: WikiView): Promise<TreeRow[]> {
  const rows = await pagesRepo.treeRows(ctx.db, wiki.worldId)
  // El orden de lectura del árbol entero (cada página seguida de sus subpáginas)
  const children = Map.groupBy(rows, (row) => row.parentId)
  const order = new Map<string, number>()
  const visit = (parentId: string | null) => {
    for (const row of children.get(parentId) ?? []) {
      order.set(row.id, order.size)
      visit(row.id)
    }
  }
  visit(null)
  const visible = view.pages(rows).map((row) => ({ ...row, parentId: view.parentOf(row.id, row.parentId) }))
  visible.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  const parents = new Set(visible.map((row) => row.parentId))
  return visible.map((row) => ({ ...row, hasChildren: parents.has(row.id) }))
}

/** La página como la ve quien la pide: para un jugador, sin lo oculto, colgando de donde la ve y con su ruta visible */
export function pageViewFor(view: WikiView, page: Page): Page {
  if (view.full) return page
  return {
    ...page,
    parentId: view.parentOf(page.id, page.parentId),
    hasChildren: view.hasChildren(page.id),
    properties: visibleProperties(page.properties, view),
    panel: visiblePanel(page.panel, view),
    path: page.path.filter((step) => step.id === page.id || view.seesPage(step.id)),
    // Lo de editar no es suyo
    locked: true
  }
}

/**
 * El cuerpo que ve un jugador: sin los secretos que no ve ni las notas ocultas. Un enlace a lo que no ve queda como un
 * enlace sin resolver: sin id y con lo que se escribió (nunca con el título de ahora: renombrar una página oculta no se
 * nota). Un incrustado de lo que no ve, fuera
 */
export function filterBody(node: JSONContent, view: WikiView, pageId: string): JSONContent | null {
  if (view.full) return node
  if (node.type === 'note') return null
  if (node.type === 'secret') {
    const documentId = node.attrs?.documentId
    if (typeof documentId !== 'string' || !view.seesSecret(documentId, pageId)) return null
  }
  if (node.type === 'pageLink' || node.type === 'pageEmbed') {
    const target = node.attrs?.pageId
    if (typeof target === 'string' && !view.seesPage(target)) {
      if (node.type === 'pageEmbed') return null
      // Con su texto propio, solo eso: el título del destino no va
      const label = node.attrs?.label
      return { ...node, attrs: { ...node.attrs, pageId: null, anchor: null, ...(label ? { title: '' } : {}) } }
    }
  }
  if (!node.content) return node
  return { ...node, content: node.content.flatMap((child) => filterBody(child, view, pageId) ?? []) }
}

/** Para leerlo en Markdown: los enlaces sin destino, como lo que se escribió */
export function unresolvedAsText(node: JSONContent): JSONContent | null {
  if (node.type === 'pageLink' && !node.attrs?.pageId) {
    const text = String(node.attrs?.label || node.attrs?.title || '')
    return text ? { type: 'text', text } : null
  }
  if (node.type === 'pageEmbed' && !node.attrs?.pageId) return null
  if (!node.content) return node
  return { ...node, content: node.content.flatMap((child) => unresolvedAsText(child) ?? []) }
}
