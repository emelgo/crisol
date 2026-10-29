/**
 * Las propiedades de una página: pares de nombre y valor con su tipo, en el orden que elige el máster. Tres nombres
 * están reservados y tienen su tipo: alias y etiquetas (listas) y resumen (texto)
 */
export type PageProperty =
  | { name: string; type: 'text'; value: string }
  | { name: string; type: 'number'; value: number }
  | { name: string; type: 'boolean'; value: boolean }
  | { name: string; type: 'list'; value: string[] }
  | { name: string; type: 'pages'; value: string[] }

export const RESERVED_PROPERTIES = { alias: 'list', etiquetas: 'list', resumen: 'text' } as const

/** Cómo se compara un nombre: sin espacios de los lados ni mayúsculas */
export const propertyKey = (name: string) => name.trim().toLocaleLowerCase('es')

/** Una etiqueta: palabras separadas por «/» para la jerarquía, sin espacios ni tramos vacíos */
const TAG = /^[^\s/]+(\/[^\s/]+)*$/u

/** Por qué no valen estas propiedades, o null si valen */
export function propertiesProblem(
  properties: readonly PageProperty[]
): 'DUPLICATE_PROPERTY' | 'RESERVED_PROPERTY_TYPE' | 'BAD_TAG' | null {
  const seen = new Set<string>()
  for (const property of properties) {
    const key = propertyKey(property.name)
    if (seen.has(key)) return 'DUPLICATE_PROPERTY'
    seen.add(key)
    const reserved = RESERVED_PROPERTIES[key as keyof typeof RESERVED_PROPERTIES]
    if (reserved && reserved !== property.type) return 'RESERVED_PROPERTY_TYPE'
    if (key === 'etiquetas' && property.type === 'list' && property.value.some((tag) => !TAG.test(tag))) {
      return 'BAD_TAG'
    }
  }
  return null
}

/** El valor de una propiedad reservada de lista (alias, etiquetas), si la página la tiene */
export function reservedList(properties: readonly PageProperty[], name: 'alias' | 'etiquetas'): string[] {
  const found = properties.find((p) => propertyKey(p.name) === name)
  return found?.type === 'list' ? found.value : []
}

/**
 * Cuántas páginas tiene cada etiqueta, de la A a la Z. Una etiqueta madre («lugar») cuenta también las páginas de sus
 * hijas («lugar/ciudad»), cada página una vez. Sin mirar mayúsculas
 */
export function tagCounts(pages: readonly { pageId: string; tags: readonly string[] }[]) {
  const byTag = new Map<string, Set<string>>()
  for (const { pageId, tags } of pages) {
    for (const tag of tags) {
      const parts = tag.toLocaleLowerCase('es').split('/')
      for (let i = 1; i <= parts.length; i++) {
        const prefix = parts.slice(0, i).join('/')
        const set = byTag.get(prefix) ?? new Set()
        set.add(pageId)
        byTag.set(prefix, set)
      }
    }
  }
  return [...byTag]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([tag, ids]) => ({ tag, depth: tag.split('/').length - 1, count: ids.size }))
}
