/**
 * Encontrar páginas por su nombre: para resolver un `[[Título]]` (exacto: título o alias sin mayúsculas, o una ruta
 * «Lugares/Puerto») y para sugerir al escribir `[[` (con erratas)
 */

/** Lo que se sabe de una página para encontrarla: su título, sus alias y su ruta (los títulos desde arriba, ella al final) */
export interface NamedPage {
  id: string
  title: string
  aliases: readonly string[]
  path: readonly string[]
}

/** Cómo se compara un nombre: sin espacios de más ni mayúsculas */
export const foldName = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')

/** Sin tildes, para buscar con erratas */
const plain = (name: string) =>
  foldName(name)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

const namesOf = (page: NamedPage) => [page.title, ...page.aliases]

/**
 * Las páginas de una lista por cada uno de sus nombres (sin mayúsculas). Se hace una vez por lista: al pasar un mundo
 * entero se resuelven miles de enlaces contra la misma
 */
const indexes = new WeakMap<readonly NamedPage[], Map<string, NamedPage[]>>()
function indexOf(pages: readonly NamedPage[]) {
  let index = indexes.get(pages)
  if (!index) {
    index = new Map()
    for (const page of pages) {
      for (const name of new Set(namesOf(page).map(foldName))) index.set(name, [...(index.get(name) ?? []), page])
    }
    indexes.set(pages, index)
  }
  return index
}

/**
 * Las páginas a las que lleva un nombre: las que se llaman así (título o alias), o, con «A/B», la B que cuelga de A.
 * Una: resuelto; ninguna: sin resolver; varias: hay que elegir
 */
export function resolveName(name: string, pages: readonly NamedPage[]): NamedPage[] {
  const parts = name.split('/').map(foldName).filter(Boolean)
  const last = parts.at(-1)
  if (!last) return []
  const named = indexOf(pages).get(last) ?? []
  if (parts.length === 1) return named
  const above = parts.slice(0, -1)
  return named.filter((page) => {
    const path = page.path.map(foldName).slice(0, -1)
    return above.length <= path.length && above.every((part, i) => path[path.length - above.length + i] === part)
  })
}

/** La distancia de edición entre dos textos (Levenshtein), parando si pasa de max */
export function editDistance(a: string, b: string, max = Number.POSITIVE_INFINITY): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const value = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost)
      current.push(value)
      best = Math.min(best, value)
    }
    if (best > max) return max + 1
    previous = current
  }
  return previous[b.length] ?? 0
}

/** Qué tal casa un nombre con lo escrito: 0 igual, 1 empieza así, 2 una palabra empieza así, 3 lo contiene, 4+ erratas */
function score(query: string, name: string): number | null {
  if (name === query) return 0
  if (name.startsWith(query)) return 1
  if (name.split(/[\s/-]+/).some((word) => word.startsWith(query))) return 2
  if (name.includes(query)) return 3
  const allowed = query.length >= 8 ? 2 : query.length >= 4 ? 1 : 0
  if (allowed === 0) return null
  // Contra el principio del nombre y de cada palabra (con una letra más o menos), y contra el nombre entero
  let distance = editDistance(query, name, allowed)
  for (const start of [name, ...name.split(/[\s/-]+/)]) {
    for (const length of [query.length - 1, query.length, query.length + 1]) {
      if (length > 0) distance = Math.min(distance, editDistance(query, start.slice(0, length), allowed))
    }
  }
  return distance <= allowed ? 4 + distance : null
}

/** Las páginas que mejor casan con lo escrito tras `[[`, con el nombre por el que casan (el título o un alias) */
export function searchNames(query: string, pages: readonly NamedPage[], limit = 8) {
  const wanted = plain(query)
  if (!wanted) return pages.slice(0, limit).map((page) => ({ page, name: page.title, score: 0 }))
  const found: { page: NamedPage; name: string; score: number }[] = []
  for (const page of pages) {
    let best: { name: string; score: number } | null = null
    for (const name of namesOf(page)) {
      const value = score(wanted, plain(name))
      if (value !== null && (!best || value < best.score)) best = { name, score: value }
    }
    if (best) found.push({ page, ...best })
  }
  return found
    .sort((a, b) => a.score - b.score || a.name.length - b.name.length || a.name.localeCompare(b.name, 'es'))
    .slice(0, limit)
}

/** Lo que hace falta de una entrada del compendio para saber si un enlace `[[@…]]` la nombra */
export interface LinkTarget {
  key: string
  /** Sus nombres, en cada idioma */
  names: readonly string[]
  type: string
  /** El nombre de su tipo, en cada idioma */
  typeLabels: readonly string[]
  /** Del compendio del mundo: gana a la del sistema con el mismo nombre */
  world: boolean
}

/**
 * Qué entrada nombra un enlace `[[@…]]` (ADR-0033): `tipo/Nombre` (el tipo por su clave o por su nombre, para lo que
 * se llama igual: el conjuro y la armadura «Escudo»), su clave o su nombre en cualquier idioma; lo del mundo, antes
 */
export function matchLinkTarget<T extends LinkTarget>(items: readonly T[], link: string): T | undefined {
  const byName = (list: readonly T[], name: string) => {
    const wanted = foldName(name)
    const named = (item: T) => item.names.some((n) => foldName(n) === wanted)
    return list.find((item) => item.world && named(item)) ?? list.find(named)
  }
  const byKey = (list: readonly T[], key: string) =>
    list.find((item) => item.world && item.key === key.trim()) ?? list.find((item) => item.key === key.trim())
  const slash = link.indexOf('/')
  if (slash > 0) {
    const prefix = foldName(link.slice(0, slash))
    const rest = link.slice(slash + 1)
    const typed = items.filter(
      (item) => foldName(item.type) === prefix || item.typeLabels.some((label) => foldName(label) === prefix)
    )
    const hit = typed.length > 0 ? (byName(typed, rest) ?? byKey(typed, rest)) : undefined
    if (hit) return hit
  }
  return byName(items, link) ?? byKey(items, link)
}
