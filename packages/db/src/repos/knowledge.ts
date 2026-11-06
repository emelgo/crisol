/**
 * Lo que sabe cada campaña (ADR-0017): leer las marcas del mundo y de sus campañas, el árbol con el que se calcula la
 * herencia, y poner o quitar una marca en una operación (con su historial)
 */
import type { KnowledgeKind, KnowledgeMark } from '@crisol/domain'
import { and, eq, inArray, isNull, or, type SQL, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation, type Writer } from '../operation.ts'
import { campaigns } from '../schema/campaigns.ts'
import { characters } from '../schema/characters.ts'
import { documents } from '../schema/documents.ts'
import { knowledge } from '../schema/knowledge.ts'
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

/**
 * Copia lo que sabe una campaña a otra nueva (al crearla con «lo mismo que otra»), dentro de su operación. Lo que solo
 * saben unos personajes no pasa: son de la otra campaña
 */
export async function copyCampaignMarks(w: Writer, from: string, to: { worldId: string; campaignId: string }) {
  const rows = await w.read
    .select()
    .from(knowledge)
    .where(and(eq(knowledge.campaignId, from), isNull(knowledge.characters)))
  if (rows.length === 0) return
  await w.insertMany(
    knowledge,
    rows.map((row) => ({
      worldId: to.worldId,
      campaignId: to.campaignId,
      kind: row.kind,
      targetId: row.targetId,
      known: row.known,
      characters: null
    }))
  )
}

/** Lo que se marca, si es del mundo: su página (la de un secreto, una pestaña o un mapa) y un nombre para el historial */
export async function findTarget(
  db: Database,
  worldId: string,
  kind: KnowledgeKind,
  targetId: string
): Promise<{ pageId: string | null; name: string } | null> {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)
  if (!uuid) return null
  const live = and(eq(pages.worldId, worldId), isNull(pages.deletedAt))
  switch (kind) {
    case 'page': {
      const [row] = await db
        .select({ pageId: pages.id, name: pages.title })
        .from(pages)
        .where(and(eq(pages.id, targetId), live))
      return row ?? null
    }
    case 'secret': {
      const [row] = await db
        .select({ pageId: pages.id, name: pages.title })
        .from(documents)
        .innerJoin(pages, eq(pages.id, documents.pageId))
        .where(and(eq(documents.id, targetId), eq(documents.kind, 'secret'), live))
      return row ?? null
    }
    case 'tab': {
      const [row] = await db
        .select({ pageId: pages.id, name: pageTabs.name })
        .from(pageTabs)
        .innerJoin(pages, eq(pages.id, pageTabs.pageId))
        .where(and(eq(pageTabs.id, targetId), live))
      return row ?? null
    }
    case 'pin': {
      const [row] = await db
        .select({ pageId: pages.id, name: sql<string>`coalesce(${mapPins.label}, '')` })
        .from(mapPins)
        .innerJoin(maps, eq(maps.id, mapPins.mapId))
        .innerJoin(pageTabs, eq(pageTabs.id, maps.tabId))
        .innerJoin(pages, eq(pages.id, pageTabs.pageId))
        .where(and(eq(mapPins.id, targetId), live))
      return row ?? null
    }
    case 'element': {
      const [row] = await db
        .select({ pageId: pages.id, name: sql<string>`coalesce(${mapElements.label}, '')` })
        .from(mapElements)
        .innerJoin(maps, eq(maps.id, mapElements.mapId))
        .innerJoin(pageTabs, eq(pageTabs.id, maps.tabId))
        .innerJoin(pages, eq(pages.id, pageTabs.pageId))
        .where(and(eq(mapElements.id, targetId), live))
      return row ?? null
    }
    case 'content': {
      const [row] = await db
        .select({ name: sql<string>`coalesce(${worldContent.data}->>'name', ${worldContent.key})` })
        .from(worldContent)
        .where(and(eq(worldContent.id, targetId), eq(worldContent.worldId, worldId)))
      return row ? { pageId: null, name: row.name } : null
    }
  }
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
