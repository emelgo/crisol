/**
 * Las criaturas en juego de una campaña (docs/specs/criaturas.md). Todo lo que las escribe pasa por operation(): queda
 * en el historial y se deshace. Cambiar una pide la versión que se tenía: dos clics seguidos no se pisan
 */
import { and, asc, eq, getTableColumns, inArray } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { campaigns } from '../schema/campaigns.ts'
import { campaignCreatures } from '../schema/creatures.ts'

export type CreatureRow = typeof campaignCreatures.$inferSelect & { worldId: string }

/** La cambió otro mientras tanto: no se guarda nada */
export class CreatureChangedError extends Error {
  constructor() {
    super('La criatura cambió mientras tanto')
    this.name = 'CreatureChangedError'
  }
}

/** Ya hay una única de esa entrada en la campaña */
export class UniqueTakenError extends Error {
  constructor() {
    super('Esa criatura ya está en juego')
    this.name = 'UniqueTakenError'
  }
}

/** Sus columnas y el mundo de su campaña */
const withWorld = { ...getTableColumns(campaignCreatures), worldId: campaigns.worldId }

/** Las de una campaña, en el orden en que se pusieron (y cada copia por su número) */
export function listCreatures(db: Database, campaignId: string) {
  return db
    .select(withWorld)
    .from(campaignCreatures)
    .innerJoin(campaigns, eq(campaigns.id, campaignCreatures.campaignId))
    .where(eq(campaignCreatures.campaignId, campaignId))
    .orderBy(asc(campaignCreatures.createdAt), asc(campaignCreatures.number))
}

export async function findCreature(db: Database, id: string): Promise<CreatureRow | null> {
  const [found] = await db
    .select(withWorld)
    .from(campaignCreatures)
    .innerJoin(campaigns, eq(campaigns.id, campaignCreatures.campaignId))
    .where(eq(campaignCreatures.id, id))
  return found ?? null
}

export interface CreatureValues {
  campaignId: string
  systemId: string
  key: string
  name: string
  number: number | null
  unique: boolean
  play: Record<string, unknown>
  overrides: Record<string, number>
  /** Oculta a los jugadores */
  hidden?: boolean
}

/** Pone en juego unas cuantas (o una única) en una sola operación */
export function createCreatures(db: Database, context: OperationContext, values: readonly CreatureValues[]) {
  return operation(db, context, async (w) => {
    const created = []
    for (const value of values) {
      if (value.unique) {
        const [taken] = await w.read
          .select({ id: campaignCreatures.id })
          .from(campaignCreatures)
          .where(
            and(
              eq(campaignCreatures.campaignId, value.campaignId),
              eq(campaignCreatures.key, value.key),
              eq(campaignCreatures.unique, true)
            )
          )
        if (taken) throw new UniqueTakenError()
      }
      created.push(await w.insert(campaignCreatures, value))
    }
    return created
  })
}

export type CreaturePatch = Partial<Pick<CreatureValues, 'name' | 'play' | 'overrides'>>

/** Cambia una (su nombre, lo de la partida, sus máximos) con la versión que se leyó */
export function updateCreature(
  db: Database,
  context: OperationContext,
  id: string,
  version: number,
  patch: CreaturePatch
) {
  return operation(db, context, async (w) => {
    const [current] = await w.read
      .select({ version: campaignCreatures.version })
      .from(campaignCreatures)
      .where(eq(campaignCreatures.id, id))
      .for('update')
    if (!current || current.version !== version) throw new CreatureChangedError()
    return w.update(campaignCreatures, id, patch)
  })
}

/** Lo de la partida de varias a la vez (aplicar una tirada), en una sola operación: todas o ninguna */
export function updateCreaturesPlay(
  db: Database,
  context: OperationContext,
  updates: readonly { id: string; version: number; play: Record<string, unknown> }[]
) {
  return operation(db, context, async (w) => {
    const saved = []
    for (const update of updates) {
      const [current] = await w.read
        .select({ version: campaignCreatures.version })
        .from(campaignCreatures)
        .where(eq(campaignCreatures.id, update.id))
        .for('update')
      if (!current || current.version !== update.version) throw new CreatureChangedError()
      saved.push(await w.update(campaignCreatures, update.id, { play: update.play }))
    }
    return saved
  })
}

/** Quita unas de juego (las que no están, no cuentan) */
export function deleteCreatures(db: Database, context: OperationContext, campaignId: string, ids: readonly string[]) {
  return operation(db, context, async (w) => {
    const found = await w.read
      .select({ id: campaignCreatures.id })
      .from(campaignCreatures)
      .where(and(eq(campaignCreatures.campaignId, campaignId), inArray(campaignCreatures.id, [...ids])))
    for (const row of found) await w.remove(campaignCreatures, row.id)
    return found.map((r) => r.id)
  })
}

/** A la vista u oculta a los jugadores (en su propia operación, con su historial) */
export function setCreatureHidden(db: Database, context: OperationContext, id: string, hidden: boolean) {
  return operation(db, context, (w) => w.update(campaignCreatures, id, { hidden }))
}
