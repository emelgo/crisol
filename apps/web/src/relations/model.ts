/**
 * Lo que la web hace con las relaciones de una página (módulo 10, docs/specs/modulo-10.md), sin React: con qué modo se
 * abre (y recordarlo por plantilla), cómo se lee cada arista desde la página del centro y la lista «en palabras» que
 * va debajo del grafo en el móvil y en la ficha de una página elegida
 */
import type { RelationEdge, RelationMode } from '@crisol/contracts'
import type { TFunction } from 'i18next'

export const MODE_ORDER: readonly RelationMode[] = ['links', 'family', 'org']

const modeKey = (template: string | null) => `crisol.relaciones.modo.${template ?? 'sin-plantilla'}`

/** El modo que se eligió la última vez en las páginas de esa plantilla (null si no hay o no se puede leer) */
export function rememberedMode(template: string | null): RelationMode | null {
  try {
    const value = localStorage.getItem(modeKey(template))
    return MODE_ORDER.includes(value as RelationMode) ? (value as RelationMode) : null
  } catch {
    return null
  }
}

export function rememberMode(template: string | null, mode: RelationMode) {
  try {
    localStorage.setItem(modeKey(template), mode)
  } catch {
    // Sin almacenamiento (ventana privada): no se recuerda
  }
}

/**
 * Con qué modo se abre la pestaña: el recordado para su plantilla, si la página lo tiene; si no, Familia u Organigrama
 * si los tiene (decisión 8 de la spec) y, si no, Enlaces. null si no tiene ninguna relación
 */
export function openingMode(modes: readonly RelationMode[], remembered: RelationMode | null): RelationMode | null {
  if (remembered && modes.includes(remembered)) return remembered
  if (modes.includes('family')) return 'family'
  if (modes.includes('org')) return 'org'
  return modes.includes('links') ? 'links' : null
}

/** Una arista con lo que hace falta para leerla (las del grafo del mundo llegan cortas y se completan) */
export type ReadableEdge = Pick<RelationEdge, 'source' | 'target' | 'kind' | 'name' | 'inverseName' | 'secret'>

/**
 * Cómo se lee una arista desde una página: un campo suyo, por su nombre («Padres»); uno de otra que apunta a ella, por
 * su nombre al revés («Hijos») o, sin él, «Facción de», que se lee con la otra página («Facción de Ilsa»); una mención,
 * «Menciona» o «Mencionada en»
 */
export function edgeLabel(edge: ReadableEdge, from: string, t: TFunction): string {
  const outgoing = edge.source === from
  if (edge.kind === 'mention') return t(outgoing ? 'relations.mentions' : 'relations.mentionedIn')
  if (outgoing) return edge.name
  return edge.inverseName || t('relations.inverseOf', { name: edge.name })
}

/** Una fila de la lista «en palabras»: cómo se lee y con qué páginas */
export interface WordsRow {
  label: string
  /** Sale de un secreto (solo el máster) */
  secret: boolean
  pages: { id: string; title: string }[]
}

/**
 * Las relaciones de una página dichas en palabras, como en su panel: primero sus campos (en el orden en que llegan),
 * después lo que apunta a ella y al final las menciones
 */
export function inWords(
  pageId: string,
  edges: readonly ReadableEdge[],
  titleOf: (id: string) => string,
  t: TFunction
): WordsRow[] {
  const rank = (edge: ReadableEdge) => (edge.kind === 'mention' ? 2 : edge.source === pageId ? 0 : 1)
  const own = edges
    .filter((edge) => edge.source === pageId || edge.target === pageId)
    .map((edge, index) => ({ edge, index }))
    .sort((a, b) => rank(a.edge) - rank(b.edge) || a.index - b.index)
  const rows = new Map<string, WordsRow>()
  for (const { edge } of own) {
    const label = edgeLabel(edge, pageId, t)
    const secret = edge.secret === true
    const key = `${label}|${secret}`
    const row = rows.get(key) ?? { label, secret, pages: [] }
    const other = edge.source === pageId ? edge.target : edge.source
    if (!row.pages.some((page) => page.id === other)) row.pages.push({ id: other, title: titleOf(other) })
    rows.set(key, row)
  }
  return [...rows.values()]
}

const ROMAN = /^[IVXLCDM]+$/

/**
 * Las iniciales de un título, para el círculo de una página sin icono: «Mirela de Varn» → «MV». Sin los ordinales
 * («Aldren IV» → «AL») ni iniciales que se lean como uno («Ilsa de Varn» → «IL», no «IV»)
 */
export function initials(title: string) {
  const all = title.split(/\s+/).filter(Boolean)
  const words = all.filter((word) => !ROMAN.test(word))
  const capital = words.filter((word) => /\p{Lu}/u.test([...word][0] ?? ''))
  const picked = capital.length > 0 ? capital : words.length > 0 ? words : all
  const first = picked[0] ?? ''
  const twoOf = (word: string) => [...word].slice(0, 2).join('').toLocaleUpperCase()
  if (picked.length < 2) return twoOf(first)
  const pair = `${[...first][0] ?? ''}${[...(picked[picked.length - 1] ?? '')][0] ?? ''}`.toLocaleUpperCase()
  // «IV», «XI»…: se leerían como un ordinal
  return /^[IVX]{2}$/.test(pair) ? twoOf(first) : pair
}

/** Cuántos colores de serie hay en el tema (--color-series-1 a --color-series-8) */
export const SERIES_COLORS = 8

/**
 * El color de una plantilla: el de su sitio en la lista de plantillas que salen (el mismo en la pestaña y en el grafo
 * del mundo); sin plantilla, el atenuado
 */
export function templateColor(template: string | null, order: readonly string[]) {
  if (!template) return 'var(--color-muted)'
  const at = order.indexOf(template)
  return `var(--color-series-${((at === -1 ? order.length : at) % SERIES_COLORS) + 1})`
}
