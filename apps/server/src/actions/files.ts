/**
 * Los archivos del mundo: la lista, renombrar, mandar a la papelera y restaurar. Subir y reemplazar van por sus rutas
 * (files/routes.ts): los bytes no caben en una acción
 */
import { deleteFile, type FileView, listFiles, renameFile, restoreFile } from '@crisol/contracts'
import { filesRepo, linksRepo, type OperationContext } from '@crisol/db'
import { NotFoundError } from '@crisol/domain'
import { filesChanged } from '../realtime/events.ts'
import { resolvePendingFiles } from '../wiki/file-embeds.ts'
import { authorizedWiki } from './access.ts'
import { historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

type FileRow = NonNullable<Awaited<ReturnType<typeof filesRepo.findFile>>>

export const fileView = (row: FileRow): FileView => ({
  id: row.id,
  worldId: row.worldId,
  name: row.name,
  kind: row.kind,
  mime: row.mime,
  size: row.size,
  url: `/api/files/${row.id}`,
  version: row.version,
  updatedAt: row.updatedAt.toISOString()
})

/** El nombre ya lo tiene otro archivo del mundo (el índice único, si dos llegan a la vez) */
export function nameTaken(error: unknown): boolean {
  for (let e = error as { code?: string; cause?: unknown } | undefined; e; e = e.cause as typeof e) {
    if (e.code === '23505') return true
  }
  return false
}

/**
 * Pone un archivo con un nombre libre: el pedido o, si está, con un número. Si otro se lo quita entre medias, lo
 * vuelve a intentar
 */
export async function withFreeName<T>(
  db: Parameters<typeof filesRepo.freeName>[0],
  file: { worldId: string; name: string; except?: string },
  write: (name: string) => Promise<T>
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const name = await filesRepo.freeName(db, file.worldId, file.name, file.except)
    try {
      return await write(name)
    } catch (error) {
      if (!nameTaken(error) || attempt >= 4) throw error
    }
  }
}

/** El archivo (fuera de la papelera) y la wiki de su mundo, si la cuenta puede hacer eso en ella. Si no, 404 */
export async function authorizedFile(
  ctx: Parameters<typeof authorizedWiki>[0],
  capability: 'page.read' | 'page.write',
  fileId: string,
  options: { trashed?: boolean } = {}
) {
  const file = fileId ? await filesRepo.findFile(ctx.db, fileId, options) : null
  const wiki = await authorizedWiki(ctx, capability, file?.worldId ?? '')
  if (!file) throw new NotFoundError('file')
  return { file, wiki }
}

export const fileActions = [
  implement(listFiles, async (ctx, { worldId }) => {
    await authorizedWiki(ctx, 'page.read', worldId)
    const uses = await linksRepo.fileUses(ctx.db, worldId)
    const rows = await filesRepo.listFiles(ctx.db, worldId)
    return { files: rows.map((row) => ({ ...fileView(row), usedBy: uses.get(row.id) ?? 0 })) }
  }),

  implement(renameFile, async (ctx, { fileId, name }) => {
    const { file, wiki } = await authorizedFile(ctx, 'page.write', fileId)
    if (name === file.name) return fileView(file)
    if ((await filesRepo.freeName(ctx.db, file.worldId, name, file.id)) !== name) {
      throw new InvalidRequestError('NAME_TAKEN', `Ya hay un archivo «${name}» en el mundo`)
    }
    const context: OperationContext = historyContext(ctx, 'renameFile', { from: file.name, to: name }, wiki)
    try {
      await filesRepo.updateFile(ctx.db, context, fileId, { name })
    } catch (error) {
      if (nameTaken(error)) throw new InvalidRequestError('NAME_TAKEN', `Ya hay un archivo «${name}» en el mundo`)
      throw error
    }
    ctx.realtime.publish(filesChanged(wiki))
    // Lo que esperaba a ese nombre lo encuentra
    await resolvePendingFiles(ctx, wiki.worldId, ctx.actor.userId, [name])
    const renamed = await filesRepo.findFile(ctx.db, fileId)
    if (!renamed) throw new NotFoundError('file')
    return fileView(renamed)
  }),

  implement(deleteFile, async (ctx, { fileId }) => {
    const { file, wiki } = await authorizedFile(ctx, 'page.write', fileId)
    await filesRepo.updateFile(ctx.db, historyContext(ctx, 'deleteFile', { name: file.name }, wiki), fileId, {
      deletedAt: new Date()
    })
    ctx.realtime.publish(filesChanged(wiki))
    return { id: file.id, name: file.name }
  }),

  implement(restoreFile, async (ctx, { fileId }) => {
    const { file, wiki } = await authorizedFile(ctx, 'page.write', fileId, { trashed: true })
    if (!file.deletedAt) return { id: file.id, name: file.name }
    // Si su nombre lo tiene ya otro, vuelve con un número
    const name = await withFreeName(ctx.db, { worldId: file.worldId, name: file.name, except: file.id }, (free) =>
      filesRepo
        .updateFile(ctx.db, historyContext(ctx, 'restoreFile', { name: free }, wiki), fileId, {
          deletedAt: null,
          ...(free !== file.name ? { name: free } : {})
        })
        .then(() => free)
    )
    ctx.realtime.publish(filesChanged(wiki))
    await resolvePendingFiles(ctx, wiki.worldId, ctx.actor.userId, [name])
    return { id: file.id, name }
  })
]
