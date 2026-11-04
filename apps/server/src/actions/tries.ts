/**
 * Cuántas tiradas puede hacer cada uno por minuto: las que se apuntan se cuentan en la tabla (así vale con varias
 * instancias); las de probar (tryDice y las tiradas de un sistema), que no guardan nada, en la memoria del proceso
 */

/** Como mucho, tantas por minuto y persona */
export const ROLLS_PER_MINUTE = 60

const tried = new Map<string, number[]>()

/** Si ya ha probado tantas en el último minuto; si no, cuenta esta */
export function tooManyTries(userId: string) {
  const now = Date.now()
  const recent = (tried.get(userId) ?? []).filter((at) => now - at < 60_000)
  if (recent.length >= ROLLS_PER_MINUTE) {
    tried.set(userId, recent)
    return true
  }
  recent.push(now)
  tried.set(userId, recent)
  return false
}
