/**
 * Cambiar un sistema por rutas (la IA, con cambiar_sistema): cada cambio pone un valor en su ruta o la quita, sobre una
 * copia. Si uno no se puede hacer, no se hace ninguno. Las rutas son las de los problemas:
 * `types.personaje.fields.defensa.formula`, `rolls.atributo.bands[1].if`
 */

export interface SystemChange {
  path: string
  /** Lo que se pone (un valor o un trozo entero, como un campo nuevo) */
  value?: unknown
  /** Quitarlo */
  remove?: boolean
}

export class ChangeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChangeError'
  }
}

type Segment = string | number
type Container = Record<string, unknown> | unknown[]

/** Lo que no se puede nombrar en una ruta: tocaría los prototipos de JavaScript */
const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor'])
const MAX_SEGMENTS = 20

/** Lee una ruta: `rolls.atributo.bands[1].if` → rolls, atributo, bands, 1, if */
export function parsePath(path: string): Segment[] {
  const segments: Segment[] = []
  const pattern = /([^.[\]]+)|\[(\d+)\]/g
  let at = 0
  for (const match of path.matchAll(pattern)) {
    const between = path.slice(at, match.index)
    if (between !== '' && between !== '.') throw new ChangeError(`No se entiende la ruta «${path}»`)
    at = match.index + match[0].length
    segments.push(match[2] !== undefined ? Number(match[2]) : (match[1] as string))
  }
  if (!path || at !== path.length || path.startsWith('.') || segments.length === 0)
    throw new ChangeError(`No se entiende la ruta «${path}»`)
  if (segments.length > MAX_SEGMENTS) throw new ChangeError(`«${path}»: como mucho, ${MAX_SEGMENTS} partes`)
  for (const s of segments)
    if (typeof s === 'string' && FORBIDDEN.has(s)) throw new ChangeError(`«${path}»: «${s}» no vale en una ruta`)
  return segments
}

const isContainer = (value: unknown): value is Container => typeof value === 'object' && value !== null

/** Hace los cambios sobre una copia del documento, en orden; si uno no se puede, ninguno (lanza ChangeError) */
export function applyChanges(document: Record<string, unknown>, changes: readonly SystemChange[]) {
  const copy = structuredClone(document)
  for (const change of changes) {
    const segments = parsePath(change.path)
    if (!change.remove && change.value === undefined)
      throw new ChangeError(`«${change.path}»: falta lo que se pone (value) o remove`)
    let node: Container = copy
    // Hasta lo que la contiene: lo que falte se crea (un objeto o, si sigue un número, una lista)
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i] as Segment
      const next = segments[i + 1] as Segment
      const child: unknown = Array.isArray(node) ? node[segment as number] : node[segment as string]
      if (child === undefined) {
        if (change.remove) throw new ChangeError(`«${change.path}»: no existe`)
        if (Array.isArray(node) !== (typeof segment === 'number'))
          throw new ChangeError(`«${change.path}»: «${segment}» no es de una lista`)
        const created: Container = typeof next === 'number' ? [] : {}
        setIn(node, segment, created, change.path)
        node = created
      } else if (isContainer(child)) node = child
      else throw new ChangeError(`«${change.path}»: «${segment}» no es un objeto ni una lista`)
    }
    const last = segments[segments.length - 1] as Segment
    if (change.remove) removeIn(node, last, change.path)
    else setIn(node, last, structuredClone(change.value), change.path)
  }
  return copy
}

function setIn(node: Container, segment: Segment, value: unknown, path: string) {
  if (Array.isArray(node)) {
    if (typeof segment !== 'number') throw new ChangeError(`«${path}»: en una lista va un número ([0])`)
    if (segment > node.length) throw new ChangeError(`«${path}»: la lista tiene ${node.length}`)
    node[segment] = value
    return
  }
  if (typeof segment === 'number') throw new ChangeError(`«${path}»: «${segment}» va en un objeto, no en una lista`)
  node[segment] = value
}

function removeIn(node: Container, segment: Segment, path: string) {
  if (Array.isArray(node)) {
    if (typeof segment !== 'number' || segment >= node.length) throw new ChangeError(`«${path}»: no existe`)
    node.splice(segment, 1)
    return
  }
  if (typeof segment === 'number' || !Object.hasOwn(node, segment)) throw new ChangeError(`«${path}»: no existe`)
  delete node[segment]
}

/** Unas partes de un documento, cada una por su ruta (`types.personaje`, `rolls.atributo`); si una no está, lanza */
export function pickPaths(document: Record<string, unknown>, paths: readonly string[]) {
  const out: Record<string, unknown> = {}
  for (const path of paths) {
    let node: unknown = document
    for (const segment of parsePath(path)) {
      if (!isContainer(node)) throw new ChangeError(`«${path}»: no existe`)
      node = Array.isArray(node) ? node[segment as number] : (node as Record<string, unknown>)[segment as string]
      if (node === undefined) throw new ChangeError(`«${path}»: no existe`)
    }
    out[path] = structuredClone(node)
  }
  return out
}
