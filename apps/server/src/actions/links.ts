/**
 * Los enlaces de una página vistos desde la API (ADR-0003): quién la enlaza y desde dónde, adónde enlaza, dónde se la
 * nombra sin enlazarla (con «Enlazar» de un clic) y los enlaces sin resolver del mundo. Todo sale de page_links y del
 * texto plano de los documentos
 */
import { getPageLinks, linkMention, listUnresolvedLinks } from '@crisol/contracts'
import { documentsRepo, linksRepo, pagesRepo } from '@crisol/db'
import { foldName, NotFoundError } from '@crisol/domain'
import { findName, fragmentAround, plainText, textBlocks } from '@crisol/editor'
import type { JSONContent } from '@tiptap/core'
import { documentJson, readDocument, writeDocument } from '../wiki/content.ts'
import { worldNames } from '../wiki/links.ts'
import { viewedPage, visibleProperties } from '../wiki/projection.ts'
import { propertiesOf } from '../wiki/properties.ts'
import { searchScope } from '../wiki/reader.ts'
import { authorizedPage, authorizedWiki } from './access.ts'
import type { ActionContext } from './context.ts'
import { implement } from './registry.ts'

const refOf = (kind: string, pageId: string, documentId: string) =>
  kind === 'body' ? ({ kind: 'body', pageId } as const) : ({ kind: 'separate', documentId, pageId } as const)

/** El texto plano de los documentos del mundo que aún no lo tienen (los de antes de guardarlo) */
async function fillMissingText(ctx: ActionContext, worldId: string) {
  for (const doc of await documentsRepo.withoutText(ctx.db, worldId)) {
    await documentsRepo.setText(
      ctx.db,
      doc.id,
      plainText(documentJson(ctx, refOf(doc.kind, doc.pageId, doc.id), doc.state))
    )
  }
}

/** La primera vez que un texto nombra a una página (título o alias), como palabra entera */
function firstMention(text: string, names: readonly string[]) {
  let best: { index: number; name: string } | null = null
  for (const name of names) {
    const index = findName(text, name)
    if (index !== -1 && (!best || index < best.index)) best = { index, name }
  }
  return best
}

/** El documento con la primera mención (fuera de enlaces) cambiada por un enlace a la página */
function withLink(
  json: JSONContent,
  target: { id: string; title: string },
  names: readonly string[],
  done: { linked: boolean }
): JSONContent {
  if (done.linked || !json.content) return json
  const content: JSONContent[] = []
  for (const child of json.content) {
    if (done.linked || child.type !== 'text') {
      content.push(child.type === 'text' || child.type === 'pageLink' ? child : withLink(child, target, names, done))
      continue
    }
    const text = child.text ?? ''
    const found = firstMention(text, names)
    if (!found) {
      content.push(child)
      continue
    }
    const said = text.slice(found.index, found.index + found.name.trim().length)
    const marks = child.marks ? { marks: child.marks } : {}
    if (found.index > 0) content.push({ ...child, text: text.slice(0, found.index) })
    content.push({
      type: 'pageLink',
      attrs: {
        pageId: target.id,
        title: target.title,
        anchor: null,
        label: foldName(said) === foldName(target.title) ? null : said
      },
      ...marks
    })
    const rest = text.slice(found.index + said.length)
    if (rest) content.push({ ...child, text: rest })
    done.linked = true
  }
  return { ...json, content }
}

export const linkActions = [
  implement(getPageLinks, async (ctx, { pageId, ...as }) => {
    const { page, wiki, view } = await viewedPage(ctx, pageId, as)
    const names = await worldNames(ctx, wiki.worldId)
    const byId = new Map(names.map((named) => [named.id, named]))
    // Un jugador (ADR-0017): solo desde lo que ve (páginas, secretos y pestañas; nunca las notas), con su ruta visible
    const scope = await searchScope(ctx, wiki.worldId, view)
    const seenSeparates = new Set(scope?.separates ?? [])
    const seesDocument = (kind: string, pageOf: string, documentId: string) =>
      !scope || (view.seesPage(pageOf) && (kind === 'body' || seenSeparates.has(documentId)))
    const visiblePaths = scope ? await pagesRepo.pagePaths(ctx.db, [...(view.visiblePageIds() ?? [])]) : null
    const pathOf = (id: string) =>
      visiblePaths
        ? view
            .pages(visiblePaths.get(id) ?? [])
            .slice(0, -1)
            .map((step) => step.title)
        : (byId.get(id)?.path.slice(0, -1) ?? [])

    // Entrantes: un trozo por página (el del primer bloque que la enlaza), de su cuerpo o de un secreto
    const incoming: { pageId: string; title: string; path: string[]; fragment: string; inSecret: boolean }[] = []
    const linking = new Set<string>()
    for (const link of await linksRepo.incoming(ctx.db, page.id)) {
      if (link.sourcePageId === page.id || linking.has(link.sourcePageId)) continue
      if (!seesDocument(link.documentKind, link.sourcePageId, link.sourceDocumentId)) continue
      const json = await readDocument(ctx, refOf(link.documentKind, link.sourcePageId, link.sourceDocumentId))
      const block = textBlocks(json).find((b) => b.links.includes(page.id))
      linking.add(link.sourcePageId)
      incoming.push({
        pageId: link.sourcePageId,
        title: link.title,
        path: [...pathOf(link.sourcePageId)],
        fragment: fragmentAround(block?.text ?? '', 0),
        inSecret: link.documentKind === 'secret' || link.documentKind === 'note'
      })
    }

    // Salientes, una vez cada destino
    const seen = new Set<string>()
    const outgoing = (await linksRepo.outgoing(ctx.db, page.id)).flatMap((link) => {
      const key = link.targetPageId ?? `nombre:${foldName(link.targetTitle)}`
      if (seen.has(key)) return []
      // Un jugador: solo adonde puede ir
      if (scope && !(link.targetPageId && view.seesPage(link.targetPageId))) return []
      seen.add(key)
      const target = link.targetPageId ? byId.get(link.targetPageId) : undefined
      const state = !link.targetPageId ? 'missing' : target ? 'ok' : 'broken'
      return [
        { pageId: link.targetPageId, title: target?.title ?? link.targetTitle, anchor: link.anchor, state } as const
      ]
    })

    // Menciones sin enlazar: en páginas que no la enlazan, su título o un alias como palabra entera
    const own = byId.get(page.id)
    const ownNames = own ? [own.title, ...own.aliases] : [page.title]
    await fillMissingText(ctx, wiki.worldId)
    const mentions: typeof incoming = []
    const mentioned = new Set<string>()
    for (const doc of await documentsRepo.mentioning(ctx.db, wiki.worldId, ownNames)) {
      if (doc.pageId === page.id || linking.has(doc.pageId) || mentioned.has(doc.pageId)) continue
      if (!seesDocument(doc.kind, doc.pageId, doc.id)) continue
      const found = firstMention(doc.text ?? '', ownNames)
      if (!found) continue
      mentioned.add(doc.pageId)
      mentions.push({
        pageId: doc.pageId,
        title: byId.get(doc.pageId)?.title ?? '',
        path: [...pathOf(doc.pageId)],
        fragment: fragmentAround(doc.text ?? '', found.index, found.name.length),
        inSecret: doc.kind === 'secret' || doc.kind === 'note'
      })
    }
    // Las que la apuntan desde un campo de enlace, con el nombre de esos campos
    const fields = view
      .pages(await pagesRepo.pagesPointingTo(ctx.db, { worldId: wiki.worldId, pageId: page.id }))
      .map((other) => ({
        pageId: other.id,
        title: other.title,
        path: [...pathOf(other.id)],
        fields: visibleProperties(propertiesOf(other.properties), view).flatMap((property) =>
          property.type === 'pages' && property.value.includes(page.id) ? [property.name] : []
        )
      }))
      .filter((other) => other.fields.length > 0)
    return { incoming, outgoing, mentions, fields }
  }),

  implement(listUnresolvedLinks, async (ctx, { worldId }) => {
    const wiki = await authorizedWiki(ctx, 'page.read', worldId)
    const rows = await linksRepo.unresolvedInWorld(ctx.db, wiki.worldId)
    const titles = await pagesRepo.titlesOf(
      ctx.db,
      wiki.worldId,
      rows.flatMap((row) => row.pageIds)
    )
    return {
      links: rows
        .map((row) => ({
          title: row.title,
          count: row.count,
          pages: row.pageIds.flatMap((id) => (titles.has(id) ? [{ id, title: titles.get(id) as string }] : []))
        }))
        .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, 'es'))
    }
  }),

  implement(linkMention, async (ctx, { sourcePageId, targetPageId }) => {
    const { wiki } = await authorizedPage(ctx, 'page.write', sourcePageId)
    const { page: target, wiki: targetWiki } = await authorizedPage(ctx, 'page.read', targetPageId)
    if (targetWiki.worldId !== wiki.worldId) throw new NotFoundError('page')
    const named = (await worldNames(ctx, wiki.worldId)).find((page) => page.id === target.id)
    const names = named ? [named.title, ...named.aliases] : [target.title]
    // El cuerpo primero; si no, sus secretos
    const docs = (await documentsRepo.documentsOfPages(ctx.db, [sourcePageId])).sort((a, b) =>
      a.kind === 'body' ? -1 : b.kind === 'body' ? 1 : 0
    )
    for (const doc of docs) {
      const done = { linked: false }
      await writeDocument(
        ctx,
        refOf(doc.kind, sourcePageId, doc.id),
        { userId: ctx.actor.userId, worldId: wiki.worldId },
        (current) => withLink(current, { id: target.id, title: target.title }, names, done)
      )
      if (done.linked) return { linked: true }
    }
    return { linked: false }
  })
]
