import { and, eq, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { documents } from '../schema/documents.ts'

/** El estado guardado del cuerpo de una página, si ya tiene */
export async function findBody(db: Database, pageId: string) {
  const [found] = await db
    .select({ id: documents.id, state: documents.state })
    .from(documents)
    .where(and(eq(documents.pageId, pageId), eq(documents.kind, 'body')))
  return found ?? null
}

/**
 * Guarda el cuerpo fusionando con lo que ya hay: merge recibe el estado guardado (o null) y devuelve el nuevo. La fila
 * va bloqueada mientras tanto, así que dos guardados a la vez no se pisan. Nunca se vuelve atrás: solo se fusiona
 */
export function mergeBody(
  db: Database,
  page: { pageId: string; worldId: string; userId: string | null },
  merge: (stored: Uint8Array | null) => Uint8Array
) {
  return db.transaction(async (tx) => {
    const [stored] = await tx
      .select({ id: documents.id, state: documents.state })
      .from(documents)
      .where(and(eq(documents.pageId, page.pageId), eq(documents.kind, 'body')))
      .for('update')
    const state = merge(stored?.state ?? null)
    if (stored) {
      await tx
        .update(documents)
        .set({ state, updatedBy: page.userId, updatedAt: new Date() })
        .where(eq(documents.id, stored.id))
    } else {
      await tx
        .insert(documents)
        .values({ worldId: page.worldId, pageId: page.pageId, kind: 'body', state, updatedBy: page.userId })
        .onConflictDoUpdate({
          target: documents.pageId,
          targetWhere: sql`${documents.kind} = 'body'`,
          set: { state, updatedBy: page.userId, updatedAt: new Date() }
        })
    }
    return state.byteLength
  })
}
