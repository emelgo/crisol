/**
 * Los sistemas de reglas de una cuenta (ADR-0011). Todo lo que los escribe pasa por operation(): queda en el historial
 * y se deshace. Guardar pide la versión que se tenía: si cambió entre medias (otra pestaña, la IA), no se pisa nada
 */
import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { systemContent, systems } from '../schema/systems.ts'

/** Una fila, con el documento ya leído */
export type SystemRow = Omit<typeof systems.$inferSelect, 'document'> & { document: Record<string, unknown> }

const read = (row: typeof systems.$inferSelect): SystemRow => ({ ...row, document: JSON.parse(row.document) })

/** Lo cambió otro mientras tanto: no se guarda nada */
export class SystemChangedError extends Error {
  constructor() {
    super('El sistema cambió mientras tanto')
    this.name = 'SystemChangedError'
  }
}

/** Los de una organización (sin los apartados), en el orden en que se hicieron */
export async function listSystems(db: Database, organizationId: string) {
  const rows = await db
    .select()
    .from(systems)
    .where(and(eq(systems.organizationId, organizationId), isNull(systems.deletedAt)))
    .orderBy(asc(systems.createdAt), asc(systems.id))
  return rows.map(read)
}

export async function findSystem(db: Database, id: string) {
  const [found] = await db.select().from(systems).where(eq(systems.id, id))
  return found ? read(found) : null
}

export async function countSystems(db: Database, organizationId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(systems)
    .where(and(eq(systems.organizationId, organizationId), isNull(systems.deletedAt)))
  return row?.n ?? 0
}

/** Cuántos documentos de contenido tiene cada sistema */
export async function contentCounts(db: Database, ids: readonly string[]) {
  if (ids.length === 0) return new Map<string, number>()
  const rows = await db
    .select({ systemId: systemContent.systemId, n: count() })
    .from(systemContent)
    .where(inArray(systemContent.systemId, [...ids]))
    .groupBy(systemContent.systemId)
  return new Map(rows.map((r) => [r.systemId, r.n]))
}

export function listContent(db: Database, systemId: string) {
  return db.select().from(systemContent).where(eq(systemContent.systemId, systemId)).orderBy(asc(systemContent.key))
}

export interface ContentValues {
  type: string
  key: string
  source: string | null
  data: Record<string, unknown>
}

/** Uno nuevo, con su contenido (el de aquel del que se copia, o el del archivo que se sube) */
export function createSystem(
  db: Database,
  context: OperationContext,
  values: {
    id: string
    organizationId: string
    basedOn: { id: string; version: number } | null
    document: Record<string, unknown>
  },
  content: readonly ContentValues[] = []
) {
  return operation(db, context, async (w) => {
    const row = await w.insert(systems, { ...values, document: JSON.stringify(values.document) })
    for (const item of content) await w.insert(systemContent, { ...item, systemId: row.id })
    return read(row)
  })
}

/**
 * Cambia el documento si la versión es la que se tenía; con `content`, cambia también todo su contenido (al subir un
 * archivo encima)
 */
export function updateSystem(
  db: Database,
  context: OperationContext,
  id: string,
  version: number,
  document: Record<string, unknown>,
  content?: readonly ContentValues[]
) {
  return operation(db, context, async (w) => {
    const [current] = await w.read
      .select({ version: systems.version })
      .from(systems)
      .where(eq(systems.id, id))
      .for('update')
    if (!current || current.version !== version) throw new SystemChangedError()
    const row = read(await w.update(systems, id, { document: JSON.stringify(document) }))
    if (content) {
      const old = await w.read
        .select({ id: systemContent.id })
        .from(systemContent)
        .where(eq(systemContent.systemId, id))
      for (const item of old) await w.remove(systemContent, item.id)
      for (const item of content) await w.insert(systemContent, { ...item, systemId: id })
    }
    return row
  })
}

/** Lo aparta: deja de salir; el historial lo devuelve */
export function deleteSystem(db: Database, context: OperationContext, id: string) {
  return operation(db, context, async (w) => read(await w.update(systems, id, { deletedAt: new Date() })))
}
