/**
 * El mundo a pantalla completa (ADR-0027), para lo que va dentro: la página abierta, si el panel de la página va
 * plegado y abrir un archivo en el centro. Fuera del mundo (una plantilla, una ventana de la Mesa), null
 */
import { createContext, type ReactNode, useContext } from 'react'

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

/** En el mundo a pantalla completa, el título y las pestañas de la página que van en la barra de una pizarra */
export const BoardHeadContext = createContext<ReactNode>(null)
