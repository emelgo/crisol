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

/** Lo que enseña el panel lateral de la wiki: el árbol, la búsqueda o los marcadores */
export type WikiPanel = 'pages' | 'search' | 'bookmarks'

const PANELS: readonly WikiPanel[] = ['pages', 'search', 'bookmarks']
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
  /** En lo ancho: el panel recogido (se pulsa otra vez el botón del que está abierto) */
  collapsed: boolean
  /** En lo estrecho: el cajón abierto */
  open: boolean
  /** Pulsar un botón de la barra: abre ese panel, o recoge el que ya está abierto */
  toggle: (panel: WikiPanel, trigger: HTMLElement | null) => void
  /** Abre ese panel sin recoger nada (al llegar a la wiki desde otra pantalla) */
  show: (panel: WikiPanel, trigger: HTMLElement | null) => void
  /** Cierra el cajón; con `back`, el foco vuelve al botón que lo abrió */
  close: (back: boolean) => void
}

const PanelContext = createContext<PanelState | null>(null)

export function WikiPanelProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<WikiPanel>(storedPanel)
  const [collapsed, setCollapsed] = useState(false)
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLElement | null>(null)

  const toggle = useCallback(
    (next: WikiPanel, from: HTMLElement | null) => {
      trigger.current = from
      const narrow = window.matchMedia?.(NARROW).matches ?? false
      if (narrow) {
        setPanel(next)
        setOpen(true)
      } else if (next === panel && !collapsed) {
        setCollapsed(true)
      } else {
        setPanel(next)
        setCollapsed(false)
      }
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // Sin almacenamiento, el panel vuelve al árbol en la próxima visita
      }
    },
    [panel, collapsed]
  )

  const show = useCallback((next: WikiPanel, from: HTMLElement | null) => {
    trigger.current = from
    setPanel(next)
    setCollapsed(false)
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

  const value = useMemo(
    () => ({ panel, collapsed, open, toggle, show, close }),
    [panel, collapsed, open, toggle, show, close]
  )
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
