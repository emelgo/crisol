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

/** page:<id> es el cuerpo de esa página; null si el nombre no es de ningún documento */
export function parseDocumentName(name: string): { kind: 'body'; pageId: string } | null {
  const match = /^page:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.exec(name)
  return match?.[1] ? { kind: 'body', pageId: match[1] } : null
}

export const bodyName = (pageId: string) => `page:${pageId}`

export class DocumentTooLargeError extends Error {
  override name = 'DocumentTooLargeError'
}

export interface Collab {
  hocuspocus: Hocuspocus<CollabContext>
  /** Cierra las conexiones a los cuerpos de estas páginas (a la papelera): al reconectar, ya no se abren */
  closePages(pageIds: Iterable<string>): void
  /** Las de toda la wiki de un mundo (el mundo, a la papelera) */
  closeWorld(worldId: string): void
}

export function createCollab({ db, onError }: { db: Database; onError: (error: unknown) => void }): Collab {
  // De qué mundo es cada documento abierto, para cerrarlos todos si el mundo se va
  const worldOf = new Map<string, string>()

  const hocuspocus = new Hocuspocus<CollabContext>({
    quiet: true,
    debounce: 2000,
    maxDebounce: 10_000,

    // Cada documento, con la sesión de la conexión y las pertenencias de ahora. Sin escribir, en solo lectura
    async onAuthenticate({ documentName, context, connectionConfig }) {
      const target = parseDocumentName(documentName)
      const page = target ? await pagesRepo.findPage(db, target.pageId) : null
      const world = page ? await worldsRepo.findWorld(db, page.worldId) : null
      const wiki = { worldId: world?.id ?? '', organizationId: world?.organizationId ?? '' }
      const actor = actorFrom(context.userId, await loadMemberships(db, context.userId))
      authorize(actor, 'page.read', wiki)
      if (!page || !world) throw new NotFoundError('page')
      connectionConfig.readOnly = !can(actor, 'page.write', wiki)
      worldOf.set(documentName, world.id)
      return { pageId: page.id, worldId: world.id }
    },

    async onLoadDocument({ documentName, document }) {
      const target = parseDocumentName(documentName)
      const stored = target ? await documentsRepo.findBody(db, target.pageId) : null
      if (stored) Y.applyUpdate(document, stored.state)
    },

    async beforeHandleMessage({ update }) {
      if (update.byteLength > MAX_MESSAGE_BYTES) throw new DocumentTooLargeError('El mensaje es demasiado grande')
    },

    async onStoreDocument({ documentName, document, lastContext }) {
      const target = parseDocumentName(documentName)
      const worldId = worldOf.get(documentName) ?? lastContext?.worldId
      if (!target || !worldId) return
      const current = Y.encodeStateAsUpdate(document)
      try {
        await documentsRepo.mergeBody(
          db,
          { pageId: target.pageId, worldId, userId: lastContext?.userId ?? null },
          (stored) => {
            const merged = stored ? Y.mergeUpdates([stored, current]) : current
            if (merged.byteLength > MAX_STATE_BYTES) throw new DocumentTooLargeError(documentName)
            return merged
          }
        )
      } catch (error) {
        onError(error)
        // Lo que no cabe no se guarda: se cierra, y al volver se carga lo último guardado
        if (error instanceof DocumentTooLargeError) hocuspocus.closeConnections(documentName)
        else throw error
      }
    },

    async afterUnloadDocument({ documentName }) {
      worldOf.delete(documentName)
    }
  })

  return {
    hocuspocus,
    closePages(pageIds) {
      for (const pageId of pageIds) hocuspocus.closeConnections(bodyName(pageId))
    },
    closeWorld(worldId) {
      for (const [name, world] of worldOf) if (world === worldId) hocuspocus.closeConnections(name)
    }
  }
}
