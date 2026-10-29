import { getWikiPreferences, setBookmarks, setWikiTabs, type WikiPreferences } from '@crisol/contracts'
import { pagesRepo, preferencesRepo } from '@crisol/db'
import { authorizedWiki } from './access.ts'
import type { ActionContext } from './context.ts'
import { implement } from './registry.ts'

/**
 * Las preferencias de la cuenta con los títulos de ahora. Lo que ya no está en la wiki (borrado o en la papelera) no
 * sale: si vuelve, vuelve a salir
 */
async function preferencesView(ctx: ActionContext, worldId: string): Promise<WikiPreferences> {
  const stored = await preferencesRepo.findPreferences(ctx.db, ctx.actor.userId, worldId)
  const ids = [...stored.tabs.map((tab) => tab.pageId), ...stored.bookmarks.flatMap((group) => group.pages)]
  const titles = await pagesRepo.titlesOf(ctx.db, worldId, ids)
  return {
    tabs: stored.tabs.flatMap((tab) => {
      const title = titles.get(tab.pageId)
      return title === undefined ? [] : [{ ...tab, title }]
    }),
    bookmarks: stored.bookmarks.map((group) => ({
      name: group.name,
      pages: group.pages.flatMap((id) => {
        const title = titles.get(id)
        return title === undefined ? [] : [{ id, title }]
      })
    }))
  }
}

export const preferenceActions = [
  implement(getWikiPreferences, async (ctx, { worldId }) => {
    await authorizedWiki(ctx, 'page.read', worldId)
    return preferencesView(ctx, worldId)
  }),

  implement(setWikiTabs, async (ctx, { worldId, tabs }) => {
    await authorizedWiki(ctx, 'page.read', worldId)
    // Solo páginas de esta wiki, cada una una vez
    const known = await pagesRepo.titlesOf(
      ctx.db,
      worldId,
      tabs.map((tab) => tab.pageId)
    )
    const seen = new Set<string>()
    const kept = tabs.filter((tab) => known.has(tab.pageId) && !seen.has(tab.pageId) && seen.add(tab.pageId))
    await preferencesRepo.savePreferences(ctx.db, ctx.actor.userId, worldId, { tabs: kept })
    return preferencesView(ctx, worldId)
  }),

  implement(setBookmarks, async (ctx, { worldId, bookmarks }) => {
    await authorizedWiki(ctx, 'page.read', worldId)
    const known = await pagesRepo.titlesOf(
      ctx.db,
      worldId,
      bookmarks.flatMap((group) => group.pages)
    )
    const kept = bookmarks.map((group) => ({
      name: group.name,
      pages: [...new Set(group.pages)].filter((id) => known.has(id))
    }))
    await preferencesRepo.savePreferences(ctx.db, ctx.actor.userId, worldId, { bookmarks: kept })
    return preferencesView(ctx, worldId)
  })
]
