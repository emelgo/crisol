/**
 * Las versiones del texto de una página (ADR-0003): la lista, ver una en solo lectura (con sus secretos: es el máster)
 * y restaurarla, que es un cambio nuevo hacia delante, con su entrada en el historial, y se puede deshacer
 */
import { getPageVersion, listPageVersions, restorePageVersion } from '@crisol/contracts'
import { versionsRepo } from '@crisol/db'
import { NotFoundError } from '@crisol/domain'
import type { JSONContent } from '@tiptap/core'
import * as Y from 'yjs'
import { jsonOfDoc } from '../wiki/content.ts'
import { linkName, worldNames } from '../wiki/links.ts'
import { applyVersion, snapshotPage } from '../wiki/versions.ts'
import { authorizedPage } from './access.ts'
import { historyContext } from './context.ts'
import { implement } from './registry.ts'

type VersionRow = Awaited<ReturnType<typeof versionsRepo.listVersions>>[number]

const view = (row: VersionRow, current: string | null) => ({
  id: row.id,
  at: row.createdAt.toISOString(),
  by: row.createdBy && row.authorName ? { id: row.createdBy, name: row.authorName } : null,
  via: row.via,
  current: row.id === current
})

const contentOf = (state: Uint8Array, nested: boolean) => {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, state)
  const json = jsonOfDoc(doc, nested)
  doc.destroy()
  return json
}

/** Los bloques de una versión: los secretos con lo suyo de esa versión, y los enlaces con el título de ahora */
function project(
  node: JSONContent,
  separates: ReadonlyMap<string, JSONContent[]>,
  linkTitle: (id: string) => string
): JSONContent {
  if (node.type === 'secret' || node.type === 'note') {
    return { ...node, content: separates.get(String(node.attrs?.documentId ?? '')) ?? [] }
  }
  if ((node.type === 'pageLink' || node.type === 'pageEmbed') && typeof node.attrs?.pageId === 'string') {
    return { ...node, attrs: { ...node.attrs, title: linkTitle(node.attrs.pageId) || node.attrs.title } }
  }
  return node.content ? { ...node, content: node.content.map((child) => project(child, separates, linkTitle)) } : node
}

export const versionActions = [
  implement(listPageVersions, async (ctx, { pageId }) => {
    await authorizedPage(ctx, 'page.read', pageId)
    const current = (await versionsRepo.pageBody(ctx.db, pageId))?.versionId ?? null
    return { versions: (await versionsRepo.listVersions(ctx.db, pageId)).map((row) => view(row, current)) }
  }),

  implement(getPageVersion, async (ctx, { pageId, versionId }) => {
    const { wiki } = await authorizedPage(ctx, 'page.read', pageId)
    const rows = await versionsRepo.listVersions(ctx.db, pageId)
    const row = rows.find((r) => r.id === versionId)
    if (!row) throw new NotFoundError('version')
    const current = (await versionsRepo.pageBody(ctx.db, pageId))?.versionId ?? null
    const documents = await versionsRepo.versionDocumentsOf(ctx.db, versionId)
    const body = documents.find((doc) => doc.kind === 'body')
    const separates = new Map(
      documents
        .filter((doc) => doc.kind !== 'body')
        .map((doc) => [doc.documentId, contentOf(doc.state, true).content ?? []])
    )
    const linkTitle = linkName(await worldNames(ctx, wiki.worldId))
    const blocks = (body ? (contentOf(body.state, false).content ?? []) : []).map((block) =>
      project(block, separates, linkTitle)
    )
    return { version: view(row, current), blocks: blocks as Record<string, unknown>[] }
  }),

  implement(restorePageVersion, async (ctx, { pageId, versionId }) => {
    const { page, wiki } = await authorizedPage(ctx, 'page.write', pageId)
    const version = await versionsRepo.findVersion(ctx.db, pageId, versionId)
    if (!version) throw new NotFoundError('version')
    // Lo que se estaba escribiendo queda antes en su sesión; luego, el texto de esa versión, hacia delante
    await ctx.collab?.closeSessions(page.id)
    await applyVersion(ctx, { pageId: page.id, worldId: wiki.worldId, userId: ctx.actor.userId }, versionId)
    const context = historyContext(
      ctx,
      'restoreVersion',
      { title: page.title, at: version.createdAt.toISOString() },
      wiki
    )
    const via = ctx.via === 'ai' ? 'ai' : 'ui'
    const recorded = await snapshotPage(ctx, context, { pageId: page.id, worldId: wiki.worldId, via })
    return { restored: recorded !== null }
  })
]
