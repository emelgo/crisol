import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { documents } from '../schema/documents.ts'
import { fileEmbeds, pageLinks } from '../schema/links.ts'
import { pages } from '../schema/pages.ts'

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
    .where(and(eq(pageLinks.targetPageId, targetPageId), isNull(pages.deletedAt)))
}

/** Los enlaces que salen de una página (de su cuerpo y sus secretos) */
export function outgoing(db: Database, sourcePageId: string) {
  return db
    .select({ targetPageId: pageLinks.targetPageId, targetTitle: pageLinks.targetTitle, anchor: pageLinks.anchor })
    .from(pageLinks)
    .where(eq(pageLinks.sourcePageId, sourcePageId))
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

/** Cuántas páginas (fuera de la papelera) usan cada archivo del mundo */
export async function fileUses(db: Database, worldId: string) {
  const rows = await db
    .select({ fileId: fileEmbeds.fileId, pages: sql<number>`count(distinct ${fileEmbeds.sourcePageId})::int` })
    .from(fileEmbeds)
    .innerJoin(pages, eq(pages.id, fileEmbeds.sourcePageId))
    .where(and(eq(fileEmbeds.worldId, worldId), isNull(pages.deletedAt)))
    .groupBy(fileEmbeds.fileId)
  return new Map(rows.flatMap((row) => (row.fileId ? [[row.fileId, row.pages] as const] : [])))
}

/** Los archivos que usan estas páginas (para exportarlas con ellos) */
export async function filesUsedBy(db: Database, pageIds: readonly string[]) {
  if (pageIds.length === 0) return []
  const rows = await db
    .selectDistinct({ fileId: fileEmbeds.fileId })
    .from(fileEmbeds)
    .where(inArray(fileEmbeds.sourcePageId, [...pageIds]))
  return rows.flatMap((row) => (row.fileId ? [row.fileId] : []))
}
