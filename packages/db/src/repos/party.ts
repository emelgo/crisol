/**
 * El inventario del grupo de una campaña (docs/specs/grupo.md): leerlo y cambiarlo en una sola operación, también
 * con lo que lleva un personaje (mover no duplica: sale de un sitio y entra en el otro a la vez)
 */
import { eq } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation, type Writer } from '../operation.ts'
import { type CharacterSummary, characters } from '../schema/characters.ts'
import { campaignParty, type PartyContainerRow, type PartyItemRow } from '../schema/party.ts'

export type PartyRow = typeof campaignParty.$inferSelect

export interface PartyValues {
  containers: PartyContainerRow[]
  items: PartyItemRow[]
  coins: Record<string, number>
}

/** La versión que se leyó ya no es la suya */
export class PartyChangedError extends Error {}

export async function findParty(db: Database, campaignId: string): Promise<PartyRow | null> {
  const [row] = await db.select().from(campaignParty).where(eq(campaignParty.campaignId, campaignId))
  return row ?? null
}

/** Un personaje de la campaña, bloqueado hasta acabar (para cambiar lo que lleva) */
export interface LockedCharacter {
  id: string
  campaignId: string
  ownerId: string | null
  name: string
  system: string
  build: Record<string, unknown>
  play: Record<string, unknown>
}

/**
 * Cambia el grupo (y, si hace falta, lo que llevan unos personajes) en una operación: `change` recibe el grupo de
 * ahora (vacío si aún no tiene fila) y una forma de leer un personaje bloqueado, y da el grupo nuevo y lo que llevan
 * los personajes que cambian. Con `version`, solo si es la del grupo
 */
export function changeParty<R>(
  db: Database,
  context: OperationContext,
  campaignId: string,
  version: number | undefined,
  change: (
    party: PartyValues,
    lock: (characterId: string) => Promise<LockedCharacter | null>
  ) => Promise<{
    party: PartyValues
    plays?: { id: string; play: Record<string, unknown>; summary: CharacterSummary }[]
    result: R
  }>
) {
  return operation(db, context, async (w: Writer) => {
    const [current] = await w.read
      .select()
      .from(campaignParty)
      .where(eq(campaignParty.campaignId, campaignId))
      .for('update')
    if (version !== undefined && (current?.version ?? 0) !== version) throw new PartyChangedError()
    const lock = async (characterId: string) => {
      const [row] = await w.read
        .select({
          id: characters.id,
          campaignId: characters.campaignId,
          ownerId: characters.ownerId,
          name: characters.name,
          system: characters.system,
          build: characters.build,
          play: characters.play
        })
        .from(characters)
        .where(eq(characters.id, characterId))
        .for('update')
      return row && row.campaignId === campaignId ? (row as LockedCharacter) : null
    }
    const before: PartyValues = current
      ? { containers: current.containers, items: current.items, coins: current.coins }
      : { containers: [], items: [], coins: {} }
    const { party, plays = [], result } = await change(before, lock)
    const row = current
      ? await w.update(campaignParty, current.id, party)
      : await w.insert(campaignParty, { campaignId, ...party })
    for (const p of plays) await w.update(characters, p.id, { play: p.play, summary: p.summary })
    return { row, result }
  })
}
