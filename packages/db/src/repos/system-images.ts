/**
 * Las imágenes de un sistema (docs/specs/imagenes.md): por su ruta, con su licencia y su crédito. No pasan por el
 * historial: se rehacen al volver a importar, y se van con su sistema
 */
import { and, eq, inArray } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { systemImages } from '../schema/systems.ts'

export type SystemImageRow = typeof systemImages.$inferSelect

export interface SystemImageValues {
  path: string
  storageKey: string
  mime: string
  bytes: number
  license: string
  credit: string | null
}

/** Guarda unas imágenes de un sistema por su ruta (las que ya estaban se cambian); da las claves que dejan de usarse */
export async function putImages(db: Database, systemId: string, images: readonly SystemImageValues[]) {
  return db.transaction(async (tx) => {
    const old = images.length
      ? await tx
          .select({ storageKey: systemImages.storageKey })
          .from(systemImages)
          .where(
            and(
              eq(systemImages.systemId, systemId),
              inArray(
                systemImages.path,
                images.map((i) => i.path)
              )
            )
          )
      : []
    for (const image of images)
      await tx
        .insert(systemImages)
        .values({ ...image, systemId })
        .onConflictDoUpdate({ target: [systemImages.systemId, systemImages.path], set: { ...image } })
    return old.map((o) => o.storageKey)
  })
}

/** Una imagen de un sistema, por su ruta */
export async function findImage(db: Database, systemId: string, path: string) {
  const [found] = await db
    .select()
    .from(systemImages)
    .where(and(eq(systemImages.systemId, systemId), eq(systemImages.path, path)))
  return found ?? null
}

/** Cuáles de estas rutas tiene un sistema (para decir qué entradas tienen imagen) */
export async function existingPaths(db: Database, systemId: string, paths: readonly string[]) {
  if (paths.length === 0) return new Map<string, SystemImageRow>()
  const rows = await db
    .select()
    .from(systemImages)
    .where(and(eq(systemImages.systemId, systemId), inArray(systemImages.path, [...new Set(paths)])))
  return new Map(rows.map((r) => [r.path, r]))
}
