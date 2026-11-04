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
  color: user.diceColor,
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
  // Guardarla y leerla con el nombre y el color de quien tira, en una consulta y sin esperar al disco: tirar va con
  // prisa, y si la base de datos cae justo entonces, se pierde como mucho la última tirada (ADR-0010)
  const rows = await db.transaction(async (tx) => {
    await tx.execute(sql`set local synchronous_commit = off`)
    return tx.execute<{
      id: string
      n: number
      campaign_id: string
      user_id: string
      name: string
      color: string | null
      ai: boolean
      formula: string
      label: string | null
      visibility: Visibility
      result: StoredRoll
      created_at: string | Date
    }>(sql`
    with inserted as (
      insert into ${diceRolls} (campaign_id, world_id, user_id, ai, formula, label, visibility, result)
      values (${roll.campaignId}, ${roll.worldId}, ${roll.userId}, ${roll.ai}, ${roll.formula}, ${roll.label},
        ${roll.visibility}, ${JSON.stringify(roll.result)}::jsonb)
      returning *
    )
    select inserted.*, ${user.name} as name, ${user.diceColor} as color
    from inserted join ${user} on ${user.id} = inserted.user_id
  `)
  })
  const found = [...rows][0]
  if (!found) throw new Error('La tirada no se guardó')
  return {
    id: found.id,
    n: Number(found.n),
    campaignId: found.campaign_id,
    userId: found.user_id,
    name: found.name,
    color: found.color,
    ai: found.ai,
    formula: found.formula,
    label: found.label,
    visibility: found.visibility,
    result: found.result,
    createdAt: new Date(found.created_at)
  }
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
