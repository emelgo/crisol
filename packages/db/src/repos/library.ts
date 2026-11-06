/**
 * La biblioteca (docs/specs/biblioteca.md): el texto de los PDF por página, cómo va su lectura y buscar en ellos. Sale
 * de los archivos: no pasa por el historial
 */
import { and, asc, eq, gte, inArray, isNull, lte, notInArray, type SQL, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { files } from '../schema/files.ts'
import { filePages, fileTexts, searchChunks } from '../schema/library.ts'
import type { PlayerScope } from './search.ts'
import { tsQuery } from './search.ts'

export type TextStatus = (typeof fileTexts.$inferSelect)['status']

/** Lo que se lee o espera desde hace tanto se da por perdido (una cola que se vació, un servidor que se paró) */
export const STALE_MINUTES = 20

/**
 * Los PDF que hay que leer, de tanda en tanda por su id: los que no se han leído, los cambiados después (otra huella)
 * y los que se quedaron a medias (leyendo o pendientes hace mucho), fuera de la papelera
 */
export async function pdfsToRead(db: Database, after: string | null = null, limit = 200) {
  return db
    .select({ id: files.id, hash: files.hash })
    .from(files)
    .leftJoin(fileTexts, eq(fileTexts.fileId, files.id))
    .where(
      and(
        eq(files.kind, 'pdf'),
        isNull(files.deletedAt),
        after ? sql`${files.id} > ${after}` : undefined,
        sql`(${fileTexts.fileId} is null or ${fileTexts.hash} <> ${files.hash}
          or (${fileTexts.status} in ('pending', 'reading')
            and ${fileTexts.updatedAt} < now() - make_interval(mins => ${STALE_MINUTES})))`
      )
    )
    .orderBy(asc(files.id))
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

/** Un vector como lo lee pgvector */
const vectorLiteral = (vector: readonly number[]) => `[${vector.map((x) => x.toFixed(7)).join(',')}]`

/**
 * Los trozos de un libro, como quedan: los que siguen igual (misma huella) guardan su vector; los nuevos, sin él; los
 * que ya no están, fuera
 */
export async function syncBookChunks(
  db: Database,
  file: { id: string; organizationId: string; worldId: string | null },
  pieces: readonly { page: number; position: number; text: string; hash: string }[]
) {
  await db.transaction(async (tx) => {
    const hashes = pieces.map((p) => p.hash)
    await tx
      .delete(searchChunks)
      .where(
        and(eq(searchChunks.fileId, file.id), hashes.length > 0 ? notInArray(searchChunks.hash, hashes) : undefined)
      )
    const kept = new Set(
      (await tx.select({ hash: searchChunks.hash }).from(searchChunks).where(eq(searchChunks.fileId, file.id))).map(
        (row) => row.hash
      )
    )
    const fresh = pieces.filter((p) => !kept.has(p.hash))
    for (let i = 0; i < fresh.length; i += 200)
      await tx.insert(searchChunks).values(
        fresh.slice(i, i + 200).map((p) => ({
          organizationId: file.organizationId,
          worldId: file.worldId,
          source: 'book' as const,
          fileId: file.id,
          page: p.page,
          position: p.position,
          text: p.text,
          hash: p.hash
        }))
      )
  })
}

/** La huella de una sección de la wiki, como la calcula Postgres: su sitio, su título y su texto */
const sectionHash = sql`md5(s.position::text || E'\n' || coalesce(s.heading_id, '') || E'\n' || coalesce(s.heading, '') || E'\n' || s.body)`

/**
 * Los trozos de la wiki, sacados de sus secciones (lo del cuerpo, las pestañas y los secretos; un trozo por sección,
 * su título delante): los que cambiaron, de nuevo y sin vector; los de secciones que ya no están, fuera. De esos
 * documentos (los que se acaban de guardar) o, sin decirlos, de todos (al arrancar)
 */
export async function syncWikiChunks(db: Database, documentIds?: readonly string[]) {
  if (documentIds && documentIds.length === 0) return
  const ids = documentIds
    ? sql`(${sql.join(
        documentIds.map((id) => sql`${id}::uuid`),
        sql`, `
      )})`
    : null
  await db.execute(sql`
    delete from search_chunks c where c.source = 'page' ${ids ? sql`and c.document_id in ${ids}` : sql``}
      and not exists (select 1 from search_sections s where s.document_id = c.document_id and ${sectionHash} = c.hash)`)
  await db.execute(sql`
    insert into search_chunks (organization_id, world_id, source, document_id, page_id, heading_id, position, kind, text, hash)
    select w.organization_id, s.world_id, 'page', s.document_id, s.page_id, s.heading_id, s.position, s.kind,
      left(coalesce(s.heading || E'\n', '') || s.body, 2000), ${sectionHash}
    from search_sections s join worlds w on w.id = s.world_id
    where s.kind in ('body', 'tab', 'secret') and length(s.body) >= 30 ${ids ? sql`and s.document_id in ${ids}` : sql``}
      and not exists (select 1 from search_chunks c where c.document_id = s.document_id and c.hash = ${sectionHash})`)
}

/** Unos trozos que aún no tienen vector (los que el modelo no pudo, aparte) */
export function pendingChunks(db: Database, limit: number) {
  return db
    .select({ id: searchChunks.id, text: searchChunks.text })
    .from(searchChunks)
    .where(and(isNull(searchChunks.embedding), eq(searchChunks.failed, false)))
    .limit(limit)
}

/** Uno con el que el modelo no pudo: no se vuelve a intentar hasta que cambie (otra huella, otro trozo) */
export async function markChunkFailed(db: Database, id: string) {
  await db.update(searchChunks).set({ failed: true }).where(eq(searchChunks.id, id))
}

/** Sus vectores, ya calculados */
export async function setEmbeddings(db: Database, rows: readonly { id: string; vector: readonly number[] }[]) {
  for (const row of rows)
    await db.execute(
      sql`update search_chunks set embedding = ${vectorLiteral(row.vector)}::vector where id = ${row.id}`
    )
}

/**
 * Lo más cercano a un vector con el índice HNSW y un filtro (el mundo, los comunes): con el recorrido iterativo de
 * pgvector, que sigue buscando hasta llenar lo pedido (si no, con un filtro que deja pocos trozos, salen muy pocos)
 */
function nearest<T>(db: Database, query: SQL) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local hnsw.iterative_scan = relaxed_order`)
    await tx.execute(sql`set local hnsw.ef_search = 100`)
    return [...(await tx.execute<T & Record<string, unknown>>(query))]
  })
}

/** Los trozos de libros más cercanos a un vector, en lo que ve quien busca: su libro, su página y su parecido */
export async function nearestBookChunks(db: Database, scope: LibraryScope, vector: readonly number[], limit: number) {
  const where = sql.join(
    [
      ...(scope.worldId ? [sql`f.world_id = ${scope.worldId}`] : []),
      ...(scope.common ? [sql`(f.world_id is null and f.organization_id = ${scope.organizationId})`] : [])
    ],
    sql` or `
  )
  const target = sql`${vectorLiteral(vector)}::vector`
  // El recorrido iterativo puede desordenar un poco: se ordena otra vez fuera
  const rows = await nearest<{
    file_id: string
    name: string
    world_id: string | null
    page: number
    text: string
    distance: number
  }>(
    db,
    sql`select * from (
      select c.file_id, f.name, f.world_id, c.page, c.text, (c.embedding <=> ${target})::float8 as distance
      from search_chunks c join files f on f.id = c.file_id
      where c.source = 'book' and c.embedding is not null and f.deleted_at is null and (${where})
        ${scope.fileId ? sql`and f.id = ${scope.fileId}` : sql``}
      order by c.embedding <=> ${target}
      limit ${limit}
    ) near order by distance`
  )
  return rows.map((row) => ({
    fileId: row.file_id,
    name: row.name,
    common: row.world_id === null,
    page: row.page,
    text: row.text,
    similarity: 1 - row.distance
  }))
}

/** Las páginas de la wiki de un mundo más cercanas a un vector (por su mejor sección), fuera de la papelera */
export async function nearestPages(
  db: Database,
  worldId: string,
  vector: readonly number[],
  limit: number,
  /** Un jugador: solo lo que ve (ADR-0017) */
  player?: PlayerScope | null
) {
  const target = sql`${vectorLiteral(vector)}::vector`
  const own = player
    ? sql`and c.page_id = any(string_to_array(${player.pages.join(',')}, ',')::uuid[])
        and (c.kind = 'body' or c.document_id = any(string_to_array(${player.separates.join(',')}, ',')::uuid[]))`
    : sql``
  const rows = await nearest<{ page_id: string; title: string; distance: number }>(
    db,
    sql`select page_id, title, min(distance)::float8 as distance from (
      select c.page_id, p.title, (c.embedding <=> ${target}) as distance
      from search_chunks c join pages p on p.id = c.page_id
      where c.source = 'page' and c.world_id = ${worldId} and c.embedding is not null and p.deleted_at is null ${own}
      order by c.embedding <=> ${target}
      limit ${limit * 4}
    ) near group by page_id, title order by distance limit ${limit}`
  )
  return rows.map((row) => ({ pageId: row.page_id, title: row.title, similarity: 1 - row.distance }))
}
