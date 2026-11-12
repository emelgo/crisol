/**
 * Los capítulos de los libros de un sistema propio (ADR-0025). Todo lo que los escribe pasa por operation(): queda en
 * el historial y se deshace. Cambiar uno pide la versión que se tenía: si cambió entre medias, no se pisa
 */
import { and, asc, count, eq, max } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { systemChapters } from '../schema/systems.ts'

export class ChapterChangedError extends Error {
  constructor() {
    super('El capítulo cambió mientras tanto')
    this.name = 'ChapterChangedError'
  }
}

export type ChapterRow = typeof systemChapters.$inferSelect

const summary = {
  id: systemChapters.id,
  systemId: systemChapters.systemId,
  source: systemChapters.source,
  position: systemChapters.position,
  title: systemChapters.title,
  version: systemChapters.version,
  updatedAt: systemChapters.updatedAt
}

/** Los de un sistema (o de uno de sus libros), en su orden, sin su texto */
export function listChapters(db: Database, systemId: string, source?: string) {
  return db
    .select(summary)
    .from(systemChapters)
    .where(
      source
        ? and(eq(systemChapters.systemId, systemId), eq(systemChapters.source, source))
        : eq(systemChapters.systemId, systemId)
    )
    .orderBy(asc(systemChapters.source), asc(systemChapters.position))
}

/** Los de un sistema con su texto (para exportarlo o copiarlo) */
/** Cuántos capítulos tiene cada libro de un sistema */
export async function chapterCounts(db: Database, systemId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ source: systemChapters.source, count: count() })
    .from(systemChapters)
    .where(eq(systemChapters.systemId, systemId))
    .groupBy(systemChapters.source)
  return new Map(rows.map((row) => [row.source, row.count]))
}

export function chaptersWithText(db: Database, systemId: string) {
  return db
    .select()
    .from(systemChapters)
    .where(eq(systemChapters.systemId, systemId))
    .orderBy(asc(systemChapters.source), asc(systemChapters.position))
}

export async function findChapter(db: Database, id: string) {
  const [row] = await db.select().from(systemChapters).where(eq(systemChapters.id, id))
  return row ?? null
}

/** Uno nuevo, al final de su libro */
export function createChapter(
  db: Database,
  context: OperationContext,
  values: { systemId: string; source: string; title: string; markdown: string }
) {
  return operation(db, context, async (w) => {
    const [last] = await w.read
      .select({ position: max(systemChapters.position) })
      .from(systemChapters)
      .where(and(eq(systemChapters.systemId, values.systemId), eq(systemChapters.source, values.source)))
    return w.insert(systemChapters, { ...values, position: (last?.position ?? -1) + 1 })
  })
}

/** Varios a la vez (al importar un sistema o copiarlo), en el orden dado dentro de cada libro */
export function insertChapters(
  db: Database,
  context: OperationContext,
  systemId: string,
  chapters: readonly { source: string; title: string; markdown: string }[]
) {
  return operation(db, context, async (w) => {
    if (chapters.length === 0) return []
    const next = new Map<string, number>()
    return w.insertMany(
      systemChapters,
      chapters.map((chapter) => {
        const position = next.get(chapter.source) ?? 0
        next.set(chapter.source, position + 1)
        return { ...chapter, systemId, position }
      })
    )
  })
}

/** Cambia su título o su texto, si su versión es la que se tenía */
export function updateChapter(
  db: Database,
  context: OperationContext,
  id: string,
  version: number,
  patch: { title?: string; markdown?: string }
) {
  return operation(db, context, async (w) => {
    const [current] = await w.read
      .select({ version: systemChapters.version })
      .from(systemChapters)
      .where(eq(systemChapters.id, id))
      .for('update')
    if (!current || current.version !== version) throw new ChapterChangedError()
    return w.update(systemChapters, id, patch)
  })
}

/** Los capítulos de un libro, en el orden dado (los que no se nombran, detrás, en el suyo) */
export function orderChapters(
  db: Database,
  context: OperationContext,
  systemId: string,
  source: string,
  ids: readonly string[]
) {
  return operation(db, context, async (w) => {
    const rows = await w.read
      .select({ id: systemChapters.id, position: systemChapters.position })
      .from(systemChapters)
      .where(and(eq(systemChapters.systemId, systemId), eq(systemChapters.source, source)))
      .orderBy(asc(systemChapters.position))
    const named = ids.filter((id) => rows.some((row) => row.id === id))
    const order = [...named, ...rows.map((row) => row.id).filter((id) => !named.includes(id))]
    for (const [position, id] of order.entries()) {
      const row = rows.find((each) => each.id === id)
      if (row && row.position !== position) await w.update(systemChapters, id, { position })
    }
    return order
  })
}

export function deleteChapter(db: Database, context: OperationContext, id: string) {
  return operation(db, context, (w) => w.remove(systemChapters, id))
}

/** Los ids de los de un libro (para quitarlos con él) */
export async function chapterIdsOf(db: Database, systemId: string, source: string) {
  const rows = await db
    .select({ id: systemChapters.id })
    .from(systemChapters)
    .where(and(eq(systemChapters.systemId, systemId), eq(systemChapters.source, source)))
  return rows.map((row) => row.id)
}
