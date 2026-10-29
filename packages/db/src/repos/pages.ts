import { keyBetween } from '@crisol/domain'
import { and, eq, inArray, isNotNull, isNull, ne, type SQL, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Database } from '../client.ts'
import { type OperationContext, operation, type Transaction } from '../operation.ts'
import { pages } from '../schema/pages.ts'

const summaryColumns = {
  id: pages.id,
  worldId: pages.worldId,
  parentId: pages.parentId,
  position: pages.position,
  title: pages.title,
  icon: pages.icon,
  version: pages.version
}

/** Si tiene subpáginas fuera de la papelera (con la tabla escrita: dentro de la subconsulta, id sería el de c) */
const hasChildren = sql<boolean>`exists (select 1 from pages c where c.parent_id = "pages"."id" and c.deleted_at is null)`
/** El orden entre hermanas: la clave, comparada carácter a carácter */
const byPosition = [sql`${pages.position} collate "C"`, pages.id]

/** Dónde va una página entre sus hermanas: delante o detrás de una de ellas, o al final */
export interface Placement {
  parentId: string | null
  before?: string
  after?: string
}

const inBranch = (worldId: string, parentId: string | null) =>
  and(eq(pages.worldId, worldId), parentId === null ? isNull(pages.parentId) : eq(pages.parentId, parentId))

/** Una página que no está en la papelera, con lo que no es su cuerpo */
export async function findPage(db: Database, pageId: string) {
  const [found] = await db
    .select({
      ...summaryColumns,
      properties: pages.properties,
      locked: pages.locked,
      sheet: pages.sheet,
      updatedAt: pages.updatedAt,
      hasChildren
    })
    .from(pages)
    .where(and(eq(pages.id, pageId), isNull(pages.deletedAt)))
  return found ?? null
}

/** Las subpáginas de una página (o el primer nivel del mundo), en su orden */
export function listChildren(db: Database, worldId: string, parentId: string | null) {
  return db
    .select({ ...summaryColumns, hasChildren })
    .from(pages)
    .where(and(inBranch(worldId, parentId), isNull(pages.deletedAt)))
    .orderBy(...byPosition)
}

/** De la página del primer nivel a esta, las dos incluidas */
export async function pagePath(db: Database, pageId: string): Promise<{ id: string; title: string }[]> {
  const rows = await db.execute<{ id: string; title: string }>(sql`
    with recursive up as (
      select id, parent_id, title, 0 as depth from pages where id = ${pageId}
      union all
      select p.id, p.parent_id, p.title, up.depth + 1 from pages p join up on p.id = up.parent_id where up.depth < 64
    )
    select id, title from up order by depth desc`)
  return [...rows]
}

/** Cuántos niveles ocupa la rama de una página, ella incluida (también lo que está en la papelera: puede volver) */
export async function subtreeHeight(db: Database, pageId: string): Promise<number> {
  const rows = await db.execute<{ height: number }>(sql`
    with recursive down as (
      select id, 1 as depth from pages where id = ${pageId}
      union all
      select p.id, down.depth + 1 from pages p join down on p.parent_id = down.id where down.depth < 64
    )
    select max(depth)::int as height from down`)
  return rows[0]?.height ?? 0
}

/** Las páginas de una rama (o del mundo) hasta `levels` niveles por debajo, sin orden: lo pone quien las agrupa */
export async function listBranch(db: Database, worldId: string, parentId: string | null, levels: number) {
  const top = parentId === null ? sql`parent_id is null` : sql`parent_id = ${parentId}`
  const rows = await db.execute<{
    id: string
    parent_id: string | null
    position: string
    title: string
    icon: string | null
    has_children: boolean
  }>(sql`
    with recursive down as (
      select id, parent_id, position, title, icon, 1 as level from pages
      where world_id = ${worldId} and ${top} and deleted_at is null
      union all
      select p.id, p.parent_id, p.position, p.title, p.icon, down.level + 1 from pages p
      join down on p.parent_id = down.id where p.deleted_at is null and down.level < ${levels}
    )
    select id, parent_id, position, title, icon,
      exists (select 1 from pages c where c.parent_id = down.id and c.deleted_at is null) as has_children
    from down`)
  return rows.map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    position: row.position,
    title: row.title,
    icon: row.icon,
    hasChildren: row.has_children
  }))
}

/**
 * La clave de orden para ponerla donde se pide, dentro de la transacción. Cuentan también las hermanas de la
 * papelera, para que al volver no repitan clave. moving: la que se mueve, que no cuenta como vecina
 */
async function placeKey(tx: Transaction, worldId: string, placement: Placement, moving?: string) {
  const conditions: SQL[] = []
  const branch = inBranch(worldId, placement.parentId)
  if (branch) conditions.push(branch)
  if (moving) conditions.push(ne(pages.id, moving))
  const siblings = and(...conditions)
  const extreme = (fn: 'max' | 'min') => sql<string | null>`${sql.raw(fn)}(${pages.position} collate "C")`
  const neighbourId = placement.before ?? placement.after
  if (!neighbourId) {
    const [last] = await tx
      .select({ position: extreme('max') })
      .from(pages)
      .where(siblings)
    return keyBetween(last?.position ?? null, null)
  }
  const [neighbour] = await tx
    .select({ position: pages.position })
    .from(pages)
    .where(and(siblings, eq(pages.id, neighbourId)))
  if (!neighbour) throw new Error(`${neighbourId} no está en esa rama`)
  if (placement.before) {
    const [previous] = await tx
      .select({ position: extreme('max') })
      .from(pages)
      .where(and(siblings, sql`${pages.position} collate "C" < ${neighbour.position}`))
    return keyBetween(previous?.position ?? null, neighbour.position)
  }
  const [next] = await tx
    .select({ position: extreme('min') })
    .from(pages)
    .where(and(siblings, sql`${pages.position} collate "C" > ${neighbour.position}`))
  return keyBetween(neighbour.position, next?.position ?? null)
}

export function createPage(
  db: Database,
  context: OperationContext,
  input: { worldId: string; title: string; placement: Placement }
) {
  return operation(db, context, async (w) => {
    const position = await placeKey(w.read, input.worldId, input.placement)
    return w.insert(pages, { worldId: input.worldId, parentId: input.placement.parentId, position, title: input.title })
  })
}

export function updatePage(
  db: Database,
  context: OperationContext,
  pageId: string,
  patch: { title?: string; icon?: string | null; properties?: unknown[] }
) {
  return operation(db, context, (w) => w.update(pages, pageId, patch))
}

/** Cuáles de estas páginas son del mundo y no están en la papelera (para las propiedades que enlazan páginas) */
export async function existingPages(db: Database, worldId: string, pageIds: readonly string[]) {
  if (pageIds.length === 0) return new Set<string>()
  const rows = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.worldId, worldId), isNull(pages.deletedAt), inArray(pages.id, [...pageIds])))
  return new Set(rows.map((row) => row.id))
}

/** Los títulos de estas páginas del mundo que siguen fuera de la papelera */
export async function titlesOf(db: Database, worldId: string, pageIds: readonly string[]) {
  if (pageIds.length === 0) return new Map<string, string>()
  const rows = await db
    .select({ id: pages.id, title: pages.title })
    .from(pages)
    .where(and(eq(pages.worldId, worldId), isNull(pages.deletedAt), inArray(pages.id, [...new Set(pageIds)])))
  return new Map(rows.map((row) => [row.id, row.title]))
}

/** Las propiedades de las páginas del mundo que tienen alguna (para las etiquetas) */
export function listProperties(db: Database, worldId: string) {
  return db
    .select({ id: pages.id, properties: pages.properties })
    .from(pages)
    .where(and(eq(pages.worldId, worldId), isNull(pages.deletedAt), sql`${pages.properties} <> '[]'::jsonb`))
}

export function movePage(
  db: Database,
  context: OperationContext,
  pageId: string,
  input: { worldId: string; placement: Placement }
) {
  return operation(db, context, async (w) => {
    const position = await placeKey(w.read, input.worldId, input.placement, pageId)
    return w.update(pages, pageId, { parentId: input.placement.parentId, position })
  })
}

/**
 * Las subpáginas de una página, a cualquier profundidad, que están como ella: fuera de la papelera si ella lo está, o
 * borradas en el mismo momento si está en la papelera (las que se fueron con ella)
 */
async function sameStateBelow(db: Database | Transaction, pageId: string) {
  const rows = await db.execute<{ id: string }>(sql`
    with recursive down as (
      select id, deleted_at, 0 as depth from pages where parent_id = ${pageId}
      union all
      select p.id, p.deleted_at, down.depth + 1 from pages p join down on p.parent_id = down.id where down.depth < 64
    )
    select id from down
    where deleted_at is not distinct from (select deleted_at from pages where id = ${pageId})`)
  return rows.map((row) => row.id)
}

/**
 * Manda la página a la papelera con las subpáginas que no lo estaban, en una sola operación y con el mismo momento:
 * así vuelven juntas. Devuelve cuántas subpáginas se fueron con ella
 */
export function deletePageTree(db: Database, context: OperationContext, pageId: string) {
  return operation(db, context, async (w) => {
    const now = new Date()
    const below = await sameStateBelow(w.read, pageId)
    await w.update(pages, pageId, { deletedAt: now })
    for (const id of below) await w.update(pages, id, { deletedAt: now })
    return below.length
  })
}

/** Una página de la papelera, y si su madre también está en ella (entonces se restaura la madre) */
export async function findTrashedPage(db: Database, pageId: string) {
  const parent = alias(pages, 'parent')
  const [found] = await db
    .select({
      id: pages.id,
      worldId: pages.worldId,
      title: pages.title,
      deletedAt: pages.deletedAt,
      parentInTrash: sql<boolean>`${parent.deletedAt} is not null`
    })
    .from(pages)
    .leftJoin(parent, eq(parent.id, pages.parentId))
    .where(and(eq(pages.id, pageId), isNotNull(pages.deletedAt)))
  return found ?? null
}

/** Saca de la papelera la página y las subpáginas que se fueron con ella (las del mismo momento), en una operación */
export function restorePageTree(db: Database, context: OperationContext, pageId: string) {
  return operation(db, context, async (w) => {
    const together = await sameStateBelow(w.read, pageId)
    await w.update(pages, pageId, { deletedAt: null })
    for (const id of together) await w.update(pages, id, { deletedAt: null })
    return together.length
  })
}
