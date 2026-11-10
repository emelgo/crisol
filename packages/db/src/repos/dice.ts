/**
 * Las tiradas de una campaña (ADR-0010): se guardan ya resueltas y se leen filtradas por quién las ve. No pasan por
 * operation(): una tirada no se deshace
 */
import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm'
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
  limit: number,
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
  // Con un cerrojo por cuenta, contar las del último minuto y guardarla, a la vez: con muchas peticiones juntas no se
  // pasa del límite. Se lee con el nombre y el color de quien tira, en una consulta y sin esperar al disco: tirar va
  // con prisa, y si la base de datos cae justo entonces, se pierden las de ese momento (ADR-0010)
  const rows = await db.transaction(async (tx) => {
    await tx.execute(sql`set local synchronous_commit = off`)
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`dados:${roll.userId}`}, 0))`)
    const [recent] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(diceRolls)
      .where(and(eq(diceRolls.userId, roll.userId), sql`${diceRolls.createdAt} > now() - interval '1 minute'`))
    if ((recent?.count ?? 0) >= limit) return null
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
  // Ya tiró las del último minuto
  if (rows === null) return null
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
  // El cursor, de esta campaña (otro id no sirve: como si no se diera)
  const cursor = input.before
    ? (
        await db
          .select({ n: diceRolls.n })
          .from(diceRolls)
          .where(and(eq(diceRolls.id, input.before), eq(diceRolls.campaignId, input.campaignId)))
      )[0]?.n
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

/** Una tirada de una campaña, por su id (para aplicar su daño) */
export async function findRoll(db: Database, campaignId: string, rollId: string) {
  const [found] = await db
    .select(view)
    .from(diceRolls)
    .innerJoin(user, eq(user.id, diceRolls.userId))
    .where(and(eq(diceRolls.id, rollId), eq(diceRolls.campaignId, campaignId)))
  return found ?? null
}

/** Para el registro (docs/specs/registro.md): las que ve una cuenta, por la hora, de las más recientes hacia atrás */
export async function listRollsByTime(
  db: Database,
  input: { campaignId: string; viewerId: string; master: boolean; before?: Date | undefined; limit: number }
) {
  return db
    .select(view)
    .from(diceRolls)
    .innerJoin(user, eq(user.id, diceRolls.userId))
    .where(
      and(
        eq(diceRolls.campaignId, input.campaignId),
        input.before ? lt(diceRolls.createdAt, input.before) : undefined,
        input.master ? undefined : or(eq(diceRolls.visibility, 'all'), eq(diceRolls.userId, input.viewerId))
      )
    )
    .orderBy(desc(diceRolls.createdAt), desc(diceRolls.n))
    .limit(input.limit)
}

/** Borra tiradas de una campaña (las de ids, o todas); cuántas */
export async function deleteRolls(db: Database, campaignId: string, ids?: readonly string[]): Promise<number> {
  const rows = await db
    .delete(diceRolls)
    .where(and(eq(diceRolls.campaignId, campaignId), ids ? inArray(diceRolls.id, [...ids]) : undefined))
    .returning({ id: diceRolls.id })
  return rows.length
}
