/**
 * Los documentos de Yjs de la wiki, con Hocuspocus dentro del servidor (ADR-0003). Cada documento decide su permiso al
 * abrirse; guardar es fusionar con lo que ya hay, nunca pisarlo.
 */
import {
  type Database,
  documentsRepo,
  knowledgeRepo,
  loadMemberships,
  mapsRepo,
  pagesRepo,
  worldsRepo
} from '@crisol/db'
import { actorFrom, authorize, can, NotFoundError } from '@crisol/domain'
import { Hocuspocus } from '@hocuspocus/server'
import * as Y from 'yjs'
import { createSessions, type SessionTimes } from './sessions.ts'

/** Lo más que ocupa el estado de un documento, y un mensaje: lo que pase no se guarda */
export const MAX_STATE_BYTES = 4 * 1024 * 1024
export const MAX_MESSAGE_BYTES = 1024 * 1024

/** Lo que se sabe de quien está conectado: su cuenta y, al abrir un documento, de qué página y mundo es */
export interface CollabContext {
  userId: string
  pageId?: string
  worldId?: string
  /** Una conexión directa del servidor (Claude, deshacer, restaurar): no abre sesión de edición */
  server?: boolean
  /** Un jugador que escribe en una página de jugadores (docs/specs/pagina-de-jugadores.md) */
  player?: boolean
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
  /** Cierra las de los jugadores que escriben en esa página (cambió quién puede): al volver, se mira otra vez */
  closePlayers(pageId: string): void
  /** Las de toda la wiki de un mundo (el mundo, a la papelera) */
  closeWorld(worldId: string): void
  /** Las de un documento aparte (el de una pestaña de texto que se quita) */
  closeDocument(documentId: string): void
  /** Al parar el servidor: cierra todo y espera (hasta 5 s) a que se guarde lo pendiente */
  close(): Promise<void>
  /** Cierra las sesiones de edición abiertas de una página (antes de una operación del servidor sobre ella) */
  closeSessions(pageId: string): Promise<void>
  /** Los documentos abiertos de una página, para sacar su versión con lo último */
  livePage(pageId: string): { kind: 'body' | 'separate'; documentId: string; document: Y.Doc }[]
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
  onStored,
  onSessionClosed,
  onBodyLoaded,
  sessionTimes
}: {
  db: Database
  onError: (error: unknown) => void
  onStored?: (stored: StoredDocument) => Promise<void>
  /** Al cerrarse una sesión de edición: su versión y su operación */
  onSessionClosed?: (session: { pageId: string; worldId: string; userId: string }) => Promise<void>
  /** Al cargar el cuerpo de una página sin sesiones: por si quedó una abierta al pararse el servidor */
  onBodyLoaded?: (page: { pageId: string; worldId: string }) => Promise<void>
  sessionTimes?: SessionTimes
}): Collab {
  const sessions = createSessions(async (session) => onSessionClosed?.(session), onError, sessionTimes)
  // De qué página y mundo es cada documento abierto, para cerrarlos si se van a la papelera
  const opened = new Map<string, { pageId: string; worldId: string }>()
  /** De qué página es lo que se abre: la del cuerpo, o la del secreto o la nota oculta */
  const pageOf = async (target: Target) => {
    if (target.kind === 'body') return target.pageId
    const separate = await documentsRepo.findSeparate(db, target.documentId)
    // El de una pestaña de texto, solo mientras la pestaña exista (borrada, su documento queda para deshacer)
    if (separate?.kind === 'tab' && !(await mapsRepo.tabOfDocument(db, separate.id))) return null
    return separate?.pageId ?? null
  }

  // Al cerrar: ya no se recupera nada más, y lo que esté en marcha se espera
  let closing = false
  const recovering = new Set<Promise<void>>()

  const hocuspocus = new Hocuspocus<CollabContext>({
    quiet: true,
    debounce: 2000,
    maxDebounce: 10_000,

    // Cada documento, con la sesión de la conexión y las pertenencias de ahora. Sin escribir, en solo lectura. Es de
    // quien lleva la wiki (ADR-0017: los jugadores leen lo proyectado), salvo el cuerpo de una página que un jugador
    // puede escribir (docs/specs/pagina-de-jugadores.md), que no lleva secretos
    async onAuthenticate({ documentName, context, connectionConfig }) {
      const target = parseDocumentName(documentName)
      const pageId = target ? await pageOf(target) : null
      const page = pageId ? await pagesRepo.findPage(db, pageId) : null
      const world = page ? await worldsRepo.findWorld(db, page.worldId) : null
      const wiki = { worldId: world?.id ?? '', organizationId: world?.organizationId ?? '' }
      const actor = actorFrom(context.userId, await loadMemberships(db, context.userId))
      const editor =
        !can(actor, 'page.read', wiki) && target?.kind === 'body' && page
          ? await knowledgeRepo.canEditPage(db, context.userId, page.id)
          : false
      if (!editor) authorize(actor, 'page.read', wiki)
      if (!page || !world) throw new NotFoundError('page')
      connectionConfig.readOnly = !editor && !can(actor, 'page.write', wiki)
      opened.set(documentName, { pageId: page.id, worldId: world.id })
      return { pageId: page.id, worldId: world.id, ...(editor ? { player: true } : {}) }
    },

    async onLoadDocument({ documentName, document }) {
      const target = parseDocumentName(documentName)
      if (!target) return
      const stored =
        target.kind === 'body'
          ? await documentsRepo.findBody(db, target.pageId)
          : await documentsRepo.findSeparate(db, target.documentId)
      if (stored) Y.applyUpdate(document, stored.state)
      // El cuerpo, sin sesiones abiertas: si quedó una a medias al pararse el servidor, se cierra ahora
      const place = opened.get(documentName)
      if (target.kind === 'body' && place && onBodyLoaded && !sessions.isOpen(place.pageId) && !closing) {
        // Apuntada: al cerrar el servidor se espera (si no, escribiría en el historial con todo ya cerrado)
        const recovery = new Promise<void>((resolve) => setTimeout(resolve, 0))
          .then(() => onBodyLoaded({ pageId: place.pageId, worldId: place.worldId }))
          .catch(onError)
        recovering.add(recovery)
        void recovery.finally(() => recovering.delete(recovery))
      }
    },

    // Cada cambio de una cuenta (no del servidor) abre o alarga su sesión de edición en la página
    async onChange({ documentName, context }) {
      const place = opened.get(documentName)
      if (!place || !context?.userId || context.server) return
      sessions.touch(place.pageId, place.worldId, context.userId)
    },

    async connected({ documentName, context }) {
      const place = opened.get(documentName)
      if (place && context?.userId && !context.server) sessions.connected(place.pageId, context.userId)
    },

    // Al irse su última conexión a la página, la sesión de esa cuenta se cierra
    async onDisconnect({ documentName, context }) {
      const place = opened.get(documentName)
      if (place && context?.userId && !context.server) sessions.disconnected(place.pageId, context.userId)
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
    closeDocument(documentId) {
      hocuspocus.closeConnections(separateName(documentId))
    },
    closePages(pageIds) {
      const gone = new Set(pageIds)
      for (const [name, place] of opened) if (gone.has(place.pageId)) hocuspocus.closeConnections(name)
    },
    closePlayers(pageId) {
      for (const [name, place] of opened) {
        if (place.pageId !== pageId) continue
        for (const connection of hocuspocus.documents.get(name)?.getConnections() ?? [])
          if ((connection.context as CollabContext | undefined)?.player) connection.close()
      }
    },
    closeWorld(worldId) {
      for (const [name, place] of opened) if (place.worldId === worldId) hocuspocus.closeConnections(name)
    },
    closeSessions: (pageId) => sessions.closePage(pageId),
    livePage(pageId) {
      const live: { kind: 'body' | 'separate'; documentId: string; document: Y.Doc }[] = []
      for (const [name, place] of opened) {
        const document = hocuspocus.documents.get(name)
        const target = parseDocumentName(name)
        if (place.pageId !== pageId || !document || !target) continue
        live.push(
          target.kind === 'body'
            ? { kind: 'body', documentId: '', document }
            : { kind: 'separate', documentId: target.documentId, document }
        )
      }
      return live
    },
    async close() {
      closing = true
      // Las sesiones a medias que se estaban recuperando, y lo que se estaba escribiendo, quedan en su versión
      await Promise.all([...recovering])
      await sessions.closeAll()
      hocuspocus.closeConnections()
      hocuspocus.flushPendingStores()
      // Cada documento se descarga cuando ya está guardado
      const deadline = Date.now() + 5000
      while (hocuspocus.documents.size > 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      // Lo que cerrar las conexiones haya abierto todavía
      await Promise.all([...recovering])
      await sessions.closeAll()
    }
  }
}
