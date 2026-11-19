/**
 * Dónde va cada nodo de la pestaña «Árbol» (bloque B de los ajustes tras los módulos 8 a 10, como la genealogía de
 * Everlore): en filas con dagre, con las tarjetas de Familia (relations/). Las líneas que ponen a uno encima del otro
 * (padre o madre, padrastro, adopción, dirige, miembro de, una libre) bajan de quien va arriba a una barra y de ella a los
 * de abajo; las de lado (pareja, expareja, hermanos, una libre al lado), una raya entre los dos. Solo se pinta lo que hay:
 * dos que comparten un hijo no salen como pareja si nadie lo ha dicho. Las que no son de sangre ni de pareja van con raya
 * discontinua y su nombre. Lo que no cuelga de nada (un nodo recién añadido, sin líneas) va en una fila debajo. Puro: lo
 * prueban las unitarias
 */
import type { TreeEdgeView } from '@crisol/contracts'
import { aboveBelow, besideEdge } from '@crisol/domain'
import { graphlib, layout as runDagre } from '@dagrejs/dagre'
import { CARD, type Card, type Point, type TreeLayout, type Wire } from '../relations/layout.ts'

/** El hueco entre las tarjetas sueltas de la fila de abajo */
const LOOSE_GAP = 24
/** Lo que se separan las barras de una misma fila */
const BAR_STEP = 7

interface Placed {
  id: string
}

/** Las de sangre, pareja y mando van con raya continua; las demás, discontinua (y con su nombre) */
const SOLID: ReadonlySet<TreeEdgeView['type']> = new Set(['parent', 'partner', 'leads', 'member'])
export const dashedEdge = (edge: Pick<TreeEdgeView, 'type'>) => !SOLID.has(edge.type)

/** Qué línea es, para juntar en una barra solo las del mismo tipo (las libres, por su nombre) */
const kindOf = (edge: TreeEdgeView) => (edge.type === 'other' ? `other:${(edge.label ?? '').toLowerCase()}` : edge.type)

/**
 * Las tarjetas y las líneas de un árbol; labelOf da el nombre que se escribe junto a una línea (null: ninguno, como en
 * las de padre o madre y pareja)
 */
export function treeTabLayout(
  nodes: readonly Placed[],
  edges: readonly TreeEdgeView[],
  labelOf: (edge: TreeEdgeView) => string | null = () => null
): TreeLayout {
  const present = new Set(nodes.map((node) => node.id))
  const lines = edges.filter((edge) => present.has(edge.from) && present.has(edge.to) && edge.from !== edge.to)
  const linked = new Set(lines.flatMap((edge) => [edge.from, edge.to]))
  const graph = new graphlib.Graph({ multigraph: false })
  graph.setGraph({ rankdir: 'TB', ranksep: 32, nodesep: 44, marginx: 24, marginy: 24 })
  graph.setDefaultEdgeLabel(() => ({}))
  for (const node of nodes) if (linked.has(node.id)) graph.setNode(node.id, { width: CARD.width, height: CARD.height })

  // Un punto de unión por cada grupo de los de arriba de una misma línea (y por cada pareja de lado)
  type Union = { above: string[]; below: string[]; edge: TreeEdgeView }
  const unions = new Map<string, Union>()
  const sides: TreeEdgeView[] = []
  const aboveOf = new Map<string, Map<string, { above: Set<string>; edge: TreeEdgeView }>>()
  for (const edge of lines) {
    if (besideEdge(edge)) {
      sides.push(edge)
      continue
    }
    const [above, below] = aboveBelow(edge)
    const byKind = aboveOf.get(below) ?? new Map<string, { above: Set<string>; edge: TreeEdgeView }>()
    const entry = byKind.get(kindOf(edge)) ?? { above: new Set<string>(), edge }
    entry.above.add(above)
    byKind.set(kindOf(edge), entry)
    aboveOf.set(below, byKind)
  }
  const union = (key: string, above: string[], edge: TreeEdgeView) => {
    let found = unions.get(key)
    if (!found) {
      found = { above, below: [], edge }
      unions.set(key, found)
      graph.setNode(key, { width: 2, height: 2 })
      for (const id of above) graph.setEdge(id, key, { minlen: 1, weight: 2 })
    }
    return found
  }
  for (const [below, byKind] of aboveOf)
    for (const [kind, { above, edge }] of byKind) {
      const sorted = [...above].sort()
      const key = `union:${kind}:${sorted.join('+')}`
      union(key, sorted, edge).below.push(below)
      graph.setEdge(key, below, { minlen: 1, weight: 4 })
    }
  // Los de lado, en la misma fila: un punto de unión debajo de los dos
  for (const edge of sides) {
    const pair = [edge.from, edge.to].sort()
    union(`side:${kindOf(edge)}:${pair.join('+')}`, pair, edge)
  }
  runDagre(graph)

  const at = (id: string): Point => {
    const node = graph.node(id) as { x?: number; y?: number } | undefined
    return { x: node?.x ?? 0, y: node?.y ?? 0 }
  }
  const cards: Card[] = nodes
    .filter((node) => linked.has(node.id))
    .map((node) => ({ id: node.id, ...at(node.id), ...CARD, kind: 'person' as const }))
  const byId = new Map(cards.map((card) => [card.id, card]))
  const wires: Wire[] = []
  const labels: NonNullable<TreeLayout['labels']> = []
  const style = (edge: TreeEdgeView) => (dashedEdge(edge) ? { dashed: true } : {})

  // Las rayas de lado, entre sus bordes a media altura (si no están en la misma fila, de centro a centro)
  const sideKeys = new Set<string>()
  for (const edge of sides) {
    const [a, b] = [byId.get(edge.from), byId.get(edge.to)].sort((p, q) => (p?.x ?? 0) - (q?.x ?? 0))
    if (!a || !b) continue
    const points =
      a.y === b.y
        ? [
            { x: a.x + a.width / 2, y: a.y },
            { x: b.x - b.width / 2, y: b.y }
          ]
        : [
            { x: a.x, y: a.y },
            { x: b.x, y: b.y }
          ]
    sideKeys.add([edge.from, edge.to].sort().join('+'))
    const label = labelOf(edge)
    const [start, end] = points as [Point, Point]
    if (label) labels.push({ text: label, x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 7, anchor: 'middle' })
    wires.push({
      kind: edge.type === 'partner' || edge.type === 'ex-partner' ? 'partner' : 'family',
      points,
      ...style(edge)
    })
  }

  // Las barras de una misma fila, escalonadas (si no, se pisan y no se sabe qué baja a quién)
  const drawn = [...unions].filter(([, union]) => union.below.length > 0)
  const rowOf = new Map<number, string[]>()
  for (const [key] of drawn) {
    const y = Math.round(at(key).y)
    rowOf.set(y, [...(rowOf.get(y) ?? []), key])
  }
  const barOf = (key: string) => {
    const y = at(key).y
    const row = rowOf.get(Math.round(y)) ?? [key]
    return y + (row.indexOf(key) - (row.length - 1) / 2) * BAR_STEP
  }
  for (const [key, { above, below, edge }] of drawn) {
    const tops = above.flatMap((id) => byId.get(id) ?? []).sort((a, b) => a.x - b.x)
    const kids = below.flatMap((id) => byId.get(id) ?? [])
    if (tops.length === 0 || kids.length === 0) continue
    const bar = barOf(key)
    const first = tops[0] as Card
    const last = tops[tops.length - 1] as Card
    // Dos de arriba que son pareja (dicho a mano) y están en la misma fila: la línea baja de la mitad de su raya; si no,
    // cada uno baja a la barra por su cuenta
    const couple = tops.length === 2 && first.y === last.y && sideKeys.has([first.id, last.id].sort().join('+'))
    const drops: Point[] = couple
      ? [{ x: (first.x + last.x) / 2, y: first.y }]
      : tops.map((card) => ({ x: card.x, y: card.y + card.height / 2 }))
    for (const drop of drops) wires.push({ kind: 'family', points: [drop, { x: drop.x, y: bar }], ...style(edge) })
    const xs = [...drops.map((drop) => drop.x), ...kids.map((kid) => kid.x)]
    wires.push({
      kind: 'family',
      points: [
        { x: Math.min(...xs), y: bar },
        { x: Math.max(...xs), y: bar }
      ],
      ...style(edge)
    })
    for (const kid of kids)
      wires.push({
        kind: 'family',
        points: [
          { x: kid.x, y: bar },
          { x: kid.x, y: kid.y - kid.height / 2 }
        ],
        ...style(edge)
      })
    // Su nombre, junto a la subida al primero de abajo (cada una tiene la suya, aunque bajen del mismo)
    const label = labelOf(edge)
    const lead = [...kids].sort((a, b) => a.x - b.x)[0] as Card
    if (label) labels.push({ text: label, x: lead.x + 6, y: (bar + lead.y - lead.height / 2) / 2, anchor: 'start' })
  }

  const graphSize = graph.graph() as { width?: number; height?: number }
  const base: TreeLayout = {
    cards,
    wires,
    labels,
    rows: [],
    width: graphSize.width ?? 0,
    height: graphSize.height ?? 0
  }
  const loose = nodes.filter((node) => !linked.has(node.id))
  if (loose.length === 0) return base
  const bottom = cards.length > 0 ? Math.max(...cards.map((card) => card.y + card.height / 2)) : 0
  const left = cards.length > 0 ? Math.min(...cards.map((card) => card.x - card.width / 2)) : 0
  const y = bottom + (cards.length > 0 ? 48 : 0) + CARD.height / 2
  return {
    cards: [
      ...cards,
      ...loose.map((node, index) => ({
        id: node.id,
        x: left + CARD.width / 2 + index * (CARD.width + LOOSE_GAP),
        y,
        ...CARD,
        kind: 'person' as const
      }))
    ],
    wires,
    labels,
    rows: [],
    width: Math.max(base.width, loose.length * (CARD.width + LOOSE_GAP)),
    height: y + CARD.height / 2
  }
}
