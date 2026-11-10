/**
 * Lo que puede hacer un jugador en la Mesa (docs/specs/sala.md, ADR-0022): mover sus fichas y abrir puertas, según la
 * pausa y el modo de movimiento de la campaña. El máster puede con todo. Se comprueba en el servidor en cada acción
 */

export type TableMovement = 'free' | 'turn' | 'locked'

export const TABLE_MOVEMENTS: readonly TableMovement[] = ['free', 'turn', 'locked']

export interface TablePlay {
  /** Máster del mundo o de la campaña */
  master: boolean
  userId: string
  paused: boolean
  movement: TableMovement
  /** Con combate, quiénes llevan al combatiente activo (vacío si aún no hay turno); null sin combate */
  combat: { activeControllers: readonly string[] } | null
  /** Quiénes llevan la ficha (su dueño y a quien se asigna); null si la acción no es de una ficha (una puerta) */
  controllers: readonly string[] | null
}

export type TablePlayVerdict = 'ok' | 'paused' | 'locked' | 'notYourTurn' | 'notYours'

export function tableActionAllowed(play: TablePlay): TablePlayVerdict {
  if (play.master) return 'ok'
  if (play.paused) return 'paused'
  if (play.controllers && !play.controllers.includes(play.userId)) return 'notYours'
  if (play.movement === 'locked') return 'locked'
  if (play.movement === 'turn' && play.combat && !play.combat.activeControllers.includes(play.userId)) {
    return 'notYourTurn'
  }
  return 'ok'
}
