/**
 * La página de un mundo, como la de Everlore (Enrique, 2026-11-16), para lo que va dentro: si el panel de la página va
 * plegado (se recuerda en el aparato) y dónde pone sus herramientas la pestaña abierta. Fuera del mundo (una plantilla,
 * una ventana de la Mesa), null: la página de siempre
 */
import { createContext, useCallback, useContext, useState } from 'react'

export interface WorldPageValue {
  /** El panel de la página, plegado */
  panelFolded: boolean
  setPanelFolded: (folded: boolean) => void
}

export const WorldPageContext = createContext<WorldPageValue | null>(null)

export const useWorldPage = () => useContext(WorldPageContext)

/**
 * El hueco a la derecha de las pestañas de la página donde la pestaña abierta pone sus herramientas: la misma tira en
 * el texto, el mapa y la pizarra (Enrique, 2026-11-13: «deben mantener el esqueleto»)
 */
export const TabToolsSlot = createContext<HTMLElement | null>(null)

const PANEL_KEY = 'crisol.mundo.panel-plegado'

function readFolded() {
  try {
    return localStorage.getItem(PANEL_KEY) === '1'
  } catch {
    return false
  }
}

/** Si el panel de la página va plegado, recordado en el aparato (sin almacenamiento, abierto) */
export function useRememberedPanel() {
  const [folded, setFolded] = useState(readFolded)
  const set = useCallback((next: boolean) => {
    try {
      if (next) localStorage.setItem(PANEL_KEY, '1')
      else localStorage.removeItem(PANEL_KEY)
    } catch {
      // Sin almacenamiento: no se recuerda, sin más
    }
    setFolded(next)
  }, [])
  return [folded, set] as const
}
