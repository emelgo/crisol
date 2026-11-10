/**
 * Las fichas de las escenas y los encuentros del mundo (docs/specs/fichas.md). Todo pasa por operation(): se deshace
 * desde el historial. Mover varias fichas es una sola operación
 */
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { prepared } from '../prepared.ts'
import { characters } from '../schema/characters.ts'
import { campaignCreatures } from '../schema/creatures.ts'
import { encounters, sceneTokens } from '../schema/scenes.ts'
import { type CreatureValues, insertCreatures } from './creatures.ts'

export type TokenRow = typeof sceneTokens.$inferSelect
export type EncounterRow = typeof encounters.$inferSelect
type TokenValues = Omit<
  typeof sceneTokens.$inferInsert,
  'id' | 'version' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'
>
export type TokenPatch = Partial<Pick<TokenRow, 'x' | 'y' | 'size' | 'label' | 'faction' | 'hidden' | 'image'>>

/** Las fichas de una campaña en una escena, en el orden en que se pusieron (las de una vez, por su rótulo) */
export function listTokens(db: Database, campaignId: string, sceneId: string): Promise<TokenRow[]> {
  return tokensOf(db).execute({ campaignId, sceneId })
}

const tokensOf = prepared((db) =>
  db
    .select()
    .from(sceneTokens)
    .where(
      and(
        eq(sceneTokens.campaignId, sql.placeholder('campaignId')),
        eq(sceneTokens.sceneId, sql.placeholder('sceneId'))
      )
    )
    .orderBy(asc(sceneTokens.createdAt), asc(sceneTokens.label), asc(sceneTokens.id))
    .prepare('list_tokens')
)

/** Unas fichas por su id, solo de esa campaña */
export function findTokens(db: Database, campaignId: string, ids: readonly string[]) {
  if (ids.length === 0) return Promise.resolve([])
  return db
    .select()
    .from(sceneTokens)
    .where(and(eq(sceneTokens.campaignId, campaignId), inArray(sceneTokens.id, [...ids])))
}

export async function findToken(db: Database, id: string) {
  const [found] = await db.select().from(sceneTokens).where(eq(sceneTokens.id, id))
  return found ?? null
}

/**
 * Pone fichas en una sola operación: las criaturas que entran en juego con ellas (`tokens` recibe las creadas, en su
 * orden, para poner sus fichas), las fichas nuevas y las que ya estaban, movidas. Deshacerla lo quita todo de una vez
 */
export function placeTokens(
  db: Database,
  context: OperationContext,
  input: {
    creatures: readonly CreatureValues[]
    tokens: (created: ReadonlyArray<{ id: string }>) => TokenValues[]
    moves?: ReadonlyArray<{ id: string; patch: TokenPatch }>
  }
) {
  return operation(db, context, async (w) => {
    const creatures = await insertCreatures(w, input.creatures)
    const inserted: TokenRow[] = []
    for (const value of input.tokens(creatures)) inserted.push(await w.insert(sceneTokens, value))
    const moved: TokenRow[] = []
    for (const { id, patch } of input.moves ?? []) moved.push(await w.update(sceneTokens, id, patch))
    return { creatures, inserted, moved }
  })
}

/** Cambia unas fichas a la vez (moverlas), en una operación */
export function updateTokens(
  db: Database,
  context: OperationContext,
  patches: ReadonlyArray<{ id: string; patch: TokenPatch }>
) {
  return operation(db, context, async (w) => {
    const rows: TokenRow[] = []
    for (const { id, patch } of patches) rows.push(await w.update(sceneTokens, id, patch))
    return rows
  })
}

export function removeTokens(db: Database, context: OperationContext, ids: readonly string[]) {
  return operation(db, context, async (w) => {
    for (const id of ids) await w.remove(sceneTokens, id)
  })
}

/** Los encuentros de un mundo, por nombre */
export function listEncounters(db: Database, worldId: string) {
  return db
    .select()
    .from(encounters)
    .where(eq(encounters.worldId, worldId))
    .orderBy(sql`lower(${encounters.name})`, asc(encounters.id))
}

export async function findEncounter(db: Database, id: string) {
  const [found] = await db.select().from(encounters).where(eq(encounters.id, id))
  return found ?? null
}

export function saveEncounter(
  db: Database,
  context: OperationContext,
  values: Pick<EncounterRow, 'worldId' | 'systemId' | 'name' | 'members'>,
  id?: string
) {
  return operation(db, context, (w) =>
    id ? w.update(encounters, id, { name: values.name, members: values.members }) : w.insert(encounters, values)
  )
}

export function deleteEncounter(db: Database, context: OperationContext, id: string) {
  return operation(db, context, (w) => w.remove(encounters, id))
}

/**
 * Quiénes llevan a cada uno en la Mesa de una campaña (docs/specs/mover-jugadores.md): el dueño de cada personaje y los
 * jugadores a los que se asigna cada criatura en juego, por el id del personaje o de la criatura
 */
export async function controllersOf(db: Database, campaignId: string): Promise<Map<string, string[]>> {
  const [owned, assigned] = await Promise.all([
    db
      .select({ id: characters.id, ownerId: characters.ownerId })
      .from(characters)
      .where(eq(characters.campaignId, campaignId)),
    db
      .select({ id: campaignCreatures.id, controlledBy: campaignCreatures.controlledBy })
      .from(campaignCreatures)
      .where(eq(campaignCreatures.campaignId, campaignId))
  ])
  const out = new Map<string, string[]>()
  for (const row of owned) out.set(row.id, row.ownerId ? [row.ownerId] : [])
  for (const row of assigned) out.set(row.id, row.controlledBy)
  return out
}
