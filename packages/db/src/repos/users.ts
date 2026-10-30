import { and, ne, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { user } from '../schema/auth.ts'

/** Si ya hay otra cuenta con ese nombre de usuario (sin distinguir mayúsculas); `except`, la propia al cambiarlo */
export async function isNameTaken(db: Database, name: string, except?: string) {
  const same = sql`lower(${user.name}) = lower(${name.trim()})`
  const [found] = await db
    .select({ id: user.id })
    .from(user)
    .where(except ? and(same, ne(user.id, except)) : same)
    .limit(1)
  return found !== undefined
}
