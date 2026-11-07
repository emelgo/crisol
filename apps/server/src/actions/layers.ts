/**
 * El contenido de una campaña por capas (docs/specs/compendio-mundo.md): lo del sistema de la cuenta y lo de su mundo,
 * unidos con `withWorld` (lo del mundo, sin fuente y mandando en las claves). Lo del mundo, solo cuando se pide: para
 * quien puede verlo, o para montar los personajes de la campaña
 */
import { systemsRepo, worldContentRepo } from '@crisol/db'
import { type ContentEntry, type ContentItem, type Layered, withWorld } from '@crisol/systems'
import { contentOf } from './content-of.ts'
import type { ActionContext } from './context.ts'

/** El compendio de un mundo para un sistema; `only`: un jugador, solo lo que se le reveló (por su clave) */
export interface WorldLayer {
  worldId: string
  systemId: string
  only?: ReadonlySet<string>
}

/** Lo del mundo que se ve de la capa */
const seen = <T extends { key: string }>(world: WorldLayer, rows: readonly T[]) =>
  world.only ? rows.filter((row) => world.only?.has(row.key)) : [...rows]

/** Una entrada del mundo como contenido: sin fuente y marcada */
export const worldItemOf = (row: worldContentRepo.WorldContentRow): Layered<ContentItem> => ({
  ...contentOf({ ...row, source: null }),
  world: true
})

/** Lo de buscar (sin leer cada entrada entera) */
export async function contentIndex(
  ctx: ActionContext,
  systemId: string,
  world: WorldLayer | null
): Promise<Layered<ContentEntry>[]> {
  const system = await systemsRepo.contentIndex(ctx.db, systemId)
  if (!world) return system
  return withWorld(system, seen(world, await worldContentRepo.contentIndex(ctx.db, world.worldId, systemId)))
}

/** Unas entradas por su clave: si están en las dos, la del mundo */
export async function contentByKeys(
  ctx: ActionContext,
  systemId: string,
  world: WorldLayer | null,
  keys: readonly string[]
): Promise<Layered<ContentItem>[]> {
  const own = world
    ? seen(world, await worldContentRepo.contentByKeys(ctx.db, world.worldId, systemId, keys)).map(worldItemOf)
    : []
  const found = new Set(own.map((item) => item.key))
  const rest = keys.filter((k) => !found.has(k))
  const system = rest.length > 0 ? (await systemsRepo.contentByKeys(ctx.db, systemId, rest)).map(contentOf) : []
  return withWorld(system, own)
}

/** Las de un tipo */
export async function contentOfType(
  ctx: ActionContext,
  systemId: string,
  world: WorldLayer | null,
  type: string
): Promise<Layered<ContentItem>[]> {
  const system = (await systemsRepo.listContentOfType(ctx.db, systemId, type)).map(contentOf)
  if (!world) return system
  return withWorld(
    system,
    seen(world, await worldContentRepo.listContentOfType(ctx.db, world.worldId, systemId, type)).map(worldItemOf)
  )
}

/** Todo (para montar un personaje) */
export async function allContent(
  ctx: ActionContext,
  systemId: string,
  world: WorldLayer | null
): Promise<Layered<ContentItem>[]> {
  const system = (await systemsRepo.listContent(ctx.db, systemId)).map(contentOf)
  if (!world) return system
  return withWorld(
    system,
    seen(world, await worldContentRepo.listContent(ctx.db, world.worldId, systemId)).map(worldItemOf)
  )
}
