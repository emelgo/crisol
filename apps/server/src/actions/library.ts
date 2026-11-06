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

/** Lo que se parece de verdad: lo de debajo, aunque sea lo más cercano, no se enseña */
const SIMILAR = 0.78
/** El peso del puesto en la mezcla por rango (RRF) */
const RRF = 60

type Hit = { page: number; excerpt: string; semantic: boolean; score: number }

/**
 * Por palabras y por significado, mezclados por su puesto (RRF): una página que sale de las dos maneras suma las dos;
 * la que sale solo por significado lleva su marca y el principio de su trozo como fragmento
 */
function mergeBooks(
  byWords: Awaited<ReturnType<typeof libraryRepo.searchBooks>>,
  near: Awaited<ReturnType<typeof libraryRepo.nearestBookChunks>>,
  limit: number
) {
  const books = new Map<string, { fileId: string; name: string; common: boolean; hits: Map<number, Hit> }>()
  const bookOf = (fileId: string, name: string, common: boolean) => {
    const found = books.get(fileId) ?? { fileId, name, common, hits: new Map<number, Hit>() }
    books.set(fileId, found)
    return found
  }
  let rank = 0
  for (const book of byWords)
    for (const page of book.pages) {
      const hits = bookOf(book.fileId, book.name, book.common).hits
      hits.set(page.page, { page: page.page, excerpt: page.excerpt, semantic: false, score: 1 / (RRF + rank++) })
    }
  rank = 0
  for (const chunk of near) {
    if (chunk.similarity < SIMILAR) continue
    const hits = bookOf(chunk.fileId, chunk.name, chunk.common).hits
    const score = 1 / (RRF + rank++)
    const seen = hits.get(chunk.page)
    if (seen) seen.score += score
    else {
      const excerpt = chunk.text.length > 220 ? `${chunk.text.slice(0, 220).replace(/\s+\S*$/, '')}…` : chunk.text
      hits.set(chunk.page, { page: chunk.page, excerpt: excerpt.replace(/\s+/g, ' '), semantic: true, score })
    }
  }
  return [...books.values()]
    .map((book) => {
      const pages = [...book.hits.values()].sort((a, b) => b.score - a.score).slice(0, 3)
      return { book, pages, best: pages[0]?.score ?? 0 }
    })
    .filter((entry) => entry.pages.length > 0)
    .sort((a, b) => b.best - a.best)
    .slice(0, limit)
    .map(({ book, pages }) => ({
      fileId: book.fileId,
      name: book.name,
      common: book.common,
      pages: pages.map(({ score: _, ...hit }) => hit)
    }))
}

/** Las páginas de la wiki por palabras y por significado, mezcladas igual (como mucho cinco) */
function mergePages(
  byWords: readonly { pageId: string; title: string }[],
  near: Awaited<ReturnType<typeof libraryRepo.nearestPages>>
) {
  const scores = new Map<string, { pageId: string; title: string; score: number }>()
  byWords.forEach((page, i) => {
    scores.set(page.pageId, { ...page, score: 1 / (RRF + i) })
  })
  near
    .filter((page) => page.similarity >= SIMILAR)
    .forEach((page, i) => {
      const seen = scores.get(page.pageId)
      if (seen) seen.score += 1 / (RRF + i)
      else scores.set(page.pageId, { pageId: page.pageId, title: page.title, score: 1 / (RRF + i) })
    })
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ score: _, ...page }) => page)
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
      // Sin leer, cambiado después (otra huella) o que se quedó a medias hace mucho: a la cola
      const stuck =
        text &&
        (text.status === 'pending' || text.status === 'reading') &&
        Date.now() - text.updatedAt.getTime() > libraryRepo.STALE_MINUTES * 60_000
      const stale = !text || text.hash !== file.hash || Boolean(stuck)
      if (stale) await ctx.library?.enqueue(file.id)
      books.push({
        fileId: file.id,
        name: file.name,
        url: `/api/files/${file.id}?v=${file.version}`,
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
    const words = searchRepo.searchTerms(query)
    const where = { worldId, organizationId: scope.organizationId, common: scope.common, ...(fileId ? { fileId } : {}) }
    // Por sus palabras
    const byWords = await libraryRepo.searchBooks(
      ctx.db,
      where,
      words.map((word) => [word]),
      { books: limit, pages: 5 }
    )
    const wikiWords = fileId
      ? []
      : (
          await searchRepo.searchPages(ctx.db, {
            worldId,
            terms: await searchRepo.similarWords(ctx.db, worldId, words),
            offset: 0,
            limit: 5
          })
        ).pages.map((page) => ({ pageId: page.id, title: page.title }))
    // Por su significado (si está el modelo; si falla, se sigue por palabras)
    let vector: number[] | null = null
    try {
      vector = ctx.embedder ? ((await ctx.embedder.embed([query], 'query'))[0] ?? null) : null
    } catch {
      vector = null
    }
    const near = vector ? await libraryRepo.nearestBookChunks(ctx.db, where, vector, 40) : []
    const nearPages = vector && !fileId ? await libraryRepo.nearestPages(ctx.db, worldId, vector, 5) : []
    return {
      books: mergeBooks(byWords, near, limit),
      pages: mergePages(wikiWords, nearPages),
      semantic: vector !== null
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
