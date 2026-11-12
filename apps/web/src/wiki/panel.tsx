import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from 'react'

/** Lo que enseña el panel de la izquierda de un mundo: sus páginas (el árbol) */
export type WikiPanel = 'pages'

const PANELS: readonly WikiPanel[] = ['pages']
const STORAGE_KEY = 'crisol.panel'
// En lo estrecho el panel es un cajón que se abre encima; el mismo corte que wiki.module.css
const NARROW = '(max-width: 48rem)'

function storedPanel(): WikiPanel {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return PANELS.find((p) => p === value) ?? 'pages'
  } catch {
    return 'pages'
  }
}

type PanelState = {
  panel: WikiPanel
  /** En lo estrecho: el cajón abierto (en lo ancho, el panel está siempre: no se recoge) */
  open: boolean
  /** Pulsar un botón de la barra: en lo estrecho, abre ese panel en su cajón */
  toggle: (panel: WikiPanel, trigger: HTMLElement | null) => void
  /** Abre ese panel sin recoger nada (al llegar a la wiki desde otra pantalla) */
  show: (panel: WikiPanel, trigger: HTMLElement | null) => void
  /** Cierra el cajón; con `back`, el foco vuelve al botón que lo abrió */
  close: (back: boolean) => void
}

const PanelContext = createContext<PanelState | null>(null)

export function WikiPanelProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<WikiPanel>(storedPanel)
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLElement | null>(null)

  const toggle = useCallback((next: WikiPanel, from: HTMLElement | null) => {
    trigger.current = from
    // En lo ancho la columna está fija (Enrique, 2026-11-11: «no debe desaparecer»): solo se elige el panel
    setPanel(next)
    if (window.matchMedia?.(NARROW).matches) setOpen(true)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Sin almacenamiento, el panel vuelve al árbol en la próxima visita
    }
  }, [])

  const show = useCallback((next: WikiPanel, from: HTMLElement | null) => {
    trigger.current = from
    setPanel(next)
    setOpen(window.matchMedia?.(NARROW).matches ?? false)
    // Se recuerda, como al pulsar su botón: al volver, sigue abierto el último
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Sin almacenamiento, el panel vuelve al árbol en la próxima visita
    }
  }, [])

  const close = useCallback((back: boolean) => {
    setOpen(false)
    if (back) trigger.current?.focus()
  }, [])

  const value = useMemo(() => ({ panel, open, toggle, show, close }), [panel, open, toggle, show, close])
  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>
}

export function useWikiPanel(): PanelState {
  const state = useContext(PanelContext)
  if (!state) throw new Error('useWikiPanel fuera de WikiPanelProvider')
  return state
}

/** Si la pantalla es estrecha (el panel es un cajón) */
export function useNarrow(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia?.(NARROW)
      query?.addEventListener('change', onChange)
      return () => query?.removeEventListener('change', onChange)
    },
    () => window.matchMedia?.(NARROW).matches ?? false,
    () => false
  )
}
