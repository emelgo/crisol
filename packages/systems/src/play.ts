/**
 * Lo de la partida de un personaje (docs/specs/hoja.md § partida), aparte de sus elecciones (ADR-0013): los valores
 * que cambian jugando (los PG, la inspiración, las monedas, las notas), lo gastado de los recursos de lo que lleva, lo
 * que lleva del compendio (con su cantidad y su estado) y lo que tiene activo. Su hoja es `evaluate` de las elecciones
 * con esto encima. Daño, curación y descansar son funciones puras sobre ello
 */
import { z } from 'zod'
import type { DocumentItem, Resource, SystemDocument } from './evaluate.ts'
import type { ContentItem } from './file.ts'
import type { Field, System } from './format.ts'
import type { Value } from './formulas/functions.ts'
import type { Mechanics } from './mechanics.ts'

export interface PlayItem {
  id: string
  /** Su clave en el contenido */
  key: string
  quantity?: number
  equipped?: boolean
  attuned?: boolean
}

export interface Play {
  /** Por la clave del campo: los PG ({ value, temp }), la inspiración, las monedas, las notas… */
  values?: Record<string, unknown>
  /** Lo gastado de cada recurso de lo que lleva: por su id y la clave del recurso */
  uses?: Record<string, Record<string, number>>
  items?: PlayItem[]
  /** Lo que tiene activo (la Furia): por su id */
  active?: string[]
}

export const PLAY_BYTES = 256 * 1024

export const playSchema = z.strictObject({
  values: z.record(z.string().max(60), z.unknown()).optional(),
  uses: z.record(z.string().max(300), z.record(z.string().max(60), z.int().min(0).max(1000))).optional(),
  items: z
    .array(
      z.strictObject({
        id: z.string().min(1).max(60),
        key: z.string().min(1).max(100),
        quantity: z.int().min(0).max(100_000).optional(),
        equipped: z.boolean().optional(),
        attuned: z.boolean().optional()
      })
    )
    .max(500)
    .optional(),
  active: z.array(z.string().max(300)).max(200).optional()
})

const isCount = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 100_000
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Lo que no vale de un valor de un campo que se cambia jugando; null si vale */
function simpleProblem(f: Field, v: unknown): string | null {
  switch (f.kind) {
    case 'number':
      if (typeof v !== 'number' || !Number.isFinite(v)) return 'va con un número'
      if (f.integer && !Number.isInteger(v)) return 'va sin decimales'
      if (f.min !== undefined && v < f.min) return `como poco, ${f.min}`
      if (f.max !== undefined && v > f.max) return `como mucho, ${f.max}`
      return null
    case 'boolean':
      return typeof v === 'boolean' ? null : 'va con sí o no'
    case 'text':
      return typeof v === 'string' && v.length <= (f.max ?? 20000) ? null : `va con un texto de hasta ${f.max ?? 20000}`
    case 'list':
      if (!Array.isArray(v) || v.length > (f.max ?? 200) || v.some((x) => typeof x !== 'string' || x.length > 200))
        return 'va con una lista de textos cortos'
      return f.options && v.some((x) => !f.options?.some((o) => o.value === x)) ? 'lleva algo que no es suyo' : null
    case 'choice':
      return f.options.some((o) => o.value === v) ? null : 'no es una de sus opciones'
    case 'clock':
      return Number.isInteger(v) && (v as number) >= 0 && (v as number) <= f.segments ? null : `va de 0 a ${f.segments}`
    case 'dice':
      return typeof v === 'string' && v.length <= 200 ? null : 'va con una tirada'
    case 'link':
      return typeof v === 'string' ||
        (f.multiple && Array.isArray(v) && v.length <= 200 && v.every((x) => typeof x === 'string'))
        ? null
        : 'va con un enlace'
    case 'table': {
      if (!Array.isArray(v) || v.length > (f.max ?? 500)) return 'va con sus filas'
      for (const row of v) {
        if (!isObject(row)) return 'va con sus filas'
        for (const [k, x] of Object.entries(row)) {
          const c = f.columns[k]
          const problem = c ? valueProblem(c, x, true) : 'no es una columna suya'
          if (problem) return `${k}: ${problem}`
        }
      }
      return null
    }
    default:
      return 'no se cambia jugando'
  }
}

/**
 * Lo que no vale de un valor de la partida: un recurso va con lo que le queda y sus temporales (enteros); un grupo, con
 * sus campos (si no se cambia entero, solo sus recursos); lo demás, solo si se cambia jugando (`all`) y con su forma
 */
function valueProblem(f: Field, v: unknown, all: boolean): string | null {
  if (v === undefined) return null
  if (f.kind === 'resource') {
    if (!isObject(v)) return 'va con { value, temp }'
    for (const [k, n] of Object.entries(v)) {
      if (k !== 'value' && k !== 'temp') return `no lleva «${k}»`
      if (n !== undefined && !isCount(n)) return `«${k}» va de 0 a 100000, sin decimales`
    }
    return null
  }
  if (f.kind === 'group') {
    if (!isObject(v)) return 'va con sus campos'
    for (const [k, x] of Object.entries(v)) {
      const c = f.fields[k]
      const problem = c ? valueProblem(c, x, all || c.play === true) : 'no es un campo suyo'
      if (problem) return `${k}: ${problem}`
    }
    return null
  }
  return all ? simpleProblem(f, v) : 'no se cambia jugando'
}

/**
 * Los valores de la partida que valen (los de sus campos con `play` y sus recursos, con su forma) y lo que no vale de
 * los demás, por su clave
 */
export function playValues(
  fields: Record<string, Field>,
  values: Record<string, unknown> = {}
): { values: Record<string, unknown>; problems: { key: string; message: string }[] } {
  const kept: Record<string, unknown> = {}
  const problems: { key: string; message: string }[] = []
  for (const [k, v] of Object.entries(values)) {
    const f = fields[k]
    const message = f ? valueProblem(f, v, f.play === true) : 'no es un campo suyo'
    if (message) problems.push({ key: k, message })
    else kept[k] = v
  }
  return { values: kept, problems }
}

/** Los tipos de lo que se lleva jugando: los de sus campos de objetos con `play` (el inventario) */
export function carriedTypes(fields: Record<string, Field>): Set<string> {
  return new Set(Object.values(fields).flatMap((f) => (f.kind === 'items' && f.play ? f.of : [])))
}

const nameOf = (item: ContentItem, language: 'es' | 'en') => {
  const name = item.data.name
  if (typeof name === 'string') return name
  const names = (name ?? {}) as { es?: string; en?: string }
  return names[language] ?? names.es ?? names.en ?? item.key
}

/**
 * Lo que lleva del compendio, como objetos del documento: su cantidad y su estado van a sus campos. Lo que ya no está
 * en el contenido falta; lo que no es de un tipo que se lleve, no se lleva
 */
export function playItems(
  items: readonly PlayItem[],
  byKey: ReadonlyMap<string, ContentItem>,
  types: ReadonlySet<string>,
  language: 'es' | 'en' = 'es'
): { carried: DocumentItem[]; missing: string[]; refused: string[] } {
  const carried: DocumentItem[] = []
  const missing: string[] = []
  const refused: string[] = []
  for (const it of items) {
    const found = byKey.get(it.key)
    if (!found) {
      missing.push(it.key)
      continue
    }
    if (!types.has(found.type)) {
      refused.push(it.key)
      continue
    }
    carried.push({
      id: `p:${it.id}`,
      type: found.type,
      name: nameOf(found, language),
      data: {
        ...structuredClone(found.data),
        ...(it.quantity !== undefined ? { cantidad: it.quantity } : {}),
        ...(it.equipped !== undefined ? { equipado: it.equipped } : {}),
        ...(it.attuned !== undefined ? { sintonizado: it.attuned } : {})
      },
      ...(found.mechanics ? { mechanics: structuredClone(found.mechanics) as Mechanics } : {})
    })
  }
  return { carried, missing, refused }
}

/** Un valor de la partida sobre el de sus elecciones: en un grupo, campo a campo */
function over(base: unknown, value: unknown): unknown {
  if (!isObject(base) || !isObject(value)) return value
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = over(base[k], v)
  return out
}

/**
 * El documento de las elecciones con lo de la partida encima: los valores que valen, lo que lleva (lo que se puede
 * llevar), lo gastado (también lo suyo, con id '') y lo activo. Dice lo que falta del contenido, lo que no se lleva y
 * lo que no vale de los valores
 */
export function withPlay(
  system: System,
  type: string,
  document: SystemDocument,
  play: Play,
  byKey: ReadonlyMap<string, ContentItem>,
  language: 'es' | 'en' = 'es'
): {
  document: SystemDocument
  missing: string[]
  refused: string[]
  problems: { key: string; message: string }[]
} {
  const fields = system.types[type]?.fields ?? {}
  const { values, problems } = playValues(fields, play.values)
  const data = { ...document.data }
  for (const [k, v] of Object.entries(values)) data[k] = over(data[k], v)
  const { carried, missing, refused } = playItems(play.items ?? [], byKey, carriedTypes(fields), language)
  const active = new Set(play.active ?? [])
  const items = [...(document.items ?? []), ...carried].map((item) => {
    const uses = play.uses?.[item.id]
    const on = active.has(item.id)
    if (!uses && !on) return item
    return { ...item, ...(uses ? { uses } : {}), ...(on ? { data: { ...item.data, activo: true } } : {}) }
  })
  const own = play.uses?.['']
  return {
    document: { ...document, data, items, ...(own ? { uses: { ...(document.uses ?? {}), ...own } } : {}) },
    missing,
    refused,
    problems
  }
}

/** Un recurso (campo) de un personaje, por su ruta (`pg`, `espacios.n1`), y el descanso que lo llena antes del largo */
export interface ResourcePath {
  path: string
  recovery?: 'short' | 'long'
}

/** Los recursos (campos) de un personaje, por su ruta: `pg`, `espacios.n1` */
export function resourcePaths(fields: Record<string, Field>, prefix = ''): ResourcePath[] {
  return Object.entries(fields).flatMap(([k, f]): ResourcePath[] => {
    if (f.kind === 'resource') return [{ path: `${prefix}${k}`, ...(f.recovery ? { recovery: f.recovery } : {}) }]
    if (f.kind === 'group') return resourcePaths(f.fields, `${prefix}${k}.`)
    return []
  })
}

const get = (values: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((v, k) => (isObject(v) ? v[k] : undefined), values)

/** En la hoja, un recurso sin valor guardado está lleno; con él, no pasa de su máximo */
export function fillResources(fields: Record<string, Field>, values: Record<string, Value>, play: Play) {
  for (const { path } of resourcePaths(fields)) {
    const stored = get(play.values ?? {}, path) as { value?: unknown } | undefined
    const shown = get(values, path) as { value?: Value; max?: Value } | undefined
    if (!shown || typeof shown.max !== 'number') continue
    if (typeof stored?.value !== 'number') shown.value = shown.max
    else if (typeof shown.value === 'number' && shown.value > shown.max) shown.value = shown.max
  }
}

/** Pone un valor en lo de la partida, por su ruta (`pg`, `espacios.n1`), sin tocar lo demás */
function setPath(values: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const [head, ...rest] = path.split('.')
  if (!head) return values
  if (rest.length === 0) {
    const { [head]: _, ...others } = values
    return value === undefined ? others : { ...values, [head]: value }
  }
  const inner = isObject(values[head]) ? values[head] : {}
  return { ...values, [head]: setPath(inner, rest.join('.'), value) }
}

/** Pone un valor de un campo en lo de la partida (`monedas.po`, `notas`) */
export function setValue(play: Play, path: string, value: unknown): Play {
  return { ...play, values: setPath(play.values ?? {}, path, value) }
}

/** Lo que queda de un recurso (campo) en lo de la partida: lo guardado, sin pasar de su máximo; sin nada, lleno */
export function resourceIn(play: Play, path: string, max: number): { value: number; max: number; temp: number } {
  const stored = get(play.values ?? {}, path) as { value?: unknown; temp?: unknown } | undefined
  const value = typeof stored?.value === 'number' ? Math.min(max, stored.value) : max
  return { value, max, temp: typeof stored?.temp === 'number' ? stored.temp : 0 }
}

/**
 * Daño a un recurso (los PG): primero lo temporal y luego lo que queda, sin bajar de 0. Curación: lo que queda sube,
 * sin pasar del máximo. Temporales: se quedan los mayores (no se suman). Parte de lo guardado en `play` (así, dos
 * cambios seguidos se suman)
 */
export function changeResource(
  play: Play,
  path: string,
  max: number,
  change: { damage?: number; heal?: number; temp?: number }
): Play {
  let { value, temp } = resourceIn(play, path, max)
  if (change.damage) {
    const fromTemp = Math.min(temp, change.damage)
    temp -= fromTemp
    value = Math.max(0, value - (change.damage - fromTemp))
  }
  if (change.heal) value = Math.min(max, value + change.heal)
  if (change.temp !== undefined) temp = Math.max(temp, change.temp)
  return { ...play, values: setPath(play.values ?? {}, path, { value, temp }) }
}

/** Gasta (o recupera) usos de un recurso de lo que lleva, entre 0 y su máximo, de lo gastado en `play` */
export function spend(play: Play, resource: Pick<Resource, 'item' | 'key' | 'max'>, by: number): Play {
  const item = resource.item ?? ''
  const before = play.uses?.[item]?.[resource.key] ?? 0
  const used = Math.max(0, Math.min(resource.max, before + by))
  return { ...play, uses: { ...(play.uses ?? {}), [item]: { ...(play.uses?.[item] ?? {}), [resource.key]: used } } }
}

/** Lo que recupera cada descanso: el corto, lo de los descansos cortos; el largo, todo (y al amanecer) */
const RECOVERS: Record<'short' | 'long', readonly string[]> = {
  short: ['short'],
  long: ['short', 'long', 'dawn']
}

/**
 * Descansar: lo gastado de los recursos que recupera ese descanso vuelve a 0 (o baja lo que salga de su `amount`, con
 * `roll`) y los recursos del personaje se llenan: en el corto, los que se llenan con él (la magia de pacto); en el
 * largo, todos (los PG, los espacios)
 */
export function rest(
  play: Play,
  resources: readonly Pick<Resource, 'item' | 'key' | 'recovery' | 'amount'>[],
  kind: 'short' | 'long',
  paths: readonly ResourcePath[],
  roll?: (formula: string) => number
): Play {
  const uses: Record<string, Record<string, number>> = structuredClone(play.uses ?? {})
  for (const r of resources) {
    if (!r.recovery || !RECOVERS[kind].includes(r.recovery)) continue
    const mine = uses[r.item ?? '']
    const was = mine?.[r.key]
    if (!mine || was === undefined) continue
    const back = r.amount && roll ? roll(r.amount) : Number.POSITIVE_INFINITY
    const left = Math.max(0, was - Math.max(0, back))
    if (left === 0) delete mine[r.key]
    else mine[r.key] = left
  }
  let values = { ...(play.values ?? {}) }
  for (const { path, recovery } of paths)
    if (kind === 'long' || recovery === 'short') values = setPath(values, path, undefined)
  return { ...play, uses, values }
}
