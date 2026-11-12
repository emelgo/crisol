/**
 * Mover un archivo o una carpeta en la lista ya cargada, para verlo en su sitio al soltarlo sin esperar al servidor (que
 * luego da la de verdad): a una carpeta (null, lo más alto) y, si se da, delante o detrás de un hermano de su tipo, con
 * los puestos de todos la primera vez que se ordenan, como hace el servidor (placeAmong). Sin ancla, sin puesto
 */
import { bySiblingPlace, placeAmong } from '@crisol/domain'
import type { ActionOutput } from '../api/client.ts'

/** La lista tal como llega del servidor (la de un mundo o la de los comunes) */
export type Listed = ActionOutput<'listFiles'>
/** Algo de la lista: un archivo o una carpeta */
export type Item = { kind: 'file' | 'folder'; id: string }
/** Adónde va: su carpeta de verdad (null, lo más alto) y, si se recoloca, delante o detrás de un hermano de su tipo */
export type FilesMove = { folderId: string | null; before?: string; after?: string }

type Entry = { id: string; name: string; worldId: string | null; organizationId: string; position: string | null }

/** Las entradas con la movida en su carpeta y su puesto (y el de sus hermanas, si se rellenan) */
function placed<T extends Entry>(
  list: readonly T[],
  id: string,
  parentOf: (entry: T) => string | null,
  to: FilesMove,
  inside: (entry: T, parent: string | null, position: string | null) => T
): T[] {
  const moved = list.find((entry) => entry.id === id)
  if (!moved) return [...list]
  const anchor = to.before ?? to.after
  // Sus hermanas: las de su ámbito (los del mundo y los comunes no se mezclan) en la carpeta de destino
  const siblings = list
    .filter(
      (entry) =>
        entry.worldId === moved.worldId &&
        entry.organizationId === moved.organizationId &&
        parentOf(entry) === to.folderId
    )
    .sort(bySiblingPlace)
  const places =
    anchor === undefined
      ? new Map<string, string>()
      : new Map(
          placeAmong(siblings, id, to.before !== undefined ? { before: to.before } : { after: anchor }).map(
            (place) => [place.id, place.position] as const
          )
        )
  return list.map((entry) => {
    if (entry.id === id) return inside(entry, to.folderId, places.get(id) ?? null)
    const position = places.get(entry.id)
    return position === undefined ? entry : { ...entry, position }
  })
}

export function movedIn(list: Listed, item: Item, to: FilesMove): Listed {
  return item.kind === 'file'
    ? {
        ...list,
        files: placed(
          list.files,
          item.id,
          (file) => file.folderId,
          to,
          (file, folderId, position) => ({ ...file, folderId, position })
        )
      }
    : {
        ...list,
        folders: placed(
          list.folders,
          item.id,
          (folder) => folder.parentId,
          to,
          (folder, parentId, position) => ({ ...folder, parentId, position })
        )
      }
}
