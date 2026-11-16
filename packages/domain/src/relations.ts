/**
 * Las relaciones del mundo (módulo 10): las aristas salen de los campos de enlace de las páginas y de los enlaces de su
 * texto («menciona»). Con ellas, el vecindario de una página, su árbol genealógico (papeles parent y partner) y el
 * organigrama de su grupo (member-of y leads). Lo que no ve quien pregunta ya viene quitado: aquí no se filtra por eso
 */
import type { PageProperty, RelationRole } from './properties.ts'
import { fieldKey } from './templates.ts'

export interface RelationEdge {
  source: string
  target: string
  kind: 'field' | 'mention'
  /** «mention», o la del campo: field:<id> (o name:<nombre> sin id) */
  key: string
  /** El nombre del campo (vacío en una mención) */
  name: string
  inverseName?: string
  role?: RelationRole
  /** Sale de un secreto o de una nota oculta (solo el máster lo recibe) */
  secret?: true
}

/** Una página con lo que hace falta para el grafo (sus propiedades, ya sin lo que no ve quien pregunta) */
export interface RelationPage {
  id: string
  properties: readonly PageProperty[]
}

/** Un enlace del texto de una página a otra, y si sale de un secreto o una nota oculta */
export interface Mention {
  source: string
  target: string
  secret: boolean
}

/** La clave de la relación de un campo de enlace: su id o, sin él, su nombre */
export const relationKeyOf = (property: Pick<PageProperty, 'field' | 'name'>) =>
  property.field ? `field:${property.field}` : `name:${fieldKey(property.name)}`

export const MENTION_KEY = 'mention'

/**
 * Las aristas entre estas páginas: una por campo y destino, y una «menciona» por par (de secreto solo si todos los
 * enlaces salen de secretos), salvo si el destino ya está en un campo de la página. Sin enlaces a sí misma ni a páginas
 * que no están
 */
export function relationEdges(pages: readonly RelationPage[], mentions: readonly Mention[]): RelationEdge[] {
  const present = new Set(pages.map((page) => page.id))
  const edges: RelationEdge[] = []
  const linked = new Set<string>()
  const seen = new Set<string>()
  for (const page of pages) {
    for (const property of page.properties) {
      if (property.type !== 'pages') continue
      const key = relationKeyOf(property)
      for (const target of property.value) {
        if (target === page.id || !present.has(target)) continue
        const id = `${page.id}|${target}|${key}`
        if (seen.has(id)) continue
        seen.add(id)
        linked.add(`${page.id}|${target}`)
        edges.push({
          source: page.id,
          target,
          kind: 'field',
          key,
          name: property.name,
          ...(property.inverseName ? { inverseName: property.inverseName } : {}),
          ...(property.role ? { role: property.role } : {})
        })
      }
    }
  }
  const byPair = new Map<string, Mention>()
  for (const mention of mentions) {
    if (mention.source === mention.target || !present.has(mention.source) || !present.has(mention.target)) continue
    const pair = `${mention.source}|${mention.target}`
    if (linked.has(pair)) continue
    const before = byPair.get(pair)
    byPair.set(pair, before ? { ...before, secret: before.secret && mention.secret } : mention)
  }
  for (const { source, target, secret } of byPair.values())
    edges.push({ source, target, kind: 'mention', key: MENTION_KEY, name: '', ...(secret ? { secret: true } : {}) })
  return edges
}

/** Las aristas de cada página, de salida y de entrada */
function adjacency(edges: readonly RelationEdge[]) {
  const by = new Map<string, RelationEdge[]>()
  const add = (id: string, edge: RelationEdge) => {
    const list = by.get(id)
    if (list) list.push(edge)
    else by.set(id, [edge])
  }
  for (const edge of edges) {
    add(edge.source, edge)
    if (edge.target !== edge.source) add(edge.target, edge)
  }
  return (id: string) => by.get(id) ?? []
}

const other = (edge: RelationEdge, id: string) => (edge.source === id ? edge.target : edge.source)
const FAMILY: ReadonlySet<string> = new Set<RelationRole>(['parent', 'partner'])
const ORG: ReadonlySet<string> = new Set<RelationRole>(['member-of', 'leads'])

/** Los modos que tiene una página: enlaces si tiene alguna relación; familia y organigrama, si tiene esos papeles */
export function relationModes(edges: readonly RelationEdge[], pageId: string): ('links' | 'family' | 'org')[] {
  const own = edges.filter((edge) => edge.source === pageId || edge.target === pageId)
  if (own.length === 0) return []
  return [
    'links',
    ...(own.some((edge) => edge.role && FAMILY.has(edge.role)) ? (['family'] as const) : []),
    ...(own.some((edge) => edge.role && ORG.has(edge.role)) ? (['org'] as const) : [])
  ]
}

/** Lo que sale de un modo: las páginas (de la más cercana a la más lejana) y las aristas entre ellas */
export interface RelationView {
  ids: string[]
  edges: RelationEdge[]
  truncated: boolean
}

const among = (edges: readonly RelationEdge[], ids: ReadonlySet<string>) =>
  edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))

/** El vecindario de una página: hasta depth saltos por cualquier relación, en los dos sentidos, como mucho limit */
export function neighborhood(edges: readonly RelationEdge[], pageId: string, depth: number, limit = 500): RelationView {
  const of = adjacency(edges)
  const found = new Set([pageId])
  let frontier = [pageId]
  let truncated = false
  for (let step = 0; step < depth && frontier.length > 0 && !truncated; step++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const edge of of(id)) {
        const neighbour = other(edge, id)
        if (found.has(neighbour)) continue
        if (found.size >= limit) {
          truncated = true
          break
        }
        found.add(neighbour)
        next.push(neighbour)
      }
      if (truncated) break
    }
    frontier = next
  }
  return { ids: [...found], edges: among(edges, found), truncated }
}

/**
 * El árbol genealógico: por los papeles parent (el destino es padre o madre de la página) y partner, hasta generations
 * generaciones arriba y abajo (también hermanos, tíos y primos, mientras no se salgan). La pareja de cada uno sale a su
 * lado, sin seguir por su familia
 */
export function familyTree(
  edges: readonly RelationEdge[],
  pageId: string,
  generations = 3,
  limit = 500
): RelationView & { generation: Map<string, number> } {
  const family = edges.filter((edge) => edge.role === 'parent' || edge.role === 'partner')
  const of = adjacency(family)
  const generation = new Map([[pageId, 0]])
  const queue = [pageId]
  let truncated = false
  // Primero la sangre (padres e hijos), luego las parejas
  while (queue.length > 0 && !truncated) {
    const id = queue.shift() as string
    const level = generation.get(id) as number
    for (const edge of of(id)) {
      if (edge.role !== 'parent') continue
      // source es hijo de target
      const next = edge.source === id ? edge.target : edge.source
      const at = edge.source === id ? level - 1 : level + 1
      if (generation.has(next) || Math.abs(at) > generations) continue
      if (generation.size >= limit) {
        truncated = true
        break
      }
      generation.set(next, at)
      queue.push(next)
    }
  }
  for (const [id, level] of [...generation]) {
    for (const edge of of(id)) {
      if (edge.role !== 'partner') continue
      const next = other(edge, id)
      if (generation.has(next)) continue
      if (generation.size >= limit) {
        truncated = true
        break
      }
      generation.set(next, level)
    }
  }
  const ids = new Set(generation.keys())
  return { ids: [...ids], edges: among(family, ids), truncated, generation }
}

/**
 * El organigrama: el grupo de la página (ella misma si alguien pertenece a ella o la dirige; si no, los grupos a los que
 * pertenece o que dirige), con quien lo dirige y sus miembros, y los de sus subgrupos hasta levels niveles
 */
export function orgChart(
  edges: readonly RelationEdge[],
  pageId: string,
  levels = 3,
  limit = 500
): RelationView & { groups: string[] } {
  const org = edges.filter((edge) => edge.role === 'member-of' || edge.role === 'leads')
  const of = adjacency(org)
  // Pertenecen a él (member-of hacia él) o lo dirige alguien (leads desde él)
  const isGroup = (id: string) =>
    of(id).some(
      (edge) => (edge.role === 'member-of' && edge.target === id) || (edge.role === 'leads' && edge.source === id)
    )
  const groups = isGroup(pageId)
    ? [pageId]
    : [
        ...new Set(
          of(pageId).flatMap((edge) =>
            edge.role === 'member-of' && edge.source === pageId
              ? [edge.target]
              : edge.role === 'leads' && edge.target === pageId
                ? [edge.source]
                : []
          )
        )
      ]
  const found = new Set([pageId, ...groups])
  let frontier = [...groups]
  let truncated = false
  for (let level = 0; level < levels && frontier.length > 0 && !truncated; level++) {
    const next: string[] = []
    for (const group of frontier) {
      for (const edge of of(group)) {
        const leader = edge.role === 'leads' && edge.source === group
        const member = edge.role === 'member-of' && edge.target === group
        if (!leader && !member) continue
        const id = other(edge, group)
        if (found.has(id)) continue
        if (found.size >= limit) {
          truncated = true
          break
        }
        found.add(id)
        if (member && isGroup(id)) next.push(id)
      }
    }
    frontier = next
  }
  return { ids: [...found], edges: among(org, found), truncated, groups }
}

/** Una página del grafo del mundo, con lo que hace falta para filtrarla */
export interface GraphPage {
  id: string
  /** Su plantilla y las de las que viene */
  line: readonly string[]
  /** Sus etiquetas visibles */
  tags: readonly string[]
}

export interface GraphFilter {
  /** Solo las de estas plantillas (o de sus copias) */
  templates?: readonly string[] | undefined
  /** Solo estas relaciones (sus claves) */
  relations?: readonly string[] | undefined
  /** Solo las que llevan alguna (o una hija suya) */
  tags?: readonly string[] | undefined
  /** También las que no tienen relaciones */
  orphans: boolean
}

/** Cuántas aristas hay de cada relación */
export interface RelationCount {
  key: string
  kind: 'field' | 'mention'
  name: string
  inverseName?: string
  role?: RelationRole
  count: number
}

/**
 * El grafo del mundo filtrado: las páginas de esas plantillas y etiquetas, las aristas de esas relaciones entre ellas
 * y, sin orphans, solo las páginas con alguna. counts, las relaciones que hay entre las páginas filtradas (antes de
 * filtrar por relación: para elegir)
 */
export function filterGraph<P extends GraphPage>(
  pages: readonly P[],
  edges: readonly RelationEdge[],
  filter: GraphFilter
): { pages: P[]; edges: RelationEdge[]; counts: RelationCount[] } {
  const templates = filter.templates ? new Set(filter.templates) : null
  const tags = filter.tags?.map((tag) => tag.toLocaleLowerCase('es'))
  const hasTag = (page: GraphPage) =>
    page.tags.some((tag) => {
      const own = tag.toLocaleLowerCase('es')
      return tags?.some((wanted) => own === wanted || own.startsWith(`${wanted}/`))
    })
  const kept = pages.filter(
    (page) => (!templates || page.line.some((t) => templates.has(t))) && (!tags || tags.length === 0 || hasTag(page))
  )
  const ids = new Set(kept.map((page) => page.id))
  const between = among(edges, ids)
  const counts = new Map<string, RelationCount>()
  for (const edge of between) {
    const count = counts.get(edge.key)
    if (count) count.count++
    else
      counts.set(edge.key, {
        key: edge.key,
        kind: edge.kind,
        name: edge.name,
        ...(edge.inverseName ? { inverseName: edge.inverseName } : {}),
        ...(edge.role ? { role: edge.role } : {}),
        count: 1
      })
  }
  const relations = filter.relations ? new Set(filter.relations) : null
  const chosen = relations ? between.filter((edge) => relations.has(edge.key)) : between
  const linked = new Set(chosen.flatMap((edge) => [edge.source, edge.target]))
  return {
    pages: filter.orphans ? kept : kept.filter((page) => linked.has(page.id)),
    edges: chosen,
    counts: [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'))
  }
}
