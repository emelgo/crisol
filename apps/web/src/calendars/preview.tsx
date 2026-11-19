/**
 * Lo que comparten las vistas de un mes (la vista grande de un calendario, la de las cronologías, el selector de fechas):
 * qué se enseña con cada mes, los nombres cortos de los días y el año con que se abre. (Fue la vista previa del editor,
 * que se quitó al pasar a fases)
 */
import type { CalendarDefinition } from '@crisol/domain'

/** Lo que se enseña con cada mes normal: los fuera de la semana que van justo detrás (y, antes del primero, los de delante) */
export function pagesOf(definition: CalendarDefinition) {
  const regular = definition.months.map((m, i) => ({ m, i })).filter(({ m }) => !m.outsideWeek)
  if (regular.length === 0) return definition.months.map((m) => ({ month: m.id, before: [], after: [] as string[] }))
  return regular.map(({ i }, k) => {
    const next = regular[k + 1]?.i ?? definition.months.length
    const after = definition.months.slice(i + 1, next).map((m) => m.id)
    const before = k === 0 ? definition.months.slice(0, i).map((m) => m.id) : []
    return { month: definition.months[i]?.id ?? '', before, after }
  })
}

/**
 * Los nombres cortos de los días de la semana para la cabecera de la rejilla: sus primeras letras, las justas para que
 * no se repitan («Lu», «Ma»…); si empiezan igual («Día 1», «Día 2»), sus iniciales («D1»)
 */
export function shortWeekdays(names: readonly string[]): string[] {
  for (let k = 2; k <= 4; k++) {
    const short = names.map((n) => n.slice(0, k))
    if (new Set(short).size === names.length) return short.map((s) => s.toUpperCase())
  }
  return names.map((n) =>
    n
      .split(/\s+/)
      .map((word) => (/^\d+$/.test(word) ? word : word.charAt(0)))
      .join('')
      .toUpperCase()
  )
}

/** El año con que se abre: el del principio de su última era (lo más reciente), o el 1 */
export const startYear = (definition: CalendarDefinition) =>
  definition.eras.reduce((year, era) => Math.max(year, era.start.year), Number.NEGATIVE_INFINITY) ===
  Number.NEGATIVE_INFINITY
    ? 1
    : Math.max(...definition.eras.map((era) => era.start.year))
