/**
 * Lo que se ve del contenido de un sistema en una campaña (ADR-0012): el de sus fuentes activas y, de lo que está en
 * las dos ediciones (el mismo concepto y tipo), las dos versiones, con la vieja marcada «Legado», o solo la más nueva.
 * Las referencias van al concepto y se resuelven con la edición de quien las pide
 */
import type { Choices } from './choices.ts'
import type { System } from './format.ts'

/** Lo que hace falta de un documento de contenido para saber si se ve */
export interface Versioned {
  type: string
  key: string
  source: string | null
  concept?: string
}

export interface Seen<T> {
  item: T
  /** Lo de una edición vieja que tiene versión en una más nueva que también se ve */
  legacy: boolean
}

/** La edición de un documento: la de su fuente (sin fuente o sin edición, ninguna) */
export function editionOf(system: System, item: Pick<Versioned, 'source'>): string | undefined {
  return item.source === null ? undefined : system.sources?.find((s) => s.key === item.source)?.edition
}

/** Cuándo salió la fuente de un documento: para saber cuál es más nueva (sin fecha, la más vieja) */
function releasedOf(system: System, item: Versioned): string {
  return system.sources?.find((s) => s.key === item.source)?.released ?? ''
}

/** Lo que une las versiones de lo mismo: su tipo y su concepto (sin concepto, solo él) */
const groupOf = (item: Versioned) => (item.concept ? `${item.type}:${item.concept}` : `${item.type}#${item.key}`)

export function visibleContent<T extends Versioned>(
  system: System,
  content: readonly T[],
  choices: Pick<Choices, 'sources' | 'duplicates'>
): Seen<T>[] {
  const active = new Set(choices.sources)
  const shown = content.filter((item) => item.source === null || active.has(item.source))
  const groups = new Map<string, T[]>()
  for (const item of shown) {
    const group = groups.get(groupOf(item)) ?? []
    group.push(item)
    groups.set(groupOf(item), group)
  }
  // Legado: hay otra versión, de otra edición, que salió después
  const isLegacy = (item: T) => {
    const edition = editionOf(system, item)
    const released = releasedOf(system, item)
    return (groups.get(groupOf(item)) ?? []).some(
      (other) => editionOf(system, other) !== edition && releasedOf(system, other) > released
    )
  }
  return shown
    .map((item) => ({ item, legacy: isLegacy(item) }))
    .filter((seen) => choices.duplicates === 'both' || !seen.legacy)
}

/**
 * El documento de un concepto entre lo que se ve: el de la edición de quien lo pide o, si no lo hay, el más nuevo. Sin
 * tipo, si el concepto es de varios tipos, ninguno (no se sabe cuál)
 */
export function resolveConcept<T extends Versioned>(
  system: System,
  seen: readonly Seen<T>[],
  concept: string,
  { type, edition }: { type?: string; edition?: string | undefined } = {}
): T | null {
  const found = seen.map((s) => s.item).filter((item) => item.concept === concept && (!type || item.type === type))
  if (new Set(found.map((item) => item.type)).size > 1) return null
  const same = found.filter((item) => edition !== undefined && editionOf(system, item) === edition)
  const pool = same.length > 0 ? same : found
  return pool.reduce<T | null>(
    (best, item) => (!best || releasedOf(system, item) > releasedOf(system, best) ? item : best),
    null
  )
}
