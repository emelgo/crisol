/**
 * Los árboles genealógicos y los organigramas de las páginas (pestaña «Árbol genealógico», bloque B de los ajustes tras
 * los módulos 8 a 10): unos nodos (una página del mundo o solo un nombre) y unas líneas entre ellos. Las líneas entre dos
 * nodos con página cuentan como relaciones del grafo (kind tree). Puro: lo prueban las unitarias
 */
import type { RelationEdge } from './relations.ts'

export const TREE_LAYOUTS = ['family', 'org'] as const
export type TreeLayout = (typeof TREE_LAYOUTS)[number]

/** parent: from es padre o madre de to; partner: pareja; member: from pertenece a to; leads: from dirige to */
export const TREE_EDGE_TYPES = ['parent', 'partner', 'member', 'leads'] as const
export type TreeEdgeType = (typeof TREE_EDGE_TYPES)[number]

export interface FamilyTreeNode {
  /** Corto y propio del árbol (lo pone quien lo crea: la web, un uuid; la IA, lo que quiera) */
  id: string
  /** Su página, si la tiene; sin ella, un nodo suelto con su nombre */
  pageId?: string | null | undefined
  name: string
  note?: string | undefined
}

export interface FamilyTreeEdge {
  from: string
  to: string
  type: TreeEdgeType
}

/** Lo más que lleva un árbol */
export const TREE_LIMITS = { nodes: 400, edges: 800 } as const

/** Si dos líneas son la misma (la pareja, en los dos sentidos) */
const sameEdge = (a: FamilyTreeEdge, b: FamilyTreeEdge) =>
  a.type === b.type &&
  ((a.from === b.from && a.to === b.to) || (a.type === 'partner' && a.from === b.to && a.to === b.from))

/**
 * Lo que no vale de un árbol, en palabras (null si vale): ids repetidos, líneas a nodos que no están, a sí mismos o
 * repetidas, una página en dos nodos, o alguien que es antepasado de sí mismo
 */
export function treeProblem(nodes: readonly FamilyTreeNode[], edges: readonly FamilyTreeEdge[]): string | null {
  if (nodes.length > TREE_LIMITS.nodes) return `como mucho ${TREE_LIMITS.nodes} nodos`
  if (edges.length > TREE_LIMITS.edges) return `como mucho ${TREE_LIMITS.edges} líneas`
  const ids = new Set<string>()
  const pages = new Set<string>()
  for (const node of nodes) {
    if (ids.has(node.id)) return `el nodo «${node.id}» está repetido`
    ids.add(node.id)
    if (node.pageId) {
      if (pages.has(node.pageId)) return `la página de «${node.name}» ya está en otro nodo`
      pages.add(node.pageId)
    }
  }
  for (const [index, edge] of edges.entries()) {
    if (!ids.has(edge.from) || !ids.has(edge.to))
      return `la línea n.º ${index + 1} une un nodo que no está (${ids.has(edge.from) ? edge.to : edge.from})`
    if (edge.from === edge.to) return `la línea n.º ${index + 1} une un nodo consigo mismo`
    if (edges.slice(0, index).some((other) => sameEdge(other, edge))) return `la línea n.º ${index + 1} está repetida`
  }
  // Nadie es su propio antepasado ni pertenece, de grupo en grupo, a sí mismo (dirigir no cuenta: no sube de grupo)
  for (const type of ['parent', 'member'] as const) {
    // Hacia arriba: del hijo a su padre o madre; del miembro a su grupo
    const up = new Map<string, string[]>()
    for (const edge of edges) {
      if (edge.type !== type) continue
      const [below, above] = type === 'parent' ? [edge.to, edge.from] : [edge.from, edge.to]
      up.set(below, [...(up.get(below) ?? []), above])
    }
    const state = new Map<string, 1 | 2>()
    const loops = (id: string): boolean => {
      if (state.get(id) === 2) return false
      if (state.get(id) === 1) return true
      state.set(id, 1)
      for (const next of up.get(id) ?? []) if (loops(next)) return true
      state.set(id, 2)
      return false
    }
    for (const id of up.keys())
      if (loops(id)) {
        const name = nodes.find((node) => node.id === id)?.name ?? id
        return type === 'parent' ? `«${name}» sale como antepasado de sí mismo` : `«${name}» pertenece a sí mismo`
      }
  }
  return null
}

/** El papel de la relación de cada tipo de línea y su nombre (y al revés), como los campos con papel */
const ROLE_OF = {
  parent: { role: 'parent', name: 'Padre o madre', inverseName: 'Hijos' },
  partner: { role: 'partner', name: 'Pareja', inverseName: 'Pareja' },
  member: { role: 'member-of', name: 'Pertenece a', inverseName: 'Miembros' },
  leads: { role: 'leads', name: 'Lo dirige', inverseName: 'Dirige' }
} as const

/** La clave de las relaciones que salen de los árboles, por tipo de línea */
export const treeRelationKey = (type: TreeEdgeType) => `tree:${type}`

/**
 * Las relaciones que salen de unos árboles: cada línea entre dos nodos con página, con el sentido de los campos con papel
 * (parent: del hijo al padre; member-of: del miembro al grupo; leads: del grupo a quien lo dirige). Sin las que ya están
 * en un campo de la página con el mismo papel, ni las repetidas entre árboles, ni las que van a páginas que no están
 */
export function treeRelationEdges(
  trees: readonly { nodes: readonly FamilyTreeNode[]; edges: readonly FamilyTreeEdge[] }[],
  present: ReadonlySet<string>,
  existing: readonly RelationEdge[] = []
): RelationEdge[] {
  const out: RelationEdge[] = []
  const seen = new Set(existing.flatMap((edge) => (edge.role ? [`${edge.source}>${edge.target}>${edge.role}`] : [])))
  for (const tree of trees) {
    const pageOf = new Map(tree.nodes.flatMap((node) => (node.pageId ? [[node.id, node.pageId] as const] : [])))
    for (const edge of tree.edges) {
      const from = pageOf.get(edge.from)
      const to = pageOf.get(edge.to)
      if (!from || !to || from === to || !present.has(from) || !present.has(to)) continue
      const { role, name, inverseName } = ROLE_OF[edge.type]
      // En el sentido de los campos con papel: el hijo apunta al padre y el grupo, a quien lo dirige
      const [source, target] = edge.type === 'parent' || edge.type === 'leads' ? [to, from] : [from, to]
      const key = `${source}>${target}>${role}`
      if (seen.has(key) || (role === 'partner' && seen.has(`${target}>${source}>${role}`))) continue
      seen.add(key)
      out.push({
        source,
        target,
        kind: 'tree',
        key: treeRelationKey(edge.type),
        name,
        inverseName,
        role,
        secret: undefined
      })
    }
  }
  return out
}

/**
 * Lo que ve de un árbol quien no lo ve todo (ya ve la pestaña): los nodos con página, si conoce la página; los sueltos,
 * siempre; y las líneas entre lo que queda. Un nodo con una página que no ve no deja rastro (ni su nombre)
 */
export function visibleTree<N extends FamilyTreeNode>(
  nodes: readonly N[],
  edges: readonly FamilyTreeEdge[],
  seesPage: (pageId: string) => boolean
): { nodes: N[]; edges: FamilyTreeEdge[] } {
  const kept = nodes.filter((node) => !node.pageId || seesPage(node.pageId))
  const ids = new Set(kept.map((node) => node.id))
  return { nodes: kept, edges: edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)) }
}
