/**
 * Dónde va cada nodo de un árbol genealógico o de un organigrama (la pestaña tree): con las mismas filas y tarjetas que
 * Familia y Organigrama (relations/layout.ts, con dagre). Las líneas del árbol se pasan al sentido de los campos con
 * papel; lo que no cuelga de nada (un nodo recién añadido, sin líneas) va en una fila debajo. Puro: lo prueban las
 * unitarias
 */
import type { TreeEdgeView } from '@crisol/contracts'
import { CARD, familyLayout, orgLayout, type TreeLayout } from '../relations/layout.ts'

/** El hueco entre las tarjetas sueltas de la fila de abajo */
const LOOSE_GAP = 24

interface Placed {
  id: string
}

/** Las líneas del árbol como aristas con papel: el hijo apunta al padre; el miembro, al grupo; el grupo, a quien lo dirige */
export function roleEdges(edges: readonly TreeEdgeView[]) {
  return edges.map((edge) =>
    edge.type === 'parent'
      ? { source: edge.to, target: edge.from, role: 'parent' as const }
      : edge.type === 'partner'
        ? { source: edge.from, target: edge.to, role: 'partner' as const }
        : edge.type === 'member'
          ? { source: edge.from, target: edge.to, role: 'member-of' as const }
          : { source: edge.to, target: edge.from, role: 'leads' as const }
  )
}

/** Los grupos de arriba del organigrama: los que tienen miembros o quien los dirija y no pertenecen a otro */
export function topGroups(nodes: readonly Placed[], edges: readonly TreeEdgeView[]) {
  const groups = new Set(edges.filter((e) => e.type === 'member' || e.type === 'leads').map((e) => e.to))
  const inside = new Set(edges.filter((e) => e.type === 'member' && groups.has(e.from)).map((e) => e.from))
  const top = nodes.filter((node) => groups.has(node.id) && !inside.has(node.id)).map((node) => node.id)
  // Un círculo de grupos (no debería: el servidor no lo deja) no se queda sin pintar
  return top.length > 0 || groups.size === 0 ? top : [...groups].slice(0, 1)
}

/** Las tarjetas y las líneas de un árbol, en su forma; lo que no cuelga de nada, en una fila debajo */
export function treeTabLayout(
  layout: 'family' | 'org',
  nodes: readonly Placed[],
  edges: readonly TreeEdgeView[]
): TreeLayout {
  const linked = roleEdges(edges)
  const base =
    layout === 'family'
      ? familyLayout(
          nodes.map((node) => ({ id: node.id, generation: 0 })),
          linked,
          Number.POSITIVE_INFINITY
        )
      : orgLayout(nodes, linked, topGroups(nodes, edges))
  // Sin el nombre de cada generación: no hay una página en el centro desde la que contar
  const placed = new Set(base.cards.map((card) => card.id))
  const loose = nodes.filter((node) => !placed.has(node.id))
  if (loose.length === 0) return { ...base, rows: [] }
  const bottom = base.cards.length > 0 ? Math.max(...base.cards.map((card) => card.y + card.height / 2)) : 0
  const left = base.cards.length > 0 ? Math.min(...base.cards.map((card) => card.x - card.width / 2)) : 0
  const y = bottom + (base.cards.length > 0 ? 48 : 0) + CARD.height / 2
  const cards = [
    ...base.cards,
    ...loose.map((node, index) => ({
      id: node.id,
      x: left + CARD.width / 2 + index * (CARD.width + LOOSE_GAP),
      y,
      ...CARD,
      kind: 'person' as const
    }))
  ]
  return {
    cards,
    wires: base.wires,
    rows: [],
    width: Math.max(base.width, loose.length * (CARD.width + LOOSE_GAP)),
    height: y + CARD.height / 2
  }
}
