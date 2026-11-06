/**
 * Leer el zip de un sistema o un módulo de Foundry VTT: su manifiesto (a cualquier profundidad razonable), los nombres
 * de su idioma y sus paquetes, LevelDB (una carpeta, que se lee con classic-level en una carpeta temporal que se borra
 * siempre) o NeDB (un .db, una línea JSON por documento). Formato de los compendios de Foundry VTT, leído de sus
 * archivos (ADR-0014)
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  FOUNDRY_DOCUMENTS,
  type FoundryArt,
  type FoundryDocument,
  FoundryError,
  type FoundryFolder,
  type FoundryManifest,
  type FoundryPack,
  flattenLang,
  readManifest
} from '@crisol/systems/foundry'
import { ClassicLevel } from 'classic-level'
import { type Unzipped, unzipSync } from 'fflate'

/** Lo descomprimido que se lee, como mucho */
export const UNZIPPED_BYTES = 400 * 1024 * 1024
/** El manifiesto, como mucho a tantas carpetas de la raíz */
const MANIFEST_DEPTH = 4
/** Un archivo de una base LevelDB: sin carpetas ni nombres raros */
const LEVEL_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const invalid = (message: string) => new FoundryError('FOUNDRY_INVALID', message)

export interface FoundryRead {
  manifest: FoundryManifest
  names: Record<string, string>
  packs: FoundryPack[]
  /** Sus mapas de arte, si vienen en el zip: el retrato de cada actor */
  art?: FoundryArt
}

/** Lo que hay en el zip: el nombre y el tamaño descomprimido de cada archivo, sin descomprimir nada */
function listing(zip: Uint8Array): Map<string, number> {
  const files = new Map<string, number>()
  try {
    unzipSync(zip, {
      filter: (file) => {
        if (!file.name.endsWith('/')) files.set(file.name, file.originalSize)
        return false
      }
    })
  } catch {
    throw invalid('No es un zip')
  }
  return files
}

/** Unos archivos del zip, comprobando antes que no pasen de lo que se lee */
function extract(zip: Uint8Array, files: Map<string, number>, wanted: (name: string) => boolean): Unzipped {
  let total = 0
  for (const [name, size] of files) if (wanted(name)) total += size
  if (total > UNZIPPED_BYTES)
    throw new FoundryError('FOUNDRY_TOO_BIG', `Descomprimido ocupa más de ${UNZIPPED_BYTES / 1024 / 1024} MB`)
  try {
    return unzipSync(zip, { filter: (file) => wanted(file.name) })
  } catch {
    throw invalid('No se pudo descomprimir')
  }
}

const json = (bytes: Uint8Array | undefined, what: string): unknown => {
  if (!bytes) throw invalid(`Falta ${what}`)
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw invalid(`${what} no es JSON`)
  }
}

/** El manifiesto: system.json o module.json, el más cerca de la raíz */
function findManifest(files: Map<string, number>): { path: string; root: string; kind: 'system' | 'module' } {
  const found = [...files.keys()]
    .filter((name) => !name.startsWith('__MACOSX/'))
    .flatMap((name) => {
      const parts = name.split('/')
      const base = parts.at(-1)
      const kind = base === 'system.json' ? 'system' : base === 'module.json' ? 'module' : null
      return kind && parts.length <= MANIFEST_DEPTH + 1 ? [{ path: name, depth: parts.length, kind } as const] : []
    })
    .sort((a, b) => a.depth - b.depth || (a.kind === 'system' ? -1 : 1) - (b.kind === 'system' ? -1 : 1))
  const best = found[0]
  if (!best) throw invalid('No tiene system.json ni module.json')
  return { path: best.path, root: best.path.slice(0, best.path.length - `${best.kind}.json`.length), kind: best.kind }
}

/** Los documentos de una base LevelDB: los suyos (!items!id) con los de dentro (!actors.items!actor.item) */
export function assemble(entries: Iterable<[string, unknown]>): {
  documents: FoundryDocument[]
  folders: FoundryFolder[]
} {
  const top = new Map<string, FoundryDocument>()
  const folders: FoundryFolder[] = []
  const embedded = new Map<string, Map<string, Map<string, Record<string, unknown>>>>()
  for (const [key, value] of entries) {
    const m = /^!([^!]+)!(.+)$/.exec(key)
    if (!m || !isObject(value)) continue
    const collections = (m[1] as string).split('.')
    const ids = (m[2] as string).split('.')
    if (collections.length === 1 && ids.length === 1) {
      if (collections[0] === 'folders') {
        if (typeof value.name === 'string')
          folders.push({ _id: ids[0] as string, name: value.name, folder: (value.folder as string | null) ?? null })
      } else top.set(ids[0] as string, { ...value, _id: ids[0] as string } as FoundryDocument)
    } else if (collections.length === 2 && ids.length === 2) {
      // Solo un nivel dentro: los objetos de un actor, las páginas de un diario, los resultados de una tabla
      const [parent, child] = ids as [string, string]
      const field = collections[1] as string
      const byField = embedded.get(parent) ?? new Map()
      const docs = byField.get(field) ?? new Map()
      docs.set(child, { ...value, _id: child })
      byField.set(field, docs)
      embedded.set(parent, byField)
    }
  }
  for (const [parent, byField] of embedded) {
    const doc = top.get(parent)
    if (!doc) continue
    for (const [field, docs] of byField) {
      // En el orden de la lista de ids del documento, y luego los que no estén en ella
      const listed = Array.isArray(doc[field]) ? (doc[field] as unknown[]).filter((id) => typeof id === 'string') : []
      const ordered = [
        ...listed.flatMap((id) => (docs.has(id as string) ? [docs.get(id as string)] : [])),
        ...[...docs].filter(([id]) => !listed.includes(id)).map(([, d]) => d)
      ]
      doc[field] = ordered
    }
  }
  return { documents: [...top.values()], folders }
}

/** Los documentos de un paquete NeDB: una línea JSON por documento; la última de un id gana, y $$deleted lo quita */
export function readNedb(text: string): FoundryDocument[] {
  const docs = new Map<string, FoundryDocument>()
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    let value: unknown
    try {
      value = JSON.parse(line)
    } catch {
      continue
    }
    if (!isObject(value) || typeof value._id !== 'string') continue
    if (value.$$deleted) docs.delete(value._id)
    else docs.set(value._id, value as FoundryDocument)
  }
  return [...docs.values()]
}

/** Una base LevelDB, copiada a una carpeta temporal, leída y borrada */
async function readLevel(files: Record<string, Uint8Array>, label: string) {
  const dir = await mkdtemp(join(tmpdir(), 'crisol-foundry-'))
  try {
    for (const [name, bytes] of Object.entries(files)) await writeFile(join(dir, name), bytes)
    const db = new ClassicLevel<string, unknown>(dir, { valueEncoding: 'json', createIfMissing: false })
    try {
      const entries: [string, unknown][] = []
      for await (const entry of db.iterator()) entries.push(entry as [string, unknown])
      return assemble(entries)
    } finally {
      await db.close()
    }
  } catch (error) {
    if (error instanceof FoundryError) throw error
    throw invalid(`No se pudo leer el paquete «${label}»`)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** Dónde está cada paquete en el zip: una carpeta LevelDB o un archivo NeDB */
function locate(files: Map<string, number>, root: string, path: string) {
  const base = `${root}${path}`
  const level = [...files.keys()].filter((n) => n.startsWith(`${base}/`) && LEVEL_FILE.test(n.slice(base.length + 1)))
  if (level.length > 0) return { kind: 'level' as const, files: level, base }
  const nedb = [base, `${base}.db`, base.replace(/\.db$/, '')].find((n) => files.has(n) && n.endsWith('.db'))
  return nedb ? { kind: 'nedb' as const, file: nedb } : null
}

/**
 * Lee el zip: el manifiesto, los nombres en el idioma que se pide (o en inglés) y los paquetes que se piden (sin
 * decirlo, todos); de los que no se traen (ActiveEffect, Adventure…), solo lo que son
 */
export async function readFoundryZip(
  zip: Uint8Array,
  { packs: wanted, language }: { packs?: readonly string[]; language: string }
): Promise<FoundryRead> {
  const files = listing(zip)
  const found = findManifest(files)
  const manifest = readManifest(json(extract(zip, files, (n) => n === found.path)[found.path], found.path), found.kind)
  if (wanted) {
    const missing = wanted.filter((name) => !manifest.packs.some((p) => p.name === name))
    if (missing.length > 0) throw invalid(`No tiene los paquetes ${missing.map((m) => `«${m}»`).join(', ')}`)
  }
  const chosen = manifest.packs.filter((p) => !wanted || wanted.includes(p.name))
  const readable = chosen.filter((p) => (FOUNDRY_DOCUMENTS as readonly string[]).includes(p.type))
  const located = new Map(readable.map((p) => [p.name, locate(files, found.root, p.path)]))
  const langPath = [
    ...manifest.languages.filter((l) => l.lang === language),
    ...manifest.languages.filter((l) => l.lang === 'en'),
    { path: `lang/${language}.json` },
    { path: 'lang/en.json' }
  ]
    .map((l) => `${found.root}${l.path}`)
    .find((p) => files.has(p))
  const needed = new Set<string>(langPath ? [langPath] : [])
  for (const where of located.values()) {
    if (where?.kind === 'level') for (const f of where.files) needed.add(f)
    if (where?.kind === 'nedb') needed.add(where.file)
  }
  const unzipped = extract(zip, files, (n) => needed.has(n))
  let names: Record<string, string> = {}
  if (langPath)
    try {
      names = flattenLang(json(unzipped[langPath], langPath))
    } catch {
      names = {}
    }
  const packs: FoundryPack[] = []
  for (const def of chosen) {
    const where = located.get(def.name)
    if (!where) {
      packs.push({ ...def, documents: [], folders: [] })
      continue
    }
    if (where.kind === 'nedb') {
      const docs = readNedb(new TextDecoder().decode(unzipped[where.file]))
      packs.push({ ...def, documents: docs, folders: [] })
      continue
    }
    const level = Object.fromEntries(
      where.files.map((f) => [f.slice(where.base.length + 1), unzipped[f] ?? new Uint8Array()])
    )
    packs.push({ ...def, ...(await readLevel(level, def.label)) })
  }
  return { manifest, names, packs, ...artOf(zip, files, found.root, manifest) }
}

/** Los mapas de arte del manifiesto que vienen en el zip, juntos: { «dnd5e.monsters»: { id: { actor } } } */
function artOf(
  zip: Uint8Array,
  files: Map<string, number>,
  root: string,
  manifest: FoundryManifest
): { art?: FoundryArt } {
  const prefix = `${manifest.kind === 'module' ? 'modules' : 'systems'}/${manifest.id}/`
  const wanted = manifest.artMappings.flatMap((m) =>
    m.mapping.startsWith(prefix) ? [{ path: `${root}${m.mapping.slice(prefix.length)}`, credit: m.credit }] : []
  )
  const present = wanted.filter((w) => (files.get(w.path) ?? Number.POSITIVE_INFINITY) <= 20 * 1024 * 1024)
  if (present.length === 0) return {}
  const unzipped = extract(zip, files, (n) => present.some((w) => w.path === n))
  const map: FoundryArt['map'] = {}
  for (const w of present) {
    try {
      const parsed = json(unzipped[w.path], w.path)
      if (!parsed || typeof parsed !== 'object') continue
      for (const [pack, byId] of Object.entries(parsed as Record<string, unknown>)) {
        if (!byId || typeof byId !== 'object') continue
        const entries: Record<string, { actor?: string }> = map[pack] ?? {}
        map[pack] = entries
        for (const [id, value] of Object.entries(byId as Record<string, unknown>)) {
          const actor = (value as { actor?: unknown } | null)?.actor
          if (typeof actor === 'string') entries[id] = { actor }
        }
      }
    } catch {
      // Un mapa que no se lee: sin retratos, sin más
    }
  }
  return { art: { credit: present.find((w) => w.credit)?.credit ?? null, map } }
}

/** Cuántos documentos tiene cada paquete (los que se traen): para elegir cuáles */
export async function inspectFoundryZip(zip: Uint8Array) {
  const read = await readFoundryZip(zip, { language: 'en' })
  return {
    manifest: read.manifest,
    packs: read.packs.map((p) => ({
      name: p.name,
      label: p.label,
      type: p.type,
      documents: p.documents.length,
      supported: (FOUNDRY_DOCUMENTS as readonly string[]).includes(p.type)
    }))
  }
}
