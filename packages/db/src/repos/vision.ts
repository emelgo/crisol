/**
 * Lo de la visión de la mesa (docs/specs/vision.md): los muros, las puertas y las luces de una escena (lo del mundo,
 * con su historial), el estado de las puertas y la niebla a mano de cada campaña (con su historial) y lo explorado
 * por su grupo (fuera del historial). Cambiar muros o luces toca también la escena: su versión dice que cambiaron
 */
import { and, asc, eq } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { type SceneDoorStates, sceneStates, scenes } from '../schema/scenes.ts'
import { type FogOperationData, sceneExplored, sceneFog, sceneLights, sceneWalls } from '../schema/vision.ts'

export type WallRow = typeof sceneWalls.$inferSelect
export type LightRow = typeof sceneLights.$inferSelect
export type FogRow = typeof sceneFog.$inferSelect
type Managed = 'id' | 'version' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt' | 'worldId' | 'sceneId'
export type WallValues = Omit<typeof sceneWalls.$inferInsert, Managed>
export type LightValues = Omit<typeof sceneLights.$inferInsert, Managed>

/** Los muros de una escena, en el orden en que se pusieron */
export function listWalls(db: Database, sceneId: string): Promise<WallRow[]> {
  return db
    .select()
    .from(sceneWalls)
    .where(eq(sceneWalls.sceneId, sceneId))
    .orderBy(asc(sceneWalls.createdAt), asc(sceneWalls.id))
}

export function listLights(db: Database, sceneId: string): Promise<LightRow[]> {
  return db
    .select()
    .from(sceneLights)
    .where(eq(sceneLights.sceneId, sceneId))
    .orderBy(asc(sceneLights.createdAt), asc(sceneLights.id))
}

/** Un muro, por su id */
export async function findWall(db: Database, wallId: string): Promise<WallRow | null> {
  const [found] = await db.select().from(sceneWalls).where(eq(sceneWalls.id, wallId))
  return found ?? null
}

/** Un muro o una luz que no es de la escena */
export class NotInSceneError extends Error {
  readonly id: string
  constructor(id: string) {
    super(`${id} no es de la escena`)
    this.id = id
    this.name = 'NotInSceneError'
  }
}

export interface VisionChange {
  /** Quita antes todos los muros y luces que tuviera (poner los de un mapa encima de otros) */
  replace?: boolean
  walls?: {
    add?: readonly WallValues[]
    update?: ReadonlyArray<{ id: string; patch: Partial<WallValues> }>
    remove?: readonly string[]
  }
  lights?: {
    add?: readonly LightValues[]
    update?: ReadonlyArray<{ id: string; patch: Partial<LightValues> }>
    remove?: readonly string[]
  }
  /** Lo de la escena entera: su oscuridad y si su niebla es automática */
  scene?: { darkness?: number; automaticVision?: boolean }
}

/** Cambia los muros, las puertas y las luces de una escena en una operación; siempre sube la versión de la escena */
export function changeVision(db: Database, context: OperationContext, sceneId: string, change: VisionChange) {
  return operation(db, context, async (w) => {
    const [scene] = await w.read.select().from(scenes).where(eq(scenes.id, sceneId)).for('update')
    if (!scene) throw new Error(`No existe la escena ${sceneId}`)
    const walls = await w.read.select({ id: sceneWalls.id }).from(sceneWalls).where(eq(sceneWalls.sceneId, sceneId))
    const lights = await w.read.select({ id: sceneLights.id }).from(sceneLights).where(eq(sceneLights.sceneId, sceneId))
    const wallIds = new Set(walls.map((r) => r.id))
    const lightIds = new Set(lights.map((r) => r.id))
    const mine = (ids: Set<string>, wanted: readonly string[]) => {
      const stranger = wanted.find((id) => !ids.has(id))
      if (stranger) throw new NotInSceneError(stranger)
    }
    if (change.replace) {
      await w.removeMany(sceneWalls, [...wallIds])
      await w.removeMany(sceneLights, [...lightIds])
      wallIds.clear()
      lightIds.clear()
    }
    const removeWalls = [...new Set(change.walls?.remove ?? [])]
    const removeLights = [...new Set(change.lights?.remove ?? [])]
    mine(wallIds, [...removeWalls, ...(change.walls?.update ?? []).map((u) => u.id)])
    mine(lightIds, [...removeLights, ...(change.lights?.update ?? []).map((u) => u.id)])
    await w.removeMany(sceneWalls, removeWalls)
    await w.removeMany(sceneLights, removeLights)
    for (const { id, patch } of change.walls?.update ?? []) await w.update(sceneWalls, id, patch)
    for (const { id, patch } of change.lights?.update ?? []) await w.update(sceneLights, id, patch)
    const place = { worldId: scene.worldId, sceneId }
    const addedWalls = await w.insertMany(
      sceneWalls,
      (change.walls?.add ?? []).map((v) => ({ ...v, ...place }))
    )
    const addedLights = await w.insertMany(
      sceneLights,
      (change.lights?.add ?? []).map((v) => ({ ...v, ...place }))
    )
    const updated = await w.update(scenes, sceneId, change.scene ?? {})
    return { scene: updated, addedWalls, addedLights }
  })
}

/** El estado de una campaña en una escena, si lo tiene */
export async function findSceneState(db: Database, campaignId: string, sceneId: string) {
  const [found] = await db
    .select()
    .from(sceneStates)
    .where(and(eq(sceneStates.campaignId, campaignId), eq(sceneStates.sceneId, sceneId)))
  return found ?? null
}

/** Cambia el estado de unas puertas en una campaña (las demás quedan como estaban) */
export function setDoors(db: Database, context: OperationContext, stateId: string, doors: SceneDoorStates) {
  return operation(db, context, async (w) => {
    const [state] = await w.read.select().from(sceneStates).where(eq(sceneStates.id, stateId)).for('update')
    if (!state) throw new Error(`No existe el estado ${stateId}`)
    return w.update(sceneStates, stateId, { doors: { ...state.doors, ...doors } })
  })
}

/** La niebla a mano de una campaña en una escena, en el orden en que se hizo */
export function listFog(db: Database, campaignId: string, sceneId: string): Promise<FogRow[]> {
  return db
    .select()
    .from(sceneFog)
    .where(and(eq(sceneFog.campaignId, campaignId), eq(sceneFog.sceneId, sceneId)))
    .orderBy(asc(sceneFog.createdAt), asc(sceneFog.id))
}

/** Añade unas operaciones de niebla a mano, en una operación del historial */
export function addFog(
  db: Database,
  context: OperationContext,
  place: { worldId: string; campaignId: string; sceneId: string },
  operations: readonly FogOperationData[]
) {
  return operation(db, context, (w) =>
    w.insertMany(
      sceneFog,
      operations.map((op) => ({ ...place, operation: op }))
    )
  )
}

/**
 * Reinicia la niebla de una campaña en una escena: quita la de a mano (al historial: deshacer la devuelve) y lo
 * explorado (que no vuelve)
 */
export function resetFog(
  db: Database,
  context: OperationContext,
  place: { worldId: string; campaignId: string; sceneId: string }
) {
  return operation(db, context, async (w) => {
    const rows = await w.read
      .select({ id: sceneFog.id })
      .from(sceneFog)
      .where(and(eq(sceneFog.campaignId, place.campaignId), eq(sceneFog.sceneId, place.sceneId)))
    await w.removeMany(
      sceneFog,
      rows.map((r) => r.id)
    )
    await w.read
      .delete(sceneExplored)
      .where(and(eq(sceneExplored.campaignId, place.campaignId), eq(sceneExplored.sceneId, place.sceneId)))
    return rows.length
  })
}

/** Lo explorado por el grupo de una campaña en una escena (comprimido), o null */
export async function findExplored(db: Database, campaignId: string, sceneId: string) {
  const [found] = await db
    .select()
    .from(sceneExplored)
    .where(and(eq(sceneExplored.campaignId, campaignId), eq(sceneExplored.sceneId, sceneId)))
  return found ?? null
}

/** Guarda lo explorado (no va al historial) */
export async function saveExplored(db: Database, campaignId: string, sceneId: string, data: Uint8Array) {
  await db
    .insert(sceneExplored)
    .values({ campaignId, sceneId, data })
    .onConflictDoUpdate({
      target: [sceneExplored.campaignId, sceneExplored.sceneId],
      set: { data, updatedAt: new Date() }
    })
}
