import { keyBetween } from '@crisol/domain'
import { and, eq, inArray, isNotNull, isNull, ne, type SQL, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Database } from '../client.ts'
import { type OperationContext, operation, type Transaction, type Writer } from '../operation.ts'
import { documents } from '../schema/documents.ts'
import { pages } from '../schema/pages.ts'
import { worlds } from '../schema/worlds.ts'
import { writeMark } from './knowledge.ts'
import { type DocumentState, recordVersion } from './versions.ts'

const summaryColumns = {
  id: pages.id,
  worldId: pages.worldId,
  parentId: pages.parentId,
  position: pages.position,
  title: pages.title,
  icon: pages.icon,
  template: pages.template,
  version: pages.version
}

/** Si tiene subpáginas fuera de la papelera (con la tabla escrita: dentro de la subconsulta, id sería el de c) */
const hasChildren = sql<boolean>`exists (select 1 from pages c where c.parent_id = "pages"."id" and c.deleted_at is null)`
/** El orden entre hermanas: la clave, comparada carácter a carácter */
const byPosition = [sql`${pages.position} collate "C"`, pages.id]

/** Una lista de ids como un solo parámetro (miles de páginas no son miles de parámetros) */
export const uuidArray = (ids: readonly string[]) => sql`string_to_array(${ids.join(',')}, ',')::uuid[]`

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
      cover: pages.cover,
      sheet: pages.sheet,
      panel: pages.panel,
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

/** Las rutas de varias páginas de una vez (para listas de resultados): id → del primer nivel a ella */
export async function pagePaths(db: Database, pageIds: readonly string[]) {
  const paths = new Map<string, { id: string; title: string }[]>()
  if (pageIds.length === 0) return paths
  const rows = await db.execute<{ start: string; id: string; title: string }>(sql`
    with recursive up as (
      select id as start, id, parent_id, title, 0 as depth from pages
        where id in (${sql.join(
          pageIds.map((id) => sql`${id}::uuid`),
          sql`, `
        )})
      union all
      select up.start, p.id, p.parent_id, p.title, up.depth + 1 from pages p join up on p.id = up.parent_id
        where up.depth < 64
    )
    select start, id, title from up order by start, depth desc`)
  for (const row of rows) paths.set(row.start, [...(paths.get(row.start) ?? []), { id: row.id, title: row.title }])
  return paths
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
    template: string | null
    has_children: boolean
  }>(sql`
    with recursive down as (
      select id, parent_id, position, title, icon, template, 1 as level from pages
      where world_id = ${worldId} and ${top} and deleted_at is null
      union all
      select p.id, p.parent_id, p.position, p.title, p.icon, p.template, down.level + 1 from pages p
      join down on p.parent_id = down.id where p.deleted_at is null and down.level < ${levels}
    )
    select id, parent_id, position, title, icon, template,
      exists (select 1 from pages c where c.parent_id = down.id and c.deleted_at is null) as has_children
    from down`)
  return rows.map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    position: row.position,
    title: row.title,
    icon: row.icon,
    template: row.template,
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
  input: { worldId: string; title: string; placement: Placement; hidden?: boolean }
) {
  return operation(db, context, async (w) => {
    const position = await placeKey(w.read, input.worldId, input.placement)
    const page = await w.insert(pages, {
      worldId: input.worldId,
      parentId: input.placement.parentId,
      position,
      title: input.title
    })
    if (input.hidden) await hideFromPlayers(w, input.worldId, page.id)
    return page
  })
}

/** Nace oculta (ADR-0017): bajo una página que alguna campaña conoce, «No lo sabe nadie» en el mundo */
const hideFromPlayers = (w: Writer, worldId: string, pageId: string) =>
  writeMark(w, { worldId, campaignId: null, kind: 'page', targetId: pageId, known: false, characters: null })

/**
 * La página de portada de un mundo (como la «Home» de Everlore): la primera de lo más alto, y el mundo la apunta. En
 * una sola operación, así deshacerla quita las dos cosas
 */
/**
 * Crea la portada del mundo, salvo si otra petición a la vez ya la creó (el mundo, bloqueado mientras): entonces
 * devuelve esa, sin crear nada (created: false)
 */
export function createHomePage(db: Database, context: OperationContext, input: { worldId: string; title: string }) {
  return operation(db, context, async (w) => {
    const [world] = await w.read
      .select({ home: worlds.homePageId })
      .from(worlds)
      .where(eq(worlds.id, input.worldId))
      .for('update')
    if (world?.home) {
      const [existing] = await w.read
        .select()
        .from(pages)
        .where(and(eq(pages.id, world.home), isNull(pages.deletedAt)))
      if (existing) return { page: existing, created: false }
    }
    const [first] = await w.read
      .select({ id: pages.id })
      .from(pages)
      .where(and(inBranch(input.worldId, null), isNull(pages.deletedAt)))
      .orderBy(...byPosition)
      .limit(1)
    const position = await placeKey(w.read, input.worldId, { parentId: null, ...(first ? { before: first.id } : {}) })
    const page = await w.insert(pages, { worldId: input.worldId, parentId: null, position, title: input.title })
    await w.update(worlds, input.worldId, { homePageId: page.id })
    return { page, created: true }
  })
}

export function updatePage(
  db: Database,
  context: OperationContext,
  pageId: string,
  patch: {
    title?: string
    icon?: string | null
    properties?: unknown[]
    locked?: boolean
    cover?: { fileId: string; x: number; y: number; zoom?: number } | null
    sheet?: Record<string, unknown> | null
    panel?: unknown[]
  }
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
 * Ordena las subpáginas de una página (o el primer nivel) por título, de la A a la Z o al revés, en una sola operación.
 * La portada del mundo, si está entre ellas, se queda la primera
 */
export function sortChildren(
  db: Database,
  context: OperationContext,
  input: { worldId: string; parentId: string | null; order: 'asc' | 'desc'; keepFirst: string | null }
) {
  return operation(db, context, async (w) => {
    const children = await listChildren(w.read as unknown as Database, input.worldId, input.parentId)
    const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })
    const sorted = [...children].sort((a, b) =>
      input.order === 'asc' ? collator.compare(a.title, b.title) : collator.compare(b.title, a.title)
    )
    const first = sorted.findIndex((child) => child.id === input.keepFirst)
    if (first > 0) sorted.unshift(...sorted.splice(first, 1))
    let previous: string | null = null
    for (const child of sorted) {
      previous = keyBetween(previous, null)
      await w.update(pages, child.id, { position: previous })
    }
    // Las de la papelera, detrás y en su orden: si conservaran su sitio, al restaurarlas podrían compartirlo con otra
    const trashed = await w.read
      .select({ id: pages.id })
      .from(pages)
      .where(and(inBranch(input.worldId, input.parentId), isNotNull(pages.deletedAt)))
      .orderBy(...byPosition)
    for (const child of trashed) {
      previous = keyBetween(previous, null)
      await w.update(pages, child.id, { position: previous })
    }
    return sorted.length
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
 * así vuelven juntas. Devuelve las subpáginas que se fueron con ella
 */
export function deletePageTree(db: Database, context: OperationContext, pageId: string) {
  return operation(db, context, async (w) => {
    const now = new Date()
    const below = await sameStateBelow(w.read, pageId)
    await w.update(pages, pageId, { deletedAt: now })
    for (const id of below) await w.update(pages, id, { deletedAt: now })
    return below
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

/** Los nombres de las páginas del mundo fuera de la papelera (título y propiedades, con los alias), para resolver títulos */
export function pageNames(db: Database, worldId: string) {
  return db
    .select({ id: pages.id, title: pages.title, properties: pages.properties })
    .from(pages)
    .where(and(eq(pages.worldId, worldId), isNull(pages.deletedAt)))
}

/** Una página nueva de las que se crean de una vez, con su cuerpo y sus secretos ya hechos estado de Yjs */
export interface NewPage {
  /** Su id, si se da de antemano (para resolver ya los enlaces de la tanda) */
  id?: string
  key: string
  /** La de la misma tanda que es su madre (va antes en la lista); sin ella, la madre común */
  parentKey: string | null
  title: string
  icon: string | null
  body: Uint8Array | null
  /** El id de su cuerpo, si lo tiene (lo nombra su versión) */
  bodyId?: string
  /** Sus secretos y notas ocultas, con el id que ya lleva el cuerpo */
  separates: { id: string; kind: 'secret' | 'note'; state: Uint8Array }[]
  /** Su primera versión (con texto), en la misma operación: deshacer la creación la quita también */
  version?: { fingerprint: string; documents: DocumentState[] }
  /** La plantilla de la que sale y su linaje (ADR-0009), y su panel */
  template?: { id: string; line: string[] }
  panel?: unknown[]
}

/**
 * Crea varias páginas con sus cuerpos y sus secretos en una sola operación (las madres antes que sus hijas). Las
 * propiedades se ponen al final, cuando ya se saben los ids de todas: así una puede enlazar a otra de la misma tanda
 */
export function createPagesWithBodies(
  db: Database,
  context: OperationContext,
  input: {
    worldId: string
    parentId: string | null
    pages: readonly NewPage[]
    properties: (ids: ReadonlyMap<string, string>) => ReadonlyMap<string, unknown[]>
    /** Las de arriba de la tanda nacen ocultas (sus subpáginas lo heredan) */
    hidden?: boolean
  }
) {
  return operation(db, context, async (w) => {
    const ids = new Map<string, string>()
    const created: { key: string; id: string; title: string; parentId: string | null }[] = []
    const docs: (typeof documents.$inferInsert)[] = []
    // Con los ids de antemano, las propiedades van ya en la fila (sin cambiarla después)
    const given = new Map(input.pages.flatMap((page) => (page.id ? [[page.key, page.id] as const] : [])))
    const early = given.size === input.pages.length ? input.properties(given) : null
    // La última posición de cada rama: se pregunta una vez y se sigue de ahí
    const last = new Map<string | null, string | null>()
    for (const page of input.pages) {
      const parentId = page.parentKey ? (ids.get(page.parentKey) ?? null) : input.parentId
      if (!last.has(parentId)) {
        const [found] = await w.read
          .select({ position: sql<string | null>`max(${pages.position} collate "C")` })
          .from(pages)
          .where(inBranch(input.worldId, parentId))
        last.set(parentId, found?.position ?? null)
      }
      const position = keyBetween(last.get(parentId) ?? null, null)
      last.set(parentId, position)
      const properties = early?.get(page.key)
      const row = await w.insert(pages, {
        ...(page.id ? { id: page.id } : {}),
        worldId: input.worldId,
        parentId,
        position,
        title: page.title,
        icon: page.icon,
        ...(properties && properties.length > 0 ? { properties } : {}),
        ...(page.template ? { template: page.template.id, templateLine: page.template.line } : {}),
        ...(page.panel && page.panel.length > 0 ? { panel: page.panel } : {})
      })
      ids.set(page.key, row.id)
      created.push({ key: page.key, id: row.id, title: row.title, parentId })
      if (input.hidden && !page.parentKey) await hideFromPlayers(w, input.worldId, row.id)
      const owner = { worldId: input.worldId, pageId: row.id, updatedBy: context.actorId }
      if (page.body)
        docs.push({ ...owner, kind: 'body', state: page.body, ...(page.bodyId ? { id: page.bodyId } : {}) })
      for (const separate of page.separates) docs.push({ ...owner, ...separate })
    }
    if (docs.length > 0) await w.read.insert(documents).values(docs)
    for (const page of input.pages) {
      const id = ids.get(page.key)
      if (!id || !page.version) continue
      const via = context.via === 'ai' ? 'ai' : context.via === 'system' ? 'system' : 'ui'
      await recordVersion(w, { pageId: id, worldId: input.worldId, actorId: context.actorId, via, ...page.version })
    }
    if (!early) {
      for (const [key, properties] of input.properties(ids)) {
        const id = ids.get(key)
        if (id && properties.length > 0) await w.update(pages, id, { properties })
      }
    }
    return created
  })
}

/**
 * Las páginas de una plantilla (o de sus copias) cuyo campo apunta a una página (ADR-0009): las filas de una tabla que
 * se llena sola, por título. Una de más, para saber si quedan
 */
export function relatedPages(
  db: Database,
  input: {
    worldId: string
    pageId: string
    template: string
    field: string
    limit: number
    /** Solo estas (las que ve un jugador) */
    within?: readonly string[]
  }
) {
  const contains = JSON.stringify([{ field: input.field, value: [input.pageId] }])
  return db
    .select({ id: pages.id, title: pages.title, icon: pages.icon, properties: pages.properties })
    .from(pages)
    .where(
      and(
        eq(pages.worldId, input.worldId),
        isNull(pages.deletedAt),
        sql`${pages.id} <> ${input.pageId}`,
        sql`${pages.templateLine} @> array[${input.template}]::text[]`,
        sql`${pages.properties} @> ${contains}::jsonb`,
        input.within ? sql`${pages.id} = any(${uuidArray(input.within)})` : undefined
      )
    )
    .orderBy(sql`lower(${pages.title})`, pages.id)
    .limit(input.limit + 1)
}

/** Las páginas del mundo (fuera de la papelera) que apuntan a esta desde un campo de enlace */
export function pagesPointingTo(db: Database, input: { worldId: string; pageId: string }) {
  const contains = JSON.stringify([{ type: 'pages', value: [input.pageId] }])
  return db
    .select({ id: pages.id, title: pages.title, properties: pages.properties })
    .from(pages)
    .where(
      and(
        eq(pages.worldId, input.worldId),
        isNull(pages.deletedAt),
        sql`${pages.id} <> ${input.pageId}`,
        sql`${pages.properties} @> ${contains}::jsonb`
      )
    )
    .orderBy(sql`lower(${pages.title})`, pages.id)
}

/** El árbol entero del mundo, para montar el de un jugador (ADR-0017): lo justo de cada página, en su orden */
export function treeRows(db: Database, worldId: string) {
  return db
    .select({
      id: pages.id,
      parentId: pages.parentId,
      title: pages.title,
      icon: pages.icon,
      template: pages.template,
      version: pages.version
    })
    .from(pages)
    .where(and(eq(pages.worldId, worldId), isNull(pages.deletedAt)))
    .orderBy(...byPosition)
}

/** Todas las páginas del mundo fuera de la papelera, en su orden (para exportar) */
export function worldPages(db: Database, worldId: string) {
  return db
    .select({
      id: pages.id,
      parentId: pages.parentId,
      title: pages.title,
      properties: pages.properties,
      template: pages.template
    })
    .from(pages)
    .where(and(eq(pages.worldId, worldId), isNull(pages.deletedAt)))
    .orderBy(...byPosition)
}

/** Cuáles de estas son páginas del mundo, estén o no en la papelera (para guardar un enlace por su id) */
export async function inWorld(db: Database, worldId: string, pageIds: readonly string[]) {
  if (pageIds.length === 0) return new Set<string>()
  const rows = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.worldId, worldId), inArray(pages.id, [...new Set(pageIds)])))
  return new Set(rows.map((row) => row.id))
}

/**
 * Las páginas del mundo fuera de la papelera cambiadas hace poco, de la última a la primera: su fila o alguno de sus
 * documentos (el cuerpo, un secreto, una nota), lo que sea más reciente
 */
export function recentPages(
  db: Database,
  worldId: string,
  limit: number,
  /** Un jugador (ADR-0017): solo las que ve, y por su cuerpo (lo que cambie en un secreto no cuenta) */
  player?: { within: readonly string[] }
) {
  const editedAt = sql<Date>`greatest(${pages.updatedAt}, coalesce(max(${documents.updatedAt}), ${pages.updatedAt}))`
  const docs = player ? and(eq(documents.pageId, pages.id), eq(documents.kind, 'body')) : eq(documents.pageId, pages.id)
  return db
    .select({ id: pages.id, title: pages.title, icon: pages.icon, cover: pages.cover, editedAt })
    .from(pages)
    .leftJoin(documents, docs)
    .where(
      and(
        eq(pages.worldId, worldId),
        isNull(pages.deletedAt),
        player ? sql`${pages.id} = any(${uuidArray(player.within)})` : undefined
      )
    )
    .groupBy(pages.id)
    .orderBy(sql`${editedAt} desc`, pages.id)
    .limit(limit)
}
