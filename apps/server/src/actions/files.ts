/**
 * Los archivos: la lista, renombrar, mandar a la papelera y restaurar. Son de un mundo o comunes a los de su
 * organización (ADR-0005). Subir y reemplazar van por sus rutas (files/routes.ts): los bytes no caben en una acción
 */
import { deleteFile, type FileView, listCommonFiles, listFiles, renameFile, restoreFile } from '@crisol/contracts'
import { type FileScope, filesRepo, linksRepo, type OperationContext, worldsRepo } from '@crisol/db'
import { authorize, NotFoundError } from '@crisol/domain'
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
  kind: row.kind,
  mime: row.mime,
  size: row.size,
  url: `/api/files/${row.id}`,
  version: row.version,
  updatedAt: row.updatedAt.toISOString()
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

/** Para el historial: el mundo o, con un común, solo su organización */
const historyScope = (place: FilePlace) => (place.worldId ? place : { organizationId: place.organizationId })

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
  implement(listFiles, async (ctx, { worldId }) => {
    await authorizedWiki(ctx, 'page.read', worldId)
    return { files: await withUses(ctx, await filesRepo.usableFiles(ctx.db, worldId), worldId) }
  }),

  implement(listCommonFiles, async (ctx, { organizationId }) => {
    const place = authorizedCommon(ctx, false, organizationId ?? targetOrganization(ctx, undefined))
    return { files: await withUses(ctx, await filesRepo.listFiles(ctx.db, scopeOf(place))) }
  }),

  implement(renameFile, async (ctx, { fileId, name }) => {
    const { file, place } = await authorizedFile(ctx, 'page.write', fileId)
    if (name === file.name) return fileView(file)
    if ((await filesRepo.freeName(ctx.db, scopeOf(place), name, file.id)) !== name) throw notFree(name, place)
    const context: OperationContext = historyContext(
      ctx,
      'renameFile',
      { from: file.name, to: name },
      historyScope(place)
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
      historyContext(ctx, 'deleteFile', { name: file.name }, historyScope(place)),
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
        .updateFile(ctx.db, historyContext(ctx, 'restoreFile', { name: free }, historyScope(place)), fileId, {
          deletedAt: null,
          ...(free !== file.name ? { name: free } : {})
        })
        .then(() => free)
    )
    await filesTouched(ctx, place, [name])
    return { id: file.id, name }
  })
]
