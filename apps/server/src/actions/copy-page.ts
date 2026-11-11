/**
 * Duplicar una página con todo lo suyo (ADR-0024): el servidor la copia entera en una sola operación (antes eran
 * cuatro pasos sueltos en el navegador que se dejaban la portada, la hoja y las pestañas). Sus documentos se copian
 * como están (lo vivo, guardado antes); el cuerpo, con los ids nuevos de sus secretos y notas
 */
import { randomUUID } from 'node:crypto'
import { copyPage } from '@crisol/contracts'
import { copyRepo, mapsRepo } from '@crisol/db'
import type { JSONContent } from '@tiptap/core'
import { pagesChanged } from '../realtime/events.ts'
import { stateOf } from '../wiki/content.ts'
import { linksOfNewPages } from '../wiki/links.ts'
import { knownBySomeone } from '../wiki/reader.ts'
import { pageStates, versionOf } from '../wiki/versions.ts'
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

/** El cuerpo con sus secretos y notas apuntando a sus copias */
function withCopies(node: JSONContent, ids: ReadonlyMap<string, string>): JSONContent {
  const documentId = node.attrs?.documentId
  const next =
    typeof documentId === 'string' && ids.has(documentId)
      ? { ...node, attrs: { ...node.attrs, documentId: ids.get(documentId) } }
      : node
  return next.content ? { ...next, content: next.content.map((child) => withCopies(child, ids)) } : next
}

export const copyPageActions = [
  implement(copyPage, async (ctx, { pageId, title }) => {
    const { page, wiki } = await authorizedPage(ctx, 'page.write', pageId)
    const docs = await pageStates(ctx, page.id, wiki.worldId, ctx.actor.userId)
    // Las pestañas de texto que siguen ahí (un documento de una pestaña quitada no viaja)
    const tabDocuments = new Set(
      (await mapsRepo.listTabs(ctx.db, page.id)).flatMap((tab) => (tab.documentId ? [tab.documentId] : []))
    )
    const ids = new Map(docs.map((doc) => [doc.documentId, randomUUID()]))
    const newId = (documentId: string) => ids.get(documentId) as string
    const separates = docs
      .filter((doc) => doc.kind === 'secret' || doc.kind === 'note')
      .map((doc) => ({ id: newId(doc.documentId), kind: doc.kind as 'secret' | 'note', state: doc.state }))
    const source = docs.find((doc) => doc.kind === 'body')
    const body = source ? { id: newId(source.documentId), state: stateOf(withCopies(source.json, ids)) } : null
    const version = body
      ? versionOf([
          { documentId: body.id, kind: 'body', state: body.state },
          ...separates.map((s) => ({ ...s, documentId: s.id }))
        ])
      : undefined
    // Bajo una página que alguna campaña conoce, nace oculta (como al crearla)
    const hidden = page.parentId ? await knownBySomeone(ctx, wiki.worldId, page.parentId) : false
    const name = title ?? copyTitle(page.title)
    const copy = await copyRepo.copyPage(
      ctx.db,
      historyContext(ctx, 'copyPage', { title: page.title, copy: name, ...(hidden ? { hidden } : {}) }, wiki),
      {
        sourceId: page.id,
        title: name,
        body,
        separates,
        tabDocuments: new Map(
          docs
            .filter((doc) => doc.kind === 'tab' && tabDocuments.has(doc.documentId))
            .map((doc) => [doc.documentId, { id: newId(doc.documentId), state: doc.state }])
        ),
        ...(version ? { version } : {}),
        hidden
      }
    )
    ctx.realtime.publish(pagesChanged(wiki))
    // Sus enlaces, sus archivos y su texto para buscar, como al crearla
    await linksOfNewPages(ctx, wiki.worldId, [{ id: copy.id, names: [copy.title] }], ctx.actor.userId)
    return pageView(ctx, copy.id)
  })
]
