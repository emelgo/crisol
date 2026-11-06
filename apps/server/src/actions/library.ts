/**
 * La biblioteca (docs/specs/biblioteca.md): los PDF de un mundo y los comunes de su cuenta, como libros, y buscar
 * dentro de ellos. La ve quien ve sus archivos: los del mundo, quien lleva su wiki; los comunes, quien los ve
 */
import { getBookPages, type LibraryBook, listLibrary, readBookAgain, searchLibrary } from '@crisol/contracts'
import { filesRepo, libraryRepo, searchRepo } from '@crisol/db'
import { can } from '@crisol/domain'
import { authorizedWiki } from './access.ts'
import { type ActionContext, InvalidRequestError } from './context.ts'
import { authorizedFile } from './files.ts'
import { implement } from './registry.ts'

/** Lo que se ve de un mundo en la biblioteca: sus PDF y, si quien pide ve los comunes, los de su cuenta */
async function libraryScope(ctx: ActionContext, worldId: string) {
  const wiki = await authorizedWiki(ctx, 'page.read', worldId)
  const common = can(ctx.actor, 'commonFiles.read', { organizationId: wiki.organizationId })
  return { worldId, organizationId: wiki.organizationId, common }
}

/** Un PDF de la biblioteca, que se lee con quien puede ver o cambiar el archivo */
async function authorizedBook(ctx: ActionContext, capability: 'page.read' | 'page.write', fileId: string) {
  const { file } = await authorizedFile(ctx, capability, fileId)
  if (file.kind !== 'pdf') throw new InvalidRequestError('NOT_A_BOOK', 'no es un PDF')
  return file
}

export const libraryActions = [
  implement(listLibrary, async (ctx, { worldId }) => {
    const scope = await libraryScope(ctx, worldId)
    const found = [
      ...(await filesRepo.listFiles(ctx.db, { worldId })),
      ...(scope.common ? await filesRepo.listFiles(ctx.db, { organizationId: scope.organizationId }) : [])
    ].filter((file) => file.kind === 'pdf')
    const statuses = await libraryRepo.textStatuses(
      ctx.db,
      found.map((file) => file.id)
    )
    const books: LibraryBook[] = []
    for (const file of found) {
      const text = statuses.get(file.id)
      // Sin leer o cambiado después (otra huella): a la cola
      const stale = !text || text.hash !== file.hash
      if (stale) await ctx.library?.enqueue(file.id)
      books.push({
        fileId: file.id,
        name: file.name,
        common: file.worldId === null,
        size: file.size,
        status: stale ? 'pending' : text.status,
        pages: stale ? 0 : text.pages,
        read: stale ? 0 : text.read,
        error: stale ? null : text.error
      })
    }
    return { books }
  }),

  implement(searchLibrary, async (ctx, { worldId, query, fileId, limit = 10 }) => {
    const scope = await libraryScope(ctx, worldId)
    if (fileId) await authorizedBook(ctx, 'page.read', fileId)
    const terms = searchRepo.searchTerms(query).map((word) => [word])
    const books = await libraryRepo.searchBooks(
      ctx.db,
      { worldId, organizationId: scope.organizationId, common: scope.common, ...(fileId ? { fileId } : {}) },
      terms,
      { books: limit, pages: 3 }
    )
    return {
      books: books.map((book) => ({
        ...book,
        pages: book.pages.map(({ page, excerpt }) => ({ page, excerpt, semantic: false }))
      }))
    }
  }),

  implement(getBookPages, async (ctx, { fileId, from, to }) => {
    const file = await authorizedBook(ctx, 'page.read', fileId)
    if (to < from) throw new InvalidRequestError('BAD_RANGE', 'la última página va después de la primera')
    if (to - from >= 20) throw new InvalidRequestError('TOO_MANY_PAGES', 'como mucho, 20 páginas de una vez')
    const status = (await libraryRepo.textStatuses(ctx.db, [fileId])).get(fileId)
    const text = await libraryRepo.bookPages(ctx.db, fileId, from, to)
    return { name: file.name, status: status?.status ?? 'pending', pages: status?.pages ?? 0, text }
  }),

  implement(readBookAgain, async (ctx, { fileId }) => {
    const file = await authorizedBook(ctx, 'page.write', fileId)
    await libraryRepo.setTextStatus(ctx.db, fileId, { status: 'pending', hash: file.hash })
    await ctx.library?.enqueue(fileId)
    return { status: 'pending' as const }
  })
]
