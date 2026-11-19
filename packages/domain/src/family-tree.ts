/**
 * Los árboles de las páginas (la pestaña «Árbol», bloque B de los ajustes tras los módulos 8 a 10; como la genealogía de
 * Everlore): unos nodos (una página del mundo o solo un nombre) y unas líneas entre ellos, hechas a mano (no se deduce
 * ninguna) y de tipos que no son fijos: padre o madre, padrastro o madrastra, adopción, pareja, expareja, hermanos, dirige,
 * miembro de u otra que escribe quien la pone. Un organigrama es un árbol con líneas «dirige» y «miembro de». Las líneas
 * entre dos nodos con página cuentan como relaciones del grafo (kind tree). Puro: lo prueban las unitarias
 */
import type { RelationRole } from './properties.ts'
import type { RelationEdge } from './relations.ts'

/**
 * parent: from es padre o madre de to; stepparent: su padrastro o madrastra; adoptive: lo adoptó; partner: pareja;
 * ex-partner: expareja; sibling: hermanos; leads: from dirige to; member: from es miembro de to; other: la que diga label
 * (from encima de to o, con beside, al lado)
 */
export const TREE_EDGE_TYPES = [
  'parent',
  'stepparent',
  'adoptive',
  'partner',
  'ex-partner',
  'sibling',
  'leads',
  'member',
  'other'
] as const
export type TreeEdgeType = (typeof TREE_EDGE_TYPES)[number]

/** Las que van de lado (y valen en los dos sentidos); las demás ponen a uno encima del otro */
const BESIDE: ReadonlySet<TreeEdgeType> = new Set(['partner', 'ex-partner', 'sibling'])

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
  /** Con type other: su nombre («Padrino», «Rival»…) */
  label?: string | undefined
  /** Con type other: al lado (si no, from va encima de to) */
  beside?: boolean | undefined
}

/** Si una línea va de lado (pareja, expareja, hermanos u otra al lado) */
export const besideEdge = (edge: Pick<FamilyTreeEdge, 'type' | 'beside'>) =>
  BESIDE.has(edge.type) || (edge.type === 'other' && edge.beside === true)

/** De una línea que pone a uno encima del otro: quién va arriba y quién abajo (el grupo, encima de su miembro) */
export const aboveBelow = (edge: Pick<FamilyTreeEdge, 'from' | 'to' | 'type'>): [string, string] =>
  edge.type === 'member' ? [edge.to, edge.from] : [edge.from, edge.to]

/** Lo más que lleva un árbol */
export const TREE_LIMITS = { nodes: 400, edges: 800 } as const

/** Si dos líneas son la misma (la pareja, en los dos sentidos) */
const sameEdge = (a: FamilyTreeEdge, b: FamilyTreeEdge) =>
  a.type === b.type &&
  (a.type !== 'other' || (a.label ?? '').trim().toLowerCase() === (b.label ?? '').trim().toLowerCase()) &&
  ((a.from === b.from && a.to === b.to) || (besideEdge(a) && a.from === b.to && a.to === b.from))

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
    if (edge.type === 'other' && !edge.label?.trim()) return `la línea n.º ${index + 1} no dice qué relación es`
    if (edges.slice(0, index).some((other) => sameEdge(other, edge))) return `la línea n.º ${index + 1} está repetida`
  }
  // Nadie es su propio antepasado (por sangre, adopción o matrimonio) ni pertenece, de grupo en grupo, a sí mismo
  // (dirigir y las libres no cuentan: dirigir un grupo y pertenecer a él a la vez vale)
  const families = { parent: ['parent', 'stepparent', 'adoptive'], member: ['member'] } as const
  for (const type of ['parent', 'member'] as const) {
    // Hacia arriba: del hijo a su padre o madre; del miembro a su grupo
    const up = new Map<string, string[]>()
    for (const edge of edges) {
      if (!(families[type] as readonly string[]).includes(edge.type)) continue
      const [above, below] = aboveBelow(edge)
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

/** El papel de la relación de cada tipo de línea (si es uno de los de los campos) y su nombre (y al revés) */
const ROLE_OF: Record<Exclude<TreeEdgeType, 'other'>, { role?: RelationRole; name: string; inverseName: string }> = {
  parent: { role: 'parent', name: 'Padre o madre', inverseName: 'Hijos' },
  stepparent: { name: 'Padrastro o madrastra', inverseName: 'Hijastros' },
  adoptive: { name: 'Padre o madre adoptivo', inverseName: 'Hijos adoptivos' },
  partner: { role: 'partner', name: 'Pareja', inverseName: 'Pareja' },
  'ex-partner': { name: 'Expareja', inverseName: 'Expareja' },
  sibling: { name: 'Hermanos', inverseName: 'Hermanos' },
  member: { role: 'member-of', name: 'Pertenece a', inverseName: 'Miembros' },
  leads: { role: 'leads', name: 'Lo dirige', inverseName: 'Dirige' }
}

/** La clave de las relaciones que salen de los árboles, por tipo de línea (las libres, también por su nombre) */
export const treeRelationKey = (type: TreeEdgeType, label?: string) =>
  type === 'other' ? `tree:other:${(label ?? '').trim().toLowerCase()}` : `tree:${type}`

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
      const label = edge.label?.trim() ?? ''
      const { role, name, inverseName } =
        edge.type === 'other' ? { role: undefined, name: label, inverseName: label } : ROLE_OF[edge.type]
      // En el sentido de los campos con papel: el hijo apunta al padre y el grupo, a quien lo dirige
      const [source, target] = edge.type === 'parent' || edge.type === 'leads' ? [to, from] : [from, to]
      const relationKey = treeRelationKey(edge.type, label)
      const key = `${source}>${target}>${role ?? relationKey}`
      if (seen.has(key) || (besideEdge(edge) && seen.has(`${target}>${source}>${role ?? relationKey}`))) continue
      seen.add(key)
      out.push({ source, target, kind: 'tree', key: relationKey, name, inverseName, role, secret: undefined })
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
