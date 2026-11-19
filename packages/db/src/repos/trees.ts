/**
 * Los árboles genealógicos y los organigramas de las pestañas: leerlos. Se escriben por operation() desde las acciones
 * (y nacen y se van con su pestaña, en maps.ts), con su historial
 */
import { and, eq, getTableColumns, inArray, isNull } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { pageTabs } from '../schema/maps.ts'
import { pages } from '../schema/pages.ts'
import { trees } from '../schema/trees.ts'

export type TreeRow = typeof trees.$inferSelect

/** El de una pestaña */
export async function treeOfTab(db: Database, tabId: string): Promise<TreeRow | null> {
  const [found] = await db.select().from(trees).where(eq(trees.tabId, tabId))
  return found ?? null
}

/**
 * Los de un mundo cuya página no está en la papelera, con su pestaña (para saber quién los ve): sus líneas entre
 * páginas son relaciones del grafo
 */
export function treesOfWorld(db: Database, worldId: string) {
  return db
    .select({ ...getTableColumns(trees), pageId: pageTabs.pageId, tabHidden: pageTabs.hidden })
    .from(trees)
    .innerJoin(pageTabs, eq(pageTabs.id, trees.tabId))
    .innerJoin(pages, and(eq(pages.id, pageTabs.pageId), isNull(pages.deletedAt)))
    .where(eq(trees.worldId, worldId))
}

/** Título, icono y plantilla de esas páginas del mundo que siguen fuera de la papelera (las de los nodos) */
export async function nodePages(db: Database, worldId: string, ids: readonly string[]) {
  if (ids.length === 0) return new Map<string, { title: string; icon: string | null; template: string | null }>()
  const rows = await db
    .select({ id: pages.id, title: pages.title, icon: pages.icon, template: pages.template })
    .from(pages)
    .where(and(eq(pages.worldId, worldId), isNull(pages.deletedAt), inArray(pages.id, [...new Set(ids)])))
  return new Map(rows.map((row) => [row.id, { title: row.title, icon: row.icon, template: row.template }]))
}
