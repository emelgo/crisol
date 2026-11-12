/**
 * Los iconos de rol (el paquete de game-icons.net, @crisol/contracts game-icons.ts): la lista, para que la IA elija uno
 * por su nombre («gi:<id>»). No depende de la cuenta: es la misma para todos
 */
import { GAME_ICONS, listGameIcons } from '@crisol/contracts'
import { implement } from './registry.ts'

const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es')
    .replace(/[-\s]+/g, ' ')
    .trim()

export const iconActions = [
  implement(listGameIcons, async (_ctx, { query }) => {
    const wanted = query ? plain(query) : ''
    return {
      icons: GAME_ICONS.filter(
        (icon) => !wanted || plain(icon.label).includes(wanted) || plain(icon.id).includes(wanted)
      ).map((icon) => ({ icon: `gi:${icon.id}`, label: icon.label, group: icon.group }))
    }
  })
]
