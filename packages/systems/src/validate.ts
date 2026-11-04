/**
 * Validar un sistema: cada problema dice dónde está (por su ruta, para la IA y el JSON, y por sus nombres, para el
 * editor), por qué, y si impide guardarlo (error) o no (aviso). Lo que el formato no conoce se avisa y se conserva
 */
import { DiceSyntaxError, parseDice } from '@crisol/dice'
import { type core, z } from 'zod'
import {
  type Field,
  KEY_MESSAGE,
  LIMITS,
  type SimpleField,
  type System,
  strictSystemSchema,
  systemSchema
} from './format.ts'
import { checkFormulas } from './formulas/system.ts'
import { type Language, textOf } from './text.ts'

export interface Problem {
  /** Para la IA y el JSON: types.personaje.fields.defensa.formula */
  path: string
  /** Para el editor: Personaje › Defensa › Fórmula */
  where: string
  message: string
  severity: 'error' | 'warning'
  /** En una fórmula, qué parte (para subrayarla) */
  range?: { start: number; end: number }
}

export interface Validated {
  /** El sistema, si se puede guardar (sin errores; con avisos, sí) */
  system: System | null
  problems: Problem[]
}

type Segment = string | number

export const pathText = (path: readonly PropertyKey[]) =>
  path.reduce<string>(
    (text, s) => (typeof s === 'number' ? `${text}[${s}]` : text ? `${text}.${String(s)}` : String(s)),
    ''
  )

const KINDS: Record<string, string> = {
  number: 'un número',
  string: 'un texto',
  boolean: 'sí o no',
  array: 'una lista',
  object: 'un objeto'
}

/** Los mensajes de zod, cortos y en español; los que no están aquí, con su traducción */
const spanish = z.locales.es().localeError
const errorMap: core.$ZodErrorMap = (issue) => {
  switch (issue.code) {
    case 'invalid_type':
      return issue.input === undefined ? 'Falta' : `Tiene que ser ${KINDS[issue.expected] ?? issue.expected}`
    case 'too_big':
      return issue.origin === 'string'
        ? `Como mucho, ${issue.maximum} caracteres`
        : issue.origin === 'array'
          ? `Como mucho, ${issue.maximum}`
          : `Como mucho, ${issue.maximum}`
    case 'too_small':
      if (issue.origin === 'string')
        return Number(issue.minimum) <= 1 ? 'No puede ir vacío' : `Al menos ${issue.minimum} caracteres`
      if (issue.origin === 'array')
        return Number(issue.minimum) <= 1 ? 'Hace falta al menos uno' : `Hacen falta al menos ${issue.minimum}`
      return `Como poco, ${issue.minimum}`
    case 'invalid_value':
      return `Tiene que ser ${issue.values.map((v) => `«${String(v)}»`).join(', ')}`
    case 'invalid_key':
      // Las claves de los registros (tipos, campos, tiradas) son todas claves del sistema
      return KEY_MESSAGE
    case 'invalid_union':
      if (issue.note === 'No matching discriminator') {
        const value = (issue.input as Record<string, unknown> | undefined)?.[issue.discriminator ?? 'kind']
        return value === undefined ? `Falta «${issue.discriminator}»` : `No existe la clase «${String(value)}»`
      }
      return 'No tiene una forma válida'
    default:
      return spanish(issue)
  }
}

/** Los nombres de cada parte, para decir dónde está un problema en el editor */
const PARTS: Record<string, string> = {
  name: 'Nombre',
  summary: 'Resumen',
  version: 'Versión',
  languages: 'Idiomas',
  license: 'Licencia',
  format: 'Formato',
  formula: 'Fórmula',
  label: 'Nombre',
  help: 'Ayuda',
  default: 'Valor inicial',
  min: 'Mínimo',
  max: 'Máximo',
  options: 'Opciones',
  segments: 'Segmentos',
  to: 'Apunta a',
  of: 'Lleva',
  modifiers: 'Bonos',
  target: 'Objetivo',
  value: 'Valor',
  when: 'Cuándo',
  for: 'Por cada',
  variants: 'Variantes',
  modes: 'Modos',
  from: 'Cambia',
  dice: 'Dados',
  critical: 'Críticos',
  sources: 'Fuentes',
  packs: 'Contenido',
  settings: 'Ajustes de campaña',
  attribution: 'Atribución',
  elements: 'Elementos',
  columns: 'Columnas',
  kind: 'Clase',
  document: 'Clase de documento',
  if: 'Si'
}

const ordinal = (n: number) => `${n + 1}.ª`

/** Dónde está una ruta, por los nombres del sistema: «Personaje › Defensa › Fórmula» */
export function whereOf(system: unknown, path: readonly Segment[], language: Language = 'es'): string {
  const out: string[] = []
  let node: unknown = system
  const label = (value: unknown, fallback: string) =>
    textOf((value as { label?: Parameters<typeof textOf>[0] } | undefined)?.label, language) || fallback
  for (let i = 0; i < path.length; i++) {
    const segment = path[i] as Segment
    const next = path[i + 1]
    const child = (node as Record<string, unknown> | undefined)?.[segment as string]
    if ((segment === 'types' || segment === 'fields' || segment === 'columns') && typeof next === 'string') {
      const item = (child as Record<string, unknown> | undefined)?.[next]
      out.push(label(item, next))
      node = item
      i++
      continue
    }
    if (segment === 'rolls' && typeof next === 'string') {
      const item = (child as Record<string, unknown> | undefined)?.[next]
      out.push('Tiradas', label(item, next))
      node = item
      i++
      continue
    }
    if (segment === 'bands' && typeof next === 'number') {
      out.push(`Resultado, ${ordinal(next)} franja`)
      node = (child as unknown[] | undefined)?.[next]
      i++
      continue
    }
    if (typeof segment === 'number') {
      const item = (node as unknown[] | undefined)?.[segment]
      const name = textOf((item as { name?: Parameters<typeof textOf>[0] } | undefined)?.name, language)
      out.push(name || label(item, ordinal(segment)))
      node = item
      continue
    }
    out.push(PARTS[segment] ?? segment)
    node = child
  }
  return out.join(' › ')
}

/** Todos los campos de un tipo, también los de dentro de grupos, listas y conjuntos, con su ruta */
export function* fieldsOf(
  fields: Record<string, Field | SimpleField>,
  path: Segment[] = [],
  depth = 1
): Generator<{
  key: string
  field: Field
  path: Segment[]
  depth: number
}> {
  for (const [key, field] of Object.entries(fields)) {
    const here = [...path, key]
    yield { key, field: field as Field, path: here, depth }
    if (field.kind === 'group') yield* fieldsOf(field.fields, [...here, 'fields'], depth + 1)
    if (field.kind === 'table') yield* fieldsOf(field.columns, [...here, 'columns'], depth + 1)
    if (field.kind === 'set') yield* fieldsOf(field.fields, [...here, 'fields'], depth + 1)
  }
}

const bytesOf = (value: unknown) => new TextEncoder().encode(JSON.stringify(value) ?? '').length

export function validateSystem(input: unknown, { language = 'es' as Language } = {}): Validated {
  const problems: Problem[] = []
  const add = (path: Segment[], message: string, severity: Problem['severity'] = 'error', range?: Problem['range']) =>
    problems.push({
      path: pathText(path),
      where: whereOf(input, path, language) || 'El sistema',
      message,
      severity,
      ...(range ? { range: { start: range.start, end: range.end } } : {})
    })

  const bytes = bytesOf(input)
  if (bytes > LIMITS.bytes) {
    add([], `Como mucho, ${LIMITS.bytes / 1024 / 1024} MB; este tiene ${(bytes / 1024 / 1024).toFixed(1)} MB`)
    return { system: null, problems }
  }

  const parsed = systemSchema.safeParse(input, { error: errorMap })
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 50)) add(issue.path as Segment[], issue.message)
    return { system: null, problems }
  }
  // Lo que el formato no conoce: se conserva y se avisa
  const strict = strictSystemSchema.safeParse(input, { error: errorMap })
  if (!strict.success) {
    for (const issue of strict.error.issues)
      if (issue.code === 'unrecognized_keys')
        for (const k of issue.keys)
          add([...(issue.path as Segment[]), k], `Crisol no conoce «${k}»: se guarda tal cual, sin usarlo`, 'warning')
  }

  const system = parsed.data
  checkReferences(system, add)
  checkFormulas(system, (path, message, range) => add(path, message, 'error', range), language)
  return { system: problems.some((p) => p.severity === 'error') ? null : system, problems }
}

/** Lo que el esquema no ve: que lo que se nombra exista, los rangos y los repetidos */
function checkReferences(
  system: System,
  add: (path: Segment[], message: string, severity?: Problem['severity']) => void
) {
  const types = system.types
  const itemTypes = new Set(
    Object.entries(types)
      .filter(([, t]) => t.document === 'item')
      .map(([k]) => k)
  )
  // Los campos de primer nivel de cada personaje: a ellos apuntan los bonos y las tiradas
  const actorFields = Object.values(types)
    .filter((t) => t.document === 'actor')
    .map((t) => new Set(Object.keys(t.fields)))
  const anyActorHas = (key: string) => actorFields.some((keys) => keys.has(key))
  for (const [typeKey, type] of Object.entries(types)) {
    let count = 0
    for (const { field, path, depth } of fieldsOf(type.fields, ['types', typeKey, 'fields'])) {
      count++
      if (depth > LIMITS.depth) add(path, `Como mucho, ${LIMITS.depth} niveles de campos dentro de otros`)
      checkField(field, path, add, types, itemTypes)
    }
    if (count > LIMITS.fieldsPerType)
      add(['types', typeKey, 'fields'], `Como mucho, ${LIMITS.fieldsPerType} campos por tipo`)
    type.modifiers?.forEach((modifier, i) => {
      if (type.document !== 'item') add(['types', typeKey, 'modifiers', i], 'Solo los objetos dan bonos')
      const target = modifier.target.split('.')[0] ?? ''
      if (!anyActorHas(target)) add(['types', typeKey, 'modifiers', i, 'target'], `Ningún personaje tiene «${target}»`)
    })
  }
  const setFields = new Set(
    Object.values(types).flatMap((t) =>
      Object.entries(t.fields)
        .filter(([, f]) => f.kind === 'set')
        .map(([k]) => k)
    )
  )
  for (const [rollKey, roll] of Object.entries(system.rolls ?? {})) {
    const at: Segment[] = ['rolls', rollKey]
    if (roll.for && 'fields' in roll.for)
      roll.for.fields.forEach((f, i) => {
        if (!anyActorHas(f)) add([...at, 'for', 'fields', i], `No existe el campo «${f}»`)
      })
    if (roll.for && 'set' in roll.for && !setFields.has(roll.for.set))
      add([...at, 'for', 'set'], `No existe el conjunto «${roll.for.set}»`)
    repeated(roll.modes?.map((m) => m.key) ?? [], (i, k) => add([...at, 'modes', i, 'key'], `«${k}» está repetido`))
    roll.modes?.forEach((mode, i) => {
      for (const part of ['from', 'to'] as const) diceFormula(mode[part], [...at, 'modes', i, part], add)
    })
  }
  if (system.dice?.default) diceFormula(system.dice.default, ['dice', 'default'], add)
  repeated(system.languages, (i, k) => add(['languages', i], `«${k}» está repetido`))
  repeated(system.sources?.map((s) => s.key) ?? [], (i, k) => add(['sources', i, 'key'], `«${k}» está repetida`))
  repeated(system.packs?.map((p) => p.key) ?? [], (i, k) => add(['packs', i, 'key'], `«${k}» está repetido`))
  system.packs?.forEach((pack, i) => {
    pack.types?.forEach((type, j) => {
      const found = types[type]
      if (!found) add(['packs', i, 'types', j], `No existe el tipo «${type}»`)
      else if (found.document !== pack.document)
        add(['packs', i, 'types', j], `«${type}» no es de ${pack.document === 'actor' ? 'personajes' : 'objetos'}`)
    })
  })
  for (const [settingKey, setting] of Object.entries(system.settings ?? {})) {
    const at: Segment[] = ['settings', settingKey]
    const values = new Set(setting.options?.map((o) => o.value))
    if ((setting.kind === 'choice' || setting.kind === 'choices') && values.size === 0)
      add([...at, 'options'], 'Hace falta al menos una opción')
    const wanted =
      setting.default === undefined ? [] : Array.isArray(setting.default) ? setting.default : [setting.default]
    if (setting.kind === 'choice' || setting.kind === 'choices')
      for (const v of wanted)
        if (!values.has(String(v))) add([...at, 'default'], `«${String(v)}» no es una de sus opciones`)
  }
}

function checkField(
  field: Field,
  path: Segment[],
  add: (path: Segment[], message: string, severity?: Problem['severity']) => void,
  types: System['types'],
  itemTypes: Set<string>
) {
  switch (field.kind) {
    case 'number':
      if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
        // Lo demás sale de este: se dice solo una vez
        add([...path, 'min'], 'El mínimo es mayor que el máximo')
        break
      }
      if (field.default !== undefined && field.min !== undefined && field.default < field.min)
        add([...path, 'default'], `Por debajo del mínimo (${field.min})`)
      if (field.default !== undefined && field.max !== undefined && field.default > field.max)
        add([...path, 'default'], `Por encima del máximo (${field.max})`)
      break
    case 'choice':
      repeated(
        field.options.map((o) => o.value),
        (i, k) => add([...path, 'options', i, 'value'], `«${k}» está repetida`)
      )
      if (field.default !== undefined && !field.options.some((o) => o.value === field.default))
        add([...path, 'default'], `«${field.default}» no es una de sus opciones`)
      break
    case 'clock':
      if (field.default !== undefined && field.default > field.segments)
        add([...path, 'default'], `Como mucho, ${field.segments}`)
      break
    case 'link':
      if (!types[field.to]) add([...path, 'to'], `No existe el tipo «${field.to}»`)
      break
    case 'items':
      field.of.forEach((t, i) => {
        if (!itemTypes.has(t))
          add([...path, 'of', i], types[t] ? `«${t}» no es un tipo de objeto` : `No existe el tipo «${t}»`)
      })
      break
    case 'set':
      repeated(
        field.elements.map((e) => e.key),
        (i, k) => add([...path, 'elements', i, 'key'], `«${k}» está repetido`)
      )
      break
  }
}

function diceFormula(formula: string, path: Segment[], add: (path: Segment[], message: string) => void) {
  // Solo dados: las fórmulas con @ las mira el lenguaje de fórmulas
  if (formula.includes('@')) return
  try {
    parseDice(formula)
  } catch (error) {
    if (error instanceof DiceSyntaxError) add(path, error.message)
    else throw error
  }
}

function repeated(values: readonly string[], report: (index: number, value: string) => void) {
  const seen = new Set<string>()
  values.forEach((v, i) => {
    if (seen.has(v)) report(i, v)
    seen.add(v)
  })
}
