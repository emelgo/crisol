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

/** Los campos que se escriben jugando: los guardados del personaje (no los calculados ni los de objetos) */
export function playableFields(fields: Record<string, Field>): string[] {
  return Object.entries(fields)
    .filter(([, f]) => f.kind !== 'derived' && f.kind !== 'items' && f.kind !== 'set')
    .map(([k]) => k)
}

const nameOf = (item: ContentItem, language: 'es' | 'en') => {
  const name = item.data.name
  if (typeof name === 'string') return name
  const names = (name ?? {}) as { es?: string; en?: string }
  return names[language] ?? names.es ?? names.en ?? item.key
}

/** Lo que lleva del compendio, como objetos del documento: su cantidad y su estado van a sus campos */
export function playItems(
  items: readonly PlayItem[],
  byKey: ReadonlyMap<string, ContentItem>,
  language: 'es' | 'en' = 'es'
): { carried: DocumentItem[]; missing: string[] } {
  const carried: DocumentItem[] = []
  const missing: string[] = []
  for (const it of items) {
    const found = byKey.get(it.key)
    if (!found) {
      missing.push(it.key)
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
  return { carried, missing }
}

/** El documento de las elecciones con lo de la partida encima */
export function withPlay(
  system: System,
  type: string,
  document: SystemDocument,
  play: Play,
  byKey: ReadonlyMap<string, ContentItem>,
  language: 'es' | 'en' = 'es'
): { document: SystemDocument; missing: string[] } {
  const fields = system.types[type]?.fields ?? {}
  const writable = new Set(playableFields(fields))
  const data = { ...document.data }
  for (const [k, v] of Object.entries(play.values ?? {})) if (writable.has(k)) data[k] = v
  const { carried, missing } = playItems(play.items ?? [], byKey, language)
  const active = new Set(play.active ?? [])
  const items = [...(document.items ?? []), ...carried].map((item) => {
    const uses = play.uses?.[item.id]
    const on = active.has(item.id)
    if (!uses && !on) return item
    return { ...item, ...(uses ? { uses } : {}), ...(on ? { data: { ...item.data, activo: true } } : {}) }
  })
  return { document: { ...document, data, items }, missing }
}

/** Los recursos (campos) de un personaje, por su ruta: `pg`, `espacios.n1` */
export function resourcePaths(fields: Record<string, Field>, prefix = ''): string[] {
  return Object.entries(fields).flatMap(([k, f]) => {
    if (f.kind === 'resource') return [`${prefix}${k}`]
    if (f.kind === 'group') return resourcePaths(f.fields, `${prefix}${k}.`)
    return []
  })
}

const get = (values: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), values)

/** En la hoja, un recurso sin valor guardado está lleno (lo que queda es su máximo) */
export function fillResources(fields: Record<string, Field>, values: Record<string, Value>, play: Play) {
  for (const path of resourcePaths(fields)) {
    const stored = get(play.values ?? {}, path) as { value?: unknown } | undefined
    const shown = get(values, path) as { value?: Value; max?: Value } | undefined
    if (shown && typeof stored?.value !== 'number' && typeof shown.max === 'number') shown.value = shown.max
  }
}

/** Pone un valor en lo de la partida, por su ruta (`pg`, `espacios.n1`), sin tocar lo demás */
function setPath(values: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const [head, ...rest] = path.split('.')
  if (!head) return values
  if (rest.length === 0) return { ...values, [head]: value }
  const inner = (values[head] && typeof values[head] === 'object' ? values[head] : {}) as Record<string, unknown>
  return { ...values, [head]: setPath(inner, rest.join('.'), value) }
}

/**
 * Daño a un recurso (los PG): primero lo temporal y luego lo que queda, sin bajar de 0. Curación: lo que queda sube,
 * sin pasar del máximo. Temporales: se quedan los mayores (no se suman)
 */
export function changeResource(
  play: Play,
  path: string,
  current: { value: number; max: number; temp: number },
  change: { damage?: number; heal?: number; temp?: number }
): Play {
  let { value, temp } = current
  if (change.damage) {
    const fromTemp = Math.min(temp, change.damage)
    temp -= fromTemp
    value = Math.max(0, value - (change.damage - fromTemp))
  }
  if (change.heal) value = Math.min(current.max, value + change.heal)
  if (change.temp !== undefined) temp = Math.max(temp, change.temp)
  return { ...play, values: setPath(play.values ?? {}, path, { value, temp }) }
}

/** Gasta (o recupera) usos de un recurso de lo que lleva, entre 0 y su máximo */
export function spend(play: Play, resource: Pick<Resource, 'item' | 'key' | 'max' | 'used'>, by: number): Play {
  const item = resource.item ?? ''
  const used = Math.max(0, Math.min(resource.max, resource.used + by))
  return { ...play, uses: { ...(play.uses ?? {}), [item]: { ...(play.uses?.[item] ?? {}), [resource.key]: used } } }
}

/** Lo que recupera cada descanso: el corto, lo de los descansos cortos; el largo, todo (y al amanecer) */
const RECOVERS: Record<'short' | 'long', readonly string[]> = {
  short: ['short'],
  long: ['short', 'long', 'dawn']
}

/**
 * Descansar: lo gastado de los recursos que recupera ese descanso vuelve a 0 y, en el largo, los recursos del
 * personaje (los PG, los espacios) se llenan
 */
export function rest(
  system: System,
  type: string,
  play: Play,
  resources: readonly Resource[],
  kind: 'short' | 'long'
): Play {
  const uses: Record<string, Record<string, number>> = structuredClone(play.uses ?? {})
  for (const r of resources) {
    if (!r.recovery || !RECOVERS[kind].includes(r.recovery)) continue
    const item = r.item ?? ''
    if (uses[item]) delete uses[item][r.key]
  }
  let values = { ...(play.values ?? {}) }
  if (kind === 'long')
    for (const path of resourcePaths(system.types[type]?.fields ?? {})) {
      const [head, ...rest] = path.split('.')
      if (!head) continue
      if (rest.length === 0) delete values[head]
      else values = setPath(values, path, undefined)
    }
  return { ...play, uses, values }
}
