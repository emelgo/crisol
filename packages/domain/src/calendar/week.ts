/**
 * La semana de un calendario, como la piensa quien lo edita (ajustes tras los módulos, bloque C): en qué día empieza
 * la semana (reordena los días sin cambiar el de ninguna fecha) y el ancla «el 1 de {mes} del año {N} fue {día}», que
 * da el día de la semana del primer día del año 0 (`firstWeekday`). Y la regla de bisiestos «Como el gregoriano»
 */
import { monthIndexOf, weekdayOf } from './dates.ts'
import type { CalendarDefinition, FullDate, LeapRule } from './definition.ts'

const mod = (n: number, m: number) => ((n % m) + m) % m

/**
 * El `firstWeekday` con el que `date` cae en el día `weekday` de la semana (su índice). null si no se puede: no hay
 * semana, el día no es de ella, el mes no existe o va fuera de la semana. El día de la semana es lineal en
 * `firstWeekday` (en las dos maneras de contar la semana), así que basta con correrlo lo que falte
 */
export function firstWeekdayFor(def: CalendarDefinition, date: FullDate, weekday: number): number | null {
  const count = def.weekdays.length
  if (count === 0 || !Number.isInteger(weekday) || weekday < 0 || weekday >= count) return null
  const index = monthIndexOf(def, date.month)
  if (index < 0 || def.months[index]?.outsideWeek) return null
  const now = weekdayOf(def, date)
  if (now === null) return null
  return mod(def.firstWeekday + weekday - now, count)
}

/**
 * La semana empezando en el día `start` (su índice): la lista, reordenada, y el `firstWeekday` corrido para que cada
 * fecha siga cayendo en el mismo día
 */
export function rotateWeek(
  def: CalendarDefinition,
  start: number
): Pick<CalendarDefinition, 'weekdays' | 'firstWeekday'> {
  const count = def.weekdays.length
  if (count === 0) return { weekdays: [...def.weekdays], firstWeekday: def.firstWeekday }
  const at = mod(Math.trunc(start), count)
  return {
    weekdays: [...def.weekdays.slice(at), ...def.weekdays.slice(0, at)],
    firstWeekday: mod(def.firstWeekday - at, count)
  }
}

/**
 * «Como el gregoriano»: un día más cada 4 años, salvo cada 100, pero sí cada 400, en el segundo mes que no es
 * festividad (febrero en el nuestro; si solo hay uno, en él). null sin meses
 */
export function gregorianLeapRule(def: CalendarDefinition): LeapRule | null {
  const regular = def.months.filter((m) => !m.festival)
  const month = regular[1] ?? regular[0] ?? def.months[0]
  return month ? { monthId: month.id, days: 1, every: 4, unless: 100, but: 400 } : null
}
