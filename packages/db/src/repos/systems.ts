/**
 * Los sistemas de reglas de una cuenta (ADR-0011). Todo lo que los escribe pasa por operation(): queda en el historial
 * y se deshace. Guardar pide la versión que se tenía: si cambió entre medias (otra pestaña, la IA), no se pisa nada
 */
import { and, asc, count, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { prepared } from '../prepared.ts'
import { campaigns } from '../schema/campaigns.ts'
import { characters } from '../schema/characters.ts'
import { organizations } from '../schema/organizations.ts'
import { type ContentReview, systemContent, systems } from '../schema/systems.ts'
import { worlds } from '../schema/worlds.ts'

/** Una fila, con el documento ya leído */
export type SystemRow = Omit<typeof systems.$inferSelect, 'document'> & { document: Record<string, unknown> }

const read = (row: typeof systems.$inferSelect): SystemRow => ({ ...row, document: JSON.parse(row.document) })

/** Ya hay tantos como caben en la cuenta (contados dentro de la misma transacción: dos a la vez no se pasan) */
export class TooManySystemsError extends Error {
  constructor() {
    super('No caben más sistemas en la cuenta')
    this.name = 'TooManySystemsError'
  }
}

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

/**
 * Los de la base tienen un uuid; los de serie (el catálogo: «blank», el 5e de ejemplo) no y no están aquí. Preguntar
 * por uno de esos rompería la consulta (Postgres no lo admite como uuid): se responde que no hay
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const stored = (ids: readonly string[]) => ids.filter((id) => UUID.test(id))

export async function findSystem(db: Database, id: string) {
  if (!UUID.test(id)) return null
  const [found] = await db.select().from(systems).where(eq(systems.id, id))
  return found ? read(found) : null
}

/** Varios por sus ids (los que existan) */
export async function findSystems(db: Database, given: readonly string[]) {
  const ids = stored(given)
  if (ids.length === 0) return []
  const rows = await db.select().from(systems).where(inArray(systems.id, ids))
  return rows.map(read)
}

export async function countSystems(db: Database, organizationId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(systems)
    .where(and(eq(systems.organizationId, organizationId), isNull(systems.deletedAt)))
  return row?.n ?? 0
}

/** La versión de cada uno, sin leer su documento: para saber si lo que se tiene leído sigue valiendo */
export function systemVersions(db: Database, given: readonly string[]) {
  const ids = stored(given)
  if (ids.length === 0) return Promise.resolve([])
  // Uno solo (el de la campaña, en cada refresco de la mesa): preparada
  if (ids.length === 1) return versionOf(db).execute({ id: ids[0] })
  return db
    .select({ id: systems.id, version: systems.version, deletedAt: systems.deletedAt })
    .from(systems)
    .where(inArray(systems.id, ids))
}

const versionOf = prepared((db) =>
  db
    .select({ id: systems.id, version: systems.version, deletedAt: systems.deletedAt })
    .from(systems)
    .where(eq(systems.id, sql.placeholder('id')))
    .prepare('system_version')
)

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

/** Su contenido de un tipo (para repartirlo en las carpetas de su compendio) */
export function listContentOfType(db: Database, systemId: string, type: string) {
  return db
    .select()
    .from(systemContent)
    .where(and(eq(systemContent.systemId, systemId), eq(systemContent.type, type)))
    .orderBy(asc(systemContent.key))
}

export interface ContentValues {
  type: string
  key: string
  source: string | null
  data: Record<string, unknown>
  concept?: string | null
  mechanics?: Record<string, unknown> | null
  ref?: Record<string, unknown> | null
  img?: string | null
  table?: Record<string, unknown> | null
  review?: ContentReview | null
}

/**
 * Lo que hace falta para buscar en su contenido, sin leer cada documento entero: su clave, su tipo, su fuente, su
 * concepto, su nombre (en sus idiomas) y cuánto está automatizado
 */
export function contentIndex(db: Database, systemId: string) {
  return db
    .select({
      key: systemContent.key,
      type: systemContent.type,
      source: systemContent.source,
      concept: systemContent.concept,
      name: sql<unknown>`${systemContent.data} -> 'name'`,
      automation: sql<string | null>`${systemContent.mechanics} ->> 'automation'`,
      page: sql<
        number | null
      >`nullif(coalesce(${systemContent.ref} -> 'pages' ->> 'es', ${systemContent.ref} -> 'pages' ->> 'en'), '')::int`,
      review: systemContent.review
    })
    .from(systemContent)
    .where(eq(systemContent.systemId, systemId))
    .orderBy(asc(systemContent.key))
}

/** Unos documentos de su contenido, por su clave */
export function contentByKeys(db: Database, systemId: string, keys: readonly string[]) {
  if (keys.length === 0) return Promise.resolve([])
  return db
    .select()
    .from(systemContent)
    .where(and(eq(systemContent.systemId, systemId), inArray(systemContent.key, [...keys])))
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
  content: readonly ContentValues[] = [],
  /** Como mucho, tantos en la organización */
  max = Number.POSITIVE_INFINITY
) {
  return operation(db, context, async (w) => {
    if (Number.isFinite(max)) {
      // La organización, bloqueada: quien crea otro a la vez espera y cuenta este
      await w.read
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, values.organizationId))
        .for('update')
      const [row] = await w.read
        .select({ n: count() })
        .from(systems)
        .where(and(eq(systems.organizationId, values.organizationId), isNull(systems.deletedAt)))
      if ((row?.n ?? 0) >= max) throw new TooManySystemsError()
    }
    const row = await w.insert(systems, { ...values, document: JSON.stringify(values.document) })
    await w.insertMany(
      systemContent,
      content.map((item) => ({ ...item, systemId: row.id }))
    )
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
      await w.removeMany(
        systemContent,
        old.map((item) => item.id)
      )
      await w.insertMany(
        systemContent,
        content.map((item) => ({ ...item, systemId: id }))
      )
    }
    return row
  })
}

/**
 * Guarda unos documentos de su contenido, por su clave (los que ya están, se cambian), si la versión del sistema es la
 * que se tenía; el sistema sube de versión
 */
export function putContent(
  db: Database,
  context: OperationContext,
  systemId: string,
  version: number,
  items: readonly ContentValues[]
) {
  return operation(db, context, async (w) => {
    const [current] = await w.read
      .select({ version: systems.version })
      .from(systems)
      .where(eq(systems.id, systemId))
      .for('update')
    if (!current || current.version !== version) throw new SystemChangedError()
    const keys = items.map((i) => i.key)
    const existing = await w.read
      .select({ id: systemContent.id, key: systemContent.key })
      .from(systemContent)
      .where(and(eq(systemContent.systemId, systemId), inArray(systemContent.key, keys)))
    const byKey = new Map(existing.map((e) => [e.key, e.id]))
    for (const item of items) {
      const id = byKey.get(item.key)
      if (id) await w.update(systemContent, id, { ...item })
      else await w.insert(systemContent, { ...item, systemId })
    }
    return {
      system: read(await w.update(systems, systemId, {})),
      created: items.filter((i) => !byKey.has(i.key)).length
    }
  })
}

/** Quita unos documentos de su contenido por su clave (los que no están, no cuentan); el sistema sube de versión */
export function deleteContent(
  db: Database,
  context: OperationContext,
  systemId: string,
  version: number,
  keys: readonly string[]
) {
  return operation(db, context, async (w) => {
    const [current] = await w.read
      .select({ version: systems.version })
      .from(systems)
      .where(eq(systems.id, systemId))
      .for('update')
    if (!current || current.version !== version) throw new SystemChangedError()
    const found = await w.read
      .select({ id: systemContent.id, key: systemContent.key })
      .from(systemContent)
      .where(and(eq(systemContent.systemId, systemId), inArray(systemContent.key, [...keys])))
    for (const row of found) await w.remove(systemContent, row.id)
    return { system: read(await w.update(systems, systemId, {})), deleted: found.map((r) => r.key) }
  })
}

/**
 * Quita un libro: su documento (ya sin él) y todo su contenido, aceptado o pendiente, si la versión es la que se tenía;
 * el historial lo devuelve entero
 */
export function deleteBook(
  db: Database,
  context: OperationContext,
  systemId: string,
  version: number,
  document: Record<string, unknown>,
  source: string
) {
  return operation(db, context, async (w) => {
    const [current] = await w.read
      .select({ version: systems.version })
      .from(systems)
      .where(eq(systems.id, systemId))
      .for('update')
    if (!current || current.version !== version) throw new SystemChangedError()
    const found = await w.read
      .select({ id: systemContent.id })
      .from(systemContent)
      .where(and(eq(systemContent.systemId, systemId), eq(systemContent.source, source)))
    await w.removeMany(
      systemContent,
      found.map((r) => r.id)
    )
    return {
      system: read(await w.update(systems, systemId, { document: JSON.stringify(document) })),
      deleted: found.length
    }
  })
}

/**
 * Lo que propone la IA para un libro: entradas pendientes de revisar, por su clave (si ya hay una pendiente con esa
 * clave, se cambia; una aceptada no se toca: `taken`). No cambia la versión del sistema: no se ve hasta aceptarlo
 */
export function proposeContent(
  db: Database,
  context: OperationContext,
  systemId: string,
  items: readonly (ContentValues & { review: ContentReview })[]
) {
  return operation(db, context, async (w) => {
    const keys = items.map((i) => i.key)
    const existing = await w.read
      .select({ id: systemContent.id, key: systemContent.key, review: systemContent.review })
      .from(systemContent)
      .where(and(eq(systemContent.systemId, systemId), inArray(systemContent.key, keys)))
    const byKey = new Map(existing.map((e) => [e.key, e]))
    const proposed: string[] = []
    const taken: string[] = []
    for (const item of items) {
      const found = byKey.get(item.key)
      if (found && !found.review) taken.push(item.key)
      else if (found) {
        await w.update(systemContent, found.id, { ...item })
        proposed.push(item.key)
      } else {
        await w.insert(systemContent, { ...item, systemId })
        proposed.push(item.key)
      }
    }
    return { proposed, taken }
  })
}

/** Lo pendiente de revisar de un sistema (de un libro, si se dice), entero */
export function listPending(db: Database, systemId: string, source?: string) {
  return db
    .select()
    .from(systemContent)
    .where(
      and(
        eq(systemContent.systemId, systemId),
        isNotNull(systemContent.review),
        ...(source === undefined ? [] : [eq(systemContent.source, source)])
      )
    )
    .orderBy(asc(systemContent.type), asc(systemContent.key))
}

/** Cuánto hay pendiente de revisar en cada libro de un sistema */
export async function pendingCounts(db: Database, systemId: string) {
  const rows = await db
    .select({ source: systemContent.source, n: count() })
    .from(systemContent)
    .where(and(eq(systemContent.systemId, systemId), isNotNull(systemContent.review)))
    .groupBy(systemContent.source)
  return new Map(rows.map((r) => [r.source, r.n]))
}

/**
 * Acepta lo pendiente (con su tipo cambiado, si se cambió) o lo descarta (lo borra). Solo toca lo que sigue pendiente;
 * el sistema sube de versión (lo aceptado ya se ve)
 */
export function settlePending(
  db: Database,
  context: OperationContext,
  systemId: string,
  {
    accept = [],
    discard = [],
    types = {}
  }: { accept?: readonly string[]; discard?: readonly string[]; types?: Record<string, string> }
) {
  return operation(db, context, async (w) => {
    const keys = [...accept, ...discard]
    const found = keys.length
      ? await w.read
          .select({ id: systemContent.id, key: systemContent.key })
          .from(systemContent)
          .where(
            and(eq(systemContent.systemId, systemId), isNotNull(systemContent.review), inArray(systemContent.key, keys))
          )
      : []
    const accepted: string[] = []
    const discarded: string[] = []
    const take = new Set(accept)
    for (const row of found) {
      if (take.has(row.key)) {
        const type = types[row.key]
        await w.update(systemContent, row.id, { review: null, ...(type ? { type } : {}) })
        accepted.push(row.key)
      } else {
        await w.remove(systemContent, row.id)
        discarded.push(row.key)
      }
    }
    return { system: read(await w.update(systems, systemId, {})), accepted, discarded }
  })
}

/** Lo aparta: deja de salir; el historial lo devuelve */
export function deleteSystem(db: Database, context: OperationContext, id: string) {
  return operation(db, context, async (w) => read(await w.update(systems, id, { deletedAt: new Date() })))
}

/**
 * Quién usa un sistema por su id (uno de serie que se quita, ADR-0015): las campañas que lo eligieron y los personajes
 * hechos con él, cada uno con su cuenta
 */
export async function systemUsers(db: Database, systemId: string) {
  const usedBy = await db
    .select({ id: campaigns.id, organizationId: worlds.organizationId })
    .from(campaigns)
    .innerJoin(worlds, eq(campaigns.worldId, worlds.id))
    .where(eq(campaigns.system, systemId))
  // Un personaje lleva el sistema con el que se hizo, aunque su campaña haya cambiado de sistema
  const madeWith = await db
    .select({ id: characters.id, organizationId: worlds.organizationId })
    .from(characters)
    .innerJoin(campaigns, eq(characters.campaignId, campaigns.id))
    .innerJoin(worlds, eq(campaigns.worldId, worlds.id))
    .where(eq(characters.system, systemId))
  return { campaigns: usedBy, characters: madeWith }
}

/** Esas campañas y esos personajes, a otro sistema */
export async function repointSystem(
  db: Database,
  ids: { campaigns: readonly string[]; characters: readonly string[] },
  to: string
) {
  if (ids.campaigns.length > 0)
    await db
      .update(campaigns)
      .set({ system: to })
      .where(inArray(campaigns.id, [...ids.campaigns]))
  if (ids.characters.length > 0)
    await db
      .update(characters)
      .set({ system: to })
      .where(inArray(characters.id, [...ids.characters]))
}
