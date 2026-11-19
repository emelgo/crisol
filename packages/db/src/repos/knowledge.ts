/**
 * Lo que sabe cada campaña (ADR-0017): leer las marcas del mundo y de sus campañas, el árbol con el que se calcula la
 * herencia, y poner o quitar una marca en una operación (con su historial)
 */
import type { KnowledgeKind, KnowledgeMark } from '@crisol/domain'
import { and, eq, inArray, isNull, or, type SQL, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation, type Writer } from '../operation.ts'
import { campaignMembers, campaigns } from '../schema/campaigns.ts'
import { characters } from '../schema/characters.ts'
import { chronologies, timelineEvents } from '../schema/chronologies.ts'
import { documents } from '../schema/documents.ts'
import { knowledge, knowledgeNews, pageEditors } from '../schema/knowledge.ts'
import { mapElements, mapPins, maps, pageTabs } from '../schema/maps.ts'
import { pages } from '../schema/pages.ts'
import { worldContent } from '../schema/systems.ts'

export type KnowledgeRow = typeof knowledge.$inferSelect

const asMark = (row: KnowledgeRow): KnowledgeMark => ({
  campaignId: row.campaignId,
  kind: row.kind,
  targetId: row.targetId,
  known: row.known,
  characters: row.characters
})

/**
 * Las marcas del mundo y, de las campañas, las de esas (o las de todas, para el máster que ve qué sabe cada una).
 * Con kinds, solo de esos tipos
 */
export async function listMarks(
  db: Database,
  input: { worldId: string; campaignIds: readonly string[] | 'all'; kinds?: readonly KnowledgeKind[] }
): Promise<KnowledgeMark[]> {
  const filters: SQL[] = [eq(knowledge.worldId, input.worldId)]
  if (input.campaignIds !== 'all') {
    const layers = [isNull(knowledge.campaignId)]
    if (input.campaignIds.length > 0) layers.push(inArray(knowledge.campaignId, [...input.campaignIds]))
    filters.push(or(...layers) as SQL)
  }
  if (input.kinds) filters.push(inArray(knowledge.kind, [...input.kinds]))
  const rows = await db
    .select()
    .from(knowledge)
    .where(and(...filters))
  return rows.map(asMark)
}

/** Las filas de una campaña, de la más reciente a la más antigua (lo que sabe el grupo) */
export function campaignRows(db: Database, campaignId: string) {
  return db
    .select()
    .from(knowledge)
    .where(eq(knowledge.campaignId, campaignId))
    .orderBy(sql`${knowledge.updatedAt} desc`, knowledge.id)
}

/** Las marcas del mundo (lo que sabe todo el mundo), de la más reciente a la más antigua */
export function worldRows(db: Database, worldId: string) {
  return db
    .select()
    .from(knowledge)
    .where(and(eq(knowledge.worldId, worldId), isNull(knowledge.campaignId)))
    .orderBy(sql`${knowledge.updatedAt} desc`, knowledge.id)
}

/** El árbol del mundo fuera de la papelera: lo justo para calcular la herencia */
export function worldTree(db: Database, worldId: string) {
  return db
    .select({ id: pages.id, parentId: pages.parentId })
    .from(pages)
    .where(and(eq(pages.worldId, worldId), isNull(pages.deletedAt)))
}

/** Los personajes de una cuenta en una campaña: lo que sabe por ellos */
export async function characterIdsOf(db: Database, campaignId: string, userId: string) {
  const rows = await db
    .select({ id: characters.id })
    .from(characters)
    .where(and(eq(characters.campaignId, campaignId), eq(characters.ownerId, userId)))
  return rows.map((row) => row.id)
}

/** Si cada campaña parte de lo que sabe el mundo */
export async function knowsWorld(db: Database, campaignIds: readonly string[]) {
  if (campaignIds.length === 0) return new Map<string, boolean>()
  const rows = await db
    .select({ id: campaigns.id, knowsWorld: campaigns.knowsWorld })
    .from(campaigns)
    .where(inArray(campaigns.id, [...campaignIds]))
  return new Map(rows.map((row) => [row.id, row.knowsWorld]))
}

/** Lo que se pide de una marca: null en known la quita (vuelve a heredar) */
export interface MarkChange {
  worldId: string
  campaignId: string | null
  kind: KnowledgeKind
  targetId: string
  known: boolean | null
  /** null: todos. En el mundo y en «no la conocen», no cuenta */
  characters: readonly string[] | null
}

/** Pone, cambia o quita una marca dentro de una operación; da la fila que queda (o null si se quitó o no había) */
export async function writeMark(w: Writer, change: MarkChange): Promise<KnowledgeRow | null> {
  const [current] = await w.read
    .select()
    .from(knowledge)
    .where(
      and(
        eq(knowledge.worldId, change.worldId),
        change.campaignId === null ? isNull(knowledge.campaignId) : eq(knowledge.campaignId, change.campaignId),
        eq(knowledge.kind, change.kind),
        eq(knowledge.targetId, change.targetId)
      )
    )
    .for('update')
  if (change.known === null) {
    if (current) await w.remove(knowledge, current.id)
    return null
  }
  // El público solo cuenta en una campaña y cuando la conocen
  const audience =
    change.campaignId !== null && change.known && change.characters !== null ? [...new Set(change.characters)] : null
  if (current) {
    const same =
      current.known === change.known && JSON.stringify(current.characters ?? null) === JSON.stringify(audience)
    return same ? current : w.update(knowledge, current.id, { known: change.known, characters: audience })
  }
  return w.insert(knowledge, {
    worldId: change.worldId,
    campaignId: change.campaignId,
    kind: change.kind,
    targetId: change.targetId,
    known: change.known,
    characters: audience
  })
}

/** Pone o quita una marca, en su propia operación */
export function setMark(db: Database, context: OperationContext, change: MarkChange) {
  return operation(db, context, (w) => writeMark(w, change))
}

/** Varias marcas en una sola operación (revelar un secreto y su página: se deshacen juntas) */
export function setMarks(db: Database, context: OperationContext, changes: readonly MarkChange[]) {
  return operation(db, context, async (w) => {
    for (const change of changes) await writeMark(w, change)
  })
}

/** La marca de una cosa en una campaña (o en el mundo), si tiene */
export async function findMark(
  db: Database,
  input: { worldId: string; campaignId: string | null; kind: KnowledgeKind; targetId: string }
) {
  const [row] = await db
    .select()
    .from(knowledge)
    .where(
      and(
        eq(knowledge.worldId, input.worldId),
        input.campaignId === null ? isNull(knowledge.campaignId) : eq(knowledge.campaignId, input.campaignId),
        eq(knowledge.kind, input.kind),
        eq(knowledge.targetId, input.targetId)
      )
    )
  return row ?? null
}

/**
 * Copia lo que sabe una campaña a otra nueva (al crearla con «lo mismo que otra»), dentro de su operación. Lo que solo
 * saben unos personajes (que son de la otra) pasa como «no la conocen»: la campaña entera no lo sabía
 */
export async function copyCampaignMarks(w: Writer, from: string, to: { worldId: string; campaignId: string }) {
  const rows = await w.read.select().from(knowledge).where(eq(knowledge.campaignId, from))
  if (rows.length === 0) return
  await w.insertMany(
    knowledge,
    rows.map((row) => ({
      worldId: to.worldId,
      campaignId: to.campaignId,
      kind: row.kind,
      targetId: row.targetId,
      known: row.known && row.characters === null,
      characters: null
    }))
  )
}

/** Lo que se marca, si es del mundo: su página (la de un secreto, una pestaña o un mapa) y un nombre para el historial */
export interface MarkTarget {
  pageId: string | null
  name: string
  hidden?: boolean
}

export async function findTarget(
  db: Database,
  worldId: string,
  kind: KnowledgeKind,
  targetId: string
): Promise<MarkTarget | null> {
  return (await findTargets(db, worldId, kind, [targetId])).get(targetId) ?? null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Su nombre, en español si lo tiene (o el primero que tenga) */
function contentName(data: unknown, key: string) {
  const name = (data as { name?: unknown } | null)?.name
  const text =
    typeof name === 'string'
      ? name
      : name && typeof name === 'object'
        ? ((name as Record<string, string>).es ?? Object.values(name as Record<string, string>)[0])
        : undefined
  return text || key
}

/** Lo mismo que findTarget, de varios de un tipo a la vez (por su id; lo que no está, no sale) */
export async function findTargets(
  db: Database,
  worldId: string,
  kind: KnowledgeKind,
  targetIds: readonly string[]
): Promise<Map<string, MarkTarget>> {
  // Todo va por su id, salvo una entrada del compendio del mundo: por su clave
  const ids = [...new Set(kind === 'content' ? targetIds : targetIds.filter((id) => UUID.test(id)))]
  const found = new Map<string, MarkTarget>()
  if (ids.length === 0) return found
  const live = and(eq(pages.worldId, worldId), isNull(pages.deletedAt))
  const put = (rows: { id: string; pageId: string | null; name: string; hidden?: boolean }[]) => {
    for (const { id, ...target } of rows) found.set(id, target)
  }
  switch (kind) {
    case 'page':
      put(
        await db
          .select({ id: pages.id, pageId: pages.id, name: pages.title })
          .from(pages)
          .where(and(inArray(pages.id, ids), live))
      )
      break
    case 'secret':
      put(
        await db
          .select({ id: documents.id, pageId: pages.id, name: pages.title })
          .from(documents)
          .innerJoin(pages, eq(pages.id, documents.pageId))
          .where(and(inArray(documents.id, ids), eq(documents.kind, 'secret'), live))
      )
      break
    case 'tab':
      put(
        await db
          .select({ id: pageTabs.id, pageId: pages.id, name: pageTabs.name, hidden: pageTabs.hidden })
          .from(pageTabs)
          .innerJoin(pages, eq(pages.id, pageTabs.pageId))
          .where(and(inArray(pageTabs.id, ids), live))
      )
      break
    case 'pin':
      put(
        await db
          .select({
            id: mapPins.id,
            pageId: pages.id,
            name: sql<string>`coalesce(${mapPins.label}, '')`,
            hidden: mapPins.hidden
          })
          .from(mapPins)
          .innerJoin(maps, eq(maps.id, mapPins.mapId))
          .innerJoin(pageTabs, eq(pageTabs.id, maps.tabId))
          .innerJoin(pages, eq(pages.id, pageTabs.pageId))
          .where(and(inArray(mapPins.id, ids), live))
      )
      break
    case 'element':
      put(
        await db
          .select({
            id: mapElements.id,
            pageId: pages.id,
            name: sql<string>`coalesce(${mapElements.label}, '')`,
            hidden: mapElements.hidden
          })
          .from(mapElements)
          .innerJoin(maps, eq(maps.id, mapElements.mapId))
          .innerJoin(pageTabs, eq(pageTabs.id, maps.tabId))
          .innerJoin(pages, eq(pages.id, pageTabs.pageId))
          .where(and(inArray(mapElements.id, ids), live))
      )
      break
    case 'event':
      // Un evento (módulo 8): su título o, sin él, el de su página enlazada; cuelga de la página de su cronología
      // (ADR-0032: se ve con su pestaña)
      put(
        await db
          .select({
            id: timelineEvents.id,
            pageId: pageTabs.pageId,
            name: sql<string>`coalesce(nullif(${timelineEvents.title}, ''), ${pages.title}, '')`,
            hidden: timelineEvents.hidden
          })
          .from(timelineEvents)
          .innerJoin(chronologies, eq(chronologies.id, timelineEvents.chronologyId))
          .innerJoin(pageTabs, eq(pageTabs.id, chronologies.tabId))
          .leftJoin(pages, eq(pages.id, timelineEvents.pageId))
          .where(and(inArray(timelineEvents.id, ids), eq(timelineEvents.worldId, worldId)))
      )
      break
    case 'chronology':
      // Una marca de antes de que las cronologías fueran pestañas (ADR-0031; la migración 0090 las pasó a su página)
      put(
        await db
          .select({ id: chronologies.id, pageId: pageTabs.pageId, name: pages.title })
          .from(chronologies)
          .innerJoin(pageTabs, eq(pageTabs.id, chronologies.tabId))
          .innerJoin(pages, eq(pages.id, pageTabs.pageId))
          .where(and(inArray(chronologies.id, ids), eq(chronologies.worldId, worldId)))
      )
      break
    case 'content': {
      // Una clave puede estar en el compendio del mundo para varios sistemas: vale la primera
      const rows = await db
        .select({ key: worldContent.key, data: worldContent.data })
        .from(worldContent)
        .where(and(inArray(worldContent.key, ids), eq(worldContent.worldId, worldId)))
      for (const row of rows)
        if (!found.has(row.key)) found.set(row.key, { pageId: null, name: contentName(row.data, row.key) })
      break
    }
  }
  return found
}

/** Los secretos y las pestañas de texto del mundo, con su página (y la pestaña, si está oculta): para filtrar lo que se busca */
export function separatesOf(db: Database, worldId: string) {
  return db
    .select({
      id: documents.id,
      pageId: documents.pageId,
      kind: documents.kind,
      tabId: pageTabs.id,
      hidden: pageTabs.hidden
    })
    .from(documents)
    .innerJoin(pages, and(eq(pages.id, documents.pageId), isNull(pages.deletedAt)))
    .leftJoin(pageTabs, eq(pageTabs.documentId, documents.id))
    .where(and(eq(documents.worldId, worldId), inArray(documents.kind, ['secret', 'tab'])))
}

/**
 * Dónde se usa un archivo del mundo, para saber si un jugador lo puede abrir (ADR-0017): como portada o imagen del
 * panel de una página, incrustado en un documento, como imagen de un mapa o de un evento suelto, o como portada del
 * mundo o de una campaña
 */
export async function fileUses(db: Database, worldId: string, fileId: string) {
  const [covers, panels, embeds, mapImages, campaignCovers, world, events, chronologyRows] = await Promise.all([
    db.execute<{ id: string }>(sql`
      select id from pages where world_id = ${worldId} and deleted_at is null and cover->>'fileId' = ${fileId}`),
    db.execute<{ id: string }>(sql`
      select p.id from pages p, jsonb_array_elements(p.panel) b
      where p.world_id = ${worldId} and p.deleted_at is null and b->>'type' = 'image' and b->>'fileId' = ${fileId}
        and coalesce(b->>'hidden', '') <> 'true'`),
    db.execute<{
      page_id: string
      document_id: string
      kind: string
      tab_id: string | null
      hidden: boolean | null
    }>(sql`
      select e.source_page_id as page_id, e.source_document_id as document_id, d.kind, t.id as tab_id, t.hidden
      from file_embeds e join documents d on d.id = e.source_document_id
        left join page_tabs t on t.document_id = d.id
      where e.world_id = ${worldId} and e.file_id = ${fileId}`),
    db.execute<{ tab_id: string; page_id: string; hidden: boolean }>(sql`
      select t.id as tab_id, t.page_id, t.hidden from maps m join page_tabs t on t.id = m.tab_id
      where m.world_id = ${worldId} and m.file_id = ${fileId}`),
    db.execute<{ id: string }>(sql`
      select id from campaigns where world_id = ${worldId} and deleted_at is null and cover->>'fileId' = ${fileId}`),
    db.execute<{ id: string }>(sql`select id from worlds where id = ${worldId} and cover->>'fileId' = ${fileId}`),
    db
      .select({ id: timelineEvents.id, hidden: timelineEvents.hidden })
      .from(timelineEvents)
      .where(and(eq(timelineEvents.worldId, worldId), sql`${timelineEvents.image}->>'fileId' = ${fileId}`)),
    db
      .select({ tabId: pageTabs.id, pageId: pageTabs.pageId, hidden: pageTabs.hidden })
      .from(chronologies)
      .innerJoin(pageTabs, eq(pageTabs.id, chronologies.tabId))
      .innerJoin(pages, and(eq(pages.id, pageTabs.pageId), isNull(pages.deletedAt)))
      .where(eq(chronologies.worldId, worldId))
  ])
  return {
    covers: [...covers].map((r) => r.id),
    panels: [...panels].map((r) => r.id),
    embeds: [...embeds].map((r) => ({
      pageId: r.page_id,
      documentId: r.document_id,
      kind: r.kind,
      tabId: r.tab_id,
      hidden: r.hidden ?? false
    })),
    maps: [...mapImages].map((r) => ({ tabId: r.tab_id, pageId: r.page_id, hidden: r.hidden })),
    campaignCovers: [...campaignCovers].map((r) => r.id),
    worldCover: [...world].length > 0,
    /** Como imagen de un evento suelto: lo ve quien ve el evento y alguna cronología (su pestaña, ADR-0031) */
    events,
    chronologies: events.length > 0 ? chronologyRows : []
  }
}

/** Los jugadores de una campaña con sus personajes (para saber a quién le aparece algo al revelarlo) */
export async function campaignPlayers(db: Database, campaignId: string) {
  const members = await db
    .select({ userId: campaignMembers.userId })
    .from(campaignMembers)
    .where(and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.role, 'player')))
  const owned = await db
    .select({ id: characters.id, ownerId: characters.ownerId })
    .from(characters)
    .where(eq(characters.campaignId, campaignId))
  return members.map((m) => ({
    userId: m.userId,
    characterIds: owned.filter((c) => c.ownerId === m.userId).map((c) => c.id)
  }))
}

export interface NewsItem {
  userId: string
  campaignId: string
  kind: KnowledgeKind
  targetId: string
  pageId: string | null
}

/** Apunta lo nuevo de unos jugadores (si ya estaba, se queda como estaba) */
export async function addNews(db: Database, items: readonly NewsItem[]) {
  if (items.length === 0) return
  await db
    .insert(knowledgeNews)
    .values([...items])
    .onConflictDoNothing()
}

/** Lo nuevo de un jugador en una campaña, de lo más reciente a lo más antiguo */
export function listNews(db: Database, userId: string, campaignId: string) {
  return db
    .select()
    .from(knowledgeNews)
    .where(and(eq(knowledgeNews.userId, userId), eq(knowledgeNews.campaignId, campaignId)))
    .orderBy(sql`${knowledgeNews.createdAt} desc`, knowledgeNews.id)
}

/** Ya lo ha visto: lo nuevo de esa página (ella y lo que hay en ella) */
export async function seeNews(db: Database, userId: string, campaignId: string, pageId: string) {
  await db
    .delete(knowledgeNews)
    .where(
      and(
        eq(knowledgeNews.userId, userId),
        eq(knowledgeNews.campaignId, campaignId),
        or(eq(knowledgeNews.pageId, pageId), and(eq(knowledgeNews.kind, 'page'), eq(knowledgeNews.targetId, pageId)))
      )
    )
}

/** Una entrada del compendio del mundo, abierta: deja de ser nueva */
export async function seeContentNews(db: Database, userId: string, campaignId: string, key: string) {
  await db
    .delete(knowledgeNews)
    .where(
      and(
        eq(knowledgeNews.userId, userId),
        eq(knowledgeNews.campaignId, campaignId),
        eq(knowledgeNews.kind, 'content'),
        eq(knowledgeNews.targetId, key)
      )
    )
}

/** Oculto otra vez: deja de ser nuevo para todos */
export async function dropNews(db: Database, campaignId: string, kind: KnowledgeKind, targetId: string) {
  const own = and(eq(knowledgeNews.kind, kind), eq(knowledgeNews.targetId, targetId))
  // Una página oculta se lleva también lo nuevo de dentro (sus secretos, sus pines)
  await db
    .delete(knowledgeNews)
    .where(
      and(eq(knowledgeNews.campaignId, campaignId), kind === 'page' ? or(own, eq(knowledgeNews.pageId, targetId)) : own)
    )
}

/** Quién puede escribir en una página, por campaña (docs/specs/pagina-de-jugadores.md) */
export function pageEditorsOf(db: Database, pageId: string) {
  return db
    .select({ campaignId: pageEditors.campaignId, characters: pageEditors.characters })
    .from(pageEditors)
    .where(eq(pageEditors.pageId, pageId))
}

/** Las páginas de un mundo que alguna campaña puede editar */
export async function editedPages(db: Database, worldId: string) {
  const rows = await db
    .selectDistinct({ pageId: pageEditors.pageId })
    .from(pageEditors)
    .where(eq(pageEditors.worldId, worldId))
  return new Set(rows.map((row) => row.pageId))
}

/** Si alguna campaña puede editar esa página */
export async function isEdited(db: Database, pageId: string) {
  const [row] = await db.select({ id: pageEditors.id }).from(pageEditors).where(eq(pageEditors.pageId, pageId)).limit(1)
  return Boolean(row)
}

/**
 * Pone, cambia o quita quién de una campaña puede escribir en una página, dentro de una operación. editors: null, nadie;
 * 'all', toda la campaña; si no, esos personajes
 */
export async function writeEditors(
  w: Writer,
  change: { worldId: string; campaignId: string; pageId: string; editors: 'all' | readonly string[] | null }
) {
  const [current] = await w.read
    .select()
    .from(pageEditors)
    .where(and(eq(pageEditors.campaignId, change.campaignId), eq(pageEditors.pageId, change.pageId)))
    .for('update')
  if (change.editors === null || (Array.isArray(change.editors) && change.editors.length === 0)) {
    if (current) await w.remove(pageEditors, current.id)
    return null
  }
  const characters = change.editors === 'all' ? null : [...new Set(change.editors)]
  if (current) {
    const same = JSON.stringify(current.characters ?? null) === JSON.stringify(characters)
    return same ? current : w.update(pageEditors, current.id, { characters })
  }
  return w.insert(pageEditors, {
    worldId: change.worldId,
    campaignId: change.campaignId,
    pageId: change.pageId,
    characters
  })
}

/**
 * Lo que deja escribir en esa página a esa cuenta como jugadora: en cada campaña suya (no en la papelera) con permiso,
 * si es para toda la campaña o para unos personajes, sus personajes en ella y si parte de lo que sabe el mundo (para
 * mirar después si la ve)
 */
export async function editorGrants(db: Database, userId: string, pageId: string) {
  const rows = await db
    .select({
      campaignId: pageEditors.campaignId,
      characters: pageEditors.characters,
      knowsWorld: campaigns.knowsWorld,
      worldId: pageEditors.worldId
    })
    .from(pageEditors)
    .innerJoin(
      campaignMembers,
      and(eq(campaignMembers.campaignId, pageEditors.campaignId), eq(campaignMembers.userId, userId))
    )
    .innerJoin(campaigns, and(eq(campaigns.id, pageEditors.campaignId), isNull(campaigns.deletedAt)))
    .where(eq(pageEditors.pageId, pageId))
  return Promise.all(rows.map(async (row) => ({ ...row, mine: await characterIdsOf(db, row.campaignId, userId) })))
}
