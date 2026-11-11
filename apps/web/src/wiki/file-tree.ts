/**
 * La lista de Archivos como árbol, la misma en su pantalla y en el selector de archivos: en un mundo, los comunes
 * dentro de su carpeta «Comunes»; lo de cada carpeta en su orden; y al buscar, lo encontrado dentro de sus carpetas
 */
import type { FolderView } from '@crisol/contracts'
import { bySiblingPlace } from '@crisol/domain'
import type { WorldFile } from './links-context.ts'

/** La carpeta «Comunes» dentro de un mundo: no existe como tal, es la raíz de los comunes */
export const COMMON = 'comunes'

/** Lo de un ámbito (un mundo o los comunes): sus archivos y sus carpetas */
export type Scope = { files: WorldFile[]; folders: FolderView[] }
/** Lo de una carpeta: sus carpetas y sus archivos */
export type Level = { folders: FolderView[]; files: WorldFile[] }
/** Lo de cada carpeta, por su id (null: lo más alto) */
export type Tree = Map<string | null, Level>

/** Para buscar: sin tildes ni mayúsculas, como en las páginas */
export const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es')

/** Lo de un mundo con lo común colgando de «Comunes» (lo que en los comunes está en lo más alto, dentro de ella) */
export function withCommon(own: Scope, common: Scope, folder: { name: string; organizationId: string }): Scope {
  const root: FolderView = {
    id: COMMON,
    worldId: null,
    organizationId: folder.organizationId,
    parentId: null,
    name: folder.name,
    position: null,
    color: null,
    icon: null
  }
  return {
    files: [...own.files, ...common.files.map((file) => ({ ...file, folderId: file.folderId ?? COMMON }))],
    folders: [...own.folders, root, ...common.folders.map((each) => ({ ...each, parentId: each.parentId ?? COMMON }))]
  }
}

/** Separa lo del mundo y lo común de una lista de listFiles (que trae los dos) */
export function splitScopes(data: Scope): { own: Scope; common: Scope } {
  return {
    own: {
      files: data.files.filter((f) => f.worldId !== null),
      folders: data.folders.filter((f) => f.worldId !== null)
    },
    common: {
      files: data.files.filter((f) => f.worldId === null),
      folders: data.folders.filter((f) => f.worldId === null)
    }
  }
}

/**
 * Lo de cada carpeta: las carpetas primero y luego los archivos, en su orden (por su puesto y, sin él, detrás y por
 * nombre); «Comunes», tras las del mundo
 */
export function treeOf(data: Scope): Tree {
  const map: Tree = new Map()
  const at = (id: string | null) => {
    const entry = map.get(id) ?? { folders: [], files: [] }
    map.set(id, entry)
    return entry
  }
  for (const folder of data.folders) at(folder.parentId ?? null).folders.push(folder)
  for (const file of data.files) at(file.folderId ?? null).files.push(file)
  for (const entry of map.values()) {
    entry.folders.sort((a, b) => Number(a.id === COMMON) - Number(b.id === COMMON) || bySiblingPlace(a, b))
    entry.files.sort(bySiblingPlace)
  }
  return map
}

/** Si un archivo responde a lo buscado: por su nombre o, empezando por #, por el principio de una de sus etiquetas */
export function matches(file: Pick<WorldFile, 'name' | 'tags'>, query: string): boolean {
  const wanted = plain(query.trim())
  if (wanted.startsWith('#')) return file.tags.some((tag) => plain(tag).startsWith(wanted.slice(1)))
  return plain(file.name).includes(wanted)
}

/** Lo encontrado, en su árbol: cada archivo dentro de sus carpetas (todas las de su camino), sin lo demás */
export function foundTree(results: readonly WorldFile[], tree: Tree, folders: readonly FolderView[]): Tree {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const map: Tree = new Map()
  const at = (id: string | null) => {
    const entry = map.get(id) ?? { folders: [], files: [] }
    map.set(id, entry)
    return entry
  }
  const folderIds = new Set<string>()
  for (const file of results) {
    at(file.folderId ?? null).files.push(file)
    for (let id = file.folderId ?? null; id; id = byId.get(id)?.parentId ?? null) folderIds.add(id)
  }
  for (const [parentId, entry] of tree) {
    const kept = entry.folders.filter((folder) => folderIds.has(folder.id))
    if (kept.length) at(parentId).folders.push(...kept)
  }
  for (const entry of map.values()) entry.files.sort(bySiblingPlace)
  return map
}

/**
 * Las carpetas adonde puede ir algo de un ámbito (worldId; null, los comunes), en el orden del árbol y con su camino
 * («Lugares › Puertos»). Sin «Comunes» (es la raíz de los comunes) y, si se mueve una carpeta, sin ella ni las suyas
 */
export function folderChoices(
  folders: readonly FolderView[],
  worldId: string | null,
  moving?: string
): { id: string; label: string }[] {
  const tree = treeOf({ files: [], folders: [...folders] })
  const choices: { id: string; label: string }[] = []
  const walk = (parentId: string | null, path: string[]) => {
    for (const folder of tree.get(parentId)?.folders ?? []) {
      if (folder.id === moving) continue
      const next = folder.id === COMMON ? path : [...path, folder.name]
      if (folder.id !== COMMON && folder.worldId === worldId) choices.push({ id: folder.id, label: next.join(' › ') })
      walk(folder.id, next)
    }
  }
  walk(null, [])
  return choices
}
