/**
 * Los documentos de Yjs de la wiki, con Hocuspocus dentro del servidor (ADR-0003). Cada documento decide su permiso al
 * abrirse; guardar es fusionar con lo que ya hay, nunca pisarlo.
 */
import { type Database, documentsRepo, loadMemberships, pagesRepo, worldsRepo } from '@crisol/db'
import { actorFrom, authorize, can, NotFoundError } from '@crisol/domain'
import { Hocuspocus } from '@hocuspocus/server'
import * as Y from 'yjs'

/** Lo más que ocupa el estado de un documento, y un mensaje: lo que pase no se guarda */
export const MAX_STATE_BYTES = 4 * 1024 * 1024
export const MAX_MESSAGE_BYTES = 1024 * 1024

/** Lo que se sabe de quien está conectado: su cuenta y, al abrir un documento, de qué página y mundo es */
export interface CollabContext {
  userId: string
  pageId?: string
  worldId?: string
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
type Target = { kind: 'body'; pageId: string } | { kind: 'separate'; documentId: string }

/**
 * page:<id> es el cuerpo de esa página; doc:<id>, un secreto o una nota oculta (su propio documento); null si el nombre
 * no es de ningún documento
 */
export function parseDocumentName(name: string): Target | null {
  const body = new RegExp(`^page:(${UUID})$`).exec(name)
  if (body?.[1]) return { kind: 'body', pageId: body[1] }
  const separate = new RegExp(`^doc:(${UUID})$`).exec(name)
  return separate?.[1] ? { kind: 'separate', documentId: separate[1] } : null
}

export const bodyName = (pageId: string) => `page:${pageId}`
export const separateName = (documentId: string) => `doc:${documentId}`

export class DocumentTooLargeError extends Error {
  override name = 'DocumentTooLargeError'
}

export interface Collab {
  hocuspocus: Hocuspocus<CollabContext>
  /** Cierra las conexiones a los documentos de estas páginas (a la papelera): al reconectar, ya no se abren */
  closePages(pageIds: Iterable<string>): void
  /** Las de toda la wiki de un mundo (el mundo, a la papelera) */
  closeWorld(worldId: string): void
  /** Al parar el servidor: cierra todo y espera (hasta 5 s) a que se guarde lo pendiente */
  close(): Promise<void>
}

/** Lo guardado: de qué mundo, página y documento es, y el documento de Yjs (para rehacer sus enlaces) */
export interface StoredDocument {
  worldId: string
  pageId: string
  documentId: string
  kind: 'body' | 'separate'
  document: Y.Doc
  /** Quien escribió lo último */
  userId: string | null
}

export function createCollab({
  db,
  onError,
  onStored
}: {
  db: Database
  onError: (error: unknown) => void
  onStored?: (stored: StoredDocument) => Promise<void>
}): Collab {
  // De qué página y mundo es cada documento abierto, para cerrarlos si se van a la papelera
  const opened = new Map<string, { pageId: string; worldId: string }>()
  /** De qué página es lo que se abre: la del cuerpo, o la del secreto o la nota oculta */
  const pageOf = async (target: Target) => {
    if (target.kind === 'body') return target.pageId
    const separate = await documentsRepo.findSeparate(db, target.documentId)
    return separate?.pageId ?? null
  }

  const hocuspocus = new Hocuspocus<CollabContext>({
    quiet: true,
    debounce: 2000,
    maxDebounce: 10_000,

    // Cada documento, con la sesión de la conexión y las pertenencias de ahora. Sin escribir, en solo lectura. Un
    // secreto tiene su propio permiso: ahora, el de su página; en el módulo 5, el suyo
    async onAuthenticate({ documentName, context, connectionConfig }) {
      const target = parseDocumentName(documentName)
      const pageId = target ? await pageOf(target) : null
      const page = pageId ? await pagesRepo.findPage(db, pageId) : null
      const world = page ? await worldsRepo.findWorld(db, page.worldId) : null
      const wiki = { worldId: world?.id ?? '', organizationId: world?.organizationId ?? '' }
      const actor = actorFrom(context.userId, await loadMemberships(db, context.userId))
      authorize(actor, 'page.read', wiki)
      if (!page || !world) throw new NotFoundError('page')
      connectionConfig.readOnly = !can(actor, 'page.write', wiki)
      opened.set(documentName, { pageId: page.id, worldId: world.id })
      return { pageId: page.id, worldId: world.id }
    },

    async onLoadDocument({ documentName, document }) {
      const target = parseDocumentName(documentName)
      if (!target) return
      const stored =
        target.kind === 'body'
          ? await documentsRepo.findBody(db, target.pageId)
          : await documentsRepo.findSeparate(db, target.documentId)
      if (stored) Y.applyUpdate(document, stored.state)
    },

    async beforeHandleMessage({ update }) {
      if (update.byteLength > MAX_MESSAGE_BYTES) throw new DocumentTooLargeError('El mensaje es demasiado grande')
    },

    async onStoreDocument({ documentName, document, lastContext }) {
      const target = parseDocumentName(documentName)
      const place = opened.get(documentName) ?? lastContext
      if (!target || !place?.worldId || !place.pageId) return
      const current = Y.encodeStateAsUpdate(document)
      const merge = (stored: Uint8Array | null) => {
        const merged = stored ? Y.mergeUpdates([stored, current]) : current
        if (merged.byteLength > MAX_STATE_BYTES) throw new DocumentTooLargeError(documentName)
        return merged
      }
      const userId = lastContext?.userId ?? null
      try {
        if (target.kind === 'body') {
          await documentsRepo.mergeBody(db, { pageId: target.pageId, worldId: place.worldId, userId }, merge)
        } else {
          await documentsRepo.mergeSeparate(db, target.documentId, userId, merge)
        }
        const documentId =
          target.kind === 'body' ? (await documentsRepo.findBody(db, target.pageId))?.id : target.documentId
        if (documentId && onStored) {
          const stored = { worldId: place.worldId, pageId: place.pageId, documentId, document, userId }
          await onStored({ ...stored, kind: target.kind })
        }
      } catch (error) {
        onError(error)
        // Lo que no cabe no se guarda: se cierra, y al volver se carga lo último guardado
        if (error instanceof DocumentTooLargeError) hocuspocus.closeConnections(documentName)
        else throw error
      }
    },

    async afterUnloadDocument({ documentName }) {
      opened.delete(documentName)
    }
  })

  return {
    hocuspocus,
    closePages(pageIds) {
      const gone = new Set(pageIds)
      for (const [name, place] of opened) if (gone.has(place.pageId)) hocuspocus.closeConnections(name)
    },
    closeWorld(worldId) {
      for (const [name, place] of opened) if (place.worldId === worldId) hocuspocus.closeConnections(name)
    },
    async close() {
      hocuspocus.closeConnections()
      hocuspocus.flushPendingStores()
      // Cada documento se descarga cuando ya está guardado
      const deadline = Date.now() + 5000
      while (hocuspocus.documents.size > 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
    }
  }
}
