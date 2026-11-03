/**
 * La búsqueda de la wiki (ADR-0003): en Postgres, en español sin tildes. Cada documento se indexa por secciones; las
 * páginas, por su título y sus propiedades. Las erratas se arreglan ampliando cada palabra con las parecidas del mundo
 */
import { eq, inArray, type SQL, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { documents } from '../schema/documents.ts'
import { searchSections } from '../schema/search.ts'

export interface SectionRow {
  heading: string | null
  headingId: string | null
  body: string
}

/** Lo más que se indexa de una sección: más no cabe en un vector de búsqueda (1 MB) */
const MAX_SECTION = 200_000
const bounded = (section: SectionRow): SectionRow => ({ ...section, body: section.body.slice(0, MAX_SECTION) })

/** Rehace las secciones de un documento (su página, su mundo y su tipo salen de él) */
export async function replaceSections(db: Database, documentId: string, sections: readonly SectionRow[]) {
  await db.transaction(async (tx) => {
    const [doc] = await tx
      .select({ worldId: documents.worldId, pageId: documents.pageId, kind: documents.kind })
      .from(documents)
      .where(eq(documents.id, documentId))
    await tx.delete(searchSections).where(eq(searchSections.documentId, documentId))
    if (!doc || sections.length === 0) return
    await tx
      .insert(searchSections)
      .values(sections.map((section, position) => ({ ...doc, documentId, position, ...bounded(section) })))
  })
}

/** Rehace las secciones de muchos documentos de una vez (los de una tanda de páginas nuevas) */
export async function replaceSectionsMany(
  db: Database,
  items: readonly { documentId: string; sections: readonly SectionRow[] }[]
) {
  if (items.length === 0) return
  const ids = items.map((item) => item.documentId)
  await db.transaction(async (tx) => {
    const docs = await tx
      .select({ id: documents.id, worldId: documents.worldId, pageId: documents.pageId, kind: documents.kind })
      .from(documents)
      .where(inArray(documents.id, ids))
    const byId = new Map(docs.map((doc) => [doc.id, doc]))
    await tx.delete(searchSections).where(inArray(searchSections.documentId, ids))
    const rows = items.flatMap((item) => {
      const doc = byId.get(item.documentId)
      if (!doc) return []
      return item.sections.map((section, position) => ({
        worldId: doc.worldId,
        pageId: doc.pageId,
        kind: doc.kind,
        documentId: doc.id,
        position,
        ...bounded(section)
      }))
    })
    // De mil en mil: un INSERT con demasiados parámetros no cabe
    for (let i = 0; i < rows.length; i += 1000) await tx.insert(searchSections).values(rows.slice(i, i + 1000))
  })
}

/**
 * Los documentos del mundo sin indexar: sin texto todavía, o con texto y sin secciones (lo de antes de la búsqueda).
 * Con su estado, para sacar su contenido
 */
export async function unindexedDocuments(db: Database, worldId: string) {
  const rows = await db.execute<{
    id: string
    page_id: string
    kind: 'body' | 'secret' | 'note' | 'tab'
    state: Buffer
  }>(sql`
    select d.id, d.page_id, d.kind, d.state from documents d
    where d.world_id = ${worldId}
      and (d.text is null or (d.text <> '' and not exists (select 1 from search_sections s where s.document_id = d.id)))`)
  return [...rows].map((row) => ({ id: row.id, pageId: row.page_id, kind: row.kind, state: new Uint8Array(row.state) }))
}

/** La palabra tal cual se busca: sin tildes ni mayúsculas, solo letras y cifras */
export const searchTerms = (query: string) =>
  query
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0 && word.length <= 64)
    .slice(0, 8)

/**
 * Cada palabra con las del mundo que pueden ser ella con una errata (por trigramas y a una o dos letras de distancia)
 * y, la última que se escribe, con las que empiezan por ella. Primero la misma. Todas en una consulta
 */
export async function similarWords(db: Database, worldId: string, words: readonly string[]) {
  const long = words.map((word, i) => ({ word, i })).filter(({ word }) => word.length >= 3)
  if (long.length === 0) return words.map((word) => [word])
  const last = words.length - 1
  const rows = await db.transaction(async (tx) => {
    await tx.execute(sql`set local pg_trgm.similarity_threshold = 0.2`)
    return tx.execute<{ i: number; word: string }>(sql`
      select q.i, w.word from (values ${sql.join(
        long.map(({ word, i }) => sql`(${i}::int, ${word}::text, ${word.length >= 6 ? 2 : 1}::int)`),
        sql`, `
      )}) as q(i, term, distance)
      cross join lateral (
        (select word from search_words
          where world_id = ${worldId} and word % q.term and levenshtein(word, q.term) <= q.distance
          order by levenshtein(word, q.term), word limit 5)
        union
        (select word from search_words
          where q.i = ${last} and world_id = ${worldId} and word like q.term || '%'
          order by length(word) limit 5)
      ) w`)
  })
  return words.map((word, i) => [...new Set([word, ...[...rows].filter((row) => row.i === i).map((row) => row.word)])])
}

/** La consulta: cada palabra con sus alternativas (la que se está escribiendo, también por su principio) */
function tsQuery(terms: readonly string[][]): SQL {
  return sql.join(
    terms.map((alternatives, i) => {
      const last = i === terms.length - 1
      const parts = alternatives.map(
        (word, j) => sql`to_tsquery('es_unaccent'::regconfig, ${last && j === 0 ? `${word}:*` : word})`
      )
      return sql`(${sql.join(parts, sql` || `)})`
    }),
    sql` && `
  )
}

export interface SearchOptions {
  worldId: string
  /** Por palabra, sus alternativas (de similarWords) */
  terms: readonly string[][]
  tag?: string | null
  branchId?: string | null
  /** Solo las de esta plantilla o sus copias, y las que la llevan en este campo de enlace (ADR-0009) */
  template?: string | null
  link?: { field: string; pageId: string } | null
  offset: number
  limit: number
}

/** Las condiciones de plantilla y de campo, sobre la página p */
const templateFilter = (options: Pick<SearchOptions, 'template' | 'link'>) => sql`
  ${options.template ? sql`and p.template_line @> array[${options.template}]::text[]` : sql``}
  ${
    options.link
      ? sql`and p.properties @> ${JSON.stringify([{ field: options.link.field, value: [options.link.pageId] }])}::jsonb`
      : sql``
  }`

/** Sin nada que buscar: las páginas de una plantilla (y de un campo), por título, con el total */
export async function templatePages(db: Database, options: Omit<SearchOptions, 'terms'>) {
  const rows = await db.execute<{ id: string; title: string; icon: string | null; total: number }>(sql`
    select p.id, p.title, p.icon, (count(*) over ())::int as total from pages p
    where p.world_id = ${options.worldId} and p.deleted_at is null ${templateFilter(options)}
    order by lower(p.title), p.id
    offset ${options.offset} limit ${options.limit}`)
  const pages = [...rows]
  return { total: pages[0]?.total ?? 0, pages: pages.map(({ total: _total, ...page }) => ({ ...page, score: 0 })) }
}

/** Lo de una pestaña de texto cuenta solo mientras la pestaña exista (quitada, su documento queda para deshacer) */
const liveTab = sql`(s.kind <> 'tab' or exists (select 1 from page_tabs t where t.document_id = s.document_id))`

/** Las páginas que coinciden, de la que más a la que menos, con el total */
export async function searchPages(db: Database, options: SearchOptions) {
  if (options.terms.length === 0) return { total: 0, pages: [] }
  const query = tsQuery(options.terms)
  const tag = options.tag?.trim().toLowerCase() ?? ''
  const rows = await db.execute<{ id: string; title: string; icon: string | null; score: number; total: number }>(sql`
    with q as (select ${query} as query),
    hits as (
      select s.page_id, ts_rank(s.tsv, q.query) as rank
        from search_sections s, q where s.world_id = ${options.worldId} and s.tsv @@ q.query and ${liveTab}
      union all
      -- El título y las propiedades cuentan como el título de una sección, y el doble
      select p.id, 2 * ts_rank(p.search_tsv, q.query)
        from pages p, q
        where p.world_id = ${options.worldId} and p.deleted_at is null and p.search_tsv @@ q.query
    ),
    scored as (select page_id, max(rank) as score from hits group by page_id)
    select p.id, p.title, p.icon, scored.score::float8 as score, (count(*) over ())::int as total
    from scored join pages p on p.id = scored.page_id
    where p.deleted_at is null
      ${
        tag
          ? sql`and exists (
              select 1 from jsonb_array_elements(p.properties) e, jsonb_array_elements_text(e->'value') v
              where lower(e->>'name') = 'etiquetas' and jsonb_typeof(e->'value') = 'array'
                and (lower(v) = ${tag} or lower(v) like ${`${tag}/%`}))`
          : sql``
      }
      ${templateFilter(options)}
      ${
        options.branchId
          ? sql`and p.id in (
              with recursive branch as (
                select id from pages where id = ${options.branchId} and world_id = ${options.worldId}
                union all select c.id from pages c join branch b on c.parent_id = b.id)
              select id from branch)`
          : sql``
      }
    order by scored.score desc, p.title
    offset ${options.offset} limit ${options.limit}`)
  const pages = [...rows]
  return { total: pages[0]?.total ?? 0, pages: pages.map(({ total: _total, ...page }) => page) }
}

/** De esas páginas, las secciones que coinciden (las tres mejores de cada una), con su extracto marcado con ** */
export async function matchingSections(db: Database, pageIds: readonly string[], terms: readonly string[][]) {
  if (pageIds.length === 0 || terms.length === 0) return []
  const query = tsQuery(terms)
  const rows = await db.execute<{
    page_id: string
    kind: string
    heading: string | null
    heading_id: string | null
    excerpt: string
  }>(sql`
    with q as (select ${query} as query)
    select page_id, kind, heading, heading_id, excerpt from (
      select s.page_id, s.kind, s.heading, s.heading_id, s.position,
        ts_headline('es_unaccent'::regconfig, s.body, q.query,
          'StartSel=**, StopSel=**, MaxWords=30, MinWords=12, MaxFragments=1, FragmentDelimiter=" … "') as excerpt,
        row_number() over (partition by s.page_id order by ts_rank(s.tsv, q.query) desc, s.position) as n
      from search_sections s, q
      where s.page_id in (${sql.join(
        pageIds.map((id) => sql`${id}::uuid`),
        sql`, `
      )}) and s.tsv @@ q.query and ${liveTab}
    ) ranked where n <= 3 order by page_id, n`)
  return [...rows].map((row) => ({
    pageId: row.page_id,
    kind: row.kind as 'body' | 'secret' | 'note' | 'tab',
    heading: row.heading,
    headingId: row.heading_id,
    excerpt: row.excerpt
  }))
}
