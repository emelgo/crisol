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

/** La hoja de un tipo: la de su sistema o la de por defecto */
export function sheetOf(system: System, type: string): SheetBlock[] {
  return system.sheet?.blocks ?? defaultSheet(system.types[type]?.fields ?? {})
}

/** Lo que no vale de la hoja de un sistema: lo que nombra cada bloque, que exista y sea de su clase */
export function checkSheet(system: System, add: (path: (string | number)[], message: string) => void) {
  const blocks = system.sheet?.blocks
  if (!blocks) return
  const actor = Object.entries(system.types).find(([, t]) => t.document === 'actor')
  if (!actor) {
    add(['sheet'], 'La hoja es de un personaje: el sistema no tiene ningún tipo de personaje (actor)')
    return
  }
  const [actorKey, type] = actor
  const fields = type.fields
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
        b.fields.forEach((k, i) => field([...at, 'fields', i], k, ['number', 'derived']))
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
        b.fields.forEach((k, i) => field([...at, 'fields', i], k, ['list']))
        return
      case 'items':
        field([...at, 'field'], b.field, ['items'])
        b.types?.forEach((t, i) => {
          if (!system.types[t]) add([...at, 'types', i], `No existe el tipo «${t}»`)
        })
        b.rolls?.forEach((r, i) => roll([...at, 'rolls', i], r))
        return
      case 'text':
        field([...at, 'field'], b.field, ['text'])
        return
      default:
        return
    }
  }
  blocks.forEach((b, i) => {
    const at = ['sheet', 'blocks', i]
    if (b.kind === 'columns') b.blocks.forEach((inner, j) => leaf(inner, [...at, 'blocks', j]))
    else if (b.kind === 'tabs')
      b.tabs.forEach((tab, j) => tab.blocks.forEach((inner, k) => leaf(inner, [...at, 'tabs', j, 'blocks', k])))
    else leaf(b, at)
  })
}

/** Un bloque con sus nombres ya en su idioma, para pintarlo */
export type SheetBlockView =
  | { kind: 'header' }
  | { kind: 'stats'; label: string | null; fields: { key: string; label: string; roll: string | null }[] }
  | { kind: 'resource'; label: string; field: string }
  | {
      kind: 'set'
      label: string
      field: string
      columns: { key: string; label: string }[]
      elements: { key: string; label: string }[]
      roll: string | null
    }
  | { kind: 'group'; label: string; field: string; fields: { key: string; label: string; kind: string }[] }
  | { kind: 'list'; label: string | null; fields: { key: string; label: string }[] }
  | {
      kind: 'items'
      label: string
      field: string
      types: string[]
      columns: { key: string; label: string }[]
      rolls: string[]
    }
  | { kind: 'actions'; label: string | null }
  | { kind: 'uses'; label: string | null }
  | { kind: 'text'; label: string; field: string }
  | { kind: 'columns'; blocks: SheetBlockView[] }
  | { kind: 'tabs'; tabs: { label: string; blocks: SheetBlockView[] }[] }

/** Los bloques de la hoja de un tipo, con los nombres de sus campos (o los suyos) en su idioma */
export function sheetView(system: System, type: string, language: Language = 'es'): SheetBlockView[] {
  const fields = system.types[type]?.fields ?? {}
  const say = (text: Text | undefined, fallback: string) => (text ? textOf(text, language) : fallback)
  const name = (key: string) => say(fields[key]?.label, key)
  const own = (label: Text | undefined) => (label ? textOf(label, language) : null)
  const leaf = (b: Leaf): SheetBlockView => {
    switch (b.kind) {
      case 'header':
        return { kind: 'header' }
      case 'stats':
        return {
          kind: 'stats',
          label: own(b.label),
          fields: b.fields.map((k) => ({ key: k, label: name(k), roll: b.rolls?.[k] ?? null }))
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
          columns: b.columns.map((c) => ({ key: c, label: say(set?.fields[c]?.label, c) })),
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
          fields:
            f?.kind === 'group'
              ? Object.entries(f.fields).map(([k, c]) => ({ key: k, label: textOf(c.label, language), kind: c.kind }))
              : []
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
          columns: (b.columns ?? []).map((c) => ({ key: c, label: say(sample?.[c]?.label, c) })),
          rolls: b.rolls ?? []
        }
      }
      case 'actions':
        return { kind: 'actions', label: own(b.label) }
      case 'uses':
        return { kind: 'uses', label: own(b.label) }
      case 'text':
        return { kind: 'text', label: say(b.label, name(b.field)), field: b.field }
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
