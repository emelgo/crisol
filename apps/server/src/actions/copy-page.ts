/**
 * Duplicar una página con todo lo suyo (ADR-0024): el servidor la copia entera en una sola operación (antes eran
 * cuatro pasos sueltos en el navegador que se dejaban la portada, la hoja y las pestañas). Sus documentos se copian
 * como están (lo vivo, guardado antes); el cuerpo, con los ids nuevos de sus secretos y notas
 */
import { copyPage } from '@crisol/contracts'
import { copyRepo } from '@crisol/db'
import { pagesChanged } from '../realtime/events.ts'
import { copyDocuments } from '../wiki/copy.ts'
import { linksOfNewPages } from '../wiki/links.ts'
import { knownBySomeone } from '../wiki/reader.ts'
import { authorizedPage } from './access.ts'
import { historyContext } from './context.ts'
import { pageView } from './pages.ts'
import { implement } from './registry.ts'

/** El título de la copia, sin pasarse del largo de un título */
const MAX_TITLE = 200
const copyTitle = (title: string) => {
  const suffix = ' (copia)'
  return `${title.slice(0, MAX_TITLE - suffix.length)}${suffix}`
}

export const copyPageActions = [
  implement(copyPage, async (ctx, { pageId, title }) => {
    const { page, wiki } = await authorizedPage(ctx, 'page.write', pageId)
    const documents = await copyDocuments(ctx, page.id, wiki.worldId)
    // Bajo una página que alguna campaña conoce, nace oculta (como al crearla)
    const hidden = page.parentId ? await knownBySomeone(ctx, wiki.worldId, page.parentId) : false
    const name = title ?? copyTitle(page.title)
    const copy = await copyRepo.copyPage(
      ctx.db,
      historyContext(ctx, 'copyPage', { title: page.title, copy: name, ...(hidden ? { hidden } : {}) }, wiki),
      { sourceId: page.id, title: name, ...documents, hidden }
    )
    ctx.realtime.publish(pagesChanged(wiki))
    // Sus enlaces, sus archivos y su texto para buscar, como al crearla
    await linksOfNewPages(ctx, wiki.worldId, [{ id: copy.id, names: [copy.title] }], ctx.actor.userId)
    return pageView(ctx, copy.id)
  })
]
