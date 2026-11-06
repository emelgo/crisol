/**
 * El archivo de un sistema, para bajarlo y subirlo en otra cuenta: el documento y su contenido (las clases, los
 * conjuros…). Al subirlo se valida entero: con un solo error, no se guarda nada
 */
import { FORMAT, LIMITS, type System } from './format.ts'
import { conceptSchema, type Mechanics, refSchema, validateMechanics } from './mechanics.ts'
import { own } from './own.ts'
import { TABLE_TYPE, type TableEntry, tableEntryProblems, withTables } from './table-entries.ts'
import { type Language, textOf } from './text.ts'
import { errorMap, type Problem, pathText, validateSystem } from './validate.ts'

export const SYSTEM_FILE = 'crisol-system'
/** El archivo entero: el sistema (hasta 2 MB) y su contenido */
export const FILE_BYTES = 10 * 1024 * 1024
/** Las claves del contenido: como las del sistema, y además con guiones (`srd-bola-de-fuego`) */
export const CONTENT_KEY = /^[a-z0-9][a-z0-9_-]{0,99}$/

export interface ContentItem {
  type: string
  key: string
  source: string | null
  /** Su nombre (`name`) y los valores de sus campos */
  data: Record<string, unknown>
  /** Lo que une sus versiones entre ediciones (el Guerrero de 2014 y el de 2024) */
  concept?: string
  /** Su mecánica: efectos, recursos, acciones, lo que concede, su escalado y su automatización */
  mechanics?: Mechanics
  /** De dónde sale: su página en cada PDF */
  ref?: { pages?: { en?: number; es?: number } }
  /** Su imagen: su ruta entre las del sistema (la de un zip de Foundry: systems/dnd5e/tokens/…) */
  img?: string
  /** Si es una tabla («Tabla», de Crisol): su fórmula, si repite y sus filas */
  table?: TableEntry
}

export interface SystemFile {
  kind: typeof SYSTEM_FILE
  format: number
  system: System
  content: ContentItem[]
}

export const toFile = (system: System, content: readonly ContentItem[]): SystemFile => ({
  kind: SYSTEM_FILE,
  format: FORMAT,
  system,
  content: [...content]
})

/** El nombre del archivo al bajarlo: fronteras.crisol-system.json */
export const fileName = (system: System, language: Language = 'es') =>
  `${
    textOf(system.name, language)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'sistema'
  }.${SYSTEM_FILE}.json`

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** El contenido de un sistema: de sus tipos, con sus claves sin repetir, sus fuentes y su tamaño */
export function validateContent(
  declared: System,
  content: unknown,
  prefix: (string | number)[] = ['content']
): Problem[] {
  // Todo sistema tiene «Tabla», lo declare o no
  const system = withTables(declared)
  const problems: Problem[] = []
  const add = (path: (string | number)[], message: string, severity: Problem['severity'] = 'error') =>
    problems.push({
      path: pathText(path),
      where: whereOfContent(content, path.slice(prefix.length)),
      message,
      severity
    })
  if (!Array.isArray(content)) {
    add(prefix, 'Tiene que ser una lista')
    return problems
  }
  if (content.length > LIMITS.contentDocuments) {
    add(prefix, `Como mucho, ${LIMITS.contentDocuments} documentos`)
    return problems
  }
  const sources = new Set((system.sources ?? []).map((s) => s.key))
  const seen = new Set<string>()
  const encoder = new TextEncoder()
  for (const [i, item] of content.entries()) {
    const at = [...prefix, i]
    if (!isObject(item)) {
      add(at, 'Tiene que ser un documento')
      continue
    }
    const { type, key, source, data, concept, mechanics, ref, img, table } = item
    if (table !== undefined) {
      if (type !== TABLE_TYPE) add([...at, 'table'], 'Solo una tabla lleva sus filas')
      else {
        const { errors, warnings } = tableEntryProblems(table)
        for (const e of errors) add([...at, 'table', ...e.path], e.message)
        for (const w of warnings) add([...at, 'table'], w, 'warning')
      }
    }
    if (img !== undefined && (typeof img !== 'string' || img.length === 0 || img.length > 500 || img.includes('..')))
      add([...at, 'img'], 'Su imagen va con su ruta, de hasta 500 caracteres')
    if (typeof type !== 'string' || !own(system.types, type))
      add([...at, 'type'], `No existe el tipo «${String(type)}»`)
    if (typeof key !== 'string' || !CONTENT_KEY.test(key))
      add([...at, 'key'], 'Una clave va en minúsculas, sin espacios ni tildes')
    else if (seen.has(key)) add([...at, 'key'], `«${key}» está repetida`)
    else seen.add(key)
    if (source !== null && source !== undefined && (typeof source !== 'string' || !sources.has(source)))
      add([...at, 'source'], `No existe la fuente «${String(source)}»`)
    if (concept !== undefined) {
      const checked = conceptSchema.safeParse(concept, { error: errorMap })
      if (!checked.success) add([...at, 'concept'], checked.error.issues[0]?.message ?? 'No vale')
    }
    if (ref !== undefined) {
      const checked = refSchema.safeParse(ref, { error: errorMap })
      if (!checked.success)
        for (const issue of checked.error.issues)
          add([...at, 'ref', ...(issue.path as (string | number)[])], issue.message)
    }
    if (mechanics !== undefined && typeof type === 'string')
      validateMechanics(system, type, mechanics, [...at, 'mechanics'], add)
    if (!isObject(data)) {
      add([...at, 'data'], 'Tiene que ser un objeto')
      continue
    }
    const name = data.name
    if (
      !(typeof name === 'string' && name.trim()) &&
      !(isObject(name) && Object.values(name).some((v) => typeof v === 'string' && v.trim()))
    )
      add([...at, 'data', 'name'], 'Falta su nombre')
    if (encoder.encode(JSON.stringify(data)).length > LIMITS.contentBytes)
      add([...at, 'data'], `Como mucho, ${LIMITS.contentBytes / 1024} KB por documento`)
  }
  return problems
}

/** Dónde está un problema del contenido: «Contenido › Bola de fuego» */
function whereOfContent(content: unknown, path: (string | number)[]): string {
  const [index, ...rest] = path
  if (typeof index !== 'number' || !Array.isArray(content)) return 'Contenido'
  const item = content[index] as { data?: { name?: unknown }; key?: unknown } | undefined
  const name = textOf(item?.data?.name as never) || (typeof item?.key === 'string' ? item.key : `${index + 1}.º`)
  const part = {
    type: 'Tipo',
    key: 'Clave',
    source: 'Fuente',
    data: 'Datos',
    name: 'Nombre',
    concept: 'Concepto',
    ref: 'Página',
    table: 'Tabla',
    rows: 'Filas',
    mechanics: 'Mecánica',
    effects: 'Efectos',
    resources: 'Recursos',
    actions: 'Acciones',
    grants: 'Concede',
    scaling: 'Escalado',
    damage: 'Daño',
    attack: 'Ataque',
    save: 'Salvación',
    value: 'Valor',
    target: 'Destino',
    when: 'Cuándo',
    max: 'Máximo'
  }
  return ['Contenido', name, ...rest.map((r) => part[r as keyof typeof part] ?? String(r))].join(' › ')
}

/** Lee y valida un archivo de sistema entero; sin errores, da el sistema y su contenido */
export function validateFile(
  input: unknown,
  { language = 'es' as Language } = {}
): {
  file: SystemFile | null
  problems: Problem[]
} {
  const fail = (path: string, message: string) => ({
    file: null,
    problems: [{ path, where: 'El archivo', message, severity: 'error' as const }]
  })
  if (new TextEncoder().encode(JSON.stringify(input) ?? '').length > FILE_BYTES)
    return fail('', `Como mucho, ${FILE_BYTES / 1024 / 1024} MB`)
  if (!isObject(input) || input.kind !== SYSTEM_FILE) return fail('kind', 'No es el archivo de un sistema de Crisol')
  if (input.format !== FORMAT)
    return fail('format', `Es de otra versión del formato (${String(input.format)}); esta es la ${FORMAT}`)
  const { system, problems: systemProblems } = validateSystem(input.system, { language })
  const problems = systemProblems.map((p) => ({ ...p, path: p.path ? `system.${p.path}` : 'system' }))
  if (!system) return { file: null, problems }
  problems.push(...validateContent(system, input.content ?? []))
  if (problems.some((p) => p.severity === 'error')) return { file: null, problems }
  return { file: toFile(system, (input.content ?? []) as ContentItem[]), problems }
}
