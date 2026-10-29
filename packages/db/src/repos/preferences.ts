import { and, eq } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { wikiPreferences } from '../schema/wiki-preferences.ts'

type Tabs = (typeof wikiPreferences.$inferSelect)['tabs']
type Bookmarks = (typeof wikiPreferences.$inferSelect)['bookmarks']

/** Lo que la cuenta tiene a mano en la wiki de ese mundo (sin nada guardado aún, vacío) */
export async function findPreferences(db: Database, userId: string, worldId: string) {
  const [found] = await db
    .select({ tabs: wikiPreferences.tabs, bookmarks: wikiPreferences.bookmarks })
    .from(wikiPreferences)
    .where(and(eq(wikiPreferences.userId, userId), eq(wikiPreferences.worldId, worldId)))
  return found ?? { tabs: [], bookmarks: [] }
}

/** Guarda una parte (las pestañas o los marcadores) sin tocar la otra. No es una operación: no va al historial */
export async function savePreferences(
  db: Database,
  userId: string,
  worldId: string,
  patch: { tabs: Tabs } | { bookmarks: Bookmarks }
) {
  await db
    .insert(wikiPreferences)
    .values({ userId, worldId, ...patch })
    .onConflictDoUpdate({
      target: [wikiPreferences.userId, wikiPreferences.worldId],
      set: { ...patch, updatedAt: new Date() }
    })
}
