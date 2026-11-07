/**
 * El combate de una campaña y sus combatientes (docs/specs/combate.md). Todo pasa por operation(): se deshace desde el
 * historial. Pasar el turno guarda en la misma operación lo que cambia en quien lo empieza (sus estados, sus recargas)
 */
import { asc, eq, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation, type Writer } from '../operation.ts'
import { prepared } from '../prepared.ts'
import { characters } from '../schema/characters.ts'
import { combatants, combats } from '../schema/combat.ts'
import { campaignCreatures } from '../schema/creatures.ts'
import { removeCreaturesIn } from './creatures.ts'

export type CombatRow = typeof combats.$inferSelect
export type CombatantRow = typeof combatants.$inferSelect
export type CombatPatch = Partial<Pick<CombatRow, 'round' | 'turnId' | 'skipDefeated' | 'sceneId'>>
export type CombatantPatch = Partial<Pick<CombatantRow, 'initiative' | 'modifier' | 'group' | 'sort'>>
export type CombatantValues = Pick<CombatantRow, 'characterId' | 'creatureId' | 'group'> &
  Partial<Pick<CombatantRow, 'initiative' | 'modifier'>>

/** Ya hay un combate en la campaña */
export class CombatRunningError extends Error {
  constructor() {
    super('Ya hay un combate en la campaña')
    this.name = 'CombatRunningError'
  }
}

/** El combate (o lo de la partida de alguien) cambió mientras tanto: no se guarda nada */
export class CombatChangedError extends Error {
  constructor() {
    super('El combate cambió mientras tanto')
    this.name = 'CombatChangedError'
  }
}

export async function findCombat(db: Database, campaignId: string): Promise<CombatRow | null> {
  const [found] = await combatOf(db).execute({ campaignId })
  return found ?? null
}

const combatOf = prepared((db) =>
  db
    .select()
    .from(combats)
    .where(eq(combats.campaignId, sql.placeholder('campaignId')))
    .prepare('find_combat')
)

/** Sus combatientes, en el orden en que entraron */
export function listCombatants(db: Database, combatId: string) {
  return db
    .select()
    .from(combatants)
    .where(eq(combatants.combatId, combatId))
    .orderBy(asc(combatants.createdAt), asc(combatants.id))
}

/** Empieza el combate de una campaña con sus combatientes, en una operación */
export function startCombat(
  db: Database,
  context: OperationContext,
  combat: Pick<CombatRow, 'worldId' | 'campaignId' | 'sceneId'>,
  members: readonly CombatantValues[]
) {
  return operation(db, context, async (w) => {
    const [running] = await w.read
      .select({ id: combats.id })
      .from(combats)
      .where(eq(combats.campaignId, combat.campaignId))
      .for('update')
    if (running) throw new CombatRunningError()
    const row = await w.insert(combats, { ...combat, round: 0, turnId: null })
    const added: CombatantRow[] = []
    for (const member of members) added.push(await insertMember(w, row, member))
    return { combat: row, combatants: added }
  })
}

const insertMember = (w: Writer, combat: CombatRow, member: CombatantValues) =>
  w.insert(combatants, {
    worldId: combat.worldId,
    campaignId: combat.campaignId,
    combatId: combat.id,
    characterId: member.characterId,
    creatureId: member.creatureId,
    group: member.group,
    initiative: member.initiative ?? null,
    modifier: member.modifier ?? null,
    sort: null
  })

/** Lo de la partida nuevo de un personaje o de una criatura, con la versión que se leyó */
export interface PlayUpdate {
  id: string
  version: number
  play: Record<string, unknown>
}

export interface CombatChange {
  /** La versión del combate que se leyó: si cambió entre medias, no se guarda nada */
  version: number
  patch?: CombatPatch
  insert?: readonly CombatantValues[]
  update?: ReadonlyArray<{ id: string; patch: CombatantPatch }>
  remove?: readonly string[]
  creatures?: readonly PlayUpdate[]
  characters?: readonly PlayUpdate[]
}

/**
 * Cambia el combate en una operación: él (la ronda, el turno), sus combatientes (entrar, salir, su iniciativa, su
 * grupo, su orden) y lo de la partida de quien empieza su turno. Todo o nada
 */
export function changeCombat(db: Database, context: OperationContext, combatId: string, change: CombatChange) {
  return operation(db, context, async (w) => {
    const [current] = await w.read.select().from(combats).where(eq(combats.id, combatId)).for('update')
    if (!current || current.version !== change.version) throw new CombatChangedError()
    for (const id of change.remove ?? []) await w.remove(combatants, id)
    for (const member of change.insert ?? []) await insertMember(w, current, member)
    for (const { id, patch } of change.update ?? []) await w.update(combatants, id, patch)
    for (const update of change.creatures ?? []) {
      const [row] = await w.read
        .select({ version: campaignCreatures.version })
        .from(campaignCreatures)
        .where(eq(campaignCreatures.id, update.id))
        .for('update')
      if (!row || row.version !== update.version) throw new CombatChangedError()
      await w.update(campaignCreatures, update.id, { play: update.play })
    }
    for (const update of change.characters ?? []) {
      const [row] = await w.read
        .select({ version: characters.version })
        .from(characters)
        .where(eq(characters.id, update.id))
        .for('update')
      if (!row || row.version !== update.version) throw new CombatChangedError()
      await w.update(characters, update.id, { play: update.play })
    }
    // Siempre se toca el combate: su versión sube con cualquier cambio (dos «Siguiente» a la vez no pasan dos turnos)
    return w.update(combats, combatId, change.patch ?? {})
  })
}

/**
 * Acaba el combate: se van sus combatientes, él y, en la misma operación, las criaturas que se piden (con sus fichas).
 * Deshacerlo lo devuelve todo
 */
export function endCombat(
  db: Database,
  context: OperationContext,
  combatId: string,
  version: number,
  creatureIds: readonly string[]
) {
  return operation(db, context, async (w) => {
    const [current] = await w.read.select().from(combats).where(eq(combats.id, combatId)).for('update')
    if (!current || current.version !== version) throw new CombatChangedError()
    const members = await w.read.select({ id: combatants.id }).from(combatants).where(eq(combatants.combatId, combatId))
    for (const member of members) await w.remove(combatants, member.id)
    await w.remove(combats, combatId)
    return removeCreaturesIn(w, current.campaignId, creatureIds)
  })
}
