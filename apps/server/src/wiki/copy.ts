/**
 * Lo que hace falta para copiar una página (ADR-0024): sus documentos como están ahora (lo vivo, guardado antes), con
 * ids nuevos; el cuerpo, con sus secretos y notas apuntando a sus copias; y su primera versión. Lo usan «Duplicar»,
 * crear una plantilla copiando otra y crear una página desde una plantilla
 */
import { randomUUID } from 'node:crypto'
import { mapsRepo } from '@crisol/db'
import type { JSONContent } from '@tiptap/core'
import type { ActionContext } from '../actions/context.ts'
import { stateOf } from './content.ts'
import { pageStates, versionOf } from './versions.ts'

/** El cuerpo con sus secretos y notas apuntando a sus copias */
function withCopies(node: JSONContent, ids: ReadonlyMap<string, string>): JSONContent {
  const documentId = node.attrs?.documentId
  const next =
    typeof documentId === 'string' && ids.has(documentId)
      ? { ...node, attrs: { ...node.attrs, documentId: ids.get(documentId) } }
      : node
  return next.content ? { ...next, content: next.content.map((child) => withCopies(child, ids)) } : next
}

/** Los documentos de una página listos para su copia (copyRepo.copyPage) */
export async function copyDocuments(ctx: ActionContext, pageId: string, worldId: string) {
  const docs = await pageStates(ctx, pageId, worldId, ctx.actor.userId)
  // Las pestañas de texto que siguen ahí (un documento de una pestaña quitada no viaja)
  const live = new Set(
    (await mapsRepo.listTabs(ctx.db, pageId)).flatMap((tab) => (tab.documentId ? [tab.documentId] : []))
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
  const tabDocuments = new Map(
    docs
      .filter((doc) => doc.kind === 'tab' && live.has(doc.documentId))
      .map((doc) => [doc.documentId, { id: newId(doc.documentId), state: doc.state }])
  )
  return { body, separates, tabDocuments, ...(version ? { version } : {}) }
}
