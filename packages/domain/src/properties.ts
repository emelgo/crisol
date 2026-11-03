/**
 * Las propiedades de una página: pares de nombre y valor con su tipo, en el orden que elige el máster. Tres nombres
 * están reservados y tienen su tipo: alias y etiquetas (listas) y resumen (texto). Las que salen de una plantilla
 * llevan el id de su campo (`field`) y su forma (opciones, segmentos, a qué apuntan), guardada en la propia página
 * (ADR-0009)
 */
interface Field {
  name: string
  /** El id del campo de la plantilla de la que salió */
  field?: string | undefined
}

export type PageProperty =
  | (Field & { type: 'text'; value: string })
  /** Sin valor (null): un campo de plantilla aún sin rellenar */
  | (Field & { type: 'number'; value: number | null })
  | (Field & { type: 'boolean'; value: boolean })
  | (Field & { type: 'list'; value: string[] })
  /** Enlaces a páginas (sus ids). Con single, a una sola; targets, las plantillas que se buscan primero */
  | (Field & { type: 'pages'; value: string[]; single?: true | undefined; targets?: string[] | undefined })
  /** Uno de una lista. Un valor fuera de ella se guarda igual y se nota */
  | (Field & { type: 'choice'; value: string; options: string[] })
  /** Un reloj de progreso: cuántos segmentos lleva llenos de los que tiene */
  | (Field & { type: 'clock'; value: number; segments: number })

export type PropertyType = PageProperty['type']

export const RESERVED_PROPERTIES = { alias: 'list', etiquetas: 'list', resumen: 'text' } as const

/** Los segmentos de un reloj: de 2 a 12 */
export const CLOCK_SEGMENTS = { min: 2, max: 12 } as const

/** Cómo se compara un nombre: sin espacios de los lados ni mayúsculas */
export const propertyKey = (name: string) => name.trim().toLocaleLowerCase('es')

/** Una etiqueta: palabras separadas por «/» para la jerarquía, sin espacios ni tramos vacíos */
const TAG = /^[^\s/]+(\/[^\s/]+)*$/u

/** Si el valor de unas opciones no está en su lista (vacío no cuenta: aún no se ha elegido) */
export const outsideOptions = (property: { value: string; options: readonly string[] }) =>
  property.value !== '' && !property.options.includes(property.value)

/** Por qué no valen estas propiedades, o null si valen */
export function propertiesProblem(
  properties: readonly PageProperty[]
):
  | 'DUPLICATE_PROPERTY'
  | 'DUPLICATE_FIELD'
  | 'RESERVED_PROPERTY_TYPE'
  | 'BAD_TAG'
  | 'BAD_CLOCK'
  | 'BAD_PROPERTY'
  | null {
  const seen = new Set<string>()
  const fields = new Set<string>()
  for (const property of properties) {
    const key = propertyKey(property.name)
    if (seen.has(key)) return 'DUPLICATE_PROPERTY'
    seen.add(key)
    if (property.field !== undefined) {
      if (fields.has(property.field)) return 'DUPLICATE_FIELD'
      fields.add(property.field)
    }
    const reserved = RESERVED_PROPERTIES[key as keyof typeof RESERVED_PROPERTIES]
    if (reserved && reserved !== property.type) return 'RESERVED_PROPERTY_TYPE'
    if (key === 'etiquetas' && property.type === 'list' && property.value.some((tag) => !TAG.test(tag))) {
      return 'BAD_TAG'
    }
    if (property.type === 'clock') {
      const { value, segments } = property
      if (segments < CLOCK_SEGMENTS.min || segments > CLOCK_SEGMENTS.max || value < 0 || value > segments) {
        return 'BAD_CLOCK'
      }
    }
    if (property.type === 'pages' && property.single && property.value.length > 1) return 'BAD_PROPERTY'
  }
  return null
}

/** Un número escrito como texto, o null */
const numberIn = (text: string): number | null => {
  const trimmed = text.trim()
  if (!/^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/.test(trimmed)) return null
  return Number(trimmed.replace(',', '.'))
}

/**
 * Un valor con la forma de un campo: su id, su tipo y lo de su tipo (opciones, segmentos, a qué apunta), con el nombre
 * y el valor que vienen. Null si el valor no cabe en ese tipo
 */
export function conformTo(shape: PageProperty, read: PageProperty): PageProperty | null {
  const base = { name: read.name, ...(shape.field === undefined ? {} : { field: shape.field }) }
  const text = read.type === 'text' ? read.value : read.type === 'number' ? String(read.value ?? '') : null
  switch (shape.type) {
    case 'text':
      if (read.type === 'text' || read.type === 'number' || read.type === 'boolean' || read.type === 'choice') {
        return { ...base, type: 'text', value: String(read.value ?? '') }
      }
      return null
    case 'number': {
      if (read.type === 'number') return { ...base, type: 'number', value: read.value }
      if (read.type === 'text' && read.value.trim() === '') return { ...base, type: 'number', value: null }
      const number = read.type === 'text' ? numberIn(read.value) : null
      return number === null ? null : { ...base, type: 'number', value: number }
    }
    case 'boolean':
      return read.type === 'boolean' ? { ...base, type: 'boolean', value: read.value } : null
    case 'list':
      if (read.type === 'list') return { ...base, type: 'list', value: read.value }
      if (text !== null) return { ...base, type: 'list', value: text.trim() === '' ? [] : [text] }
      return null
    case 'choice':
      if (read.type === 'choice') return { ...base, type: 'choice', value: read.value, options: read.options }
      return text === null ? null : { ...base, type: 'choice', value: text.trim(), options: shape.options }
    case 'clock': {
      if (read.type === 'clock') return { ...base, type: 'clock', value: read.value, segments: read.segments }
      if (read.type === 'number') return { ...base, type: 'clock', value: read.value ?? 0, segments: shape.segments }
      const match = read.type === 'text' ? /^\s*(\d+)\s*(?:\/\s*(\d+))?\s*$/.exec(read.value) : null
      if (!match)
        return read.type === 'text' && read.value.trim() === ''
          ? { ...base, type: 'clock', value: 0, segments: shape.segments }
          : null
      return { ...base, type: 'clock', value: Number(match[1]), segments: match[2] ? Number(match[2]) : shape.segments }
    }
    case 'pages': {
      const value = read.type === 'pages' ? read.value : read.type === 'text' && read.value.trim() === '' ? [] : null
      if (value === null) return null
      const single = shape.single === true && value.length <= 1
      return {
        ...base,
        type: 'pages',
        value,
        ...(single ? { single: true } : {}),
        ...(shape.targets ? { targets: shape.targets } : {})
      }
    }
  }
}

/**
 * Las propiedades reescritas a mano (la IA, el YAML de un cuerpo) con la forma de los campos que ya tenía la página:
 * una que se llama igual que uno con id o con forma propia la conserva, si su valor cabe. Así las tablas no la pierden
 */
export function keepShapes(before: readonly PageProperty[], after: readonly PageProperty[]): PageProperty[] {
  const shaped = new Map(
    before
      .filter(
        (p) =>
          p.field !== undefined ||
          p.type === 'choice' ||
          p.type === 'clock' ||
          (p.type === 'pages' && (p.single || p.targets))
      )
      .map((p) => [propertyKey(p.name), p])
  )
  return after.map((property) => {
    if (property.field !== undefined) return property
    const shape = shaped.get(propertyKey(property.name))
    return (shape && conformTo(shape, property)) ?? property
  })
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
