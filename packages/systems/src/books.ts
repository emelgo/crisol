/**
 * Los libros de un sistema (ADR-0021): sus fuentes, vistas como libros. Cuánto trae cada uno (por tipo, con unos
 * ejemplos), cuánto deja fuera una campaña y cuánto tiene pendiente de revisar
 */
import type { ContentEntry } from './content.ts'
import type { System } from './format.ts'
import type { Language } from './text.ts'

export interface BookSummary {
  key: string
  /** Cuántas entradas aceptadas trae */
  count: number
  /** Por tipo, en el orden del sistema */
  byType: { type: string; label: string; count: number; examples: string[] }[]
  /** Cuántas deja fuera la campaña (si se da lo excluido) */
  excluded: number
  /** Cuántas esperan a que se revisen */
  pending: number
}

const nameIn = (name: unknown, language: Language): string =>
  typeof name === 'string'
    ? name
    : name && typeof name === 'object'
      ? String(
          (name as Record<string, unknown>)[language] ??
            Object.values(name as Record<string, unknown>).find(Boolean) ??
            ''
        )
      : ''

const labelIn = (label: unknown, language: Language) => nameIn(label, language)

/** Lo que trae cada libro del sistema, en su orden; sin libros, ninguno */
export function summarizeBooks(
  system: System,
  content: readonly ContentEntry[],
  {
    excluded = [],
    language = 'es',
    examples = 3
  }: { excluded?: readonly string[]; language?: Language; examples?: number } = {}
): BookSummary[] {
  const out = new Set(excluded)
  const order = Object.keys(system.types)
  return (system.sources ?? []).map((book) => {
    const mine = content.filter((item) => item.source === book.key)
    const accepted = mine.filter((item) => !item.review)
    const byType = order.flatMap((type) => {
      const ofType = accepted.filter((item) => item.type === type)
      if (ofType.length === 0) return []
      return [
        {
          type,
          label: labelIn(system.types[type]?.label, language),
          count: ofType.length,
          examples: ofType
            .map((item) => nameIn(item.name, language))
            .filter(Boolean)
            .slice(0, examples)
        }
      ]
    })
    return {
      key: book.key,
      count: accepted.length,
      byType,
      excluded: accepted.filter((item) => out.has(item.key)).length,
      pending: mine.length - accepted.length
    }
  })
}
