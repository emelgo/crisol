/**
 * Las etiquetas de la cuenta (ADR-0006): la jerarquía va en el nombre, con «/» («lugar/ciudad» está dentro de «lugar»),
 * y se comparan sin mirar mayúsculas
 */

/** La clave de una etiqueta para compararla */
export const tagKey = (tag: string) => tag.trim().toLocaleLowerCase('es')

/** Si una etiqueta es esa o una de sus hijas */
export function isTagOrChild(tag: string, of: string) {
  const key = tagKey(tag)
  const parent = tagKey(of)
  return key === parent || key.startsWith(`${parent}/`)
}

/** Sin repetidas (sin mirar mayúsculas): se queda la primera */
export function uniqueTags(tags: readonly string[]) {
  const seen = new Set<string>()
  return tags.filter((tag) => {
    const key = tagKey(tag)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Cambia una etiqueta (y sus hijas: «lugar/ciudad» pasa a «sitio/ciudad») por otra; null si no la lleva */
export function renameTagIn(tags: readonly string[], from: string, to: string): string[] | null {
  if (!tags.some((tag) => isTagOrChild(tag, from))) return null
  const length = from.trim().length
  return uniqueTags(tags.map((tag) => (isTagOrChild(tag, from) ? `${to.trim()}${tag.trim().slice(length)}` : tag)))
}

/** Quita una etiqueta y sus hijas; null si no la lleva */
export function removeTagIn(tags: readonly string[], tag: string): string[] | null {
  if (!tags.some((t) => isTagOrChild(t, tag))) return null
  return tags.filter((t) => !isTagOrChild(t, tag))
}

/** Las madres de una etiqueta y ella: «a/b/c» da «a», «a/b» y «a/b/c» */
const withParents = (tag: string) => {
  const parts = tag.trim().split('/')
  return parts.map((_, i) => parts.slice(0, i + 1).join('/'))
}

/** Por tramos: así las hijas van justo detrás de su madre */
const byPath = (a: string, b: string) => {
  const left = a.split('/')
  const right = b.split('/')
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const order = (left[i] ?? '').localeCompare(right[i] ?? '', 'es')
    if (order !== 0) return order
  }
  return left.length - right.length
}

export interface TagNode<Color> {
  id: string | null
  name: string
  depth: number
  color: Color | null
  pages: number
  files: number
  /** Cuántas páginas la llevan en cada mundo */
  worlds: Map<string, number>
}

/**
 * El catálogo en árbol: las etiquetas guardadas (creadas a mano o con color) y las que llevan las páginas y los
 * archivos, con sus madres aunque nadie las lleve. Cada página o archivo cuenta una vez en cada una (en «lugar», aunque
 * lleve «lugar/ciudad» y «lugar/puerto»). El nombre, como sale la primera vez: guardada, en una página o en un archivo
 */
export function tagTree<Color>(input: {
  rows: readonly { id: string; name: string; color: Color | null }[]
  pages: readonly { worldId: string; tags: readonly string[] }[]
  files: readonly { tags: readonly string[] }[]
}): TagNode<Color>[] {
  const nodes = new Map<string, TagNode<Color>>()
  const node = (name: string) => {
    const key = tagKey(name)
    let found = nodes.get(key)
    if (!found) {
      found = { id: null, name, depth: name.split('/').length - 1, color: null, pages: 0, files: 0, worlds: new Map() }
      nodes.set(key, found)
    }
    return found
  }
  for (const row of input.rows) {
    for (const name of withParents(row.name)) node(name)
    const saved = node(row.name.trim())
    saved.id = row.id
    saved.color = row.color
  }
  // Las de cada cosa, con sus madres, una vez
  const keysOf = (tags: readonly string[]) => {
    const found = new Map<string, string>()
    for (const tag of tags)
      for (const name of withParents(tag)) if (!found.has(tagKey(name))) found.set(tagKey(name), name)
    return [...found.values()]
  }
  for (const page of input.pages) {
    for (const name of keysOf(page.tags)) {
      const at = node(name)
      at.pages++
      at.worlds.set(page.worldId, (at.worlds.get(page.worldId) ?? 0) + 1)
    }
  }
  for (const file of input.files) for (const name of keysOf(file.tags)) node(name).files++
  return [...nodes.values()].sort((a, b) => byPath(tagKey(a.name), tagKey(b.name)))
}
