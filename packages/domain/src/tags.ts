import { keyBetween } from './order.ts'

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

/** La madre de una etiqueta («lugar» de «lugar/ciudad»), o null si va en lo más alto */
export const tagParent = (tag: string) => {
  const parts = tag.trim().split('/')
  return parts.length > 1 ? parts.slice(0, -1).join('/') : null
}

/** Su último tramo, el que se ve en el árbol («ciudad» de «lugar/ciudad») */
export const tagLeaf = (tag: string) => tag.trim().split('/').at(-1) ?? tag.trim()

/**
 * El orden de las hermanas: las que tienen puesto, por él (comparando caracteres, como la collation "C"); detrás, las
 * que no, por nombre
 */
const bySiblingOrder = (a: { name: string; position: string | null }, b: { name: string; position: string | null }) => {
  if (a.position !== null && b.position !== null) return a.position < b.position ? -1 : a.position > b.position ? 1 : 0
  if (a.position !== null) return -1
  if (b.position !== null) return 1
  return tagLeaf(a.name).localeCompare(tagLeaf(b.name), 'es')
}

/**
 * Los puestos que hay que guardar al poner `moved` delante o detrás de una de sus hermanas (`siblings`: todas, ya en su
 * orden, con ella o sin ella). Si todas tenían puesto, solo cambia el suyo; si no, se rellenan todas en el orden nuevo
 */
export function placeAmongSiblings(
  siblings: readonly { name: string; position: string | null }[],
  moved: string,
  to: { before?: string; after?: string }
): { name: string; position: string }[] {
  const others = siblings.filter((s) => tagKey(s.name) !== tagKey(moved))
  const anchor = to.before ?? to.after
  const at = anchor ? others.findIndex((s) => tagKey(s.name) === tagKey(anchor)) : -1
  const index = at < 0 ? others.length : to.before !== undefined ? at : at + 1
  if (others.every((s) => s.position !== null)) {
    const previous = others[index - 1]?.position ?? null
    const next = others[index]?.position ?? null
    return [{ name: moved, position: keyBetween(previous, next) }]
  }
  const order = [...others.slice(0, index).map((s) => s.name), moved, ...others.slice(index).map((s) => s.name)]
  const result: { name: string; position: string }[] = []
  let last: string | null = null
  for (const name of order) {
    last = keyBetween(last, null)
    result.push({ name, position: last })
  }
  return result
}

export interface TagNode<Color> {
  id: string | null
  /** Su puesto entre sus hermanas (null: por nombre, detrás) */
  position: string | null
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
  rows: readonly { id: string; name: string; color: Color | null; position?: string | null }[]
  pages: readonly { worldId: string; tags: readonly string[] }[]
  files: readonly { tags: readonly string[] }[]
}): TagNode<Color>[] {
  const nodes = new Map<string, TagNode<Color>>()
  const node = (name: string) => {
    const key = tagKey(name)
    let found = nodes.get(key)
    if (!found) {
      found = {
        id: null,
        position: null,
        name,
        depth: name.split('/').length - 1,
        color: null,
        pages: 0,
        files: 0,
        worlds: new Map()
      }
      nodes.set(key, found)
    }
    return found
  }
  for (const row of input.rows) {
    for (const name of withParents(row.name)) node(name)
    const saved = node(row.name.trim())
    saved.id = row.id
    saved.color = row.color
    saved.position = row.position ?? null
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
  // Cada una justo detrás de su madre; entre hermanas, por su puesto (y sin él, por nombre)
  const children = new Map<string | null, TagNode<Color>[]>()
  for (const at of nodes.values()) {
    const parent = tagParent(at.name)
    const key = parent === null ? null : tagKey(parent)
    children.set(key, [...(children.get(key) ?? []), at])
  }
  const ordered: TagNode<Color>[] = []
  const walk = (key: string | null) => {
    for (const at of (children.get(key) ?? []).sort(bySiblingOrder)) {
      ordered.push(at)
      walk(tagKey(at.name))
    }
  }
  walk(null)
  return ordered
}
