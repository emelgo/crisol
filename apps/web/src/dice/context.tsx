/**
 * Los dados de un mundo: si la ficha está abierta y en qué campaña se tira en cada mundo. Se recuerda en el navegador.
 * Lo usan la barra (abrir y cerrar), la ficha y las tiradas escritas en las páginas (en qué campaña tiran)
 */
import type { RollVisibility } from '@crisol/contracts'
import { useRouterState } from '@tanstack/react-router'
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'

const OPEN = 'crisol.dados'
const CAMPAIGNS = 'crisol.dados.campañas'

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
  /** Quién ve lo que se tira: lo elegido en la ficha, que usan también las tiradas de las páginas */
  visibility: RollVisibility
  setVisibility: (visibility: RollVisibility) => void
}

const DiceContext = createContext<Dice | null>(null)

export function DiceProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(() => read(OPEN, false))
  const [campaigns, setCampaigns] = useState(() => read<Record<string, string>>(CAMPAIGNS, {}))
  const [visibility, setVisibility] = useState<RollVisibility>('all')
  const toggle = useCallback(() => {
    setOpen((current) => {
      write(OPEN, !current)
      return !current
    })
  }, [])
  const close = useCallback(() => {
    write(OPEN, false)
    setOpen(false)
  }, [])
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
      setVisibility
    }),
    [open, toggle, close, campaigns, setCampaign, visibility]
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
  return useRouterState({ select: (state) => /^\/mundos\/([^/]+)/.exec(state.location.pathname)?.[1] })
}
