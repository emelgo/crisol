/**
 * El gráfico que se está editando (módulo 10): mientras un bloque «Gráfico» está elegido en el editor, su editor visual
 * ocupa el sitio del panel de la derecha de la página. El bloque lo apunta aquí y el panel lo lee
 */
import type { JSONContent } from '@tiptap/core'
import { useSyncExternalStore } from 'react'

export interface ChartEditing {
  /** El bloque (su id; sin él, su posición): al cambiar de bloque, el editor empieza de nuevo */
  key: string
  yaml: string
  /** El documento de la página: sus tablas, para los datos de una */
  doc: JSONContent
  update: (yaml: string) => void
  /** Deja de elegirlo (la X del editor) */
  close: () => void
}

let current: ChartEditing | null = null
const listeners = new Set<() => void>()

export function setChartEditing(next: ChartEditing | null) {
  current = next
  for (const listener of listeners) listener()
}

/** Deja de editar ese bloque (si es el que se edita) */
export function clearChartEditing(key: string) {
  if (current?.key === key) setChartEditing(null)
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useChartEditing() {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null
  )
}
