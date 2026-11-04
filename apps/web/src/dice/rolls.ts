/** El registro de tiradas de una campaña en la caché de la web: su clave, añadir una (sin repetirla) y los colores */
import type { DiceRoll } from '@crisol/contracts'
import type { InfiniteData, QueryClient } from '@tanstack/react-query'

export type RollsPage = { rolls: DiceRoll[]; next: string | null }

export const rollsKey = (campaignId: string) => ['rolls', campaignId] as const

/** Si la tirada es de esta cuenta */
export const isMine = (roll: DiceRoll, account: { id?: string; name: string } | null | undefined) =>
  Boolean(account) && (account?.id ? roll.by.userId === account.id : roll.by.name === account?.name)

/** Una tirada nueva, abajo del todo de la página más reciente; si ya está (llegó por los dos caminos), nada */
export function appendRoll(queryClient: QueryClient, roll: DiceRoll) {
  const key = rollsKey(roll.campaignId)
  // Si se está pidiendo el registro, la respuesta la pisaría: que se vuelva a pedir, ya con ella (está guardada)
  if (queryClient.isFetching({ queryKey: key }) > 0) {
    void queryClient.invalidateQueries({ queryKey: key })
    return
  }
  queryClient.setQueryData<InfiniteData<RollsPage>>(key, (data) => {
    if (!data || data.pages.some((page) => page.rolls.some((r) => r.id === roll.id))) return data
    const [latest, ...older] = data.pages
    if (!latest) return data
    return { ...data, pages: [{ ...latest, rolls: [...latest.rolls, roll] }, ...older] }
  })
}

/** Los colores de los dados: una paleta que se distingue en claro y en oscuro, cada uno con su nombre */
export const DICE_COLORS = [
  { key: 'red', value: '#d1453f' },
  { key: 'teal', value: '#2a9d8f' },
  { key: 'amber', value: '#d39b3a' },
  { key: 'blue', value: '#5a7fd6' },
  { key: 'violet', value: '#8a7fd6' },
  { key: 'pink', value: '#c2569b' },
  { key: 'green', value: '#5c9e4a' },
  { key: 'copper', value: '#b5763c' }
] as const

/** El color de los dados de una cuenta: el que eligió o, si no, uno de la paleta, siempre el mismo */
export function colorOf(userId: string, chosen?: string | null): string {
  if (chosen && /^#[0-9a-f]{6}$/i.test(chosen)) return chosen
  let hash = 0
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return DICE_COLORS[hash % DICE_COLORS.length]?.value ?? '#d1453f'
}
