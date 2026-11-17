/**
 * El tiempo de una campaña (docs/specs/modulo-8-10-campana.md): su «hoy», y lo que cuelga de él. Se escribe por
 * operation(), con su historial: cambiar la fecha se deshace
 */
import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { type CampaignToday, campaigns } from '../schema/campaigns.ts'
import { worlds } from '../schema/worlds.ts'

export type { CampaignToday }

/** El «hoy» de una campaña (null si no tiene o no existe) */
export async function findToday(db: Database, campaignId: string): Promise<CampaignToday | null> {
  const [found] = await db.select({ today: campaigns.today }).from(campaigns).where(eq(campaigns.id, campaignId))
  return found?.today ?? null
}

/** Cambia el «hoy» de una campaña */
export function setToday(db: Database, context: OperationContext, campaignId: string, today: CampaignToday | null) {
  return operation(db, context, (w) => w.update(campaigns, campaignId, { today }))
}

/** Las campañas de un mundo (fuera de la papelera) que tienen «hoy», en el orden en que se crearon */
export function todaysOfWorld(db: Database, worldId: string) {
  return db
    .select({ id: campaigns.id, name: campaigns.name, today: campaigns.today })
    .from(campaigns)
    .innerJoin(worlds, eq(worlds.id, campaigns.worldId))
    .where(and(eq(campaigns.worldId, worldId), isNotNull(campaigns.today), isNull(campaigns.deletedAt)))
    .orderBy(asc(campaigns.createdAt), asc(campaigns.id))
}

/** Los «hoy» que usan un calendario (también los de la papelera: al volver tienen que caber) */
export async function todaysInCalendar(db: Database, calendarId: string) {
  const rows = await db
    .select({ today: campaigns.today })
    .from(campaigns)
    .where(sql`${campaigns.today}->>'calendarId' = ${calendarId}`)
  return rows.flatMap((row) => (row.today ? [row.today] : []))
}
