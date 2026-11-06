/**
 * La hoja de un personaje por bloques (docs/specs/hoja.md § bloques): la que compone su sistema o, sin ella, una por
 * defecto de sus campos; lo que nombra cada bloque, validado; y los bloques con sus nombres en el idioma de la campaña
 */
import type { Field, System } from './format.ts'
import { type Language, type Text, textOf } from './text.ts'

export type SheetBlock = NonNullable<System['sheet']>['blocks'][number]
type Leaf = Exclude<SheetBlock, { kind: 'columns' } | { kind: 'tabs' }>

/** La hoja por defecto: cabecera, sus cifras, sus recursos, sus conjuntos, sus listas, lo que lleva, usos y textos */
export function defaultSheet(fields: Record<string, Field>): SheetBlock[] {
  const of = (kind: Field['kind']) =>
    Object.entries(fields)
      .filter(([, f]) => f.kind === kind)
      .map(([k]) => k)
  const numbers = Object.entries(fields)
    .filter(([, f]) => f.kind === 'derived' || f.kind === 'number')
    .map(([k]) => k)
    .slice(0, 12)
  const blocks: SheetBlock[] = [{ kind: 'header' }]
  if (numbers.length > 0) blocks.push({ kind: 'stats', fields: numbers })
  for (const k of of('resource')) blocks.push({ kind: 'resource', field: k })
  for (const [k, f] of Object.entries(fields))
    if (f.kind === 'set') blocks.push({ kind: 'set', field: k, columns: Object.keys(f.fields).slice(0, 4) })
  for (const k of of('group')) blocks.push({ kind: 'group', field: k })
  const lists = of('list').slice(0, 12)
  if (lists.length > 0) blocks.push({ kind: 'list', fields: lists })
  for (const k of of('items')) blocks.push({ kind: 'items', field: k })
  blocks.push({ kind: 'actions' }, { kind: 'uses' })
  for (const k of of('text')) blocks.push({ kind: 'text', field: k })
  return blocks
}

/** El tipo del personaje: el primer actor (la hoja del sistema es la suya) */
const firstActor = (system: System) => Object.entries(system.types).find(([, t]) => t.document === 'actor')?.[0]

/**
 * La hoja de un tipo: la suya (la de una criatura); la del sistema, si es el personaje; si no, una por defecto de sus
 * campos
 */
export function sheetOf(system: System, type: string): SheetBlock[] {
  const own = system.types[type]?.sheet?.blocks
  if (own) return own
  if (system.sheet && type === firstActor(system)) return system.sheet.blocks
  return defaultSheet(system.types[type]?.fields ?? {})
}

/** Lo que no vale de la hoja de un sistema: lo que nombra cada bloque, que exista y sea de su clase */
export function checkSheet(system: System, add: (path: (string | number)[], message: string) => void) {
  const blocks = system.sheet?.blocks
  if (blocks) {
    const actor = firstActor(system)
    if (!actor) add(['sheet'], 'La hoja es de un personaje: el sistema no tiene ningún tipo de personaje (actor)')
    else checkBlocks(system, actor, blocks, ['sheet'], add)
  }
  for (const [key, type] of Object.entries(system.types)) {
    if (type.sheet) {
      if (type.document !== 'actor')
        add(['types', key, 'sheet'], 'Solo los actores (personajes y criaturas) tienen hoja')
      else checkBlocks(system, key, type.sheet.blocks, ['types', key, 'sheet'], add)
    }
    // Su daño: campos de lista (los tipos de daño)
    for (const [which, field] of Object.entries(type.damage ?? {})) {
      if (!field) continue
      const f = type.fields[field]
      if (!f) add(['types', key, 'damage', which], `${key} no tiene el campo «${field}»`)
      else if (f.kind !== 'list') add(['types', key, 'damage', which], `«${field}» no es de los que van aquí (list)`)
    }
  }
}

/** Lo que nombran unos bloques de la hoja de un tipo: que exista y sea de su clase */
function checkBlocks(
  system: System,
  actorKey: string,
  blocks: readonly SheetBlock[],
  prefix: (string | number)[],
  add: (path: (string | number)[], message: string) => void
) {
  const fields = system.types[actorKey]?.fields ?? {}
  const rolls = system.rolls ?? {}
  const field = (path: (string | number)[], key: string, kinds: readonly Field['kind'][]) => {
    const f = fields[key]
    if (!f) add(path, `${actorKey} no tiene el campo «${key}»`)
    else if (!kinds.includes(f.kind)) add(path, `«${key}» no es de los que van aquí (${kinds.join(', ')})`)
    return f
  }
  const roll = (path: (string | number)[], key: string) => {
    if (!(key in rolls)) add(path, `No existe la tirada «${key}»`)
  }
  const leaf = (b: Leaf, at: (string | number)[]) => {
    switch (b.kind) {
      case 'stats':
        for (const [i, k] of b.fields.entries()) field([...at, 'fields', i], k, ['number', 'derived', 'boolean'])
        for (const [k, r] of Object.entries(b.rolls ?? {})) {
          if (!b.fields.includes(k)) add([...at, 'rolls', k], `«${k}» no está entre sus cifras`)
          roll([...at, 'rolls', k], r)
        }
        return
      case 'resource':
        field([...at, 'field'], b.field, ['resource'])
        return
      case 'set': {
        const f = field([...at, 'field'], b.field, ['set'])
        if (f?.kind === 'set')
          b.columns.forEach((c, i) => {
            if (!(c in f.fields)) add([...at, 'columns', i], `Los elementos de «${b.field}» no tienen «${c}»`)
          })
        if (b.roll) roll([...at, 'roll'], b.roll)
        return
      }
      case 'group':
        field([...at, 'field'], b.field, ['group'])
        return
      case 'list':
        for (const [i, k] of b.fields.entries()) field([...at, 'fields', i], k, ['list'])
        return
      case 'items':
        field([...at, 'field'], b.field, ['items'])
        b.types?.forEach((t, i) => {
          if (!system.types[t]) add([...at, 'types', i], `No existe el tipo «${t}»`)
        })
        for (const [i, r] of (b.rolls ?? []).entries()) roll([...at, 'rolls', i], r)
        return
      case 'text':
        field([...at, 'field'], b.field, ['text'])
        return
      default:
        return
    }
  }
  for (const [i, b] of blocks.entries()) {
    const at = [...prefix, 'blocks', i]
    if (b.kind === 'columns') for (const [j, inner] of b.blocks.entries()) leaf(inner, [...at, 'blocks', j])
    else if (b.kind === 'tabs')
      for (const [j, tab] of b.tabs.entries())
        for (const [k, inner] of tab.blocks.entries()) leaf(inner, [...at, 'tabs', j, 'blocks', k])
    else leaf(b, at)
  }
}

/** Un campo de un bloque: su nombre, su clase, si lleva signo, si se cambia jugando y sus límites */
export interface ValueView {
  key: string
  label: string
  kind: string
  signed: boolean
  play: boolean
  min?: number
  max?: number
}

/** Un bloque con sus nombres ya en su idioma, para pintarlo */
export type SheetBlockView =
  | { kind: 'header' }
  | { kind: 'stats'; label: string | null; fields: (ValueView & { roll: string | null })[] }
  | { kind: 'resource'; label: string; field: string }
  | {
      kind: 'set'
      label: string
      field: string
      columns: ValueView[]
      elements: { key: string; label: string }[]
      roll: string | null
    }
  | {
      kind: 'group'
      label: string
      field: string
      /** Lo de dentro se cambia jugando (las monedas); sus recursos, siempre */
      play: boolean
      fields: ValueView[]
    }
  | { kind: 'list'; label: string | null; fields: { key: string; label: string }[] }
  | {
      kind: 'items'
      label: string
      field: string
      types: string[]
      /** Se añade jugando, del compendio (el inventario) */
      play: boolean
      columns: ValueView[]
      rolls: string[]
    }
  | { kind: 'actions'; label: string | null }
  | { kind: 'uses'; label: string | null }
  | { kind: 'text'; label: string; field: string; play: boolean }
  | { kind: 'columns'; blocks: SheetBlockView[] }
  | { kind: 'tabs'; tabs: { label: string; blocks: SheetBlockView[] }[] }

/** Los bloques de la hoja de un tipo, con los nombres de sus campos (o los suyos) en su idioma */
export function sheetView(system: System, type: string, language: Language = 'es'): SheetBlockView[] {
  const fields = system.types[type]?.fields ?? {}
  const say = (text: Text | undefined, fallback: string) => (text ? textOf(text, language) : fallback)
  const name = (key: string) => say(fields[key]?.label, key)
  const own = (label: Text | undefined) => (label ? textOf(label, language) : null)
  const viewOfField = (key: string, f: Field | undefined, play = false): ValueView => ({
    key,
    label: say(f?.label, key),
    kind: f?.kind ?? 'text',
    signed: f?.kind === 'derived' && f.signed === true,
    play: f?.kind !== 'derived' && (play || f?.play === true),
    ...(f?.kind === 'number' && f.min !== undefined ? { min: f.min } : {}),
    ...(f?.kind === 'number' && f.max !== undefined ? { max: f.max } : {})
  })
  const leaf = (b: Leaf): SheetBlockView => {
    switch (b.kind) {
      case 'header':
        return { kind: 'header' }
      case 'stats':
        return {
          kind: 'stats',
          label: own(b.label),
          fields: b.fields.map((k) => ({ ...viewOfField(k, fields[k]), roll: b.rolls?.[k] ?? null }))
        }
      case 'resource':
        return { kind: 'resource', label: say(b.label, name(b.field)), field: b.field }
      case 'set': {
        const f = fields[b.field]
        const set = f?.kind === 'set' ? f : null
        return {
          kind: 'set',
          label: say(b.label, name(b.field)),
          field: b.field,
          columns: b.columns.map((c) => viewOfField(c, set?.fields[c])),
          elements: (set?.elements ?? []).map((e) => ({ key: e.key, label: textOf(e.label, language) })),
          roll: b.roll ?? null
        }
      }
      case 'group': {
        const f = fields[b.field]
        return {
          kind: 'group',
          label: say(b.label, name(b.field)),
          field: b.field,
          play: f?.play === true,
          fields:
            f?.kind === 'group' ? Object.entries(f.fields).map(([k, c]) => viewOfField(k, c, f.play === true)) : []
        }
      }
      case 'list':
        return { kind: 'list', label: own(b.label), fields: b.fields.map((k) => ({ key: k, label: name(k) })) }
      case 'items': {
        const f = fields[b.field]
        const types = b.types ?? (f?.kind === 'items' ? [...f.of] : [])
        const sample = types[0] ? system.types[types[0]]?.fields : undefined
        return {
          kind: 'items',
          label: say(b.label, name(b.field)),
          field: b.field,
          types,
          play: f?.kind === 'items' && f.play === true,
          columns: (b.columns ?? []).map((c) => viewOfField(c, sample?.[c])),
          rolls: b.rolls ?? []
        }
      }
      case 'actions':
        return { kind: 'actions', label: own(b.label) }
      case 'uses':
        return { kind: 'uses', label: own(b.label) }
      case 'text':
        return {
          kind: 'text',
          label: say(b.label, name(b.field)),
          field: b.field,
          play: fields[b.field]?.play === true
        }
    }
  }
  return sheetOf(system, type).map((b) => {
    if (b.kind === 'columns') return { kind: 'columns', blocks: b.blocks.map(leaf) }
    if (b.kind === 'tabs')
      return {
        kind: 'tabs',
        tabs: b.tabs.map((t) => ({ label: textOf(t.label, language), blocks: t.blocks.map(leaf) }))
      }
    return leaf(b)
  })
}
