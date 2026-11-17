/**
 * Convertir fechas entre los calendarios de un mundo (ADR-0029, decisión 10 de Enrique): cada uno que no es el
 * principal puede llevar su correspondencia («el 1 del primer mes del año 0 de este calendario cae el … de aquel»). De
 * ahí sale el desfase de cada uno respecto al principal y convertir es pasar por su día absoluto
 */
import { dateFromDay, dateSpan, dayNumber } from './dates.ts'
import type { CalendarDefinition, FullDate, WorldDate } from './definition.ts'

export interface WorldCalendar {
  id: string
  primary: boolean
  definition: CalendarDefinition
}

/** Una cadena de correspondencias no sigue más allá de tantos saltos (ni da vueltas) */
const MAX_HOPS = 20

/**
 * El día absoluto del principal en que cae el día 0 de un calendario; null si no tiene correspondencia (o su cadena no
 * llega al principal)
 */
export function offsetToPrimary(calendars: readonly WorldCalendar[], calendarId: string): number | null {
  const byId = new Map(calendars.map((c) => [c.id, c]))
  let total = 0
  let current = byId.get(calendarId)
  const seen = new Set<string>()
  for (let hops = 0; current && hops <= MAX_HOPS; hops++) {
    if (current.primary) return total
    if (seen.has(current.id)) return null
    seen.add(current.id)
    const anchor = current.definition.correspondence
    if (!anchor) return null
    const target = byId.get(anchor.calendarId)
    if (!target) return null
    try {
      total += dayNumber(target.definition, anchor.date)
    } catch {
      // Su fecha ya no cabe en aquel calendario (le quitaron el mes): sin correspondencia hasta que se arregle
      return null
    }
    current = target
  }
  return null
}

export interface Converted {
  start: FullDate
  /** Si la fecha abarca más de un día (sin día o sin mes): el último */
  end: FullDate | null
}

/** Una fecha de un calendario en otro del mundo; null si alguno no tiene correspondencia con el principal */
export function convertDate(
  calendars: readonly WorldCalendar[],
  fromId: string,
  toId: string,
  date: WorldDate
): Converted | null {
  const from = calendars.find((c) => c.id === fromId)
  const to = calendars.find((c) => c.id === toId)
  if (!from || !to) return null
  const a = offsetToPrimary(calendars, fromId)
  const b = offsetToPrimary(calendars, toId)
  if (a === null || b === null) return null
  const [first, last] = dateSpan(from.definition, date)
  const shift = a - b
  return {
    start: dateFromDay(to.definition, first + shift),
    end: last === first ? null : dateFromDay(to.definition, last + shift)
  }
}

/**
 * Al hacer principal a uno que tenía correspondencia con el anterior: la inversa para el anterior («su día 0 cae el …
 * del nuevo»), para que lo convertido siga cuadrando. null si no la tenía
 */
export function invertedCorrespondence(
  oldPrimary: WorldCalendar,
  newPrimary: WorldCalendar
): { calendarId: string; date: FullDate } | null {
  const anchor = newPrimary.definition.correspondence
  if (!anchor || anchor.calendarId !== oldPrimary.id) return null
  // El día 0 del nuevo es el día N del anterior: el día 0 del anterior es el día -N del nuevo
  const n = dayNumber(oldPrimary.definition, anchor.date)
  return { calendarId: newPrimary.id, date: dateFromDay(newPrimary.definition, -n) }
}
