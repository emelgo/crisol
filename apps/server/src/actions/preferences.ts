import { getWikiPreferences, setBookmarks, setPageView, setWikiTabs, type WikiPreferences } from '@crisol/contracts'
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
    })),
    simplePages: stored.simplePages
  }
}

export const preferenceActions = [
  // La vista en que la cuenta lee una página con hoja (la de hoja, o la sencilla)
  implement(setPageView, async (ctx, { worldId, pageId, view }) => {
    await authorizedWiki(ctx, 'page.read', worldId)
    const known = await pagesRepo.titlesOf(ctx.db, worldId, [pageId])
    const stored = await preferencesRepo.findPreferences(ctx.db, ctx.actor.userId, worldId)
    const others = stored.simplePages.filter((id) => id !== pageId)
    // Solo las que siguen en la wiki, y no más de 500
    const simplePages = (view === 'simple' && known.has(pageId) ? [...others, pageId] : others).slice(-500)
    await preferencesRepo.savePreferences(ctx.db, ctx.actor.userId, worldId, { simplePages })
    return preferencesView(ctx, worldId)
  }),

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
