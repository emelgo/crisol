/**
 * Las ventanas sobre la Mesa (lienzo «Campaña en la Mesa», como los diarios de Foundry VTT): páginas, entradas del
 * compendio, libros y fichas se abren encima del mapa sin cambiar de vista. Se mueven por su cabecera, se estiran por
 * la esquina (también con el teclado: flechas para mover, Mayúsculas + flechas para estirar), se traen delante, se
 * minimizan abajo a la izquierda y recuerdan dónde estaban
 */
import { Minus, X } from 'lucide-react'
import {
  createContext,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import styles from './windows.module.css'

export interface WindowSpec {
  /** Una por cosa: abrir otra vez la misma la trae delante */
  id: string
  title: string
  render: () => ReactNode
  /** Lo que va en su cabecera antes de minimizar (Enseñar a los jugadores…) */
  actions?: () => ReactNode
  width?: number
  height?: number
}

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

interface OpenWindow extends WindowSpec {
  box: Box
  minimized: boolean
}

/** Un enlace pulsado dentro de una ventana: true si lo abre en otra (una página) en vez de cambiar de vista */
export type LinkHandler = (url: URL, text: string, open: (spec: WindowSpec) => void) => boolean

interface WindowsState {
  windows: OpenWindow[]
  onLink: LinkHandler | undefined
  open: (spec: WindowSpec) => void
  close: (id: string) => void
  focus: (id: string) => void
  minimize: (id: string) => void
  restore: (id: string) => void
  move: (id: string, box: Box) => void
}

const WindowsContext = createContext<WindowsState | null>(null)

/** Las ventanas de la Mesa; fuera de ella, nada (quien abre comprueba) */
export function useWindows(): WindowsState | null {
  return useContext(WindowsContext)
}

const STORE_KEY = 'crisol.ventanas'
export const MIN = { width: 280, height: 180 }
/** Cada ventana nueva, un poco más abajo y a la derecha que la anterior */
const CASCADE = 28

function readBoxes(): Record<string, Box> {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Record<string, Box>
  } catch {
    return {}
  }
}

function saveBox(id: string, box: Box) {
  try {
    const all = readBoxes()
    all[id] = box
    // Solo las últimas: no crece sin fin
    const kept = Object.fromEntries(Object.entries(all).slice(-60))
    localStorage.setItem(STORE_KEY, JSON.stringify(kept))
  } catch {
    // Sin almacenamiento: no se recuerda
  }
}

/** Dentro del sitio que hay (la caja de la Mesa), con su tamaño mínimo y sin salirse */
export function clampBox(box: Box, area: { width: number; height: number }): Box {
  const width = Math.max(MIN.width, Math.min(box.width, area.width))
  const height = Math.max(MIN.height, Math.min(box.height, area.height))
  return {
    width,
    height,
    x: Math.max(0, Math.min(box.x, area.width - width)),
    y: Math.max(0, Math.min(box.y, area.height - height))
  }
}

export function WindowsProvider({
  children,
  area,
  onLink
}: {
  children: ReactNode
  /** La caja dentro de la que flotan (la del mapa) */
  area: RefObject<HTMLElement | null>
  onLink?: LinkHandler
}) {
  const [windows, setWindows] = useState<OpenWindow[]>([])
  const sizeOfArea = useCallback(() => {
    const rect = area.current?.getBoundingClientRect()
    return { width: rect?.width || 1200, height: rect?.height || 800 }
  }, [area])
  const open = useCallback(
    (spec: WindowSpec) =>
      setWindows((current) => {
        const there = current.find((w) => w.id === spec.id)
        // Ya abierta: delante, sin minimizar y con lo nuevo (su título puede haber cambiado)
        if (there) return [...current.filter((w) => w.id !== spec.id), { ...there, ...spec, minimized: false }]
        const remembered = readBoxes()[spec.id]
        const step = current.length % 8
        const box = clampBox(
          remembered ?? {
            // A la derecha de la columna de herramientas, bajo la barra de arriba
            x: 136 + step * CASCADE,
            y: 60 + step * CASCADE,
            width: spec.width ?? 460,
            height: spec.height ?? 560
          },
          sizeOfArea()
        )
        return [...current, { ...spec, box, minimized: false }]
      }),
    [sizeOfArea]
  )
  const close = useCallback((id: string) => setWindows((current) => current.filter((w) => w.id !== id)), [])
  const focus = useCallback(
    (id: string) =>
      setWindows((current) => {
        const there = current.find((w) => w.id === id)
        if (!there || current.at(-1)?.id === id) return current
        return [...current.filter((w) => w.id !== id), there]
      }),
    []
  )
  const minimize = useCallback(
    (id: string) => setWindows((current) => current.map((w) => (w.id === id ? { ...w, minimized: true } : w))),
    []
  )
  const restore = useCallback(
    (id: string) =>
      setWindows((current) => {
        const there = current.find((w) => w.id === id)
        if (!there) return current
        return [...current.filter((w) => w.id !== id), { ...there, minimized: false }]
      }),
    []
  )
  const move = useCallback(
    (id: string, box: Box) => {
      const fitted = clampBox(box, sizeOfArea())
      saveBox(id, fitted)
      setWindows((current) => current.map((w) => (w.id === id ? { ...w, box: fitted } : w)))
    },
    [sizeOfArea]
  )
  const value = useMemo(
    () => ({ windows, onLink, open, close, focus, minimize, restore, move }),
    [windows, onLink, open, close, focus, minimize, restore, move]
  )
  return <WindowsContext.Provider value={value}>{children}</WindowsContext.Provider>
}

/** Las ventanas abiertas y, abajo a la izquierda, las minimizadas */
export function WindowLayer() {
  const state = useWindows()
  const { t } = useTranslation()
  if (!state) return null
  const shown = state.windows.filter((w) => !w.minimized)
  const minimized = state.windows.filter((w) => w.minimized)
  return (
    <>
      {shown.map((w, i) => (
        <FloatingWindow key={w.id} window={w} top={i === shown.length - 1} z={i} state={state} />
      ))}
      {minimized.length > 0 && (
        <ul className={styles.dock} aria-label={t('windows.minimized')} data-window-dock="">
          {minimized.map((w) => (
            <li key={w.id} className={styles.pill}>
              <button type="button" className={styles.pillName} onClick={() => state.restore(w.id)}>
                {w.title}
              </button>
              <button
                type="button"
                className={styles.pillClose}
                aria-label={t('windows.close', { title: w.title })}
                onClick={() => state.close(w.id)}
              >
                <X aria-hidden="true" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

type Drag = { kind: 'move' | 'resize'; startX: number; startY: number; box: Box }

function FloatingWindow({
  window: w,
  top,
  z,
  state
}: {
  window: OpenWindow
  top: boolean
  z: number
  state: WindowsState
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const drag = useRef<Drag | null>(null)
  // Mientras se arrastra, la caja va en local (sin guardar en cada movimiento); al soltar, se guarda
  const [live, setLive] = useState<Box | null>(null)
  const box = live ?? w.box
  const start = (kind: Drag['kind']) => (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    // Los botones de la cabecera no arrastran
    if (kind === 'move' && (event.target as HTMLElement).closest('button, a, input')) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { kind, startX: event.clientX, startY: event.clientY, box: w.box }
    state.focus(w.id)
  }
  const onMove = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current
    if (!current) return
    const dx = event.clientX - current.startX
    const dy = event.clientY - current.startY
    setLive(
      current.kind === 'move'
        ? { ...current.box, x: current.box.x + dx, y: current.box.y + dy }
        : {
            ...current.box,
            width: Math.max(MIN.width, current.box.width + dx),
            height: Math.max(MIN.height, current.box.height + dy)
          }
    )
  }
  const end = () => {
    if (!drag.current) return
    drag.current = null
    if (live) state.move(w.id, live)
    setLive(null)
  }
  const onKey = (event: KeyboardEvent<HTMLElement>) => {
    const step = event.altKey ? 4 : 24
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step]
    }
    const d = delta[event.key]
    if (!d) return
    event.preventDefault()
    state.move(
      w.id,
      event.shiftKey
        ? { ...w.box, width: w.box.width + d[0], height: w.box.height + d[1] }
        : { ...w.box, x: w.box.x + d[0], y: w.box.y + d[1] }
    )
  }
  return (
    // No es modal (la Mesa sigue viva detrás): un div con role=dialog, no <dialog>
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className={styles.window}
      data-top={top || undefined}
      data-window={w.id}
      style={{ left: box.x, top: box.y, width: box.width, height: box.height, zIndex: 40 + z }}
      onPointerDownCapture={() => state.focus(w.id)}
      onFocusCapture={() => state.focus(w.id)}
    >
      <header
        className={styles.head}
        onPointerDown={start('move')}
        onPointerMove={onMove}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {/* El título, con el foco, se mueve y se estira con el teclado */}
        <h2
          id={titleId}
          className={styles.title}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: es el asa de la ventana para el teclado
          tabIndex={0}
          aria-roledescription={t('windows.handle')}
          aria-describedby={`${titleId}-help`}
          onKeyDown={onKey}
        >
          {w.title}
        </h2>
        <span id={`${titleId}-help`} hidden>
          {t('windows.keys')}
        </span>
        {w.actions?.()}
        <button
          type="button"
          className={styles.icon}
          aria-label={t('windows.minimize', { title: w.title })}
          title={t('windows.minimizeShort')}
          onClick={() => state.minimize(w.id)}
        >
          <Minus aria-hidden="true" size={16} />
        </button>
        <button
          type="button"
          className={styles.icon}
          aria-label={t('windows.close', { title: w.title })}
          title={t('windows.closeShort')}
          onClick={() => state.close(w.id)}
        >
          <X aria-hidden="true" size={16} />
        </button>
      </header>
      {/* Un enlace a una página, dentro: se abre en otra ventana (sin dejar la Mesa) */}
      <div
        className={styles.body}
        onClickCapture={(event) => {
          const link = (event.target as Element).closest('a[href]') as HTMLAnchorElement | null
          if (!link || !state.onLink || event.button !== 0) return
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target === '_blank') return
          const url = new URL(link.href, window.location.href)
          if (url.origin !== window.location.origin) return
          if (state.onLink(url, link.textContent?.trim() ?? '', state.open)) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
      >
        {w.render()}
      </div>
      <span
        className={styles.resize}
        aria-hidden="true"
        onPointerDown={start('resize')}
        onPointerMove={onMove}
        onPointerUp={end}
        onPointerCancel={end}
      />
    </div>
  )
}
