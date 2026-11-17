import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { documents } from '../schema/documents.ts'
import { fileEmbeds, pageLinks } from '../schema/links.ts'
import { pages } from '../schema/pages.ts'

/**
 * Lo que sale de un documento cuenta salvo si es el de una pestaña de texto ya quitada (su documento queda para poder
 * deshacer, pero sus enlaces y archivos no deben verse)
 */
const liveSource = (documentId: unknown) =>
  sql`not exists (select 1 from documents d where d.id = ${documentId} and d.kind = 'tab'
    and not exists (select 1 from page_tabs t where t.document_id = d.id))`

export interface LinkRow {
  targetPageId: string | null
  targetTitle: string
  targetKey: string
  anchor: string | null
}

/** Rehace los enlaces que salen de un documento (el cuerpo de una página o uno de sus secretos) */
export function replaceLinks(
  db: Database,
  source: { worldId: string; pageId: string; documentId: string },
  links: readonly LinkRow[]
) {
  return db.transaction(async (tx) => {
    await tx.delete(pageLinks).where(eq(pageLinks.sourceDocumentId, source.documentId))
    if (links.length === 0) return
    await tx.insert(pageLinks).values(
      links.map((link) => ({
        worldId: source.worldId,
        sourcePageId: source.pageId,
        sourceDocumentId: source.documentId,
        ...link
      }))
    )
  })
}

/** Los enlaces de muchos documentos de una vez (los de una tanda de páginas nuevas) */
export async function replaceLinksMany(
  db: Database,
  items: readonly { source: { worldId: string; pageId: string; documentId: string }; links: readonly LinkRow[] }[]
) {
  if (items.length === 0) return
  await db.transaction(async (tx) => {
    await tx.delete(pageLinks).where(
      inArray(
        pageLinks.sourceDocumentId,
        items.map((item) => item.source.documentId)
      )
    )
    const rows = items.flatMap((item) =>
      item.links.map((link) => ({
        worldId: item.source.worldId,
        sourcePageId: item.source.pageId,
        sourceDocumentId: item.source.documentId,
        ...link
      }))
    )
    for (let i = 0; i < rows.length; i += 1000) await tx.insert(pageLinks).values(rows.slice(i, i + 1000))
  })
}

/** Los enlaces sin resolver del mundo con alguno de estos nombres (sin mayúsculas), con su documento */
export function unresolvedNamed(db: Database, worldId: string, keys: readonly string[]) {
  if (keys.length === 0) return Promise.resolve([])
  return db
    .select({
      id: pageLinks.id,
      sourcePageId: pageLinks.sourcePageId,
      sourceDocumentId: pageLinks.sourceDocumentId,
      documentKind: documents.kind,
      targetTitle: pageLinks.targetTitle,
      targetKey: pageLinks.targetKey
    })
    .from(pageLinks)
    .innerJoin(documents, eq(documents.id, pageLinks.sourceDocumentId))
    .where(and(eq(pageLinks.worldId, worldId), isNull(pageLinks.targetPageId), inArray(pageLinks.targetKey, [...keys])))
}

/** Da por resueltos estos enlaces: ya van a esa página */
export async function resolveLinks(db: Database, linkIds: readonly string[], targetPageId: string) {
  if (linkIds.length === 0) return
  await db
    .update(pageLinks)
    .set({ targetPageId })
    .where(inArray(pageLinks.id, [...linkIds]))
}

/** Los enlaces sin resolver del mundo, con cuántas veces y desde qué páginas (para Claude) */
export function unresolvedInWorld(db: Database, worldId: string) {
  return db
    .select({
      title: sql<string>`min(${pageLinks.targetTitle})`,
      key: pageLinks.targetKey,
      count: sql<number>`count(*)::int`,
      pageIds: sql<string[]>`array_agg(distinct ${pageLinks.sourcePageId})`
    })
    .from(pageLinks)
    .innerJoin(pages, eq(pages.id, pageLinks.sourcePageId))
    .where(and(eq(pageLinks.worldId, worldId), isNull(pageLinks.targetPageId), isNull(pages.deletedAt)))
    .groupBy(pageLinks.targetKey)
}

/** Los enlaces que llegan a una página desde otras fuera de la papelera, con de dónde salen */
export function incoming(db: Database, targetPageId: string) {
  return db
    .select({
      sourcePageId: pageLinks.sourcePageId,
      sourceDocumentId: pageLinks.sourceDocumentId,
      documentKind: documents.kind,
      title: pages.title
    })
    .from(pageLinks)
    .innerJoin(pages, eq(pages.id, pageLinks.sourcePageId))
    .innerJoin(documents, eq(documents.id, pageLinks.sourceDocumentId))
    .where(
      and(eq(pageLinks.targetPageId, targetPageId), isNull(pages.deletedAt), liveSource(pageLinks.sourceDocumentId))
    )
}

/** Los enlaces que salen de una página (de su cuerpo y sus secretos) */
export function outgoing(db: Database, sourcePageId: string) {
  return db
    .select({
      targetPageId: pageLinks.targetPageId,
      targetTitle: pageLinks.targetTitle,
      anchor: pageLinks.anchor,
      // De qué documento sale (un jugador solo ve los de lo que ve)
      sourceDocumentId: pageLinks.sourceDocumentId
    })
    .from(pageLinks)
    .where(and(eq(pageLinks.sourcePageId, sourcePageId), liveSource(pageLinks.sourceDocumentId)))
}

export interface FileEmbedRow {
  fileId: string | null
  name: string
  nameKey: string
}

/** Rehace los archivos que usa un documento */
export function replaceFileEmbeds(
  db: Database,
  source: { worldId: string; pageId: string; documentId: string },
  embeds: readonly FileEmbedRow[]
) {
  return db.transaction(async (tx) => {
    await tx.delete(fileEmbeds).where(eq(fileEmbeds.sourceDocumentId, source.documentId))
    if (embeds.length === 0) return
    await tx.insert(fileEmbeds).values(
      embeds.map((embed) => ({
        worldId: source.worldId,
        sourcePageId: source.pageId,
        sourceDocumentId: source.documentId,
        ...embed
      }))
    )
  })
}

/** Los archivos sin resolver del mundo con alguno de estos nombres (sin mayúsculas), con su documento */
export function unresolvedFileEmbeds(db: Database, worldId: string, keys: readonly string[]) {
  if (keys.length === 0) return Promise.resolve([])
  return db
    .select({
      id: fileEmbeds.id,
      sourcePageId: fileEmbeds.sourcePageId,
      sourceDocumentId: fileEmbeds.sourceDocumentId,
      documentKind: documents.kind,
      nameKey: fileEmbeds.nameKey
    })
    .from(fileEmbeds)
    .innerJoin(documents, eq(documents.id, fileEmbeds.sourceDocumentId))
    .where(and(eq(fileEmbeds.worldId, worldId), isNull(fileEmbeds.fileId), inArray(fileEmbeds.nameKey, [...keys])))
}

export async function resolveFileEmbeds(db: Database, embedIds: readonly string[], fileId: string) {
  if (embedIds.length === 0) return
  await db
    .update(fileEmbeds)
    .set({ fileId })
    .where(inArray(fileEmbeds.id, [...embedIds]))
}

/**
 * Cuántas páginas usa cada archivo, en su texto o de portada: las del mundo o, para los comunes de una organización,
 * las de todos sus mundos
 */
export async function fileUses(db: Database, scope: { worldId: string } | { organizationId: string }) {
  const pagesIn =
    'worldId' in scope
      ? sql`p.world_id = ${scope.worldId}`
      : sql`p.world_id in (select id from worlds where organization_id = ${scope.organizationId})`
  const rows = await db.execute<{ file_id: string; pages: number }>(sql`
    select file_id, count(distinct page_id)::int as pages from (
      select fe.file_id, fe.source_page_id as page_id from file_embeds fe
        join pages p on p.id = fe.source_page_id
        where ${pagesIn} and fe.file_id is not null and p.deleted_at is null and ${liveSource(sql`fe.source_document_id`)}
      union all
      select (p.cover->>'fileId')::uuid, p.id from pages p
        where ${pagesIn} and p.cover is not null and p.deleted_at is null
    ) used group by file_id`)
  return new Map([...rows].map((row) => [row.file_id, row.pages] as const))
}

/** Los archivos que usan estas páginas, en su texto o de portada (para exportarlas con ellos) */
export async function filesUsedBy(db: Database, pageIds: readonly string[]) {
  if (pageIds.length === 0) return []
  const rows = await db
    .selectDistinct({ fileId: fileEmbeds.fileId })
    .from(fileEmbeds)
    .where(and(inArray(fileEmbeds.sourcePageId, [...pageIds]), liveSource(fileEmbeds.sourceDocumentId)))
  const covers = await db
    .select({ cover: pages.cover })
    .from(pages)
    .where(inArray(pages.id, [...pageIds]))
  return [
    ...new Set([
      ...rows.flatMap((row) => (row.fileId ? [row.fileId] : [])),
      ...covers.flatMap((row) => (row.cover ? [row.cover.fileId] : []))
    ])
  ]
}

/** Una página para el grafo del mundo: lo justo y, de sus propiedades, sus campos de enlace y sus etiquetas */
export type GraphPageRow = {
  id: string
  title: string
  icon: string | null
  template: string | null
  line: string[]
  properties: Record<string, unknown>[]
}

/** Un enlace del texto entre dos páginas del grafo, con el documento del que sale (solo si no es el cuerpo) */
export type GraphMentionRow = {
  source: string
  target: string
  kind: 'body' | 'secret' | 'note' | 'tab'
  documentId: string | null
}

/** Si una propiedad guardada cuenta para el grafo: un campo de enlace o las etiquetas */
const graphProperty = (item: Record<string, unknown>) =>
  item.type === 'pages' ||
  // Los de texto con algo: el primero que ve quien pregunta va bajo el nombre en las tarjetas
  (item.type === 'text' && typeof item.value === 'string' && item.value.trim() !== '') ||
  (typeof item.name === 'string' && item.name.trim().toLowerCase() === 'etiquetas')

/**
 * Lo que hace falta para el grafo de relaciones del mundo (módulo 10): las páginas fuera de la papelera con sus campos
 * de enlace, sus etiquetas y sus campos de texto con algo, y los enlaces resueltos de su texto (sin los de pestañas quitadas; los repetidos los junta
 * el dominio). Dos consultas, sin caché: 5.000 páginas y 20.000 aristas en menos de 300 ms. Las propiedades y la línea
 * de plantillas llegan como texto y se leen aquí (más rápido que dejárselas al driver)
 */
export async function worldGraph(db: Database, worldId: string) {
  const [pageRows, mentionRows] = await Promise.all([
    db.execute<Omit<GraphPageRow, 'properties' | 'line'> & { properties: string; line: string }>(sql`
      select p.id, p.title, p.icon, p.template, array_to_string(p.template_line, ' ') as line,
        p.properties::text as properties
      from pages p
      where p.world_id = ${worldId} and p.deleted_at is null`),
    db.execute<GraphMentionRow>(sql`
      select l.source_page_id as source, l.target_page_id as target, d.kind,
        case when d.kind = 'body' then null else l.source_document_id end as "documentId"
      from page_links l
      join documents d on d.id = l.source_document_id
      where l.world_id = ${worldId} and l.target_page_id is not null and l.target_page_id <> l.source_page_id
        and (d.kind <> 'tab' or exists (select 1 from page_tabs t where t.document_id = d.id))`)
  ])
  const pages: GraphPageRow[] = [...pageRows].map((row) => {
    const stored: unknown = JSON.parse(row.properties)
    const properties = Array.isArray(stored)
      ? stored.filter(
          (item): item is Record<string, unknown> => typeof item === 'object' && item !== null && graphProperty(item)
        )
      : []
    return { ...row, line: row.line === '' ? [] : row.line.split(' '), properties }
  })
  return { pages, mentions: [...mentionRows] }
}
