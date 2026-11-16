/**
 * Las consultas de las relaciones (módulo 10): las de una página en un modo y el grafo del mundo, con lo que ve quien
 * lee (ADR-0017). Sus claves cuelgan de ['pages', mundo]: cambiar una página (sus campos, su texto) las rehace
 */
import type { RelationMode } from '@crisol/contracts'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useApi } from '../api/context.tsx'
import { useTemplates } from '../templates/data.ts'
import { type ReadAs, readAsInput, readAsKey, useReadAs } from '../wiki/read-as.tsx'

export interface RelationsQuery {
  mode: RelationMode
  depth: number
  fieldsOnly: boolean
}

/** La primera vista de una página: Enlaces a un salto, con las menciones (también dice qué modos tiene) */
export const FIRST_VIEW: RelationsQuery = { mode: 'links', depth: 1, fieldsOnly: false }

export const relationsKey = (worldId: string, pageId: string, query: RelationsQuery, readAs: ReadAs | null) => [
  'pages',
  worldId,
  'relations',
  pageId,
  query.mode,
  // La profundidad y «Solo campos», solo en Enlaces
  query.mode === 'links' ? query.depth : 0,
  query.mode === 'links' ? query.fieldsOnly : false,
  ...readAsKey(readAs)
]

/** Las relaciones de una página en un modo */
export function useRelations(worldId: string, pageId: string, query: RelationsQuery, enabled = true) {
  const api = useApi()
  const readAs = useReadAs()
  return useQuery({
    queryKey: relationsKey(worldId, pageId, query, readAs),
    queryFn: () =>
      api.call('getRelations', {
        pageId,
        mode: query.mode,
        depth: query.depth,
        ...(query.fieldsOnly ? { fieldsOnly: true } : {}),
        ...readAsInput(readAs)
      }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000
  })
}

/** Los modos de una página (vacío, sin relaciones: sin pestaña «Relaciones») */
export function useRelationModes(worldId: string, pageId: string, enabled = true) {
  const result = useRelations(worldId, pageId, FIRST_VIEW, enabled)
  // Lo de otra página (lo anterior, mientras llega) no vale
  return result.data?.pageId === pageId ? result.data.modes : []
}

/** El grafo de todo el mundo (con las sueltas: se ocultan aquí), filtrado por etiquetas en el servidor */
export function useWorldGraph(worldId: string, tags: readonly string[]) {
  const api = useApi()
  const readAs = useReadAs()
  return useQuery({
    queryKey: ['pages', worldId, 'relations', 'world', [...tags].sort(), ...readAsKey(readAs)],
    queryFn: () =>
      api.call('getWorldGraph', {
        worldId,
        orphans: true,
        ...(tags.length > 0 ? { tags: [...tags] } : {}),
        ...readAsInput(readAs)
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000
  })
}

/**
 * Las plantillas de la cuenta, para el nombre y el color de cada página: el orden de la lista da el color. Quien juega
 * no ve las del máster: sin nombre, y el color por orden de aparición
 */
export function useTemplateLook() {
  const readAs = useReadAs()
  const templates = useTemplates()
  return useMemo(() => {
    const list = readAs ? [] : [...(templates.data?.templates ?? []), ...(templates.data?.deleted ?? [])]
    const names = new Map(list.map((each) => [each.id, each.name]))
    return {
      order: list.map((each) => each.id),
      nameOf: (id: string | null) => (id ? (names.get(id) ?? null) : null)
    }
  }, [templates.data, readAs])
}
