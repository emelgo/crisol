/**
 * Lo que el mundo a pantalla completa recuerda en el aparato (ADR-0027): la pestaña de la barra de la izquierda, si va
 * plegada y su ancho, y si el panel de la página va plegado. Sin almacenamiento (ventana privada…), lo de siempre
 */
import { useCallback, useState } from 'react'

export const SIDE_TABS = ['pages', 'files'] as const
export type SideTab = (typeof SIDE_TABS)[number]

/** Cómo va cada pestaña en la dirección (?barra=), en español como las rutas */
export const SIDE_SLUGS: Record<SideTab, string> = { pages: 'paginas', files: 'archivos' }

export function sideTabOfSlug(slug: unknown): SideTab | null {
  return SIDE_TABS.find((tab) => SIDE_SLUGS[tab] === slug) ?? null
}

/** El ancho de la barra de la izquierda: el de siempre, y lo menos y lo más que se estira (en px) */
export const SIDE_WIDTH = { initial: 288, min: 224, max: 448 } as const

export const clampWidth = (width: number) => Math.round(Math.min(SIDE_WIDTH.max, Math.max(SIDE_WIDTH.min, width)))

const KEYS = {
  tab: 'crisol.mundo.pestana',
  folded: 'crisol.mundo.plegada',
  width: 'crisol.mundo.ancho',
  panel: 'crisol.mundo.panel-plegado'
} as const

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Sin almacenamiento: no se recuerda, sin más
  }
}

/** Lo recordado, leído una vez al montar */
export function readShellState() {
  const width = Number(read(KEYS.width))
  return {
    tab: sideTabOfSlug(read(KEYS.tab)) ?? 'pages',
    folded: read(KEYS.folded) === '1',
    width: Number.isFinite(width) && width > 0 ? clampWidth(width) : SIDE_WIDTH.initial,
    panelFolded: read(KEYS.panel) === '1'
  }
}

/** Un valor recordado: se lee al montar y se guarda al cambiarlo */
function useRemembered<T>(initial: () => T, save: (value: T) => void) {
  const [value, setValue] = useState(initial)
  const set = useCallback(
    (next: T) => {
      save(next)
      setValue(next)
    },
    [save]
  )
  return [value, set] as const
}

const saveTab = (tab: SideTab) => write(KEYS.tab, SIDE_SLUGS[tab])
const saveFolded = (folded: boolean) => write(KEYS.folded, folded ? '1' : null)
const saveWidth = (width: number) => write(KEYS.width, String(clampWidth(width)))
const savePanel = (folded: boolean) => write(KEYS.panel, folded ? '1' : null)

export function useShellState() {
  const [tab, setTab] = useRemembered(() => readShellState().tab, saveTab)
  const [folded, setFolded] = useRemembered(() => readShellState().folded, saveFolded)
  const [width, setWidth] = useRemembered(() => readShellState().width, saveWidth)
  const [panelFolded, setPanelFolded] = useRemembered(() => readShellState().panelFolded, savePanel)
  return { tab, setTab, folded, setFolded, width, setWidth, panelFolded, setPanelFolded }
}
