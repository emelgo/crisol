/**
 * La lista de los iconos de rol (sus nombres en español, sus palabras y su grupo: @crisol/contracts
 * game-icons-catalog.ts), que es grande: se pide aparte, la primera vez que hace falta (al abrir el buscador, al
 * nombrar un icono), y se queda para lo demás. Pintar uno no la necesita (basta su id)
 */
import { useEffect, useSyncExternalStore } from 'react'

export type GameIconCatalog = typeof import('@crisol/contracts/game-icons-catalog')

let catalog: GameIconCatalog | null = null
let pending: Promise<GameIconCatalog> | null = null
const listeners = new Set<() => void>()

/** Pide la lista (una sola vez) */
export function loadGameIcons(): Promise<GameIconCatalog> {
  pending ??= import('@crisol/contracts/game-icons-catalog').then(
    (loaded) => {
      catalog = loaded
      for (const listener of listeners) listener()
      return loaded
    },
    (error: unknown) => {
      // Sin red, se vuelve a intentar la próxima vez
      pending = null
      throw error
    }
  )
  return pending
}

/** La lista, si ya está (si no, null) */
export const loadedGameIcons = () => catalog

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** La lista de los iconos de rol: null mientras llega (la pide al montarse, si hace falta: wanted) */
export function useGameIcons(wanted = true): GameIconCatalog | null {
  const current = useSyncExternalStore(subscribe, loadedGameIcons, loadedGameIcons)
  useEffect(() => {
    // Sin red, se queda sin nombres (el dibujo se ve igual) y se reintenta la próxima vez
    if (wanted && !current) loadGameIcons().catch(() => {})
  }, [wanted, current])
  return current
}
