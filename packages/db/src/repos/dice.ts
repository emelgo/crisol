/**
 * Las tiradas de una campaña (ADR-0010): se guardan ya resueltas y se leen filtradas por quién las ve. No pasan por
 * operation(): una tirada no se deshace
 */
import { and, desc, eq, gt, lt, or, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { user } from '../schema/auth.ts'
import { diceRolls, type StoredRoll } from '../schema/dice.ts'

export type Visibility = 'all' | 'self' | 'master' | 'hidden'

export const ROLLS_PAGE = 50

const view = {
  id: diceRolls.id,
  n: diceRolls.n,
  campaignId: diceRolls.campaignId,
  userId: diceRolls.userId,
  name: user.name,
  ai: diceRolls.ai,
  formula: diceRolls.formula,
  label: diceRolls.label,
  visibility: diceRolls.visibility,
  result: diceRolls.result,
  createdAt: diceRolls.createdAt
}

export async function insertRoll(
  db: Database,
  roll: {
    campaignId: string
    worldId: string
    userId: string
    ai: boolean
    formula: string
    label: string | null
    visibility: Visibility
    result: StoredRoll
  }
) {
  const [created] = await db.insert(diceRolls).values(roll).returning({ id: diceRolls.id })
  if (!created) throw new Error('La tirada no se guardó')
  const [found] = await db
    .select(view)
    .from(diceRolls)
    .innerJoin(user, eq(user.id, diceRolls.userId))
    .where(eq(diceRolls.id, created.id))
  if (!found) throw new Error('La tirada no se guardó')
  return found
}

/**
 * Las de una campaña que ve una cuenta, de la más reciente hacia atrás (antes de before), en páginas de 50. El máster
 * las ve todas; los demás, las de todos y las suyas
 */
export async function listRolls(
  db: Database,
  input: { campaignId: string; viewerId: string; master: boolean; before?: string | undefined }
) {
  const cursor = input.before
    ? (await db.select({ n: diceRolls.n }).from(diceRolls).where(eq(diceRolls.id, input.before)))[0]?.n
    : undefined
  const rows = await db
    .select(view)
    .from(diceRolls)
    .innerJoin(user, eq(user.id, diceRolls.userId))
    .where(
      and(
        eq(diceRolls.campaignId, input.campaignId),
        cursor === undefined ? undefined : lt(diceRolls.n, cursor),
        input.master ? undefined : or(eq(diceRolls.visibility, 'all'), eq(diceRolls.userId, input.viewerId))
      )
    )
    .orderBy(desc(diceRolls.n))
    .limit(ROLLS_PAGE + 1)
  const page = rows.slice(0, ROLLS_PAGE)
  return { rolls: page.reverse(), next: rows.length > ROLLS_PAGE ? (page[0]?.id ?? null) : null }
}

/** Cuántas ha tirado una cuenta desde esa hora (para el límite por minuto) */
export async function countSince(db: Database, userId: string, since: Date) {
  const [found] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(diceRolls)
    .where(and(eq(diceRolls.userId, userId), gt(diceRolls.createdAt, since)))
  return found?.count ?? 0
}
