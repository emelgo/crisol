/**
 * La lista de Archivos como árbol, la misma en su pantalla y en el selector de archivos: en un mundo, los comunes
 * dentro de su carpeta «Comunes»; en los comunes, cada mundo en la suya; lo de cada carpeta en su orden; y al buscar, lo
 * encontrado dentro de sus carpetas
 */
import type { FolderView } from '@crisol/contracts'
import { bySiblingPlace } from '@crisol/domain'
import type { WorldFile } from './links-context.ts'

/** La carpeta «Comunes» dentro de un mundo: no existe como tal, es la raíz de los comunes */
export const COMMON = 'comunes'

/**
 * La carpeta de un mundo en los comunes de la cuenta (Enrique, 2026-11-13): tampoco existe como tal, es la raíz de lo
 * suyo; sale con el mundo, no se cambia ni se borra y se va con él
 */
export const worldRoot = (worldId: string) => `mundo:${worldId}`

/** Si es la raíz de otro ámbito (no una carpeta de verdad): «Comunes» en un mundo o un mundo en los comunes */
export const isRoot = (id: string | null | undefined) => id === COMMON || Boolean(id?.startsWith('mundo:'))

/** Lo de un ámbito (un mundo o los comunes): sus archivos y sus carpetas */
export type Scope = { files: WorldFile[]; folders: FolderView[] }
/** Lo de una carpeta: sus carpetas y sus archivos */
export type Level = { folders: FolderView[]; files: WorldFile[] }
/** Lo de cada carpeta, por su id (null: lo más alto) */
export type Tree = Map<string | null, Level>

/** Para buscar: sin tildes ni mayúsculas, como en las páginas */
export const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es')

/** Lo de un ámbito con lo de otro colgando de su raíz (lo que en el otro está en lo más alto, dentro de ella) */
export function withRoot(own: Scope, other: Scope, root: FolderView): Scope {
  return {
    files: [...own.files, ...other.files.map((file) => ({ ...file, folderId: file.folderId ?? root.id }))],
    folders: [...own.folders, root, ...other.folders.map((each) => ({ ...each, parentId: each.parentId ?? root.id }))]
  }
}

/** La raíz de otro ámbito, como una carpeta más */
export function rootFolder(root: {
  id: string
  name: string
  worldId: string | null
  organizationId: string
  color?: FolderView['color']
}): FolderView {
  return {
    id: root.id,
    worldId: root.worldId,
    organizationId: root.organizationId,
    parentId: null,
    name: root.name,
    position: null,
    color: root.color ?? null,
    icon: null
  }
}

/** Lo de un mundo con lo común colgando de «Comunes» (lo que en los comunes está en lo más alto, dentro de ella) */
export function withCommon(own: Scope, common: Scope, folder: { name: string; organizationId: string }): Scope {
  return withRoot(own, common, rootFolder({ id: COMMON, worldId: null, ...folder }))
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
 * nombre); las raíces de otros ámbitos («Comunes», los mundos), tras las propias
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
    entry.folders.sort((a, b) => Number(isRoot(a.id)) - Number(isRoot(b.id)) || bySiblingPlace(a, b))
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
 * («Lugares › Puertos»). Sin «Comunes» (es la raíz de los comunes) y, si se mueven carpetas, sin ellas ni las suyas
 */
export function folderChoices(
  folders: readonly FolderView[],
  worldId: string | null,
  moving: string | readonly string[] = []
): { id: string; label: string }[] {
  const tree = treeOf({ files: [], folders: [...folders] })
  const skipped = new Set(typeof moving === 'string' ? [moving] : moving)
  const choices: { id: string; label: string }[] = []
  const walk = (parentId: string | null, path: string[]) => {
    for (const folder of tree.get(parentId)?.folders ?? []) {
      if (skipped.has(folder.id)) continue
      const next = isRoot(folder.id) ? path : [...path, folder.name]
      if (!isRoot(folder.id) && folder.worldId === worldId) choices.push({ id: folder.id, label: next.join(' › ') })
      walk(folder.id, next)
    }
  }
  walk(null, [])
  return choices
}
