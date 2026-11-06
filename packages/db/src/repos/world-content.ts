/**
 * El compendio de un mundo (docs/specs/compendio-mundo.md): contenido de un sistema dentro de un mundo. Todo lo que lo
 * escribe pasa por operation(): queda en el historial y se deshace. Cada entrada lleva su versión: cambiar una pide la
 * que se tenía, y no cambia la del sistema
 */
import { and, asc, count, eq, inArray, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { type ContentOrigin, worldContent } from '../schema/systems.ts'

export type WorldContentRow = typeof worldContent.$inferSelect

/** Lo cambió otro mientras tanto: no se guarda nada */
export class WorldContentChangedError extends Error {
  readonly key: string
  constructor(key: string) {
    super(`La entrada ${key} cambió mientras tanto`)
    this.name = 'WorldContentChangedError'
    this.key = key
  }
}

export interface WorldContentValues {
  type: string
  key: string
  data: Record<string, unknown>
  concept?: string | null
  mechanics?: Record<string, unknown> | null
  ref?: Record<string, unknown> | null
  img?: string | null
  table?: Record<string, unknown> | null
  /** Sin tocar, se queda el que tenía; null lo quita */
  origin?: ContentOrigin | null
  /** La versión que se leyó, para cambiar una que ya está (sin ella, se cambia sin mirar) */
  version?: number
}

const scope = (worldId: string, systemId: string) =>
  and(eq(worldContent.worldId, worldId), eq(worldContent.systemId, systemId))

/** Lo de buscar sin leer cada entrada entera, como el índice del contenido de un sistema */
export function contentIndex(db: Database, worldId: string, systemId: string) {
  return db
    .select({
      key: worldContent.key,
      type: worldContent.type,
      concept: worldContent.concept,
      name: sql<unknown>`${worldContent.data} -> 'name'`,
      automation: sql<string | null>`${worldContent.mechanics} ->> 'automation'`
    })
    .from(worldContent)
    .where(scope(worldId, systemId))
    .orderBy(asc(worldContent.key))
}

/** Unas entradas, por su clave */
export function contentByKeys(db: Database, worldId: string, systemId: string, keys: readonly string[]) {
  if (keys.length === 0) return Promise.resolve([] as WorldContentRow[])
  return db
    .select()
    .from(worldContent)
    .where(and(scope(worldId, systemId), inArray(worldContent.key, [...keys])))
}

/** Las de un tipo (para repartirlas en las carpetas de su compendio) */
export function listContentOfType(db: Database, worldId: string, systemId: string, type: string) {
  return db
    .select()
    .from(worldContent)
    .where(and(scope(worldId, systemId), eq(worldContent.type, type)))
    .orderBy(asc(worldContent.key))
}

/** Todas las de un mundo y un sistema */
export function listContent(db: Database, worldId: string, systemId: string) {
  return db.select().from(worldContent).where(scope(worldId, systemId)).orderBy(asc(worldContent.key))
}

/**
 * Guarda unas entradas por su clave: las que ya están se cambian (si traen versión, solo si es la que tienen); las que
 * no, se crean. Todo o nada
 */
export function putContent(
  db: Database,
  context: OperationContext,
  worldId: string,
  systemId: string,
  items: readonly WorldContentValues[]
) {
  return operation(db, context, async (w) => {
    const existing = await w.read
      .select({ id: worldContent.id, key: worldContent.key, version: worldContent.version })
      .from(worldContent)
      .where(
        and(
          scope(worldId, systemId),
          inArray(
            worldContent.key,
            items.map((i) => i.key)
          )
        )
      )
      .for('update')
    const byKey = new Map(existing.map((e) => [e.key, e]))
    const saved: WorldContentRow[] = []
    for (const { version, ...item } of items) {
      const found = byKey.get(item.key)
      // Con versión, tiene que estar y ser esa: si la borraron entretanto, no se vuelve a crear
      if (version !== undefined && found?.version !== version) throw new WorldContentChangedError(item.key)
      if (found) saved.push(await w.update(worldContent, found.id, item))
      else saved.push(await w.insert(worldContent, { ...item, worldId, systemId }))
    }
    return { saved, created: items.filter((i) => !byKey.has(i.key)).length }
  })
}

/** Quita unas entradas por su clave (las que no están, no cuentan) */
export function deleteContent(
  db: Database,
  context: OperationContext,
  worldId: string,
  systemId: string,
  keys: readonly string[]
) {
  return operation(db, context, async (w) => {
    const found = await w.read
      .select({ id: worldContent.id, key: worldContent.key })
      .from(worldContent)
      .where(and(scope(worldId, systemId), inArray(worldContent.key, [...keys])))
    for (const row of found) await w.remove(worldContent, row.id)
    return { deleted: found.map((r) => r.key) }
  })
}

/** Cuántas tiene un mundo para un sistema */
export async function countContent(db: Database, worldId: string, systemId: string) {
  const [row] = await db.select({ n: count() }).from(worldContent).where(scope(worldId, systemId))
  return row?.n ?? 0
}
