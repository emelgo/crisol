/** Quién ve una tirada en una campaña, partiendo de lo que se eligió (y se recuerda) en los dados */
import { type Campaign, type RollVisibility, visibilitiesFor } from '@crisol/contracts'

/**
 * Lo recordado, si vale en esta campaña; si no, lo privado sigue privado: lo más privado que tenga quien tira (oculta
 * el máster, «para mí» un jugador). Nunca se vuelve pública una tirada que se quería para uno
 */
export function visibilityIn(remembered: RollVisibility, role: Campaign['role']): RollVisibility {
  if (visibilitiesFor(role).includes(remembered) || remembered === 'all') return remembered
  return role === 'master' ? 'hidden' : 'self'
}
