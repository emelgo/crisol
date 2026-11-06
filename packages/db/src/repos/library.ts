/**
 * La biblioteca (docs/specs/biblioteca.md): el texto de los PDF por página, cómo va su lectura y buscar en ellos. Sale
 * de los archivos: no pasa por el historial
 */
import { and, asc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { files } from '../schema/files.ts'
import { filePages, fileTexts } from '../schema/library.ts'
import { tsQuery } from './search.ts'

export type TextStatus = (typeof fileTexts.$inferSelect)['status']

/** Los PDF que hay que leer: los que no se han leído o se cambiaron después (otra huella), fuera de la papelera */
export async function pdfsToRead(db: Database, limit = 200) {
  return db
    .select({ id: files.id, hash: files.hash })
    .from(files)
    .leftJoin(fileTexts, eq(fileTexts.fileId, files.id))
    .where(
      and(
        eq(files.kind, 'pdf'),
        isNull(files.deletedAt),
        sql`(${fileTexts.fileId} is null or ${fileTexts.hash} <> ${files.hash})`
      )
    )
    .limit(limit)
}

/** Cómo va la lectura de un PDF (se crea o se cambia) */
export async function setTextStatus(
  db: Database,
  fileId: string,
  values: { status: TextStatus; hash: string; pages?: number; read?: number; error?: string | null }
) {
  const set = { ...values, error: values.error ?? null, updatedAt: new Date() }
  await db
    .insert(fileTexts)
    .values({ fileId, ...set })
    .onConflictDoUpdate({ target: fileTexts.fileId, set })
}

/** Su texto, página a página (lo de antes se va), y su estado, en una transacción */
export async function savePages(db: Database, fileId: string, hash: string, pages: readonly string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(filePages).where(eq(filePages.fileId, fileId))
    const rows = pages.map((text, i) => ({ fileId, page: i + 1, text })).filter((row) => row.text.length > 0)
    for (let i = 0; i < rows.length; i += 200) await tx.insert(filePages).values(rows.slice(i, i + 200))
    const status: TextStatus = rows.length > 0 ? 'done' : 'empty'
    const set = { status, hash, pages: pages.length, read: pages.length, error: null, updatedAt: new Date() }
    await tx
      .insert(fileTexts)
      .values({ fileId, ...set })
      .onConflictDoUpdate({ target: fileTexts.fileId, set })
  })
}

/** Cómo va la lectura de unos archivos */
export async function textStatuses(db: Database, fileIds: readonly string[]) {
  if (fileIds.length === 0) return new Map<string, typeof fileTexts.$inferSelect>()
  const rows = await db
    .select()
    .from(fileTexts)
    .where(inArray(fileTexts.fileId, [...fileIds]))
  return new Map(rows.map((row) => [row.fileId, row]))
}

/** Dónde se busca: los de un mundo, los comunes de su organización, o los dos */
export interface LibraryScope {
  worldId: string | null
  organizationId: string
  common: boolean
  fileId?: string
}

/** Lo que coincide en los libros: por libro (el que más, antes), sus mejores páginas con su fragmento marcado con ** */
export async function searchBooks(
  db: Database,
  scope: LibraryScope,
  terms: readonly string[][],
  options: { books: number; pages: number }
) {
  if (terms.length === 0) return []
  const query = tsQuery(terms)
  const where = sql.join(
    [
      ...(scope.worldId ? [sql`f.world_id = ${scope.worldId}`] : []),
      ...(scope.common ? [sql`(f.world_id is null and f.organization_id = ${scope.organizationId})`] : [])
    ],
    sql` or `
  )
  const rows = await db.execute<{
    file_id: string
    name: string
    world_id: string | null
    page: number
    excerpt: string
    rank: number
    book_rank: number
  }>(sql`
    with q as (select ${query} as query),
    hits as (
      select p.file_id, p.page, p.text, ts_rank(p.tsv, q.query) as rank
      from file_pages p join files f on f.id = p.file_id, q
      where p.tsv @@ q.query and f.deleted_at is null and f.kind = 'pdf' and (${where})
        ${scope.fileId ? sql`and f.id = ${scope.fileId}` : sql``}
    ),
    books as (
      select file_id, max(rank) as book_rank from hits group by file_id
      order by max(rank) desc limit ${options.books}
    ),
    ranked as (
      select h.*, b.book_rank, row_number() over (partition by h.file_id order by h.rank desc, h.page) as n
      from hits h join books b on b.file_id = h.file_id
    )
    select r.file_id, f.name, f.world_id, r.page, r.rank::float8 as rank, r.book_rank::float8 as book_rank,
      ts_headline('es_unaccent'::regconfig, r.text, q.query,
        'StartSel=**, StopSel=**, MaxWords=30, MinWords=12, MaxFragments=1, FragmentDelimiter=" … "') as excerpt
    from ranked r join files f on f.id = r.file_id, q
    where r.n <= ${options.pages}
    order by r.book_rank desc, r.file_id, r.n`)
  const books = new Map<
    string,
    { fileId: string; name: string; common: boolean; pages: { page: number; excerpt: string; rank: number }[] }
  >()
  for (const row of rows) {
    const book = books.get(row.file_id) ?? {
      fileId: row.file_id,
      name: row.name,
      common: row.world_id === null,
      pages: []
    }
    book.pages.push({ page: row.page, excerpt: row.excerpt, rank: row.rank })
    books.set(row.file_id, book)
  }
  return [...books.values()]
}

/** El texto de unas páginas de un libro (las que lo tienen) */
export function bookPages(db: Database, fileId: string, from: number, to: number) {
  return db
    .select({ page: filePages.page, text: filePages.text })
    .from(filePages)
    .where(and(eq(filePages.fileId, fileId), gte(filePages.page, from), lte(filePages.page, to)))
    .orderBy(asc(filePages.page))
}
