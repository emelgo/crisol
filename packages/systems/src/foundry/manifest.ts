/**
 * Lo que se lee de un sistema o un módulo de Foundry VTT: su manifiesto (system.json o module.json), los nombres de su
 * idioma (lang/en.json) y sus paquetes con sus documentos. Formato de Foundry VTT (sus manifiestos y sus compendios),
 * leído de sus archivos (ADR-0014)
 */

export const FOUNDRY_MANIFESTS = ['system.json', 'module.json'] as const

/** Un paquete del manifiesto: su nombre, su nombre para leer, su clase de documento y dónde está */
export interface FoundryPackDef {
  name: string
  label: string
  /** Item, Actor, JournalEntry, RollTable… */
  type: string
  path: string
  /** Lo que el sistema pone de más (dnd5e: el libro del que sale) */
  flags?: Record<string, unknown>
}

/** Las carpetas de paquetes del manifiesto: ordenan los paquetes */
export interface FoundryPackFolder {
  name: string
  packs?: string[]
  folders?: FoundryPackFolder[]
}

export interface FoundryManifest {
  kind: 'system' | 'module'
  id: string
  title: string
  version: string | null
  description: string | null
  license: string | null
  /** De un módulo, el sistema para el que es */
  system: string | null
  packs: FoundryPackDef[]
  packFolders: FoundryPackFolder[]
  /** Los campos de HTML de cada tipo (documentTypes.Item.spell.htmlFields) */
  htmlFields: Record<string, Record<string, string[]>>
  /** Los archivos de sus idiomas: lang/en.json */
  languages: { lang: string; path: string }[]
}

/** Una carpeta de documentos dentro de un paquete */
export interface FoundryFolder {
  _id: string
  name: string
  folder?: string | null
}

/** Un documento de un paquete, con los suyos dentro (los objetos de un actor, las páginas de un diario) */
export interface FoundryDocument {
  _id: string
  name?: string
  type?: string
  folder?: string | null
  sort?: number
  system?: Record<string, unknown>
  [key: string]: unknown
}

export interface FoundryPack extends FoundryPackDef {
  documents: FoundryDocument[]
  folders: FoundryFolder[]
}

export class FoundryError extends Error {
  readonly code: 'FOUNDRY_INVALID' | 'FOUNDRY_TOO_BIG'
  constructor(code: 'FOUNDRY_INVALID' | 'FOUNDRY_TOO_BIG', message: string) {
    super(message)
    this.code = code
    this.name = 'FoundryError'
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** Una ruta del manifiesto, sin «./» delante ni «/» detrás */
export const cleanPath = (path: string) =>
  path
    .replace(/\\/g, '/')
    .replace(/^(\.\/)+|^\/+/, '')
    .replace(/\/+$/, '')

function packFolders(value: unknown, depth = 0): FoundryPackFolder[] {
  if (!Array.isArray(value) || depth > 3) return []
  return value.filter(isObject).map((f) => ({
    name: str(f.name) ?? '',
    packs: Array.isArray(f.packs) ? f.packs.filter((p): p is string => typeof p === 'string') : [],
    folders: packFolders(f.folders, depth + 1)
  }))
}

/** El manifiesto, de su JSON (de la v9 a la v13: `name` o `id`, `entity` o `type`) */
export function readManifest(json: unknown, kind: 'system' | 'module'): FoundryManifest {
  if (!isObject(json)) throw new FoundryError('FOUNDRY_INVALID', 'El manifiesto no es un objeto')
  const id = str(json.id) ?? str(json.name)
  if (!id) throw new FoundryError('FOUNDRY_INVALID', 'El manifiesto no dice su id')
  const packs = (Array.isArray(json.packs) ? json.packs : []).filter(isObject).flatMap((p): FoundryPackDef[] => {
    const name = str(p.name)
    const type = str(p.type) ?? str(p.entity)
    const path = str(p.path)
    if (!name || !type) return []
    return [
      {
        name,
        label: str(p.label) ?? name,
        type,
        path: cleanPath(path ?? `packs/${name}`),
        ...(isObject(p.flags) ? { flags: p.flags } : {})
      }
    ]
  })
  const htmlFields: Record<string, Record<string, string[]>> = {}
  if (isObject(json.documentTypes))
    for (const [document, types] of Object.entries(json.documentTypes)) {
      if (!isObject(types)) continue
      const byType: Record<string, string[]> = {}
      for (const [type, spec] of Object.entries(types))
        if (isObject(spec) && Array.isArray(spec.htmlFields))
          byType[type] = spec.htmlFields.filter((f): f is string => typeof f === 'string')
      htmlFields[document] = byType
    }
  const relationships = isObject(json.relationships) ? json.relationships : {}
  const systems = Array.isArray(relationships.systems) ? relationships.systems.filter(isObject) : []
  const system =
    kind === 'module'
      ? (str(systems[0]?.id) ??
        (Array.isArray(json.systems) ? str(json.systems[0]) : null) ??
        (typeof json.system === 'string' ? str(json.system) : Array.isArray(json.system) ? str(json.system[0]) : null))
      : null
  return {
    kind,
    id,
    title: str(json.title) ?? id,
    version: str(json.version) ?? (typeof json.version === 'number' ? String(json.version) : null),
    description: str(json.description),
    license: str(json.license),
    system,
    packs,
    packFolders: packFolders(json.packFolders),
    htmlFields,
    languages: (Array.isArray(json.languages) ? json.languages : []).filter(isObject).flatMap((l) => {
      const lang = str(l.lang)
      const path = str(l.path)
      return lang && path ? [{ lang, path: cleanPath(path) }] : []
    })
  }
}

/** Los textos de un idioma, aplanados: { TYPES: { Item: { weapon } } } y { "TYPES.Item": { weapon } } dan TYPES.Item.weapon */
export function flattenLang(json: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (value: unknown, prefix: string, depth: number) => {
    if (typeof value === 'string') out[prefix] = value
    else if (isObject(value) && depth < 8)
      for (const [k, v] of Object.entries(value)) walk(v, prefix ? `${prefix}.${k}` : k, depth + 1)
  }
  walk(json, '', 0)
  return out
}

/** El orden de los paquetes: el de sus carpetas en el manifiesto y, luego, los demás */
export function packOrder(manifest: Pick<FoundryManifest, 'packs' | 'packFolders'>): string[] {
  const order: string[] = []
  const walk = (folders: readonly FoundryPackFolder[]) => {
    for (const f of folders) {
      for (const p of f.packs ?? []) if (!order.includes(p)) order.push(p)
      walk(f.folders ?? [])
    }
  }
  walk(manifest.packFolders)
  const known = new Set(manifest.packs.map((p) => p.name))
  return [...order.filter((p) => known.has(p)), ...manifest.packs.map((p) => p.name).filter((p) => !order.includes(p))]
}
