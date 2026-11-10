/**
 * La hora del servidor en este aparato (docs/specs/sonido.md): su desfase, medido con «time» por el canal de la mesa
 * (se queda la muestra del viaje más corto, la más fiable); hasta tenerla, lo que diga el último mensaje del sonido
 */
import { clockOffset } from '@crisol/domain'

export interface ServerClock {
  now(): number
  /** La hora del servidor de un mensaje que no dice cuánto tardó: vale mientras no haya una muestra */
  hint(serverNow: number): void
  /** La respuesta a «time»: la hora del aparato al mandarlo y la del servidor */
  sample(sentAt: number, serverNow: number): void
}

/** Una muestra deja de valer como la mejor pasado este tiempo (el reloj del aparato también se desvía) */
const BEST_FOR_MS = 10 * 60_000

export function createServerClock(local: () => number = Date.now): ServerClock {
  let offset = 0
  let best = Number.POSITIVE_INFINITY
  let bestAt = Number.NEGATIVE_INFINITY
  return {
    now: () => local() + offset,
    hint(serverNow) {
      if (best === Number.POSITIVE_INFINITY) offset = serverNow - local()
    },
    sample(sentAt, serverNow) {
      const receivedAt = local()
      const trip = receivedAt - sentAt
      if (trip < 0) return
      if (trip <= best || receivedAt - bestAt > BEST_FOR_MS) {
        best = trip
        bestAt = receivedAt
        offset = clockOffset({ sentAt, receivedAt, serverNow })
      }
    }
  }
}
