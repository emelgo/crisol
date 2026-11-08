/**
 * La campaña desde la que se trabaja (su Mesa): lo que se revela o se enseña desde dentro va a ella, sin preguntar a
 * cuál (Enrique, 2026-11-09). Fuera de una campaña (la wiki del mundo), null: se elige
 */
import { createContext, useContext } from 'react'

export const CurrentCampaignContext = createContext<string | null>(null)

export const useCurrentCampaign = () => useContext(CurrentCampaignContext)
