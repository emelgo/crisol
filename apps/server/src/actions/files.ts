/**
 * Los archivos: la lista, renombrar, mandar a la papelera y restaurar. Son de un mundo o comunes a los de su
 * organización (ADR-0005). Subir y reemplazar van por sus rutas (files/routes.ts): los bytes no caben en una acción
 */
import {
  createFolder,
  deleteFile,
  deleteFiles,
  deleteFolder,
  type FileView,
  type FolderView,
  listCommonFiles,
  listFiles,
  moveFile,
  renameFile,
  restoreFile,
  updateFolder
} from '@crisol/contracts'
import { type FileScope, filesRepo, linksRepo, type OperationContext, worldsRepo } from '@crisol/db'
import { authorize, bySiblingPlace, NotFoundError, placeAmong } from '@crisol/domain'
import { commonFilesChanged, filesChanged } from '../realtime/events.ts'
import { resolvePendingFiles } from '../wiki/file-embeds.ts'
import { authorizedWiki, targetOrganization } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

type FileRow = NonNullable<Awaited<ReturnType<typeof filesRepo.findFile>>>

export const fileView = (row: FileRow): FileView => ({
  id: row.id,
  worldId: row.worldId,
  organizationId: row.organizationId,
  name: row.name,
  folderId: row.folderId,
  kind: row.kind,
  mime: row.mime,
  size: row.size,
  // Con su versión: el navegador la guarda sin volver a preguntar (al reemplazarla, cambia)
  url: `/api/files/${row.id}?v=${row.version}`,
  position: row.position,
  tags: row.tags,
  version: row.version,
  updatedAt: row.updatedAt.toISOString()
})

type FolderRow = NonNullable<Awaited<ReturnType<typeof filesRepo.findFolder>>>

const folderView = (row: FolderRow): FolderView => ({
  id: row.id,
  worldId: row.worldId,
  organizationId: row.organizationId,
  parentId: row.parentId,
  name: row.name,
  position: row.position
})

/** Dónde está un archivo: en un mundo (con su organización) o, sin mundo, entre los comunes de una organización */
export type FilePlace = { worldId: string; organizationId: string } | { worldId: null; organizationId: string }

/** Su ámbito, para el nombre libre y las listas */
export const scopeOf = (place: FilePlace): FileScope =>
  place.worldId ? { worldId: place.worldId } : { organizationId: place.organizationId }

/** El nombre ya lo tiene otro archivo de su ámbito (el índice único, si dos llegan a la vez) */
export function nameTaken(error: unknown): boolean {
  for (let e = error as { code?: string; cause?: unknown } | undefined; e; e = e.cause as typeof e) {
    if (e.code === '23505') return true
  }
  return false
}

/**
 * Pone un archivo con un nombre libre en su ámbito: el pedido o, si está, con un número. Si otro se lo quita entre
 * medias, lo vuelve a intentar
 */
export async function withFreeName<T>(
  db: Parameters<typeof filesRepo.freeName>[0],
  file: { scope: FileScope; name: string; except?: string },
  write: (name: string) => Promise<T>
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const name = await filesRepo.freeName(db, file.scope, file.name, file.except)
    try {
      return await write(name)
    } catch (error) {
      if (!nameTaken(error) || attempt >= 4) throw error
    }
  }
}

/** Los comunes de una organización, si la cuenta puede verlos (write: cambiarlos). Si no, 404 o 403 */
export function authorizedCommon(ctx: ActionContext, write: boolean, organizationId: string): FilePlace {
  authorize(ctx.actor, write ? 'commonFiles.write' : 'commonFiles.read', { organizationId })
  return { worldId: null, organizationId }
}

/**
 * El archivo (fuera de la papelera) y dónde está, si la cuenta puede hacer eso con él: con los de un mundo, lo que
 * pueda en su wiki; con los comunes, lo que pueda con los de su organización. Si no, 404
 */
export async function authorizedFile(
  ctx: ActionContext,
  capability: 'page.read' | 'page.write',
  fileId: string,
  options: { trashed?: boolean } = {}
): Promise<{ file: FileRow; place: FilePlace }> {
  const file = fileId ? await filesRepo.findFile(ctx.db, fileId, options) : null
  if (file && file.worldId === null) {
    return { file, place: authorizedCommon(ctx, capability === 'page.write', file.organizationId) }
  }
  const wiki = await authorizedWiki(ctx, capability, file?.worldId ?? '')
  if (!file) throw new NotFoundError('file')
  return { file, place: wiki }
}

/**
 * Tras cambiar los archivos de un sitio: el aviso en tiempo real y, si llegan estos nombres (subido, renombrado,
 * restaurado), lo que los esperaba con `![[…]]` los encuentra; con un común, en todos los mundos de su organización
 */
export async function filesTouched(ctx: ActionContext, place: FilePlace, names: readonly string[] = []) {
  if (place.worldId) {
    ctx.realtime.publish(filesChanged(place))
    if (names.length > 0) await resolvePendingFiles(ctx, place.worldId, ctx.actor.userId, names)
    return
  }
  ctx.realtime.publish(commonFilesChanged(place.organizationId))
  if (names.length === 0) return
  for (const world of await worldsRepo.organizationWorlds(ctx.db, place.organizationId)) {
    await resolvePendingFiles(ctx, world.id, ctx.actor.userId, names)
  }
}

/** La carpeta y dónde está, si la cuenta puede verla (write: cambiarla). Si no, 404 o 403 */
async function authorizedFolder(ctx: ActionContext, write: boolean, folderId: string) {
  const folder = await filesRepo.findFolder(ctx.db, folderId)
  if (folder && folder.worldId === null) {
    return { folder, place: authorizedCommon(ctx, write, folder.organizationId) }
  }
  const wiki = await authorizedWiki(ctx, write ? 'page.write' : 'page.read', folder?.worldId ?? '')
  if (!folder) throw new NotFoundError('folder')
  return { folder, place: wiki as FilePlace }
}

/** Una carpeta de destino: tiene que ser del mismo ámbito (null: lo más alto, siempre vale) */
export async function folderIn(ctx: ActionContext, place: FilePlace, folderId: string | null | undefined) {
  if (!folderId) return null
  const folder = await filesRepo.findFolder(ctx.db, folderId)
  const same = folder && folder.worldId === place.worldId && folder.organizationId === place.organizationId
  if (!same) throw new InvalidRequestError('BAD_FOLDER')
  return folder
}

const folderTaken = (name: string) => new InvalidRequestError('NAME_TAKEN', `Ya hay una carpeta «${name}» ahí`)

/**
 * Los puestos que hay que guardar para poner algo delante o detrás de un hermano de su tipo en su carpeta de destino
 * (`siblingsThere`: los de allí): el suyo y, la primera vez que se ordenan, los de los demás que cambian. Sin ancla,
 * null. Si el ancla no es de allí (otra carpeta, otro ámbito u otro tipo) o es él mismo, NOT_SIBLING
 */
async function placeBeside(
  siblingsThere: () => Promise<{ id: string; name: string; position: string | null }[]>,
  movedId: string,
  anchor: { before?: string | undefined; after?: string | undefined }
) {
  const by = anchor.before ?? anchor.after
  if (by === undefined) return null
  const siblings = await siblingsThere()
  if (by === movedId || !siblings.some((sibling) => sibling.id === by)) {
    throw new InvalidRequestError('NOT_SIBLING', 'Solo se ordena junto a otro de su tipo en su carpeta')
  }
  const ordered = [...siblings].sort(bySiblingPlace)
  const places = placeAmong(ordered, movedId, anchor.before !== undefined ? { before: by } : { after: by })
  const before = new Map(siblings.map((sibling) => [sibling.id, sibling.position]))
  return {
    own: places.find((place) => place.id === movedId)?.position ?? null,
    others: places.filter((place) => place.id !== movedId && before.get(place.id) !== place.position)
  }
}

/** Para el historial: el mundo o, con un común, solo su organización */
export const historyScopeOf = (place: FilePlace) => (place.worldId ? place : { organizationId: place.organizationId })

/** Con cuántas páginas cuenta cada archivo: los del mundo, en él; los comunes, en todos los de su organización */
async function withUses(ctx: ActionContext, rows: FileRow[], worldId?: string) {
  const worldUses = worldId ? await linksRepo.fileUses(ctx.db, { worldId }) : new Map<string, number>()
  const organizationId = rows.find((row) => row.worldId === null)?.organizationId
  const commonUses = organizationId ? await linksRepo.fileUses(ctx.db, { organizationId }) : new Map<string, number>()
  return rows.map((row) => ({
    ...fileView(row),
    usedBy: (row.worldId === null ? commonUses : worldUses).get(row.id) ?? 0
  }))
}

const notFree = (name: string, place: FilePlace) =>
  new InvalidRequestError(
    'NAME_TAKEN',
    place.worldId ? `Ya hay un archivo «${name}» en el mundo` : `Ya hay un archivo común «${name}»`
  )

export const fileActions = [
  // Cada uno en el orden de su carpeta: por su puesto y, sin él, detrás y por nombre
  implement(listFiles, async (ctx, { worldId }) => {
    await authorizedWiki(ctx, 'page.read', worldId)
    return {
      files: (await withUses(ctx, await filesRepo.usableFiles(ctx.db, worldId), worldId)).sort(bySiblingPlace),
      folders: (await filesRepo.usableFolders(ctx.db, worldId)).map(folderView).sort(bySiblingPlace)
    }
  }),

  implement(listCommonFiles, async (ctx, { organizationId }) => {
    const place = authorizedCommon(ctx, false, organizationId ?? targetOrganization(ctx, undefined))
    return {
      files: (await withUses(ctx, await filesRepo.listFiles(ctx.db, scopeOf(place)))).sort(bySiblingPlace),
      folders: (await filesRepo.listFolders(ctx.db, scopeOf(place))).map(folderView).sort(bySiblingPlace)
    }
  }),

  implement(createFolder, async (ctx, { worldId, organizationId, parentId, name }) => {
    const place: FilePlace = worldId
      ? await authorizedWiki(ctx, 'page.write', worldId)
      : authorizedCommon(ctx, true, organizationId ?? '')
    await folderIn(ctx, place, parentId)
    try {
      const folder = await filesRepo.createFolder(
        ctx.db,
        historyContext(ctx, 'createFolder', { name }, historyScopeOf(place)),
        { organizationId: place.organizationId, worldId: place.worldId, parentId, name }
      )
      await filesTouched(ctx, place)
      return folderView(folder)
    } catch (error) {
      if (nameTaken(error)) throw folderTaken(name)
      throw error
    }
  }),

  implement(updateFolder, async (ctx, { folderId, name, parentId, before, after }) => {
    const { folder, place } = await authorizedFolder(ctx, true, folderId)
    if (parentId !== undefined && parentId !== null) {
      await folderIn(ctx, place, parentId)
      // Ni dentro de sí misma ni de una de las suyas
      for (let at: string | null = parentId; at; at = (await filesRepo.findFolder(ctx.db, at))?.parentId ?? null) {
        if (at === folderId) throw new InvalidRequestError('CYCLE')
      }
    }
    // Su puesto entre las carpetas de su destino (sin parentId, la de ahora); al cambiar de carpeta sin él, ninguno
    const destination = parentId === undefined ? folder.parentId : parentId
    const moves = destination !== folder.parentId
    const placed = await placeBeside(() => filesRepo.foldersIn(ctx.db, scopeOf(place), destination), folderId, {
      before,
      after
    })
    const renamed = name !== undefined && name !== folder.name
    // Solo reordenada: así lo dice el historial
    const [action, details] = renamed
      ? ['updateFolder', { from: folder.name, to: name }]
      : placed && !moves
        ? ['orderFolder', { name: folder.name }]
        : ['updateFolder', { name: folder.name }]
    try {
      const updated = await filesRepo.updateFolder(
        ctx.db,
        historyContext(ctx, action, details, historyScopeOf(place)),
        folderId,
        {
          ...(name !== undefined ? { name } : {}),
          ...(parentId !== undefined ? { parentId } : {}),
          ...(placed ? { position: placed.own } : moves ? { position: null } : {})
        },
        placed?.others
      )
      await filesTouched(ctx, place)
      return folderView(updated)
    } catch (error) {
      if (nameTaken(error)) throw folderTaken(name ?? folder.name)
      throw error
    }
  }),

  implement(deleteFolder, async (ctx, { folderId }) => {
    const { folder, place } = await authorizedFolder(ctx, true, folderId)
    await filesRepo.deleteFolder(
      ctx.db,
      historyContext(ctx, 'deleteFolder', { name: folder.name }, historyScopeOf(place)),
      folderId
    )
    await filesTouched(ctx, place)
    return { id: folder.id, name: folder.name }
  }),

  implement(deleteFiles, async (ctx, { fileIds, folderIds }) => {
    // Por ámbito (un mundo, o los comunes): cada uno, su operación
    const byPlace = new Map<string, { place: FilePlace; fileIds: string[]; folderIds: string[]; names: string[] }>()
    const groupOf = (place: FilePlace) => {
      const key = place.worldId ?? `org:${place.organizationId}`
      let group = byPlace.get(key)
      if (!group) {
        group = { place, fileIds: [], folderIds: [], names: [] }
        byPlace.set(key, group)
      }
      return group
    }
    for (const fileId of new Set(fileIds)) {
      const { file, place } = await authorizedFile(ctx, 'page.write', fileId)
      const group = groupOf(place)
      group.fileIds.push(file.id)
      group.names.push(file.name)
    }
    for (const folderId of new Set(folderIds)) {
      const { folder, place } = await authorizedFolder(ctx, true, folderId)
      const group = groupOf(place)
      group.folderIds.push(folder.id)
      group.names.push(folder.name)
    }
    let trashed = 0
    for (const { place, fileIds: files, folderIds: folders, names } of byPlace.values()) {
      trashed += await filesRepo.trashItems(
        ctx.db,
        historyContext(ctx, 'deleteFiles', { names, count: names.length }, historyScopeOf(place)),
        { fileIds: files, folderIds: folders }
      )
      await filesTouched(ctx, place)
    }
    return { files: trashed }
  }),

  implement(moveFile, async (ctx, { fileId, folderId, before, after }) => {
    const { file, place } = await authorizedFile(ctx, 'page.write', fileId)
    const folder = await folderIn(ctx, place, folderId)
    const moves = file.folderId !== folderId
    // Su puesto entre los archivos de esa carpeta; al cambiar de carpeta sin él, ninguno (detrás, por nombre)
    const placed = await placeBeside(() => filesRepo.filesIn(ctx.db, scopeOf(place), folderId), fileId, {
      before,
      after
    })
    if (!moves && !placed) return fileView(file)
    await filesRepo.moveFile(
      ctx.db,
      moves
        ? historyContext(ctx, 'moveFile', { name: file.name, folder: folder?.name ?? null }, historyScopeOf(place))
        : historyContext(ctx, 'orderFile', { name: file.name }, historyScopeOf(place)),
      fileId,
      { folderId, position: placed?.own ?? null },
      placed?.others
    )
    await filesTouched(ctx, place)
    const moved = await filesRepo.findFile(ctx.db, fileId)
    if (!moved) throw new NotFoundError('file')
    return fileView(moved)
  }),

  implement(renameFile, async (ctx, { fileId, name }) => {
    const { file, place } = await authorizedFile(ctx, 'page.write', fileId)
    if (name === file.name) return fileView(file)
    if ((await filesRepo.freeName(ctx.db, scopeOf(place), name, file.id)) !== name) throw notFree(name, place)
    const context: OperationContext = historyContext(
      ctx,
      'renameFile',
      { from: file.name, to: name },
      historyScopeOf(place)
    )
    try {
      await filesRepo.updateFile(ctx.db, context, fileId, { name })
    } catch (error) {
      if (nameTaken(error)) throw notFree(name, place)
      throw error
    }
    // Lo que esperaba a ese nombre lo encuentra
    await filesTouched(ctx, place, [name])
    const renamed = await filesRepo.findFile(ctx.db, fileId)
    if (!renamed) throw new NotFoundError('file')
    return fileView(renamed)
  }),

  implement(deleteFile, async (ctx, { fileId }) => {
    const { file, place } = await authorizedFile(ctx, 'page.write', fileId)
    await filesRepo.updateFile(
      ctx.db,
      historyContext(ctx, 'deleteFile', { name: file.name }, historyScopeOf(place)),
      fileId,
      { deletedAt: new Date() }
    )
    await filesTouched(ctx, place)
    return { id: file.id, name: file.name }
  }),

  implement(restoreFile, async (ctx, { fileId }) => {
    const { file, place } = await authorizedFile(ctx, 'page.write', fileId, { trashed: true })
    if (!file.deletedAt) return { id: file.id, name: file.name }
    // Si su nombre lo tiene ya otro, vuelve con un número
    const name = await withFreeName(ctx.db, { scope: scopeOf(place), name: file.name, except: file.id }, (free) =>
      filesRepo
        .updateFile(ctx.db, historyContext(ctx, 'restoreFile', { name: free }, historyScopeOf(place)), fileId, {
          deletedAt: null,
          ...(free !== file.name ? { name: free } : {})
        })
        .then(() => free)
    )
    await filesTouched(ctx, place, [name])
    return { id: file.id, name }
  })
]
