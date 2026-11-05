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
import { own } from './own.ts'
import { checkSheet } from './sheet.ts'
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
export const errorMap: core.$ZodErrorMap = (issue) => {
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
  fields: 'Campos',
  types: 'Tipos',
  rolls: 'Tiradas',
  bands: 'Resultado',
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

/** Si un bono tiene a qué sumarse en esa ruta: un número o un calculado, también dentro de un grupo o de un conjunto */
export function bonusTarget(fields: Record<string, Field | SimpleField>, segments: readonly string[]): boolean {
  const [first, ...rest] = segments
  const field = first === undefined || !Object.hasOwn(fields, first) ? undefined : fields[first]
  if (!field) return false
  if (rest.length === 0) return field.kind === 'number' || field.kind === 'derived'
  if (field.kind === 'group') return bonusTarget(field.fields, rest)
  if (field.kind === 'set') {
    const [element, ...inner] = rest
    return field.elements.some((e) => e.key === element) && bonusTarget(field.fields, inner)
  }
  return false
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

/** Como mucho, tantos problemas: con más, se para (no hace falta ver mil erratas para arreglar la primera) */
export const MAX_PROBLEMS = 200
class Enough extends Error {}

export function validateSystem(input: unknown, { language = 'es' as Language } = {}): Validated {
  const problems: Problem[] = []
  const add = (path: Segment[], message: string, severity: Problem['severity'] = 'error', range?: Problem['range']) => {
    if (problems.length >= MAX_PROBLEMS) throw new Enough()
    problems.push({
      path: pathText(path),
      where: whereOf(input, path, language) || 'El sistema',
      message,
      severity,
      ...(range ? { range: { start: range.start, end: range.end } } : {})
    })
  }

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
  const system = parsed.data
  try {
    // Lo que el formato no conoce: se conserva y se avisa
    const strict = strictSystemSchema.safeParse(input, { error: errorMap })
    if (!strict.success) {
      for (const issue of strict.error.issues)
        if (issue.code === 'unrecognized_keys')
          for (const k of issue.keys)
            add([...(issue.path as Segment[]), k], `Crisol no conoce «${k}»: se guarda tal cual, sin usarlo`, 'warning')
    }
    checkReferences(system, add)
    checkFormulas(system, (path, message, range) => add(path, message, 'error', range), language)
  } catch (error) {
    if (!(error instanceof Enough)) throw error
    // Con tantos, se para: si no hay ningún error entre ellos, no se sabe si lo que queda está bien
    problems.push({
      path: '',
      where: 'El sistema',
      message: `Hay más de ${MAX_PROBLEMS} problemas: arregla estos y vuelve a validarlo`,
      severity: 'error'
    })
  }
  return { system: problems.some((p) => p.severity === 'error') ? null : system, problems }
}

/** Si algún problema del formato es de forma: un valor que no es de su clase (un número donde va un texto, una lista…) */
function misshapen(issues: readonly core.$ZodIssue[]): boolean {
  return issues.some(
    (issue) => issue.code === 'invalid_type' || (issue.code === 'invalid_union' && issue.errors.every(misshapen))
  )
}

/**
 * Si tiene la forma de un sistema, aunque algún valor no valga (un nombre vacío, una fórmula que falla): así lo puede
 * leer el editor visual (Avanzado lo pasa al resto del editor) y sus problemas se ven donde están
 */
export function fitsFormat(input: unknown): input is System {
  const parsed = systemSchema.safeParse(input)
  return parsed.success || !misshapen(parsed.error.issues)
}

/** Lo que el esquema no ve: que lo que se nombra exista, los rangos y los repetidos */
/** Los pasos del creador: sus claves sin repetir, y lo que nombran (un tipo, un conjunto, un campo) existe */
function checkSteps(system: System, add: (path: Segment[], message: string, severity?: Problem['severity']) => void) {
  const steps = system.creation ?? []
  if (steps.length === 0) return
  const actor = Object.entries(system.types).find(([, t]) => t.document === 'actor')
  if (!actor) {
    add(['creation'], 'Los pasos del creador son de un personaje: el sistema no tiene ningún tipo de personaje (actor)')
    return
  }
  const [actorKey, actorType] = actor
  const seen = new Set<string>()
  steps.forEach((step, i) => {
    const at: Segment[] = ['creation', i]
    if (seen.has(step.key)) add([...at, 'key'], `Ya hay un paso «${step.key}»`)
    seen.add(step.key)
    if (step.kind === 'content' && !system.types[step.type]) add([...at, 'type'], `No existe el tipo «${step.type}»`)
    if (step.kind === 'content' && step.max !== undefined && step.max < (step.min ?? 1))
      add([...at, 'max'], 'El máximo no puede ser menor que el mínimo')
    if (step.kind === 'scores') {
      const set = actorType.fields[step.set]
      if (set?.kind !== 'set') add([...at, 'set'], `«${step.set}» no es un conjunto de ${actorKey}`)
      else if (!(step.field in set.fields))
        add([...at, 'field'], `Los elementos de «${step.set}» no tienen «${step.field}»`)
    }
    if (step.kind === 'fields')
      step.fields.forEach((field, j) => {
        if (!(field in actorType.fields)) add([...at, 'fields', j], `${actorKey} no tiene el campo «${field}»`)
      })
  })
  for (const [i, key] of (system.card ?? []).entries())
    if (!(key in actorType.fields)) add(['card', i], `${actorKey} no tiene el campo «${key}»`)
}

function checkReferences(
  system: System,
  add: (path: Segment[], message: string, severity?: Problem['severity']) => void
) {
  checkSteps(system, add)
  checkSheet(system, add)
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
  const actors = Object.values(types).filter((t) => t.document === 'actor')
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
      const at = ['types', typeKey, 'modifiers', i, 'target']
      const first = modifier.target.split('.')[0] ?? ''
      if (!anyActorHas(first)) add(at, `Ningún personaje tiene «${first}»`)
      // La ruta entera: un bono se suma a un número o a un calculado (caracteristicas.des.valor, defensa)
      else if (!actors.some((actor) => bonusTarget(actor.fields, modifier.target.split('.'))))
        add(at, `«${modifier.target}» no es un número ni un calculado de los personajes: el bono no se sumaría`)
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
    if (roll.for && 'items' in roll.for)
      roll.for.items.forEach((t, i) => {
        const type = own(types, t)
        if (!type) add([...at, 'for', 'items', i], `No existe el tipo «${t}»`)
        else if (type.document !== 'item') add([...at, 'for', 'items', i], `«${t}» no es un tipo de objeto`)
      })
    repeated(roll.modes?.map((m) => m.key) ?? [], (i, k) => add([...at, 'modes', i, 'key'], `«${k}» está repetido`))
    roll.modes?.forEach((mode, i) => {
      if (!(mode.from && mode.to) && !mode.add)
        add([...at, 'modes', i], 'Un modo cambia unos dados por otros (from y to) o suma dados (add)')
      for (const part of ['from', 'to', 'add'] as const) {
        const written = mode[part]
        if (written) diceFormula(written, [...at, 'modes', i, part], add)
      }
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
    case 'list':
      if (field.options) {
        const options = field.options
        repeated(
          options.map((o) => o.value),
          (i, k) => add([...path, 'options', i, 'value'], `«${k}» está repetida`)
        )
        field.default?.forEach((v, i) => {
          if (!options.some((o) => o.value === v)) add([...path, 'default', i], `«${v}» no es una de sus opciones`)
        })
      }
      break
    case 'clock':
      if (field.default !== undefined && field.default > field.segments)
        add([...path, 'default'], `Como mucho, ${field.segments}`)
      break
    case 'link':
      if (!Object.hasOwn(types, field.to)) add([...path, 'to'], `No existe el tipo «${field.to}»`)
      break
    case 'dice':
      // Lo que se guarda en un campo de dados es dados: se tira dentro de las tiradas
      if (field.default) {
        if (field.default.includes('@')) add([...path, 'default'], 'Unos dados van sin @: solo dados (1d8)')
        else diceFormula(field.default, [...path, 'default'], add)
      }
      break
    case 'items':
      field.of.forEach((t, i) => {
        if (!itemTypes.has(t))
          add(
            [...path, 'of', i],
            Object.hasOwn(types, t) ? `«${t}» no es un tipo de objeto` : `No existe el tipo «${t}»`
          )
      })
      break
    case 'set':
      field.elements.forEach((e, i) => {
        for (const k of Object.keys(e.values ?? {}))
          if (!Object.hasOwn(field.fields, k)) add([...path, 'elements', i, 'values', k], `No existe el campo «${k}»`)
      })
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
