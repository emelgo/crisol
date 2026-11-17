/**
 * Las relaciones del mundo (módulo 10, docs/specs/modulo-10.md): las de una página (vecindario, árbol genealógico u
 * organigrama) y el grafo de todo el mundo. Se calculan con cada petición de los campos de enlace y de page_links, con
 * lo que ve quien pregunta (ADR-0017, la pauta de getPageLinks): un jugador, solo páginas que ve, campos no ocultos,
 * destinos que ve y enlaces desde documentos que ve; los de secretos y notas ocultas, solo el máster y marcados
 */
import { getRelations, getWorldGraph, type RelationNode } from '@crisol/contracts'
import { linksRepo } from '@crisol/db'
import {
  familyTree,
  filterGraph,
  type Mention,
  neighborhood,
  orgChart,
  type PageProperty,
  RELATION_ROLES,
  type RelationRole,
  type RelationView,
  relationEdges,
  relationModes
} from '@crisol/domain'
import { viewedPage, visibleProperties } from '../wiki/projection.ts'
import { authorizedView, searchScope, type WikiView } from '../wiki/reader.ts'
import { findTemplate } from '../wiki/templates.ts'
import type { ActionContext } from './context.ts'
import { implement } from './registry.ts'

/** Las páginas que se dan de una vez como mucho en las relaciones de una página */
const PAGE_LIMIT = 500

/** Lo que va bajo el nombre en las tarjetas: su primer campo de texto con algo (ya sin los que no ve quien pregunta) */
function subtitleOf(properties: readonly PageProperty[]): string | undefined {
  for (const property of properties)
    if (property.type === 'text' && property.value.trim()) return property.value.trim().slice(0, 120)
  return undefined
}

/** Sus etiquetas (sin toLocaleLowerCase: con miles de páginas, se nota) */
function tagsOf(properties: readonly PageProperty[]): string[] {
  const found = properties.find((p) => p.type === 'list' && p.name.trim().toLowerCase() === 'etiquetas')
  return found?.type === 'list' ? found.value : []
}

const isRole = (value: unknown): value is RelationRole => RELATION_ROLES.includes(value as RelationRole)
const strings = (value: unknown[]) => value.filter((item): item is string => typeof item === 'string')

/**
 * Los campos de enlace, los de texto y las etiquetas de una página, leídos sin zod (se comprobaron al guardarlos; con 5.000 páginas,
 * zod se come el tiempo)
 */
function graphProperties(stored: readonly Record<string, unknown>[]): PageProperty[] {
  return stored.flatMap((item): PageProperty[] => {
    if (typeof item.name !== 'string') return []
    const base = {
      name: item.name,
      ...(typeof item.field === 'string' ? { field: item.field } : {}),
      ...(item.hidden === true ? { hidden: true as const } : {})
    }
    if (item.type === 'text' && typeof item.value === 'string') return [{ ...base, type: 'text', value: item.value }]
    if (!Array.isArray(item.value)) return []
    if (item.type === 'list') return [{ ...base, type: 'list', value: strings(item.value) }]
    if (item.type !== 'pages') return []
    return [
      {
        ...base,
        type: 'pages',
        value: strings(item.value),
        ...(isRole(item.role) ? { role: item.role } : {}),
        ...(typeof item.inverseName === 'string' && item.inverseName ? { inverseName: item.inverseName } : {})
      }
    ]
  })
}

/** El grafo del mundo con lo que ve quien pregunta: sus páginas (con sus etiquetas visibles) y sus aristas */
async function visibleGraph(ctx: ActionContext, worldId: string, view: WikiView) {
  const [rows, scope] = await Promise.all([linksRepo.worldGraph(ctx.db, worldId), searchScope(ctx, worldId, view)])
  const separates = new Set(scope?.separates ?? [])
  const pages = view.pages(rows.pages).map((row) => {
    const properties = visibleProperties(graphProperties(row.properties), view)
    return {
      id: row.id,
      title: row.title,
      icon: row.icon,
      template: row.template,
      line: row.line,
      tags: tagsOf(properties),
      subtitle: subtitleOf(properties),
      properties
    }
  })
  // Un jugador: solo desde lo que ve (el cuerpo de una página que ve, un secreto revelado, una pestaña visible; nunca
  // las notas ocultas). El máster, todo, con lo de secretos y notas marcado
  const mentions: Mention[] = rows.mentions.flatMap((row) => {
    if (view.full)
      return [{ source: row.source, target: row.target, secret: row.kind === 'secret' || row.kind === 'note' }]
    const seen =
      row.kind === 'body'
        ? view.seesPage(row.source)
        : row.kind !== 'note' && row.documentId !== null && separates.has(row.documentId)
    return seen && view.seesPage(row.target) ? [{ source: row.source, target: row.target, secret: false }] : []
  })
  return { pages, edges: relationEdges(pages, mentions) }
}

type GraphPage = Awaited<ReturnType<typeof visibleGraph>>['pages'][number]

const nodeOf = (page: GraphPage, generation?: number): RelationNode => ({
  id: page.id,
  title: page.title,
  icon: page.icon,
  template: page.template,
  ...(page.subtitle === undefined ? {} : { subtitle: page.subtitle }),
  ...(generation === undefined ? {} : { generation })
})

export const relationActions = [
  implement(getRelations, async (ctx, { pageId, depth, mode, fieldsOnly, ...as }) => {
    const { page, wiki, view } = await viewedPage(ctx, pageId, as)
    const graph = await visibleGraph(ctx, wiki.worldId, view)
    const byId = new Map(graph.pages.map((p) => [p.id, p]))
    const modes = relationModes(graph.edges, page.id)
    const edges = fieldsOnly ? graph.edges.filter((edge) => edge.kind === 'field') : graph.edges
    let result: RelationView & { generation?: Map<string, number>; groups?: string[] }
    if (!modes.includes(mode)) result = { ids: [page.id], edges: [], truncated: false }
    else if (mode === 'family') result = familyTree(edges, page.id, 3, PAGE_LIMIT)
    else if (mode === 'org') result = orgChart(edges, page.id, 3, PAGE_LIMIT)
    else result = neighborhood(edges, page.id, depth, PAGE_LIMIT)
    return {
      pageId: page.id,
      mode,
      modes,
      nodes: result.ids.flatMap((id) => {
        const found = byId.get(id)
        return found ? [nodeOf(found, result.generation?.get(id))] : []
      }),
      edges: result.edges,
      groups: result.groups ?? [],
      truncated: result.truncated
    }
  }),

  implement(getWorldGraph, async (ctx, { worldId, templates, relations, tags, orphans, ...as }) => {
    const { wiki, view } = await authorizedView(ctx, worldId, as)
    // Las plantillas, por su id o su nombre (una que no hay lo dice, con las que hay)
    const lines = templates
      ? await Promise.all(templates.map(async (ref) => (await findTemplate(ctx, wiki.organizationId, ref)).id))
      : undefined
    const graph = await visibleGraph(ctx, wiki.worldId, view)
    const filtered = filterGraph(graph.pages, graph.edges, { templates: lines, relations, tags, orphans })
    return {
      nodes: filtered.pages.map((p) => nodeOf(p)),
      // Cortas: lo de cada relación va una vez, en relations
      edges: filtered.edges.map(({ source, target, key, secret }) => ({
        source,
        target,
        key,
        ...(secret ? { secret } : {})
      })),
      relations: filtered.counts
    }
  })
]
