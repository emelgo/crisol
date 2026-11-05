/**
 * El compendio de una campaña (docs/specs/personajes.md § campana): los tipos de su contenido, con cuántos hay de cada
 * uno y los campos que se leen, y de cada documento su edición, sus otras versiones y lo que concede por nivel
 */
import type { Choices } from './choices.ts'
import { editionOf, resolveConcept, type Seen, type Versioned, visibleContent } from './content.ts'
import type { Field, System } from './format.ts'
import type { Mechanics } from './mechanics.ts'
import type { Text } from './text.ts'

/** Un campo que se lee en el compendio: su nombre, su clase y, si es de opciones, sus opciones */
export interface CompendiumField {
  key: string
  label: Text
  kind: 'text' | 'number' | 'boolean' | 'list' | 'choice' | 'dice'
  options?: { value: string; label: Text }[]
}

export interface CompendiumType {
  key: string
  label: Text
  document: 'actor' | 'item'
  count: number
  fields: CompendiumField[]
  /** Su texto largo (la descripción), si lo tiene */
  text: string | null
}

/** Lo de un documento que se ve en el compendio, sin su texto ni su mecánica */
interface Named extends Versioned {
  name?: unknown
  data?: Record<string, unknown>
}

const READ_KINDS = new Set(['text', 'number', 'boolean', 'list', 'choice', 'dice'])
/** Lo que es de la partida, no del documento: no se lee en el compendio */
const IN_PLAY = new Set(['equipado', 'activo', 'preparado', 'sintonizado', 'cantidad', 'inicial', 'dados_usados'])

/** El texto largo de un tipo: su primer campo de texto de varias líneas */
const longText = (fields: Record<string, Field>) =>
  Object.entries(fields).find(([, f]) => f.kind === 'text' && (f.lines ?? 1) > 1)?.[0] ?? null

/** Los tipos con contenido en lo que se ve, en el orden del sistema, con cuántos hay y los campos que se leen */
export function compendiumTypes(
  system: System,
  content: readonly Versioned[],
  choices: Pick<Choices, 'sources' | 'duplicates'>
): CompendiumType[] {
  const counts = new Map<string, number>()
  for (const { item } of visibleContent(system, content, choices))
    counts.set(item.type, (counts.get(item.type) ?? 0) + 1)
  return Object.entries(system.types).flatMap(([key, type]) => {
    const count = counts.get(key) ?? 0
    if (count === 0) return []
    const text = longText(type.fields)
    // Una criatura (un documento de tipo actor) lleva su bloque de estadísticas en su texto: sus campos no se repiten
    const fields =
      type.document === 'actor' && text
        ? []
        : Object.entries(type.fields).flatMap(([field, f]): CompendiumField[] => {
            if (field === text || IN_PLAY.has(field) || !READ_KINDS.has(f.kind)) return []
            const read: CompendiumField = { key: field, label: f.label, kind: f.kind as CompendiumField['kind'] }
            if ((f.kind === 'choice' || f.kind === 'list') && f.options) read.options = f.options
            return [read]
          })
    return [{ key, label: type.label, document: type.document, count, fields, text }]
  })
}

/** Lo que concede un documento: otro (por su concepto, de su edición) o una elección, con su nivel */
export type Granted =
  | { level: number | null; key: string; type: string; name: unknown }
  | { level: number | null; choose: Text; count: string }

export interface CompendiumEntry {
  edition: string | null
  legacy: boolean
  /** Las otras versiones de lo mismo que se ven (de otras ediciones) */
  versions: { key: string; edition: string | null; legacy: boolean }[]
  granted: Granted[]
}

/** De un documento: su edición, si es legado, sus otras versiones y lo que concede por nivel (lo de sin nivel, antes) */
export function compendiumEntry<T extends Named>(
  system: System,
  seen: readonly Seen<T>[],
  item: Versioned & { mechanics?: Mechanics | Record<string, unknown> | undefined }
): CompendiumEntry {
  const edition = editionOf(system, item) ?? null
  const groupOf = (other: Versioned) => other.type === item.type && !!item.concept && other.concept === item.concept
  const versions = seen
    .filter(({ item: other }) => groupOf(other) && other.key !== item.key)
    .map(({ item: other, legacy }) => ({ key: other.key, edition: editionOf(system, other) ?? null, legacy }))
  const legacy = seen.find((s) => s.item.key === item.key)?.legacy ?? false
  const grants = ((item.mechanics as Mechanics | undefined)?.grants ?? []).flatMap((g): Granted[] => {
    const level = g.level ?? null
    if (g.choose) return [{ level, choose: g.choose.label, count: g.choose.count }]
    if (!g.concept) return []
    const found = resolveConcept(system, seen, g.concept, {
      ...(g.type ? { type: g.type } : {}),
      edition: edition ?? undefined
    })
    return found ? [{ level, key: found.key, type: found.type, name: found.name ?? found.data?.name }] : []
  })
  const granted = grants
    .map((g, i) => ({ g, i }))
    .sort((a, b) => (a.g.level ?? 0) - (b.g.level ?? 0) || a.i - b.i)
    .map(({ g }) => g)
  return { edition, legacy, versions, granted }
}
