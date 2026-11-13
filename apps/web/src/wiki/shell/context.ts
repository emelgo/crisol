/**
 * El mundo a pantalla completa (ADR-0027), para lo que va dentro: la página abierta, si el panel de la página va
 * plegado y abrir un archivo en el centro. Fuera del mundo (una plantilla, una ventana de la Mesa), null
 */
import { createContext, useContext } from 'react'

export interface WorldShellValue {
  worldId: string
  /** El panel de la página, plegado (se recuerda en el aparato) */
  panelFolded: boolean
  setPanelFolded: (folded: boolean) => void
}

export const WorldShellContext = createContext<WorldShellValue | null>(null)

export const useWorldShell = () => useContext(WorldShellContext)

/** La clave de una página en la caché (la misma en todo el mundo) */
export const pageKey = (worldId: string, pageId: string) => ['pages', worldId, 'page', pageId]

/**
 * En el mundo a pantalla completa, el hueco de la tira de la página (a la derecha de sus pestañas) donde la pestaña
 * abierta pone sus herramientas: la misma tira en el texto, el mapa y la pizarra (Enrique, 2026-11-13: «deben mantener
 * el esqueleto»)
 */
export const TabToolsSlot = createContext<HTMLElement | null>(null)
