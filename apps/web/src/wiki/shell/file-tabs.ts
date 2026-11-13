/**
 * Los archivos abiertos en el centro del mundo a pantalla completa, como pestañas (ADR-0027): se recuerdan en el
 * aparato, por mundo (las de páginas, en la cuenta). Al abrir otro, si sobran, se va el más antiguo
 */
import { useMemo, useSyncExternalStore } from 'react'

/** Cuántos archivos se quedan abiertos */
export const FILE_TABS = 8

const keyOf = (worldId: string) => `crisol.mundo.archivos.${worldId}`
const listeners = new Set<() => void>()
const emit = () => {
  for (const listener of listeners) listener()
}

function raw(worldId: string): string {
  try {
    return localStorage.getItem(keyOf(worldId)) ?? '[]'
  } catch {
    return '[]'
  }
}

function parse(text: string): string[] {
  try {
    const value: unknown = JSON.parse(text)
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export const readFileTabs = (worldId: string) => parse(raw(worldId))

function save(worldId: string, ids: string[]) {
  try {
    localStorage.setItem(keyOf(worldId), JSON.stringify(ids))
  } catch {
    // Sin almacenamiento: no se recuerdan, sin más
  }
  emit()
}

/** Abre un archivo (si ya estaba, se queda donde estaba) */
export function openFileTab(worldId: string, fileId: string) {
  const ids = readFileTabs(worldId)
  if (ids.includes(fileId)) return
  save(worldId, [...ids, fileId].slice(-FILE_TABS))
}

/** Cierra un archivo: devuelve los que quedan */
export function closeFileTab(worldId: string, fileId: string) {
  const rest = readFileTabs(worldId).filter((id) => id !== fileId)
  save(worldId, rest)
  return rest
}

/** Los abiertos de un mundo, al día (también si cambian en otra pestaña del navegador) */
export function useFileTabs(worldId: string) {
  const text = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      window.addEventListener('storage', onChange)
      return () => {
        listeners.delete(onChange)
        window.removeEventListener('storage', onChange)
      }
    },
    () => raw(worldId),
    () => '[]'
  )
  return useMemo(() => parse(text), [text])
}
