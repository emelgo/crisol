/**
 * Dibujar, retocar y quitar regiones, rutas y textos (módulo 9), con el mapa de la caché al día al momento, y Ctrl+Z
 * mientras se edita: cada cambio guarda cómo estaba para volver a ello (lo creado se quita; lo quitado se vuelve a
 * poner). El historial de Crisol sigue deshaciendo lo de antes
 */
import type { MapElementView, MapView, Page } from '@crisol/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { useApi } from '../../api/context.tsx'
import { mapKey } from './keys.ts'

export type ElementPatch = Partial<Pick<MapElementView, 'geometry' | 'label' | 'pageId' | 'style' | 'hidden'>> & {
  layerId?: string
}
type CreateInput = Pick<MapElementView, 'kind' | 'geometry'> & Partial<Omit<ElementPatch, 'geometry'>>

/** Lo que se deshace: quitar lo creado, devolver lo de antes de un cambio, o volver a poner lo quitado */
type Undo =
  | { kind: 'created'; id: string }
  | { kind: 'changed'; id: string; before: ElementPatch }
  | { kind: 'removed'; element: MapElementView }

const MAX_UNDO = 50

export function useElements(page: Page, map: MapView) {
  const api = useApi()
  const queryClient = useQueryClient()
  const key = mapKey(page.worldId, map.tabId)
  const undos = useRef<Undo[]>([])
  const remember = (undo: Undo) => {
    undos.current.push(undo)
    if (undos.current.length > MAX_UNDO) undos.current.shift()
  }
  const setMap = (fn: (current: MapView) => MapView) =>
    queryClient.setQueryData<MapView>(key, (current) => (current ? fn(current) : current))
  const put = (element: MapElementView) =>
    setMap((current) => ({
      ...current,
      // Si nace sin capas, la «General» que se crea viene con él: que la caché la sepa
      layers:
        element.layerId && !current.layers.some((layer) => layer.id === element.layerId)
          ? [...current.layers, { id: element.layerId, name: 'General', hidden: false }]
          : current.layers,
      elements: current.elements.some((other) => other.id === element.id)
        ? current.elements.map((other) => (other.id === element.id ? element : other))
        : [...current.elements, element]
    }))

  const create = useMutation({
    mutationFn: (input: CreateInput) => api.call('createMapElement', { mapId: map.id, ...input }),
    onSuccess: (element) => {
      put(element)
      remember({ kind: 'created', id: element.id })
    }
  })

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ElementPatch; silent?: boolean }) =>
      api.call('updateMapElement', { elementId: id, ...patch }),
    // Se ve al momento; si falla, vuelve lo del servidor
    onMutate: ({ id, patch, silent }) => {
      const before = map.elements.find((element) => element.id === id)
      if (before && !silent) {
        // Lo de antes de cada campo que cambia (una capa nula, la de antes de las capas, no se puede volver a poner)
        const previous = Object.fromEntries(
          Object.keys(patch)
            .map((field) => [field, before[field as keyof ElementPatch]])
            .filter(([field, value]) => !(field === 'layerId' && value === null))
        ) as ElementPatch
        remember({ kind: 'changed', id, before: previous })
      }
      setMap((current) => ({
        ...current,
        elements: current.elements.map((element) => (element.id === id ? { ...element, ...patch } : element))
      }))
    },
    onSuccess: put,
    onError: () => queryClient.invalidateQueries({ queryKey: key })
  })

  const remove = useMutation({
    mutationFn: (element: MapElementView) => api.call('deleteMapElement', { elementId: element.id }),
    onSuccess: ({ id }, element) => {
      remember({ kind: 'removed', element })
      setMap((current) => ({ ...current, elements: current.elements.filter((other) => other.id !== id) }))
    }
  })

  /** Deshacer lo último que se hizo editando; dice si había algo */
  const undo = async () => {
    const last = undos.current.pop()
    if (!last) return false
    if (last.kind === 'created') {
      await api.call('deleteMapElement', { elementId: last.id })
      setMap((current) => ({ ...current, elements: current.elements.filter((other) => other.id !== last.id) }))
    } else if (last.kind === 'changed') {
      put(await api.call('updateMapElement', { elementId: last.id, ...last.before }))
    } else {
      const { element } = last
      put(
        await api.call('createMapElement', {
          mapId: map.id,
          kind: element.kind,
          geometry: element.geometry,
          label: element.label,
          pageId: element.pageId,
          style: element.style,
          hidden: element.hidden,
          ...(element.layerId ? { layerId: element.layerId } : {})
        })
      )
    }
    return true
  }

  return { create, update, remove, undo }
}
