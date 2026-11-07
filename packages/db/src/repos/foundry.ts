/**
 * Lo traído de un zip de Foundry a un mundo (docs/specs/escenas-foundry.md): de dónde salió cada cosa (para no
 * duplicarla al reimportar), lo de una escena en una operación (su rejilla, sus muros y luces, sus criaturas
 * preparadas y sus pines) y, al abrirla una campaña, sus pines como marcas del máster
 */
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { campaigns } from '../schema/campaigns.ts'
import { foundryOrigins } from '../schema/foundry.ts'
import { type PreparedCreatureData, type ScenePinData, scenes } from '../schema/scenes.ts'
import { sceneMarks } from '../schema/table-tools.ts'
import { sceneLights, sceneWalls } from '../schema/vision.ts'
import type { LightValues, WallValues } from './vision.ts'

export type OriginRow = typeof foundryOrigins.$inferSelect
export type OriginKind = OriginRow['kind']

/** Lo ya traído a un mundo de unos documentos de un paquete */
export function findOrigins(
  db: Database,
  worldId: string,
  kind: OriginKind,
  pack: string,
  documentIds: readonly string[]
): Promise<OriginRow[]> {
  if (documentIds.length === 0) return Promise.resolve([])
  return db
    .select()
    .from(foundryOrigins)
    .where(
      and(
        eq(foundryOrigins.worldId, worldId),
        eq(foundryOrigins.kind, kind),
        eq(foundryOrigins.package, pack),
        inArray(foundryOrigins.documentId, [...documentIds])
      )
    )
}

/** Apunta de dónde salió una escena o una página (si ya estaba, ahora lleva a esta) */
export async function saveOrigin(
  db: Database,
  values: {
    worldId: string
    kind: OriginKind
    package: string
    documentId: string
    sceneId?: string | null
    pageId?: string | null
  }
) {
  const target = { sceneId: values.sceneId ?? null, pageId: values.pageId ?? null }
  await db
    .insert(foundryOrigins)
    .values({ ...values, ...target })
    .onConflictDoUpdate({
      target: [foundryOrigins.worldId, foundryOrigins.kind, foundryOrigins.package, foundryOrigins.documentId],
      set: { ...target, updatedAt: new Date() }
    })
}

/** Lo de una escena traída: lo suyo y sus muros y luces (en lugar de los que tuviera), en una operación */
export function importScene(
  db: Database,
  context: OperationContext,
  sceneId: string,
  values: {
    scene: Partial<
      Pick<
        typeof scenes.$inferInsert,
        'grid' | 'initialView' | 'darkness' | 'automaticVision' | 'prepared' | 'pins' | 'width' | 'height'
      >
    >
    walls: readonly WallValues[]
    lights: readonly LightValues[]
  }
) {
  return operation(db, context, async (w) => {
    const [scene] = await w.read.select().from(scenes).where(eq(scenes.id, sceneId)).for('update')
    if (!scene) throw new Error(`No existe la escena ${sceneId}`)
    const walls = await w.read.select({ id: sceneWalls.id }).from(sceneWalls).where(eq(sceneWalls.sceneId, sceneId))
    const lights = await w.read.select({ id: sceneLights.id }).from(sceneLights).where(eq(sceneLights.sceneId, sceneId))
    await w.removeMany(
      sceneWalls,
      walls.map((r) => r.id)
    )
    await w.removeMany(
      sceneLights,
      lights.map((r) => r.id)
    )
    const place = { worldId: scene.worldId, sceneId }
    await w.insertMany(
      sceneWalls,
      values.walls.map((v) => ({ ...v, ...place }))
    )
    await w.insertMany(
      sceneLights,
      values.lights.map((v) => ({ ...v, ...place }))
    )
    return w.update(scenes, sceneId, values.scene)
  })
}

export type { PreparedCreatureData, ScenePinData }

/** Los pines de una escena, como marcas del máster de una campaña (las de las herramientas de la mesa) */
export function insertPinMarks(
  db: Database,
  context: OperationContext,
  place: { worldId: string; campaignId: string; sceneId: string },
  pins: readonly ScenePinData[]
) {
  return operation(db, context, async (w) => {
    // En el orden en que venían (las de una vez se pintan por su sort)
    for (const [sort, pin] of pins.entries())
      await w.insert(sceneMarks, {
        ...place,
        kind: 'pin',
        hidden: true,
        sort,
        data: { x: pin.x, y: pin.y, pageId: pin.pageId, label: pin.label.slice(0, 60), icon: 'book-open' }
      })
  })
}

/** Los sistemas de las campañas de un mundo (donde buscar las criaturas de lo traído) */
export async function worldSystems(db: Database, worldId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ system: campaigns.system })
    .from(campaigns)
    .where(and(eq(campaigns.worldId, worldId), isNull(campaigns.deletedAt), isNotNull(campaigns.system)))
  return rows.flatMap((r) => (r.system ? [r.system] : []))
}
