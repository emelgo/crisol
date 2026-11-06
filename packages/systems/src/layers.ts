/**
 * Las capas del compendio de una campaña (docs/specs/compendio-mundo.md): lo del sistema y lo del mundo. Lo del mundo
 * va sin fuente (sale siempre, elija lo que elija la campaña), marcado, y manda en las claves. Y lo que hace falta para
 * las copias: la huella de una entrada y lo que cambió entre dos versiones, para avisar cuando cambia su original y
 * traer sus cambios
 */

/** Lo del mundo, marcado */
export type Layered<T> = T & { world?: true }

/** Une lo del sistema con lo del mundo, en el orden de sus claves; si una clave está en las dos, manda la del mundo */
export function withWorld<T extends { key: string; source: string | null }>(
  system: readonly T[],
  world: readonly Omit<T, 'source'>[]
): Layered<T>[] {
  if (world.length === 0) return [...system]
  const own = world.map((item) => ({ ...item, source: null, world: true as const }) as Layered<T>)
  const keys = new Set(own.map((item) => item.key))
  return [...system.filter((item) => !keys.has(item.key)), ...own].sort((a, b) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0
  )
}

/** El JSON de un valor con las claves de sus objetos en orden: el mismo valor da siempre el mismo texto */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

/** cyrb53: un hash de 53 bits, rápido y sin dependencias; basta para saber si algo cambió (no para seguridad) */
function hash(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

export interface Fingerprinted {
  type: string
  data: Record<string, unknown>
  mechanics?: unknown
}

/** La huella de una entrada: su tipo, sus datos y su mecánica, sin que cuente el orden de las claves */
export function contentFingerprint(item: Fingerprinted): string {
  return hash(canonical({ type: item.type, data: item.data, mechanics: item.mechanics ?? null }))
}

/** Lo que se compara de una entrada */
export interface Compared {
  data: Record<string, unknown>
  mechanics?: unknown
}

export interface FieldChange {
  /** La clave del campo en sus datos, o «mechanics» para toda su mecánica */
  key: string
  before: unknown
  after: unknown
}

/** Lo que cambió de una versión a otra: cada campo de sus datos (en el orden de sus claves) y, al final, su mecánica */
export function contentDiff(before: Compared, after: Compared): FieldChange[] {
  const keys = [...new Set([...Object.keys(before.data), ...Object.keys(after.data)])].sort()
  const changes: FieldChange[] = keys
    .filter((key) => canonical(before.data[key]) !== canonical(after.data[key]))
    .map((key) => ({ key, before: before.data[key], after: after.data[key] }))
  if (canonical(before.mechanics ?? null) !== canonical(after.mechanics ?? null))
    changes.push({ key: 'mechanics', before: before.mechanics ?? null, after: after.mechanics ?? null })
  return changes
}

/** La copia con lo elegido del original: los campos de sus datos (si el original ya no lo tiene, se quita) y su mecánica */
export function pullFields<T extends Compared>(copy: T, original: Compared, keys: readonly string[]): T {
  const data = { ...copy.data }
  for (const key of keys) {
    if (key === 'mechanics') continue
    if (Object.hasOwn(original.data, key)) data[key] = structuredClone(original.data[key])
    else delete data[key]
  }
  const mechanics = keys.includes('mechanics') ? structuredClone(original.mechanics ?? null) : copy.mechanics
  return { ...copy, data, mechanics }
}

/** Una clave nueva a partir de un nombre: sin tildes ni espacios, con algo al azar para no pisar otra */
export function newContentKey(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
  return `${slug || 'entrada'}-${Math.random().toString(36).slice(2, 6)}`
}
