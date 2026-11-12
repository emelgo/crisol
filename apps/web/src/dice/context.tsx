/**
 * Los dados de un mundo: si están abiertos, en qué campaña se tira en cada mundo, quién ve lo que se tira y si se
 * pulsan dados o se escribe. Eso se recuerda en el navegador; lo abierto, no (se abre y se cierra con el d20, y en el
 * móvil se cierra al cambiar de pantalla).
 * Lo usan la barra (abrir y cerrar), la ficha y las tiradas escritas en las páginas (en qué campaña tiran)
 */
import type { RollVisibility } from '@crisol/contracts'
import { useRouterState } from '@tanstack/react-router'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { shownPath } from '../shown-path.ts'

const CAMPAIGNS = 'crisol.dados.campañas'
const VISIBILITY = 'crisol.dados.quien'
const MODE = 'crisol.dados.modo'

/** Pulsando dados o escribiendo la tirada: se abre como se tiró la última vez */
export type DiceMode = 'dice' | 'write'

const read = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : (JSON.parse(value) as T)
  } catch {
    return fallback
  }
}

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Sin almacenamiento, se olvida al recargar
  }
}

interface Dice {
  open: boolean
  toggle: () => void
  close: () => void
  /** La campaña en la que se tira en ese mundo (la última elegida), si la hay */
  campaignFor: (worldId: string) => string | null
  setCampaign: (worldId: string, campaignId: string) => void
  /** Quién ve lo que se tira: lo elegido en los dados (se recuerda), que usan también las tiradas de las páginas */
  visibility: RollVisibility
  setVisibility: (visibility: RollVisibility) => void
  mode: DiceMode
  setMode: (mode: DiceMode) => void
  /** El historial de tiradas: fuera de la Mesa, una ficha junto al d20; en la Mesa, una de sus ventanas */
  history: boolean
  openHistory: () => void
  closeHistory: () => void
  /** La Mesa abre el historial en una ventana suya mientras está abierta */
  setHistoryHost: (open: (() => void) | null) => void
}

const DiceContext = createContext<Dice | null>(null)

export function DiceProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [campaigns, setCampaigns] = useState(() => read<Record<string, string>>(CAMPAIGNS, {}))
  const [visibility, setShownTo] = useState<RollVisibility>(() => read<RollVisibility>(VISIBILITY, 'all'))
  const [mode, setDiceMode] = useState<DiceMode>(() => (read<string>(MODE, 'dice') === 'write' ? 'write' : 'dice'))
  const [history, setHistory] = useState(false)
  const host = useRef<(() => void) | null>(null)
  const toggle = useCallback(() => {
    setHistory(false)
    setOpen((current) => !current)
  }, [])
  const close = useCallback(() => setOpen(false), [])
  const setVisibility = useCallback((next: RollVisibility) => {
    setShownTo(next)
    write(VISIBILITY, next)
  }, [])
  const setMode = useCallback((next: DiceMode) => {
    setDiceMode(next)
    write(MODE, next)
  }, [])
  const openHistory = useCallback(() => {
    setOpen(false)
    const open = host.current
    if (!open) {
      setHistory(true)
      return
    }
    // En la Mesa, la ventana recuerda quién la abrió para devolverle el foco al cerrarla: el d20 (el botón pulsado se va)
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-tour="dados"]')?.focus()
      open()
    })
  }, [])
  const closeHistory = useCallback(() => setHistory(false), [])
  const setHistoryHost = useCallback((open: (() => void) | null) => {
    host.current = open
    if (open) setHistory(false)
  }, [])
  // En el móvil la ficha es una hoja que tapa la pantalla: al ir a otra, se cierra
  const pathname = useRouterState({ select: (state) => shownPath(state) })
  const last = useRef(pathname)
  useEffect(() => {
    if (last.current === pathname) return
    last.current = pathname
    if (window.matchMedia?.('(max-width: 48rem)').matches) {
      setOpen(false)
      setHistory(false)
    }
  }, [pathname])
  const setCampaign = useCallback((worldId: string, campaignId: string) => {
    setCampaigns((current) => {
      const next = { ...current, [worldId]: campaignId }
      write(CAMPAIGNS, next)
      return next
    })
  }, [])
  const value = useMemo<Dice>(
    () => ({
      open,
      toggle,
      close,
      campaignFor: (worldId) => campaigns[worldId] ?? null,
      setCampaign,
      visibility,
      setVisibility,
      mode,
      setMode,
      history,
      openHistory,
      closeHistory,
      setHistoryHost
    }),
    [
      open,
      toggle,
      close,
      campaigns,
      setCampaign,
      visibility,
      setVisibility,
      mode,
      setMode,
      history,
      openHistory,
      closeHistory,
      setHistoryHost
    ]
  )
  return <DiceContext.Provider value={value}>{children}</DiceContext.Provider>
}

/** Si hay dónde tirar (fuera de la app, al imprimir, no) */
export const useHasDice = () => useContext(DiceContext) !== null

export function useDice() {
  const dice = useContext(DiceContext)
  if (!dice) throw new Error('useDice fuera de DiceProvider')
  return dice
}

/** El mundo en el que se está, si se está en uno */
export function useWorldInPath() {
  return useRouterState({ select: (state) => /^\/mundos\/([^/]+)/.exec(shownPath(state))?.[1] })
}
