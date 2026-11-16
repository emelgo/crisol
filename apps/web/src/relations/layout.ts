/**
 * Dónde va cada página en la pestaña «Relaciones» y en el grafo del mundo (módulo 10): Enlaces, por fuerzas (d3-force),
 * con la página del centro quieta en el origen; Familia y Organigrama, en tarjetas por filas con dagre. Puro (sin
 * React ni DOM): lo prueban las unitarias
 */
import { graphlib, layout } from '@dagrejs/dagre'
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum
} from 'd3-force'

export interface Point {
  x: number
  y: number
}

/** Una página del grafo de fuerzas */
export interface Body extends SimulationNodeDatum {
  id: string
}

interface Link {
  source: string
  target: string
}

/** Un par por arista, sin repetir (dos campos entre las mismas páginas tiran igual que uno) */
function pairs(links: readonly Link[], present: ReadonlySet<string>) {
  const seen = new Set<string>()
  const out: Link[] = []
  for (const { source, target } of links) {
    if (source === target || !present.has(source) || !present.has(target)) continue
    const key = source < target ? `${source} ${target}` : `${target} ${source}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ source, target })
  }
  return out
}

/**
 * La simulación de fuerzas, parada (quien la usa decide cuándo avanza): se repelen, las enlazadas se atraen, no se
 * pisan y todo tiende al centro. center: la página que se queda quieta en el origen. spread: más sitio entre ellas
 * (las del grafo del mundo, con etiquetas más pequeñas, van más juntas)
 */
export function forceSimulationOf(
  ids: readonly string[],
  links: readonly Link[],
  { center = null, spread = 1 }: { center?: string | null; spread?: number } = {}
): { simulation: Simulation<Body, undefined>; bodies: Body[] } {
  const bodies: Body[] = ids.map((id) => (id === center ? { id, fx: 0, fy: 0 } : { id }))
  const present = new Set(ids)
  const simulation = forceSimulation(bodies)
    .force(
      'link',
      forceLink<Body, { source: string | Body; target: string | Body }>(pairs(links, present))
        .id((body) => body.id)
        .distance(110 * spread)
        .strength(0.5)
    )
    .force(
      'charge',
      forceManyBody<Body>()
        .strength(-380 * spread)
        .distanceMax(700 * spread)
    )
    .force('collide', forceCollide<Body>(40 * spread))
    .force('x', forceX<Body>(0).strength(0.05))
    .force('y', forceY<Body>(0).strength(0.05))
    .stop()
  return { simulation, bodies }
}

/** Cuántos pasos hacen falta para que la simulación se pare sola */
export const ticksToSettle = (simulation: Simulation<Body, undefined>) =>
  Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()))

/** Las posiciones ya asentadas, de una vez (para unas cientos de páginas: lo que tarda no se nota) */
export function forceLayout(
  ids: readonly string[],
  links: readonly Link[],
  options: { center?: string | null; spread?: number } = {}
): Map<string, Point> {
  const { simulation, bodies } = forceSimulationOf(ids, links, options)
  simulation.tick(ticksToSettle(simulation))
  return new Map(bodies.map((body) => [body.id, { x: body.x ?? 0, y: body.y ?? 0 }]))
}

// ---------------------------------------------------------------------------
// Familia y Organigrama, en tarjetas
// ---------------------------------------------------------------------------

export const CARD = { width: 188, height: 54 }
export const GROUP_CARD = { width: 236, height: 60 }
/** El hueco entre tarjetas de una columna de miembros */
const STACK_GAP = 10

export interface Card extends Point {
  id: string
  width: number
  height: number
  /** Lo que es en el organigrama: el grupo, quien lo dirige o un miembro (en Familia, una persona) */
  kind: 'person' | 'group' | 'leader' | 'member'
  /** En un grupo: cuántos miembros tiene */
  members?: number
}

/** Una línea entre tarjetas, por sus puntos; partner: la raya entre una pareja */
export interface Wire {
  points: Point[]
  kind: 'family' | 'partner' | 'org'
}

export interface TreeLayout {
  cards: Card[]
  wires: Wire[]
  /** En Familia: la altura de cada generación (para su nombre a la izquierda) */
  rows: { generation: number; y: number }[]
  width: number
  height: number
}

interface TreeNode {
  id: string
  generation?: number | undefined
}

interface TreeEdge {
  source: string
  target: string
  role?: 'parent' | 'partner' | 'member-of' | 'leads' | undefined
}

type Dagre = InstanceType<typeof graphlib.Graph>

function newGraph(ranksep: number, nodesep: number): Dagre {
  const graph = new graphlib.Graph({ multigraph: false })
  graph.setGraph({ rankdir: 'TB', ranksep, nodesep, marginx: 24, marginy: 24 })
  graph.setDefaultEdgeLabel(() => ({}))
  return graph
}

const at = (graph: Dagre, id: string): Point => {
  const node = graph.node(id) as { x?: number; y?: number } | undefined
  return { x: node?.x ?? 0, y: node?.y ?? 0 }
}

function sized(graph: Dagre, cards: Card[], wires: Wire[], rows: TreeLayout['rows']): TreeLayout {
  const label = graph.graph() as { width?: number; height?: number }
  return { cards, wires, rows, width: label.width ?? 0, height: label.height ?? 0 }
}

/**
 * El árbol genealógico en filas, una por generación (hasta ±generations): cada pareja junta, con una raya entre las dos,
 * y de ella baja la línea a sus hijos. Los hijos de cada pareja (o de quien sea su único padre o madre) cuelgan de un
 * punto de unión invisible, que dagre coloca entre las dos filas
 */
export function familyLayout(nodes: readonly TreeNode[], edges: readonly TreeEdge[], generations: number): TreeLayout {
  const kept = nodes.filter((node) => Math.abs(node.generation ?? 0) <= generations)
  const present = new Set(kept.map((node) => node.id))
  const graph = newGraph(26, 36)
  for (const node of kept) graph.setNode(node.id, { width: CARD.width, height: CARD.height })
  // Los padres de cada hijo y las parejas
  const parentsOf = new Map<string, Set<string>>()
  const couples: [string, string][] = []
  for (const edge of edges) {
    if (!present.has(edge.source) || !present.has(edge.target)) continue
    if (edge.role === 'parent') {
      const set = parentsOf.get(edge.source) ?? new Set<string>()
      set.add(edge.target)
      parentsOf.set(edge.source, set)
    } else if (edge.role === 'partner') couples.push([edge.source, edge.target])
  }
  // Un punto de unión por cada grupo de padres (y por cada pareja sin hijos en común)
  const unions = new Map<string, { parents: string[]; children: string[] }>()
  const union = (parents: string[]) => {
    const key = `union:${[...parents].sort().join('+')}`
    let found = unions.get(key)
    if (!found) {
      found = { parents: [...parents].sort(), children: [] }
      unions.set(key, found)
      graph.setNode(key, { width: 2, height: 2 })
      for (const parent of found.parents) graph.setEdge(parent, key, { minlen: 1, weight: 2 })
    }
    return { key, found }
  }
  for (const [child, parents] of parentsOf) {
    const { key, found } = union([...parents])
    found.children.push(child)
    graph.setEdge(key, child, { minlen: 1, weight: 4 })
  }
  for (const [a, b] of couples) union([a, b])
  layout(graph)

  const cards: Card[] = kept.map((node) => ({ id: node.id, ...at(graph, node.id), ...CARD, kind: 'person' }))
  const byId = new Map(cards.map((card) => [card.id, card]))
  const wires: Wire[] = []
  const drawnCouples = new Set<string>()
  for (const [key, { parents, children }] of unions) {
    const placed = parents.flatMap((id) => byId.get(id) ?? []).sort((a, b) => a.x - b.x)
    if (placed.length === 0) continue
    const first = placed[0] as Card
    const last = placed[placed.length - 1] as Card
    // La raya de la pareja, entre sus lados, a media altura (una vez por pareja)
    if (placed.length > 1) {
      const couple = placed.map((card) => card.id).join('+')
      if (!drawnCouples.has(couple)) {
        drawnCouples.add(couple)
        wires.push({
          kind: 'partner',
          points: [
            { x: first.x + first.width / 2, y: first.y },
            { x: last.x - last.width / 2, y: last.y }
          ]
        })
      }
    }
    if (children.length === 0) continue
    // De la mitad de la pareja (o de debajo del padre o la madre) baja a la barra de sus hijos
    const drop =
      placed.length > 1 ? { x: (first.x + last.x) / 2, y: first.y } : { x: first.x, y: first.y + first.height / 2 }
    const bar = at(graph, key).y
    const kids = children.flatMap((id) => byId.get(id) ?? [])
    wires.push({ kind: 'family', points: [drop, { x: drop.x, y: bar }] })
    const xs = [drop.x, ...kids.map((kid) => kid.x)]
    wires.push({
      kind: 'family',
      points: [
        { x: Math.min(...xs), y: bar },
        { x: Math.max(...xs), y: bar }
      ]
    })
    for (const kid of kids)
      wires.push({
        kind: 'family',
        points: [
          { x: kid.x, y: bar },
          { x: kid.x, y: kid.y - kid.height / 2 }
        ]
      })
  }
  // La altura de cada generación: la media de sus tarjetas
  const levels = new Map<number, number[]>()
  for (const node of kept) {
    const card = byId.get(node.id)
    if (!card) continue
    const list = levels.get(node.generation ?? 0) ?? []
    list.push(card.y)
    levels.set(node.generation ?? 0, list)
  }
  const rows = [...levels]
    .map(([generation, ys]) => ({ generation, y: ys.reduce((sum, y) => sum + y, 0) / ys.length }))
    .sort((a, b) => a.generation - b.generation)
  return sized(graph, cards, wires, rows)
}

/**
 * El organigrama en columnas, desde sus grupos de arriba: cada grupo, con quien lo dirige debajo; de él cuelgan, cada
 * uno en su columna, sus miembros (uno bajo otro) y cada subgrupo (que sigue igual hacia abajo)
 */
export function orgLayout(
  nodes: readonly TreeNode[],
  edges: readonly TreeEdge[],
  groups: readonly string[]
): TreeLayout {
  const present = new Set(nodes.map((node) => node.id))
  const leadersOf = new Map<string, string[]>()
  const membersOf = new Map<string, string[]>()
  const push = (map: Map<string, string[]>, key: string, value: string) => {
    const list = map.get(key) ?? []
    if (!list.includes(value)) list.push(value)
    map.set(key, list)
  }
  for (const edge of edges) {
    if (!present.has(edge.source) || !present.has(edge.target)) continue
    if (edge.role === 'leads') push(leadersOf, edge.source, edge.target)
    else if (edge.role === 'member-of') push(membersOf, edge.target, edge.source)
  }
  const isGroup = (id: string) => leadersOf.has(id) || membersOf.has(id)
  const graph = newGraph(34, 28)
  const cards: Card[] = []
  const stacks = new Map<string, string[]>()
  const links: { from: string; to: string; stack: boolean }[] = []
  const placed = new Set<string>()

  const visit = (group: string) => {
    if (placed.has(group)) return
    placed.add(group)
    const leaders = (leadersOf.get(group) ?? []).filter((id) => !placed.has(id))
    const members = (membersOf.get(group) ?? []).filter((id) => !leaders.includes(id))
    const subgroups = members.filter((id) => isGroup(id) && !placed.has(id))
    const plain = members.filter((id) => !subgroups.includes(id) && !placed.has(id))
    graph.setNode(group, { ...GROUP_CARD })
    cards.push({ id: group, x: 0, y: 0, ...GROUP_CARD, kind: 'group', members: members.length })
    let anchor = group
    for (const leader of leaders) {
      placed.add(leader)
      graph.setNode(leader, { ...CARD })
      cards.push({ id: leader, x: 0, y: 0, ...CARD, kind: 'leader' })
      graph.setEdge(anchor, leader, { minlen: 1 })
      links.push({ from: anchor, to: leader, stack: false })
      anchor = leader
    }
    if (plain.length > 0) {
      const stack = `stack:${group}`
      for (const id of plain) placed.add(id)
      stacks.set(stack, plain)
      graph.setNode(stack, {
        width: CARD.width + 16,
        height: plain.length * (CARD.height + STACK_GAP) - STACK_GAP
      })
      graph.setEdge(anchor, stack, { minlen: 1 })
      links.push({ from: anchor, to: stack, stack: true })
    }
    for (const sub of subgroups) {
      if (placed.has(sub)) continue
      visit(sub)
      graph.setEdge(anchor, sub, { minlen: 1 })
      links.push({ from: anchor, to: sub, stack: false })
    }
  }
  for (const group of groups) if (present.has(group)) visit(group)
  layout(graph)

  for (const card of cards) Object.assign(card, at(graph, card.id))
  const byId = new Map(cards.map((card) => [card.id, card]))
  for (const [stack, members] of stacks) {
    const node = graph.node(stack) as { x: number; y: number; height: number }
    let top = node.y - node.height / 2
    for (const id of members) {
      cards.push({ id, x: node.x + 8, y: top + CARD.height / 2, ...CARD, kind: 'member' })
      top += CARD.height + STACK_GAP
    }
  }
  const wires: Wire[] = []
  for (const { from, to, stack } of links) {
    const source = byId.get(from)
    if (!source) continue
    const start = { x: source.x, y: source.y + source.height / 2 }
    if (stack) {
      // Una raya a la izquierda de la columna de miembros, con un trazo a cada uno
      const members = cards.filter((card) => card.kind === 'member' && stacks.get(to)?.includes(card.id))
      const first = members[0]
      const last = members[members.length - 1]
      if (!first || !last) continue
      const rail = first.x - first.width / 2 - 14
      const mid = start.y + 16
      wires.push({
        kind: 'org',
        points: [start, { x: start.x, y: mid }, { x: rail, y: mid }, { x: rail, y: last.y }]
      })
      for (const member of members)
        wires.push({
          kind: 'org',
          points: [
            { x: rail, y: member.y },
            { x: member.x - member.width / 2, y: member.y }
          ]
        })
      continue
    }
    const target = byId.get(to)
    if (!target) continue
    const end = { x: target.x, y: target.y - target.height / 2 }
    const mid = (start.y + end.y) / 2
    wires.push({
      kind: 'org',
      points: start.x === end.x ? [start, end] : [start, { x: start.x, y: mid }, { x: end.x, y: mid }, end]
    })
  }
  return sized(graph, cards, wires, [])
}
