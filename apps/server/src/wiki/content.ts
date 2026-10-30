/**
 * El contenido de las páginas fuera del editor: leer y escribir sus documentos de Yjs como JSON del esquema. Si el
 * documento está abierto en Hocuspocus, se lee el vivo y se escribe por una conexión directa: el cambio les llega al
 * momento a quienes lo tienen abierto y Yjs lo fusiona con lo que estén escribiendo (ADR-0003)
 */
import { documentsRepo } from '@crisol/db'
import { BODY_FIELD, editorSchema } from '@crisol/editor'
import type { JSONContent } from '@tiptap/core'
import type { Node as PMNode, Schema } from '@tiptap/pm/model'
import { prosemirrorJSONToYDoc, updateYFragment, yXmlFragmentToProseMirrorRootNode } from '@tiptap/y-tiptap'
import * as Y from 'yjs'
import { type ActionEnv, InvalidRequestError } from '../actions/context.ts'
import { bodyName, MAX_STATE_BYTES, separateName } from '../collab/server.ts'

/** El esquema del cuerpo, y el de dentro de un secreto (sin otros secretos) */
export const bodySchema = editorSchema()
export const nestedSchema = editorSchema({ nested: true })

/** Un documento de una página: el cuerpo o uno de sus secretos o notas ocultas */
export type DocumentRef = { kind: 'body'; pageId: string } | { kind: 'separate'; documentId: string; pageId: string }

const nameOf = (ref: DocumentRef) => (ref.kind === 'body' ? bodyName(ref.pageId) : separateName(ref.documentId))
const schemaOf = (ref: DocumentRef) => (ref.kind === 'body' ? bodySchema : nestedSchema)

/** Un JSON del esquema, comprobado: lo que no encaje (un nodo que no existe, un secreto dentro de otro) no entra */
function checked(json: JSONContent, schema: Schema): PMNode {
  try {
    const node = schema.nodeFromJSON(json)
    node.check()
    return node
  } catch {
    throw new InvalidRequestError('BAD_CONTENT')
  }
}

/** El JSON de un documento de Yjs; uno que aún no tiene nada (nadie escribió) es un cuerpo vacío */
function fragmentJson(doc: Y.Doc, schema: Schema): JSONContent {
  const fragment = doc.getXmlFragment(BODY_FIELD)
  if (fragment.length === 0) return { type: 'doc', content: [] }
  return yXmlFragmentToProseMirrorRootNode(fragment, schema).toJSON() as JSONContent
}

/** El JSON de un documento de Yjs ya cargado (el cuerpo o, nested, un secreto) */
export const jsonOfDoc = (doc: Y.Doc, nested: boolean) => fragmentJson(doc, nested ? nestedSchema : bodySchema)

/** El estado de Yjs de un documento nuevo con este contenido (comprobado y sin pasarse de tamaño) */
export function stateOf(json: JSONContent, nested = false): Uint8Array {
  const schema = nested ? nestedSchema : bodySchema
  const doc = prosemirrorJSONToYDoc(schema, checked(json, schema).toJSON(), BODY_FIELD)
  const state = Y.encodeStateAsUpdate(doc)
  doc.destroy()
  if (state.byteLength > MAX_STATE_BYTES) throw new InvalidRequestError('TOO_LARGE')
  return state
}

/** Lo que hay en un documento a partir de su estado guardado, salvo que esté abierto: entonces, el vivo */
export function documentJson(env: ActionEnv, ref: DocumentRef, stored: Uint8Array | null): JSONContent {
  const live = env.collab?.hocuspocus.documents.get(nameOf(ref))
  if (live) return fragmentJson(live, schemaOf(ref))
  const doc = new Y.Doc()
  if (stored) Y.applyUpdate(doc, stored)
  const json = fragmentJson(doc, schemaOf(ref))
  doc.destroy()
  return json
}

async function storedState(env: ActionEnv, ref: DocumentRef) {
  const stored =
    ref.kind === 'body'
      ? await documentsRepo.findBody(env.db, ref.pageId)
      : await documentsRepo.findSeparate(env.db, ref.documentId)
  return stored?.state ?? null
}

/** Lo que hay ahora en un documento: el vivo si está abierto; si no, el guardado */
export async function readDocument(env: ActionEnv, ref: DocumentRef): Promise<JSONContent> {
  const live = env.collab?.hocuspocus.documents.has(nameOf(ref))
  return documentJson(env, ref, live ? null : await storedState(env, ref))
}

/** Escribe la diferencia justa entre lo que hay y lo nuevo (así Yjs la fusiona con lo que escriban otros a la vez) */
function apply(doc: Y.Doc, schema: Schema, change: (current: JSONContent) => JSONContent) {
  const fragment = doc.getXmlFragment(BODY_FIELD)
  const next = checked(change(fragmentJson(doc, schema)), schema)
  // Antes de escribir: lo que no cabe ni se intenta
  stateOf(next.toJSON(), schema === nestedSchema)
  updateYFragment(doc, fragment, next, { mapping: new Map(), isOMark: new Map() })
}

/**
 * Cambia un documento. Por una conexión directa de Hocuspocus si hay servidor de edición en vivo (lo abre si hace
 * falta, y al soltarlo se guarda fusionando); si no, sobre lo guardado. highlight: los bloques que la web resalta un
 * instante (se piden tras el cambio, que es quien los sabe)
 */
export async function writeDocument(
  env: ActionEnv,
  ref: DocumentRef,
  place: { userId: string; worldId: string },
  change: (current: JSONContent) => JSONContent,
  highlight: () => readonly string[] = () => []
) {
  const schema = schemaOf(ref)
  if (env.collab) {
    const connection = await env.collab.hocuspocus.openDirectConnection(nameOf(ref), {
      userId: place.userId,
      pageId: ref.pageId,
      worldId: place.worldId
    })
    try {
      await connection.transact((document) => {
        apply(document, schema, change)
        const blocks = highlight()
        if (blocks.length > 0) document.broadcastStateless(JSON.stringify({ type: 'ai', blocks }))
      })
    } finally {
      await connection.disconnect()
    }
    return
  }
  const doc = new Y.Doc()
  const state = await storedState(env, ref)
  if (state) Y.applyUpdate(doc, state)
  apply(doc, schema, change)
  const update = Y.encodeStateAsUpdate(doc)
  doc.destroy()
  const merge = (stored: Uint8Array | null) => (stored ? Y.mergeUpdates([stored, update]) : update)
  if (ref.kind === 'body') {
    const page = { pageId: ref.pageId, worldId: place.worldId, userId: place.userId }
    await documentsRepo.mergeBody(env.db, page, merge)
  } else {
    await documentsRepo.mergeSeparate(env.db, ref.documentId, place.userId, merge)
  }
}
