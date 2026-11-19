/**
 * Los iconos de rol (todos los de game-icons.net, @crisol/contracts game-icons-catalog.ts): la lista, para que la IA
 * elija uno por su nombre («gi:<id>»). No depende de la cuenta: es la misma para todos. Importar la lista registra los
 * ids que existen, con los que se comprueba cualquier icono que llegue (isGameIcon)
 */
import { listGameIcons } from '@crisol/contracts'
import { FEATURED_GAME_ICONS, searchGameIcons } from '@crisol/contracts/game-icons-catalog'
import { implement } from './registry.ts'

/** Cuántos devuelve si no se dice */
const LIMIT = 50

export const iconActions = [
  implement(listGameIcons, async (_ctx, { query, group, limit = LIMIT }) => {
    const found = query || group ? searchGameIcons(query ?? '', group) : FEATURED_GAME_ICONS
    return {
      icons: found.slice(0, limit).map((icon) => ({ icon: `gi:${icon.id}`, label: icon.label, group: icon.group })),
      total: found.length
    }
  })
]
