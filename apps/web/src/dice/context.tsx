/**
 * Los dados de un mundo: si la ficha está abierta y en qué campaña se tira en cada mundo. Se recuerda en el navegador.
 * Lo usan la barra (abrir y cerrar), la ficha y las tiradas escritas en las páginas (en qué campaña tiran)
 */
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
}

const DiceContext = createContext<Dice | null>(null)

export function DiceProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(() => read(OPEN, false))
  const [campaigns, setCampaigns] = useState(() => read<Record<string, string>>(CAMPAIGNS, {}))
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
    () => ({ open, toggle, close, campaignFor: (worldId) => campaigns[worldId] ?? null, setCampaign }),
    [open, toggle, close, campaigns, setCampaign]
  )
  return <DiceContext.Provider value={value}>{children}</DiceContext.Provider>
}

export function useDice() {
  const dice = useContext(DiceContext)
  if (!dice) throw new Error('useDice fuera de DiceProvider')
  return dice
}
