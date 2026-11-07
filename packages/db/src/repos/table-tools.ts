/**
 * Las herramientas de la mesa (docs/specs/herramientas-mesa.md): las marcas de una campaña en una escena (plantillas,
 * dibujos, textos, sellos, pines e imágenes), los widgets de la campaña y las instantáneas. Todo pasa por operation():
 * se deshace desde el historial. Volver a una instantánea es una sola operación (deshacerla lo devuelve todo)
 */
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { prepared } from '../prepared.ts'
import { characters } from '../schema/characters.ts'
import { campaignCreatures } from '../schema/creatures.ts'
import { sceneStates, sceneTokens } from '../schema/scenes.ts'
import {
  campaignWidgets,
  type MarkData,
  type MarkKind,
  type SnapshotData,
  sceneMarks,
  sceneSnapshots
} from '../schema/table-tools.ts'
import { type FogOperationData, sceneFog } from '../schema/vision.ts'

export type MarkRow = typeof sceneMarks.$inferSelect
export type WidgetRow = typeof campaignWidgets.$inferSelect
export type SnapshotRow = typeof sceneSnapshots.$inferSelect
type Managed = 'id' | 'version' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'
export type WidgetValues = Omit<typeof campaignWidgets.$inferInsert, Managed>
export type WidgetPatch = Partial<Omit<WidgetValues, 'worldId' | 'campaignId' | 'kind'>>

/** Dónde: una campaña en una escena */
export interface Place {
  worldId: string
  campaignId: string
  sceneId: string
}

/** Una marca que no es de esa campaña y escena */
export class NotInPlaceError extends Error {
  readonly id: string
  constructor(id: string) {
    super(`${id} no es de la escena de la campaña`)
    this.id = id
    this.name = 'NotInPlaceError'
  }
}

const inPlace = (campaignId: string, sceneId: string) =>
  and(eq(sceneMarks.campaignId, campaignId), eq(sceneMarks.sceneId, sceneId))

/** Las marcas de una campaña en una escena, en el orden en que se pusieron */
export function listMarks(db: Database, campaignId: string, sceneId: string): Promise<MarkRow[]> {
  return marksOf(db).execute({ campaignId, sceneId })
}

const marksOf = prepared((db) =>
  db
    .select()
    .from(sceneMarks)
    .where(
      and(eq(sceneMarks.campaignId, sql.placeholder('campaignId')), eq(sceneMarks.sceneId, sql.placeholder('sceneId')))
    )
    .orderBy(asc(sceneMarks.createdAt), asc(sceneMarks.sort), asc(sceneMarks.id))
    .prepare('list_marks')
)

export async function findMark(db: Database, id: string): Promise<MarkRow | null> {
  const [found] = await db.select().from(sceneMarks).where(eq(sceneMarks.id, id))
  return found ?? null
}

export interface MarkChange {
  add?: ReadonlyArray<{ kind: MarkKind; hidden: boolean; data: MarkData }>
  update?: ReadonlyArray<{ id: string; hidden?: boolean; data?: MarkData }>
  remove?: readonly string[]
}

/**
 * Cambia las marcas de una campaña en una escena en una operación: quitar, cambiar y añadir (la goma quita un trazo y
 * pone sus trozos: se deshace de una vez). Una marca de otro sitio no se toca
 */
export function changeMarks(db: Database, context: OperationContext, place: Place, change: MarkChange) {
  return operation(db, context, async (w) => {
    const own = new Set(
      (await w.read.select({ id: sceneMarks.id }).from(sceneMarks).where(inPlace(place.campaignId, place.sceneId))).map(
        (r) => r.id
      )
    )
    const remove = [...new Set(change.remove ?? [])]
    const stranger = [...remove, ...(change.update ?? []).map((u) => u.id)].find((id) => !own.has(id))
    if (stranger) throw new NotInPlaceError(stranger)
    await w.removeMany(sceneMarks, remove)
    const updated: MarkRow[] = []
    for (const { id, hidden, data } of change.update ?? [])
      updated.push(
        await w.update(sceneMarks, id, { ...(hidden !== undefined ? { hidden } : {}), ...(data ? { data } : {}) })
      )
    const added = await w.insertMany(
      sceneMarks,
      (change.add ?? []).map((m, sort) => ({ ...place, kind: m.kind, hidden: m.hidden, data: m.data, sort }))
    )
    return { added, updated, removed: remove }
  })
}

/** Los widgets de una campaña, por su orden */
export function listWidgets(db: Database, campaignId: string): Promise<WidgetRow[]> {
  return widgetsOf(db).execute({ campaignId })
}

const widgetsOf = prepared((db) =>
  db
    .select()
    .from(campaignWidgets)
    .where(eq(campaignWidgets.campaignId, sql.placeholder('campaignId')))
    .orderBy(asc(campaignWidgets.sort), asc(campaignWidgets.createdAt), asc(campaignWidgets.id))
    .prepare('list_widgets')
)

export async function findWidget(db: Database, id: string): Promise<WidgetRow | null> {
  const [found] = await db.select().from(campaignWidgets).where(eq(campaignWidgets.id, id))
  return found ?? null
}

export function insertWidget(db: Database, context: OperationContext, values: WidgetValues) {
  return operation(db, context, (w) => w.insert(campaignWidgets, values))
}

export function updateWidget(db: Database, context: OperationContext, id: string, patch: WidgetPatch) {
  return operation(db, context, (w) => w.update(campaignWidgets, id, patch))
}

export function removeWidget(db: Database, context: OperationContext, id: string) {
  return operation(db, context, (w) => w.remove(campaignWidgets, id))
}

/** Las instantáneas de una campaña en una escena, de la más nueva a la más vieja */
export function listSnapshots(db: Database, campaignId: string, sceneId: string): Promise<SnapshotRow[]> {
  return db
    .select()
    .from(sceneSnapshots)
    .where(and(eq(sceneSnapshots.campaignId, campaignId), eq(sceneSnapshots.sceneId, sceneId)))
    .orderBy(desc(sceneSnapshots.createdAt), desc(sceneSnapshots.id))
}

export async function findSnapshot(db: Database, id: string): Promise<SnapshotRow | null> {
  const [found] = await db.select().from(sceneSnapshots).where(eq(sceneSnapshots.id, id))
  return found ?? null
}

/** Lo de la campaña en la escena ahora, para guardarlo en una instantánea */
export async function captureSnapshot(db: Database, campaignId: string, sceneId: string): Promise<SnapshotData> {
  const [tokens, state, fog, marks] = await Promise.all([
    db
      .select()
      .from(sceneTokens)
      .where(and(eq(sceneTokens.campaignId, campaignId), eq(sceneTokens.sceneId, sceneId)))
      .orderBy(asc(sceneTokens.createdAt), asc(sceneTokens.id)),
    db
      .select()
      .from(sceneStates)
      .where(and(eq(sceneStates.campaignId, campaignId), eq(sceneStates.sceneId, sceneId))),
    db
      .select()
      .from(sceneFog)
      .where(and(eq(sceneFog.campaignId, campaignId), eq(sceneFog.sceneId, sceneId)))
      .orderBy(asc(sceneFog.createdAt), asc(sceneFog.id)),
    listMarks(db, campaignId, sceneId)
  ])
  return {
    tokens: tokens.map((t) => ({
      id: t.id,
      characterId: t.characterId,
      creatureId: t.creatureId,
      x: t.x,
      y: t.y,
      size: t.size,
      label: t.label,
      faction: t.faction,
      hidden: t.hidden,
      image: (t.image as Record<string, unknown> | null) ?? null
    })),
    doors: state[0]?.doors ?? {},
    fog: fog.map((f) => f.operation),
    marks: marks.map((m) => ({ kind: m.kind, hidden: m.hidden, data: m.data }))
  }
}

export function insertSnapshot(
  db: Database,
  context: OperationContext,
  values: Place & { name: string; thumbnail: string | null; data: SnapshotData }
) {
  return operation(db, context, (w) => w.insert(sceneSnapshots, values))
}

export function removeSnapshot(db: Database, context: OperationContext, id: string) {
  return operation(db, context, (w) => w.remove(sceneSnapshots, id))
}

/**
 * Vuelve a una instantánea en una operación: quita las fichas, la niebla a mano y las marcas de ahora y pone las suyas,
 * con sus puertas. Las fichas de un personaje o una criatura que ya no está (borrado, fuera de juego) se saltan y se
 * devuelven. Lo explorado no se toca: lo visto, visto está
 */
export function restoreSnapshot(db: Database, context: OperationContext, place: Place, data: SnapshotData) {
  return operation(db, context, async (w) => {
    const { campaignId, sceneId } = place
    const [tokens, fog, marks] = await Promise.all([
      w.read
        .select({ id: sceneTokens.id, characterId: sceneTokens.characterId, creatureId: sceneTokens.creatureId })
        .from(sceneTokens)
        .where(and(eq(sceneTokens.campaignId, campaignId), eq(sceneTokens.sceneId, sceneId))),
      w.read
        .select({ id: sceneFog.id })
        .from(sceneFog)
        .where(and(eq(sceneFog.campaignId, campaignId), eq(sceneFog.sceneId, sceneId))),
      w.read.select({ id: sceneMarks.id }).from(sceneMarks).where(inPlace(campaignId, sceneId))
    ])
    await w.removeMany(
      sceneFog,
      fog.map((r) => r.id)
    )
    await w.removeMany(
      sceneMarks,
      marks.map((r) => r.id)
    )
    // Quién sigue: los personajes de la campaña y las criaturas aún en juego
    const characterIds = data.tokens.flatMap((t) => (t.characterId ? [t.characterId] : []))
    const creatureIds = data.tokens.flatMap((t) => (t.creatureId ? [t.creatureId] : []))
    const [liveCharacters, liveCreatures] = await Promise.all([
      characterIds.length
        ? w.read
            .select({ id: characters.id })
            .from(characters)
            .where(and(eq(characters.campaignId, campaignId), inArray(characters.id, characterIds)))
        : Promise.resolve([]),
      creatureIds.length
        ? w.read
            .select({ id: campaignCreatures.id })
            .from(campaignCreatures)
            .where(and(eq(campaignCreatures.campaignId, campaignId), inArray(campaignCreatures.id, creatureIds)))
        : Promise.resolve([])
    ])
    const alive = new Set([...liveCharacters, ...liveCreatures].map((r) => r.id))
    const actor = (t: { characterId: string | null; creatureId: string | null }) => t.characterId ?? t.creatureId ?? ''
    const kept = data.tokens.filter((t) => alive.has(actor(t)))
    const skipped = data.tokens.filter((t) => !alive.has(actor(t))).map((t) => t.label)
    // Cada ficha conserva su id (el combate y lo elegido en la mesa siguen valiendo): la que sigue en la escena se
    // cambia; la que se quitó vuelve con el suyo; las que no estaban en la instantánea se quitan
    const current = new Map(tokens.map((t) => [actor(t), t.id]))
    const wanted = new Set(kept.map(actor))
    await w.removeMany(
      sceneTokens,
      tokens.filter((t) => !wanted.has(actor(t))).map((t) => t.id)
    )
    const taken = new Set(
      (
        await w.read
          .select({ id: sceneTokens.id })
          .from(sceneTokens)
          .where(inArray(sceneTokens.id, [...kept.flatMap((t) => (t.id ? [t.id] : [])), crypto.randomUUID()]))
      ).map((r) => r.id)
    )
    let restoredTokens = 0
    for (const { id, ...t } of kept) {
      const values = { ...t, image: t.image as (typeof sceneTokens.$inferInsert)['image'] }
      const existing = current.get(actor(t))
      if (existing) await w.update(sceneTokens, existing, values)
      else await w.insert(sceneTokens, { ...place, ...values, ...(id && !taken.has(id) ? { id } : {}) })
      restoredTokens += 1
    }
    await w.insertMany(
      sceneFog,
      data.fog.map((operation) => ({ ...place, operation: operation as FogOperationData }))
    )
    const restoredMarks = await w.insertMany(
      sceneMarks,
      data.marks.map((m, sort) => ({ ...place, ...m, sort }))
    )
    const [state] = await w.read
      .select({ id: sceneStates.id })
      .from(sceneStates)
      .where(and(eq(sceneStates.campaignId, campaignId), eq(sceneStates.sceneId, sceneId)))
    if (state) await w.update(sceneStates, state.id, { doors: data.doors })
    return { tokens: restoredTokens, marks: restoredMarks.length, fog: data.fog.length, skipped }
  })
}
