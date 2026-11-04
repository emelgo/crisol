/** El registro de tiradas de una campaña en la caché de la web: su clave, añadir una (sin repetirla) y los colores */
import type { DiceRoll } from '@crisol/contracts'
import type { InfiniteData, QueryClient } from '@tanstack/react-query'

export type RollsPage = { rolls: DiceRoll[]; next: string | null }

export const rollsKey = (campaignId: string) => ['rolls', campaignId] as const

/** Una tirada nueva, abajo del todo de la página más reciente; si ya está (llegó por los dos caminos), nada */
export function appendRoll(queryClient: QueryClient, roll: DiceRoll) {
  queryClient.setQueryData<InfiniteData<RollsPage>>(rollsKey(roll.campaignId), (data) => {
    if (!data || data.pages.some((page) => page.rolls.some((r) => r.id === roll.id))) return data
    const [latest, ...older] = data.pages
    if (!latest) return data
    return { ...data, pages: [{ ...latest, rolls: [...latest.rolls, roll] }, ...older] }
  })
}

/** Los colores de los dados: uno por cuenta, siempre el mismo, de una paleta que se distingue en claro y en oscuro */
const PALETTE = ['#d1453f', '#2a9d8f', '#d39b3a', '#5a7fd6', '#8a7fd6', '#c2569b', '#5c9e4a', '#b5763c']

export function colorOf(userId: string): string {
  let hash = 0
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return PALETTE[hash % PALETTE.length] ?? '#d1453f'
}
