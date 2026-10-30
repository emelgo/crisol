/**
 * Las versiones del texto de una página (ADR-0003): sacar una (al cerrar una sesión de edición, al escribir Claude) y
 * volver a una (deshacer, restaurar), siempre hacia delante: un editor abierto con lo de antes no lo puede deshacer
 */
import { createHash } from 'node:crypto'
import { documentsRepo, type OperationContext, pagesRepo, versionsRepo, worldsRepo } from '@crisol/db'
import type { JSONContent } from '@tiptap/core'
import * as Y from 'yjs'
import type { ActionEnv } from '../actions/context.ts'
import { documentJson, jsonOfDoc, writeDocument } from './content.ts'

type Kind = 'body' | 'secret' | 'note'

const sha256 = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex')

/** El contenido sin lo que cambia solo (los ids de bloque, la página de un enlace resuelto después) */
function canonical(node: JSONContent): unknown {
  const { id: _id, pageId: _pageId, ...attrs } = (node.attrs ?? {}) as Record<string, unknown>
  return {
    type: node.type,
    ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
    ...(node.text !== undefined ? { text: node.text } : {}),
    ...(node.marks ? { marks: node.marks } : {}),
    ...(node.content ? { content: node.content.map(canonical) } : {})
  }
}

/** La huella del contenido de una página: su cuerpo y sus secretos, en orden */
export function fingerprintOf(documents: readonly { documentId: string; kind: Kind; json: JSONContent }[]) {
  const ordered = [...documents].sort((a, b) =>
    a.kind === 'body' ? -1 : b.kind === 'body' ? 1 : a.documentId.localeCompare(b.documentId)
  )
  return sha256(
    JSON.stringify(ordered.map((doc) => [doc.kind, doc.kind === 'body' ? '' : doc.documentId, canonical(doc.json)]))
  )
}

/** El contenido de un estado de Yjs (el cuerpo, o un secreto) */
function contentOf(kind: Kind, state: Uint8Array) {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, state)
  const json = jsonOfDoc(doc, kind !== 'body')
  doc.destroy()
  return json
}

/** La versión de unos documentos recién hechos (al crear páginas): sus huellas y la de la página */
export function versionOf(documents: readonly { documentId: string; kind: Kind; state: Uint8Array }[]) {
  const states = documents.map((doc) => ({ ...doc, hash: sha256(doc.state), json: contentOf(doc.kind, doc.state) }))
  return { fingerprint: fingerprintOf(states), documents: states.map(({ json: _json, ...doc }) => doc) }
}

const refOf = (kind: Kind, pageId: string, documentId: string) =>
  kind === 'body' ? ({ kind: 'body', pageId } as const) : ({ kind: 'separate', documentId, pageId } as const)

/**
 * Cómo están ahora los documentos de una página. Lo vivo se guarda antes (fusionando), para que todos tengan su fila y
 * lo último
 */
export async function pageStates(env: ActionEnv, pageId: string, worldId: string, userId: string | null) {
  for (const doc of env.collab?.livePage(pageId) ?? []) {
    const update = Y.encodeStateAsUpdate(doc.document)
    const merge = (stored: Uint8Array | null) => (stored ? Y.mergeUpdates([stored, update]) : update)
    if (doc.kind === 'body') await documentsRepo.mergeBody(env.db, { pageId, worldId, userId }, merge)
    else await documentsRepo.mergeSeparate(env.db, doc.documentId, userId, merge)
  }
  return (await documentsRepo.documentsWithState(env.db, [pageId])).map((doc) => ({
    documentId: doc.id,
    kind: doc.kind,
    state: doc.state,
    hash: sha256(doc.state),
    json: documentJson(env, refOf(doc.kind, pageId, doc.id), doc.state)
  }))
}

/**
 * Apunta el texto de una página como está (al cerrar una sesión, al escribir Claude): una operación editPage con su
 * versión, más lo que cambie en la fila de la página. Si nada cambió, no se apunta nada
 */
export async function snapshotPage(
  env: ActionEnv,
  context: OperationContext,
  page: { pageId: string; worldId: string; via: 'ui' | 'ai' | 'system' },
  pagePatch?: { title?: string; icon?: string | null; properties?: unknown[] }
) {
  const states = await pageStates(env, page.pageId, page.worldId, context.actorId)
  return versionsRepo.recordEdit(env.db, context, {
    pageId: page.pageId,
    worldId: page.worldId,
    actorId: context.actorId,
    via: page.via,
    fingerprint: fingerprintOf(states),
    documents: states.map(({ json: _json, ...doc }) => doc),
    ...(pagePatch ? { pagePatch } : {})
  })
}

/**
 * Deja el texto de una página como en una versión, hacia delante (cambios de Yjs, como los de Claude): así un editor
 * abierto no lo vuelve atrás al reconectar. Sin versión, el cuerpo queda vacío
 */
export async function applyVersion(
  env: ActionEnv,
  page: { pageId: string; worldId: string; userId: string },
  versionId: string | null
) {
  const documents = versionId ? await versionsRepo.versionDocumentsOf(env.db, versionId) : []
  const body = documents.find((doc) => doc.kind === 'body')
  const place = { userId: page.userId, worldId: page.worldId }
  await writeDocument(env, { kind: 'body', pageId: page.pageId }, place, () =>
    body ? contentOf('body', body.state) : { type: 'doc', content: [{ type: 'paragraph' }] }
  )
  for (const doc of documents) {
    if (doc.kind === 'body') continue
    await writeDocument(env, refOf(doc.kind, page.pageId, doc.documentId), place, () => contentOf(doc.kind, doc.state))
  }
}

/** Una sesión de edición cerrada: su versión y su operación editPage, a nombre de quien escribió */
export async function closeSession(env: ActionEnv, session: { pageId: string; worldId: string; userId: string }) {
  const page = await pagesRepo.findPage(env.db, session.pageId)
  const world = await worldsRepo.findWorld(env.db, session.worldId)
  if (!page || !world) return
  await snapshotPage(
    env,
    {
      actorId: session.userId,
      via: 'ui',
      tool: null,
      action: 'editPage',
      details: { title: page.title },
      organizationId: world.organizationId,
      worldId: world.id
    },
    { pageId: session.pageId, worldId: session.worldId, via: 'ui' }
  )
}

/**
 * Al cargar el cuerpo de una página sin sesiones abiertas: si su texto no es el de su última versión (el servidor se
 * paró con una sesión a medias), se cierra a nombre de quien escribió el último. Una página que nunca tuvo texto, nada
 */
export async function recoverSession(env: ActionEnv, page: { pageId: string; worldId: string }) {
  const body = await documentsRepo.findBody(env.db, page.pageId)
  if (!body) return
  const [row] = await documentsRepo.lastWriter(env.db, page.pageId)
  if (!row?.updatedBy) return
  await closeSession(env, { ...page, userId: row.updatedBy })
}
