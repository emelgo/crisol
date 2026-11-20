/**
 * El compendio de una campaña (docs/specs/personajes.md § campana): los tipos de su contenido, con cuántos hay de cada
 * uno y los campos que se leen, y de cada documento su edición, sus otras versiones y lo que concede por nivel
 */
import { cardKeys } from './card-template.ts'
import type { Choices } from './choices.ts'
import { editionOf, resolveConcept, type Seen, type Versioned, visibleContent } from './content.ts'
import type { Field, System } from './format.ts'
import type { Mechanics } from './mechanics.ts'
import { type Language, type Text, textOf } from './text.ts'

/** Un campo que se lee en el compendio: su nombre, su clase y, si es de opciones, sus opciones */
export interface CompendiumField {
  key: string
  label: Text
  kind: 'text' | 'number' | 'boolean' | 'list' | 'choice' | 'dice'
  options?: { value: string; label: Text }[]
  /** Sale en la ficha del tipo (su línea o su bloque de datos): en la lista de debajo no se repite */
  inCard?: true
}

export interface CompendiumType {
  key: string
  label: Text
  document: 'actor' | 'item'
  count: number
  fields: CompendiumField[]
  /** Su texto largo (la descripción), si lo tiene */
  text: string | null
  /** Cuántos hay de cada edición (sin edición, la clave vacía) */
  editions: Record<string, number>
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

/** El campo del texto largo de un tipo de un sistema (su descripción); sin él, null */
export const textFieldOf = (system: System, type: string) => longText(system.types[type]?.fields ?? {})

/** Los campos de un tipo que se leen (y se escriben) en el compendio: ni su texto largo, ni lo de la partida */
export function compendiumFields(system: System, typeKey: string): CompendiumField[] {
  const type = system.types[typeKey]
  if (!type) return []
  const text = longText(type.fields)
  // Una criatura (un documento de tipo actor) lleva su bloque de estadísticas en su texto: sus campos no se repiten
  if (type.document === 'actor' && text) return []
  // Lo de la hoja que dice que no sale, fuera; lo de su ficha, marcado (se escribe, pero no se repite en la lista)
  const hidden = new Set(type.card?.hidden ?? [])
  const inCard = cardKeys(type.card)
  return Object.entries(type.fields).flatMap(([field, f]): CompendiumField[] => {
    if (field === text || IN_PLAY.has(field) || !READ_KINDS.has(f.kind) || hidden.has(field)) return []
    const read: CompendiumField = { key: field, label: f.label, kind: f.kind as CompendiumField['kind'] }
    if ((f.kind === 'choice' || f.kind === 'list') && f.options) read.options = f.options
    if (inCard.has(field)) read.inCard = true
    return [read]
  })
}

/** Los tipos con contenido en lo que se ve, en el orden del sistema, con cuántos hay y los campos que se leen */
export function compendiumTypes(
  system: System,
  content: readonly Versioned[],
  choices: Pick<Choices, 'sources' | 'duplicates' | 'excluded'>,
  /** También los que aún no tienen nada (para crear su primera entrada) */
  all = false
): CompendiumType[] {
  const counts = new Map<string, number>()
  const editions = new Map<string, Record<string, number>>()
  for (const { item } of visibleContent(system, content, choices)) {
    counts.set(item.type, (counts.get(item.type) ?? 0) + 1)
    const byEdition = editions.get(item.type) ?? {}
    const edition = editionOf(system, item) ?? ''
    byEdition[edition] = (byEdition[edition] ?? 0) + 1
    editions.set(item.type, byEdition)
  }
  return Object.entries(system.types).flatMap(([key, type]) => {
    const count = counts.get(key) ?? 0
    if (count === 0 && !all) return []
    const text = longText(type.fields)
    const fields = compendiumFields(system, key)
    return [{ key, label: type.label, document: type.document, count, fields, text, editions: editions.get(key) ?? {} }]
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

/** Una sección del compendio (Conjuros, Equipo), con sus tipos y su nombre como carpeta (Armas) */
export interface CompendiumSection {
  key: string
  label: Text
  types: { key: string; label: Text }[]
}

/**
 * Sus secciones, como los estantes de una biblioteca: las que dice el sistema, con sus tipos que tienen contenido;
 * los tipos que no nombra (o sin compendio en el sistema), cada uno en la suya, detrás
 */
export function compendiumSections(system: System, types: readonly CompendiumType[]): CompendiumSection[] {
  const present = new Map(types.map((t) => [t.key, t]))
  const labelOf = (key: string): Text => system.compendium?.types?.[key]?.label ?? present.get(key)?.label ?? key
  const used = new Set<string>()
  const sections: CompendiumSection[] = (system.compendium?.sections ?? []).flatMap((s) => {
    const inside = s.types.filter((k) => present.has(k) && !used.has(k))
    for (const k of inside) used.add(k)
    return inside.length > 0
      ? [{ key: s.key, label: s.label, types: inside.map((k) => ({ key: k, label: labelOf(k) })) }]
      : []
  })
  for (const t of types)
    if (!used.has(t.key))
      sections.push({ key: t.key, label: labelOf(t.key), types: [{ key: t.key, label: labelOf(t.key) }] })
  return sections
}

/** Un documento del compendio en su carpeta (o suelto, con null), con sus valores en los campos que se filtran */
export interface BrowseHit {
  key: string
  name: string
  edition: string | null
  legacy: boolean
  folder: string | null
  values: Record<string, string[]>
}

/** Un filtro de un tipo: su campo, su nombre y sus valores (solo los que tiene alguno) */
export interface BrowseFilter {
  key: string
  label: string
  options: { value: string; label: string }[]
}

const YES_NO = { es: ['Sí', 'No'], en: ['Yes', 'No'] }

/** Un número como se dice: 0.125 → «1/8» (el VD de una criatura) */
const numberText = (n: number) => (n > 0 && n < 1 && Number.isInteger(1 / n) ? `1/${1 / n}` : String(n))

const folded = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

/** De un texto, lo de delante: «Dragón (cromático)» → «Dragón»; «Humanoide o bestia» → «Humanoide» */
const baseOf = (text: string) => (text.split(' (')[0] ?? text).split(/ (?:o|or)(?: |$)/)[0]?.trim() ?? text

const nameOf = (data: Record<string, unknown> | undefined, language: Language, fallback: string) => {
  const name = data?.name
  return (typeof name === 'string' ? name : textOf(name as Text | undefined, language)) || fallback
}

/**
 * Los documentos de un tipo que se ven en una campaña, cada uno en su carpeta (por el campo que dice el sistema: el
 * nivel de un conjuro, el tipo de una criatura), y sus carpetas en orden: los números de menor a mayor, las opciones
 * en su orden y los textos por su nombre. Dentro, por su nombre (de lo mismo, el nuevo antes)
 */
export function browseContent<T extends Versioned & { data?: Record<string, unknown> }>(
  system: System,
  content: readonly T[],
  {
    type,
    sources,
    duplicates,
    excluded,
    language
  }: { type: string } & Pick<Choices, 'sources' | 'duplicates' | 'excluded'> & { language: Language }
): { items: BrowseHit[]; folders: { key: string; label: string }[]; filters: BrowseFilter[] } {
  const spec = system.compendium?.types?.[type]?.folder
  const filterSpecs = (system.compendium?.types?.[type]?.filters ?? []).filter(
    (f) => system.types[type]?.fields[f.field]
  )
  // Los valores de un documento en un campo que se filtra, como textos (una lista, cada uno)
  const valuesOf = (data: Record<string, unknown> | undefined): Record<string, string[]> =>
    Object.fromEntries(
      filterSpecs.map((f) => {
        const value = data?.[f.field]
        const list = Array.isArray(value) ? value : value === undefined || value === null || value === '' ? [] : [value]
        return [f.field, list.map((v) => String(v))]
      })
    )
  const field = spec ? system.types[type]?.fields[spec.field] : undefined
  const options = field?.kind === 'choice' || field?.kind === 'list' ? (field.options ?? []) : []
  const folders = new Map<string, { label: string; order: number | string }>()
  const folderOf = (value: unknown): string | null => {
    if (!spec || value === undefined || value === null || value === '') return null
    const named = (key: string) => (spec.labels?.[key] ? textOf(spec.labels[key], language) : null)
    const templated = (key: string) => (spec.template ? textOf(spec.template, language).replace('{valor}', key) : key)
    let key: string
    let label: string
    let order: number | string
    if (typeof value === 'number') {
      key = String(value)
      label = named(key) ?? templated(key)
      order = value
    } else if (options.length > 0) {
      key = String(value)
      const at = options.findIndex((o) => o.value === value)
      label = named(key) ?? (at >= 0 ? textOf(options[at]?.label, language) : key)
      order = at >= 0 ? at : options.length
    } else {
      const text = typeof value === 'string' ? value : textOf(value as Text, language)
      const shown = spec.base ? baseOf(text) : text
      if (!shown) return null
      key = folded(shown)
      label = named(key) ?? shown.charAt(0).toUpperCase() + shown.slice(1)
      order = label
    }
    if (!folders.has(key)) folders.set(key, { label, order })
    return key
  }
  const items: BrowseHit[] = visibleContent(system, content, { sources, duplicates, excluded })
    .filter(({ item }) => item.type === type)
    .map(({ item, legacy }) => ({
      key: item.key,
      name: nameOf(item.data, language, item.key),
      edition: editionOf(system, item) ?? null,
      legacy,
      folder: folderOf(spec ? item.data?.[spec.field] : undefined),
      values: valuesOf(item.data)
    }))
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, language) || Number(a.legacy) - Number(b.legacy) || a.key.localeCompare(b.key)
    )
  const ordered = [...folders.entries()]
    .sort(([, a], [, b]) =>
      typeof a.order === 'number' && typeof b.order === 'number'
        ? a.order - b.order
        : String(a.order).localeCompare(String(b.order), language)
    )
    .map(([key, f]) => ({ key, label: f.label }))
  // Cada filtro, con los valores que tiene alguno, en su orden: el de sus opciones, sí y no, o de menor a mayor
  const filters = filterSpecs.map((spec): BrowseFilter => {
    const field = system.types[type]?.fields[spec.field]
    const present = new Set(items.flatMap((i) => i.values[spec.field] ?? []))
    const named = (value: string) => (spec.labels?.[value] ? textOf(spec.labels[value], language) : null)
    const fieldOptions = field?.kind === 'choice' || field?.kind === 'list' ? (field.options ?? []) : []
    let options: { value: string; label: string }[]
    if (field?.kind === 'boolean')
      options = ['true', 'false']
        .filter((v) => present.has(v))
        .map((v) => ({ value: v, label: YES_NO[language][v === 'true' ? 0 : 1] as string }))
    else if (fieldOptions.length > 0)
      options = fieldOptions
        .filter((o) => present.has(o.value))
        .map((o) => ({ value: o.value, label: named(o.value) ?? textOf(o.label, language) }))
    else if (field?.kind === 'number')
      options = [...present]
        .sort((a, b) => Number(a) - Number(b))
        .map((v) => ({ value: v, label: named(v) ?? numberText(Number(v)) }))
    else
      options = [...present]
        .map((v) => ({ value: v, label: named(v) ?? v }))
        .sort((a, b) => a.label.localeCompare(b.label, language))
    return { key: spec.field, label: field ? textOf(field.label, language) : spec.field, options }
  })
  return { items, folders: ordered, filters }
}
