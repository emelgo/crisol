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
import { pageView } from '../actions/pages.ts'
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
export async function pageViewFor(ctx: ActionContext, wiki: WikiTarget, view: WikiView, pageId: string): Promise<Page> {
  const page = await pageView(ctx, pageId)
  if (view.full) return page
  const tree = await viewTree(ctx, wiki, view)
  return {
    ...page,
    parentId: view.parentOf(page.id, page.parentId),
    hasChildren: tree.some((row) => row.parentId === page.id),
    properties: visibleProperties(page.properties, view),
    panel: visiblePanel(page.panel, view),
    path: page.path.filter((step) => step.id === page.id || view.seesPage(step.id)),
    // Lo de editar no es suyo
    locked: true
  }
}

/**
 * El cuerpo que ve un jugador: sin los secretos que no ve ni las notas ocultas, y los enlaces y los incrustados a lo
 * que no ve (o a lo que no existe) iguales, sin id ni título: solo su texto propio, si lo tienen
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
    if (typeof target !== 'string' || !view.seesPage(target)) {
      const label = node.type === 'pageLink' ? { label: (node.attrs?.label as string | null | undefined) ?? null } : {}
      return { ...node, attrs: { pageId: null, title: '', anchor: null, ...label } }
    }
  }
  if (!node.content) return node
  return { ...node, content: node.content.flatMap((child) => filterBody(child, view, pageId) ?? []) }
}

/** Para leerlo en Markdown: los enlaces neutros, como su texto (o «desconocido»); los incrustados neutros, fuera */
export function neutralAsText(node: JSONContent): JSONContent | null {
  const neutral = node.attrs?.pageId === null && node.attrs?.title === ''
  if (node.type === 'pageLink' && neutral) return { type: 'text', text: String(node.attrs?.label || 'desconocido') }
  if (node.type === 'pageEmbed' && neutral) return null
  if (!node.content) return node
  return { ...node, content: node.content.flatMap((child) => neutralAsText(child) ?? []) }
}
